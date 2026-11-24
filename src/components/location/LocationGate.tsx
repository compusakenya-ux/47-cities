import { useState } from 'react';
import {
  AlertCircle,
  Compass,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Moon,
  Navigation,
  Radio,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { TEST_CITY_PINS } from '../../shared/kenya-data';
import { PROXIMITY_RADIUS_KM } from '../../shared/types';
import type { TestCityPin } from '../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BrandLogo } from '../brand/BrandLogo';

export function LocationGate() {
  const { user, activateUserLocation, logoutUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGpsActivate = () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(
        'Browser GPS is not available on this device. Use one of the Desktop / No-GPS Test City Pins below to enter immediately.'
      );
      return;
    }

    setActivatingId('gps');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await activateUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            cityLabel: 'Live GPS (10 km Zone)',
            source: 'gps',
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to activate location.');
        } finally {
          setActivatingId(null);
        }
      },
      (geoErr) => {
        setActivatingId(null);
        const reason =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Unable to acquire a GPS signal right now.';
        setError(
          `${reason} You can grant browser location permission or select a Kenyan Test City Pin below.`
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleTestPinActivate = async (pin: TestCityPin) => {
    setError(null);
    setActivatingId(pin.id);
    try {
      await activateUserLocation({
        lat: pin.lat,
        lng: pin.lng,
        cityLabel: pin.label,
        source: 'test-pin',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate test city pin.');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3">
        <BrandLogo
          size="md"
          subtitleExtra={user?.nickname ? `Signed in as ${user.nickname}` : null}
        />

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl surface-subtle surface-hover text-theme-secondary transition cursor-pointer"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-cyan-600" />}
          </button>
          <button
            type="button"
            onClick={() => void logoutUser()}
            className="inline-flex items-center gap-1.5 rounded-xl surface-subtle surface-hover px-3.5 py-2 text-xs font-bold text-rose-400 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Locked Gate Card */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center justify-center">
        <div className="glass-panel glow-ring w-full rounded-3xl p-5 sm:p-8 space-y-6 animate-slide-up">
          {/* Top Radar Hero */}
          <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
            {/* Animated 10 km Proximity Radar Graphic */}
            <div className="relative flex h-44 w-44 sm:h-52 sm:w-52 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-cyan-400/25" />
              <span className="absolute inset-5 rounded-full border border-amber-400/30" />
              <span className="absolute inset-10 rounded-full border border-emerald-400/35" />
              <span className="absolute h-20 w-20 rounded-full border-2 border-cyan-400/60 animate-pulse-radar" />
              <span
                className="absolute h-20 w-20 rounded-full border-2 border-amber-400/50 animate-pulse-radar"
                style={{ animationDelay: '1.1s' }}
              />
              <div className="relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-gradient-to-br from-amber-500 via-rose-500 to-cyan-500 text-slate-950 shadow-xl">
                <Radio className="h-6 w-6" />
                <span className="font-display text-[10px] font-extrabold leading-none mt-0.5">
                  {PROXIMITY_RADIUS_KM} KM
                </span>
              </div>
            </div>

            {/* Gate Explanation & Primary GPS CTA */}
            <div className="flex-1 space-y-4 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/12 px-3 py-1 text-xs font-bold text-rose-400">
                <Lock className="h-3.5 w-3.5" />
                Portal Locked — Location Required
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-theme-primary leading-tight">
                Turn on your location to unlock{' '}
                <span className="gradient-text">47 Cities</span>
              </h1>

              <p className="text-sm text-theme-secondary leading-relaxed">
                Member profiles, online/offline lists, the public Blackboard, Stories, Multi-Chat,
                and AI Matches stay completely locked until your live {PROXIMITY_RADIUS_KM} km
                proximity zone is active.
              </p>

              {/* Privacy Guarantee Badge */}
              <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 flex items-start gap-3 text-left">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-emerald-400">10 km Privacy Guarantee</p>
                  <p className="text-theme-secondary mt-0.5">
                    Exact location is <strong>NEVER</strong> shown to anyone — only that you are
                    within {PROXIMITY_RADIUS_KM} km. Turn location OFF anytime to instantly pause
                    visibility.
                  </p>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/12 px-4 py-3 text-xs text-rose-400 text-left"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGpsActivate}
                disabled={activatingId !== null}
                data-testid="activate-gps-btn"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-xl transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
              >
                {activatingId === 'gps' ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    Acquiring GPS Proximity...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4.5 w-4.5" />
                    Turn On Live Location (GPS)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Secondary Panel: Desktop / No-GPS Test City Pins */}
          <div className="border-t border-theme pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-cyan-400" />
                <h2 className="font-display text-sm font-bold text-theme-primary">
                  Desktop / No-GPS Test City Pin
                </h2>
              </div>
              <span className="text-xs text-theme-muted">
                No GPS hardware? Pick a Kenyan city hub to activate your 10 km zone:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEST_CITY_PINS.map((pin) => {
                const isLoading = activatingId === pin.id;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    disabled={activatingId !== null}
                    onClick={() => void handleTestPinActivate(pin)}
                    data-testid={`city-pin-${pin.id}`}
                    className="group rounded-2xl surface-subtle surface-hover p-3.5 text-left transition border border-theme hover:border-amber-500/45 disabled:opacity-50 cursor-pointer flex items-start gap-3"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-amber-500/20 group-hover:text-amber-400 transition">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-theme-primary truncate">{pin.label}</p>
                      <p className="text-[11px] text-amber-400 font-semibold">{pin.county} County</p>
                      <p className="text-[11px] text-theme-muted mt-1 line-clamp-2">
                        {pin.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
