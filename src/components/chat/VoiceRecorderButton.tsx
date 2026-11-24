import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Sparkles, Square, X } from 'lucide-react';

interface VoiceRecorderButtonProps {
  disabled?: boolean;
  onSendVoice: (
    payload: FormData | { audioDataUrl: string; durationSec: number }
  ) => Promise<void>;
}

const MAX_RECORDING_SECONDS = 120;

/**
 * Formats seconds as mm:ss.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Synthesizes a valid, pleasant 2-second PCM WAV chime entirely in-browser
 * so voice notes can always be sent & played back even on devices/browsers without a mic.
 */
function createDemoVoiceNoteDataUrl(durationSec = 2): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Warm Kenyan marimba-inspired three-note arpeggio (C5 -> E5 -> G5)
  const notes = [523.25, 659.25, 783.99];
  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const noteIndex = Math.min(notes.length - 1, Math.floor((t / durationSec) * notes.length));
    const freq = notes[noteIndex];
    const localT = t - (noteIndex * durationSec) / notes.length;
    const envelope = Math.min(1, localT * 24) * Math.exp(-localT * 3.4);
    const fadeOut = Math.min(1, (durationSec - t) * 14);
    const sample =
      (Math.sin(2 * Math.PI * freq * t) * 0.65 +
        Math.sin(2 * Math.PI * (freq * 2) * t) * 0.2) *
      envelope *
      fadeOut;
    const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 18000)));
    view.setInt16(44 + i * 2, int16, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function VoiceRecorderButton({
  disabled,
  onSendVoice,
}: VoiceRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [sending, setSending] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const actionRef = useRef<'send' | 'cancel'>('cancel');

  const cleanupMedia = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => {
    return () => {
      actionRef.current = 'cancel';
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore cleanup stop errors
        }
      }
      cleanupMedia();
    };
  }, []);

  const startRecording = async () => {
    if (disabled || sending || recording) return;
    setFallbackReason(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setFallbackReason('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      actionRef.current = 'cancel';

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mode = actionRef.current;
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        );
        const blobType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        cleanupMedia();
        setRecording(false);
        setElapsedSec(0);

        if (mode === 'send' && blob.size > 0) {
          setSending(true);
          try {
            const ext = blobType.includes('mp4')
              ? 'm4a'
              : blobType.includes('ogg')
                ? 'ogg'
                : 'webm';
            const formData = new FormData();
            formData.append('audio', blob, `voice-note-${Date.now()}.${ext}`);
            formData.append('durationSec', String(durationSec));
            await onSendVoice(formData);
          } catch {
            // Parent ChatWindow displays send error cleanly
          } finally {
            setSending(false);
          }
        }
      };

      recorder.start(250);
      setRecording(true);
      setElapsedSec(0);

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsedSec(secs);
        if (secs >= MAX_RECORDING_SECONDS) {
          actionRef.current = 'send';
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
        }
      }, 250);
    } catch (err) {
      cleanupMedia();
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setFallbackReason('Microphone permission blocked — use Quick Demo Voice Note instead.');
      } else {
        setFallbackReason('No active microphone detected — send a 2s demo voice note instead.');
      }
    }
  };

  const cancelRecording = () => {
    actionRef.current = 'cancel';
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      cleanupMedia();
      setRecording(false);
      setElapsedSec(0);
    }
  };

  const stopAndSendRecording = () => {
    actionRef.current = 'send';
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const sendDemoVoiceNote = async () => {
    if (sending || disabled) return;
    setSending(true);
    try {
      const audioDataUrl = createDemoVoiceNoteDataUrl(2);
      await onSendVoice({ audioDataUrl, durationSec: 2 });
      setFallbackReason(null);
    } catch {
      // Handled by parent error banner
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shrink-0">
      {/* Live recording floating HUD above composer */}
      {recording && (
        <div
          role="status"
          aria-live="polite"
          className="glass-panel animate-slide-up absolute bottom-full left-2 right-2 z-30 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-rose-500/40 px-3 py-2 shadow-xl"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <span className="truncate text-xs font-semibold text-[var(--maasai-coral)]">
              Recording
            </span>
            <span className="font-mono text-xs font-bold text-theme-primary">
              {formatDuration(elapsedSec)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={cancelRecording}
              aria-label="Cancel voice recording"
              className="flex h-7 items-center gap-1 rounded-lg border border-theme surface-subtle px-2 text-[11px] font-semibold text-theme-secondary hover:text-rose-400 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              aria-label="Send voice note"
              className="flex h-7 items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 px-2.5 text-[11px] font-bold text-white shadow hover:brightness-110 cursor-pointer"
            >
              <Send className="h-3 w-3" />
              Send
            </button>
          </div>
        </div>
      )}

      {/* Graceful Mic Fallback HUD */}
      {fallbackReason && !recording && (
        <div
          role="alert"
          className="glass-panel animate-slide-up absolute bottom-full left-2 right-2 z-30 mb-2 rounded-2xl border border-amber-500/35 p-2.5 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <MicOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--savannah-gold)]" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-theme-primary leading-snug">
                  {fallbackReason}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={sending || disabled}
                    onClick={sendDemoVoiceNote}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    {sending ? 'Sending...' : 'Send Quick Demo Voice Note (2s)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFallbackReason(null)}
                    className="rounded-lg border border-theme surface-subtle px-2 py-1 text-[11px] font-medium text-theme-muted hover:text-theme-primary cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFallbackReason(null)}
              aria-label="Close microphone notice"
              className="shrink-0 rounded-lg p-1 text-theme-muted hover:text-theme-primary cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mic Toggle Button */}
      <button
        type="button"
        disabled={disabled || sending}
        onClick={recording ? stopAndSendRecording : startRecording}
        aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}
        title={recording ? 'Stop & send voice note' : 'Record voice note'}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
          recording
            ? 'border-rose-500/60 bg-rose-500/20 text-[var(--maasai-coral)] animate-pulse'
            : fallbackReason
              ? 'border-amber-500/50 bg-amber-500/15 text-[var(--savannah-gold)]'
              : 'border-theme surface-subtle text-theme-secondary hover:text-[var(--rift-cyan)] hover:border-cyan-500/40'
        }`}
      >
        {recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
      </button>
    </div>
  );
}
