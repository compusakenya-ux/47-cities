import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSignature,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AGE_RANGES,
  GENDERS,
  HATE_WITH_PASSION_OPTIONS,
  INTERESTED_IN_OPTIONS,
  KENYA_COUNTIES,
  LOOKING_FOR_OPTIONS,
  makeAvatarSvg,
} from '../../shared/kenya-data';
import type {
  AgeRange,
  Gender,
  HateWithPassionOption,
  InterestedIn,
  LookingForOption,
} from '../../shared/types';
import { PROXIMITY_RADIUS_KM } from '../../shared/types';
import { useAuth } from '../../context/AuthContext';

const AVATAR_PALETTES: ReadonlyArray<[string, string]> = [
  ['#F59E0B', '#F43F5E'],
  ['#06B6D4', '#10B981'],
  ['#8B5CF6', '#EC4899'],
  ['#0EA5E9', '#2563EB'],
  ['#10B981', '#F59E0B'],
];

export function ProfileView() {
  const { user, updateUserProfile, uploadUserAvatar } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'Woman');
  const [ageRange, setAgeRange] = useState<AgeRange>(user?.ageRange ?? '26-29');
  const [hasChildren, setHasChildren] = useState<boolean>(user?.hasChildren ?? false);
  const [homeCounty, setHomeCounty] = useState<string>(user?.homeCounty ?? 'Nairobi');
  const [interestedIn, setInterestedIn] = useState<InterestedIn>(user?.interestedIn ?? 'Both');
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>(
    user?.lookingFor ?? ['Soulmate']
  );
  const [hateWithPassion, setHateWithPassion] = useState<HateWithPassionOption[]>(
    user?.hateWithPassion ?? ['Liar']
  );
  const [bio, setBio] = useState(user?.bio ?? '');

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  if (!user) return null;

  const toggleLookingFor = (item: LookingForOption) => {
    setLookingFor((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const toggleHate = (item: HateWithPassionOption) => {
    setHateWithPassion((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Avatar photo must be 2 MB or smaller.' });
      return;
    }
    setUploadingAvatar(true);
    setFeedback(null);
    try {
      await uploadUserAvatar(file);
      setFeedback({ type: 'success', text: 'Profile photo updated!' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to upload avatar.',
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCycleAvatarSvg = async () => {
    setUploadingAvatar(true);
    setFeedback(null);
    try {
      const palette = AVATAR_PALETTES[Math.floor(Math.random() * AVATAR_PALETTES.length)];
      const initials = (nickname.trim() || user.nickname).slice(0, 2).toUpperCase();
      const svgUri = makeAvatarSvg(initials, palette[0], palette[1]);
      await uploadUserAvatar(svgUri);
      setFeedback({ type: 'success', text: 'Generated a fresh Afro-Futuristic badge avatar!' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update avatar.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (lookingFor.length === 0) {
      setFeedback({ type: 'error', text: 'Please keep at least one "Looking For" selection.' });
      return;
    }
    if (hateWithPassion.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Please keep at least one "Hate With Passion" selection.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        nickname: nickname.trim(),
        gender,
        ageRange,
        hasChildren,
        homeCounty,
        interestedIn,
        lookingFor,
        hateWithPassion,
        bio: bio.trim(),
      });
      setFeedback({
        type: 'success',
        text: 'Profile saved! Your AI compatibility & 10 km radar preferences are updated.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header Banner */}
      <div className="glass-card p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative shrink-0">
          <div className="story-ring">
            <img
              src={user.avatarUrl}
              alt={user.nickname}
              className="h-20 w-20 rounded-full object-cover bg-[var(--bg-secondary)]"
            />
          </div>
          <button
            type="button"
            disabled={uploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
            title="Upload custom profile photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-lg hover:brightness-110 transition cursor-pointer"
          >
            {uploadingAvatar ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handleAvatarFileChange(e)}
            className="hidden"
          />
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <h2 className="font-display text-2xl font-extrabold text-theme-primary truncate">
            {user.nickname}
          </h2>
          <p className="text-xs text-theme-muted mt-0.5 truncate">{user.email}</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl surface-subtle surface-hover px-3 py-1.5 text-xs font-bold text-theme-primary transition cursor-pointer"
            >
              Upload Custom Photo
            </button>
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => void handleCycleAvatarSvg()}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/12 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New Glow Avatar
            </button>
          </div>
        </div>
      </div>

      {/* ======================== PRIVACY SHIELD COMPARISON ======================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Publicly Visible Card */}
        <div className="glass-card p-4 border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              <Eye className="h-4 w-4" />
              What Nearby Members See
            </span>
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Public ONLY
            </span>
          </div>

          <div className="rounded-2xl surface-subtle p-3.5 flex items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={user.nickname}
              className="h-12 w-12 rounded-full object-cover border border-emerald-400/50 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-theme-primary truncate">{user.nickname}</p>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-theme-secondary">
                {user.gender} • {user.ageRange}
              </p>
              <p className="text-[11px] text-cyan-400 font-semibold mt-0.5">
                Within {PROXIMITY_RADIUS_KM} km • Online
              </p>
            </div>
          </div>

          <p className="text-[11px] text-theme-muted leading-relaxed">
            Other verified singles inside {PROXIMITY_RADIUS_KM} km see <strong>ONLY</strong> your
            Photo, Nickname, Gender, Age Range, and Online status.
          </p>
        </div>

        {/* Hidden Private Vault Card */}
        <div className="glass-card p-4 border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-400">
              <EyeOff className="h-4 w-4" />
              Hidden Private Profile
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              <Lock className="h-2.5 w-2.5" />
              Used Only by AI
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="min-w-0">
              <dt className="text-[10px] uppercase text-theme-muted">Email</dt>
              <dd className="font-semibold text-theme-primary truncate">{user.email}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] uppercase text-theme-muted">Home County</dt>
              <dd className="font-semibold text-theme-primary truncate">{user.homeCounty}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-theme-muted">Child(ren)</dt>
              <dd className="font-semibold text-theme-primary">{user.hasChildren ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-theme-muted">Interested In</dt>
              <dd className="font-semibold text-theme-primary">{user.interestedIn}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase text-theme-muted">Looking For</dt>
              <dd className="font-semibold text-emerald-400">{user.lookingFor.join(', ')}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase text-theme-muted">Hate With Passion</dt>
              <dd className="font-semibold text-rose-400">{user.hateWithPassion.join(', ')}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Signed 18+ Disclaimer Record */}
      <section className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-cyan-500/30">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FileSignature className="h-4.5 w-4.5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-theme-primary flex items-center gap-1.5">
              18+ Community Responsibility Disclaimer Signed
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </p>
            <p className="text-theme-muted mt-0.5">
              Digital Signature:{' '}
              <span className="font-semibold text-theme-primary">
                {user.disclaimerSignature || user.nickname}
              </span>
              {user.disclaimerSignedAt && (
                <>
                  {' '}
                  • Signed on{' '}
                  {new Date(user.disclaimerSignedAt).toLocaleDateString([], {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ======================== EDITABLE PROFILE FORM ======================== */}
      <form onSubmit={handleSave} className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-theme-primary">
            Update Your Profile &amp; AI Preferences
          </h3>
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold border ${
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-400'
                : 'border-rose-500/40 bg-rose-500/12 text-rose-400'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label htmlFor="profile-nickname" className="block text-xs font-semibold text-theme-secondary">
              User Name / App Name (Nickname)
            </label>
            <input
              id="profile-nickname"
              type="text"
              required
              minLength={2}
              maxLength={28}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-county" className="block text-xs font-semibold text-theme-secondary">
              Home County (Hidden — AI Only)
            </label>
            <select
              id="profile-county"
              value={homeCounty}
              onChange={(e) => setHomeCounty(e.target.value)}
              className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            >
              {KENYA_COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <span className="block text-xs font-semibold text-theme-secondary">Gender</span>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold border transition cursor-pointer ${
                    gender === g
                      ? 'border-amber-400 bg-amber-500/20 text-amber-400'
                      : 'border-theme surface-subtle text-theme-secondary surface-hover'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-xs font-semibold text-theme-secondary">
              Child(ren) (Hidden)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'No', value: false },
                { label: 'Yes', value: true },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setHasChildren(opt.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold border transition cursor-pointer ${
                    hasChildren === opt.value
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400'
                      : 'border-theme surface-subtle text-theme-secondary surface-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-theme-secondary">Age Range</span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {AGE_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setAgeRange(range)}
                className={`rounded-xl px-2 py-2 text-xs font-bold border transition cursor-pointer ${
                  ageRange === range
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400'
                    : 'border-theme surface-subtle text-theme-secondary surface-hover'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-theme-secondary">
            Interested In (10 km Radar Filter)
          </span>
          <div className="grid grid-cols-3 gap-2">
            {INTERESTED_IN_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setInterestedIn(opt)}
                className={`rounded-xl px-3 py-2 text-xs font-bold border transition cursor-pointer ${
                  interestedIn === opt
                    ? 'border-rose-400 bg-rose-500/20 text-rose-400'
                    : 'border-theme surface-subtle text-theme-secondary surface-hover'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-theme-secondary">
            Looking For (Hidden — AI Only)
          </span>
          <div className="flex flex-wrap gap-2">
            {LOOKING_FOR_OPTIONS.map((item) => {
              const selected = lookingFor.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleLookingFor(item)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    selected
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-400'
                      : 'border-theme surface-subtle text-theme-secondary surface-hover'
                  }`}
                >
                  {selected ? '✓ ' : '+ '}
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-theme-secondary">
            Hate With Passion (Hidden — AI Only)
          </span>
          <div className="flex flex-wrap gap-2">
            {HATE_WITH_PASSION_OPTIONS.map((item) => {
              const selected = hateWithPassion.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleHate(item)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    selected
                      ? 'border-rose-400 bg-rose-500/20 text-rose-400'
                      : 'border-theme surface-subtle text-theme-secondary surface-hover'
                  }`}
                >
                  {selected ? '✕ ' : '+ '}
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="profile-bio" className="block text-xs font-semibold text-theme-secondary">
            Private AI Vibe Bio
          </label>
          <textarea
            id="profile-bio"
            rows={2}
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share your favorite city spots, music, sports, or weekend rituals..."
            className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-500/60"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
        </button>
      </form>
    </div>
  );
}
