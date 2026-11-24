import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Radio,
  ShieldCheck,
  Sparkles,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AGE_RANGES,
  GENDERS,
  HATE_WITH_PASSION_OPTIONS,
  INTERESTED_IN_OPTIONS,
  KENYA_COUNTIES,
  LOOKING_FOR_OPTIONS,
  PRIVACY_DISCLAIMER_TEXT,
} from '../../shared/kenya-data';
import type {
  AgeRange,
  Gender,
  HateWithPassionOption,
  InterestedIn,
  LookingForOption,
} from '../../shared/types';
import {
  ApiError,
  forgotPassword,
  register,
  resendCode,
  resetPassword,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DevInboxModal } from './DevInboxModal';
import { BrandLogo } from '../brand/BrandLogo';

type AuthMode = 'login' | 'register' | 'verify' | 'reset';

export function AuthScreen() {
  const { loginUser, verifyEmailCode } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>('login');
  const [devInboxOpen, setDevInboxOpen] = useState(false);

  // Global feedback banners
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state (strictly email-only + all mandatory Kenyan profile fields)
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [nickname, setNickname] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange>('26-29');
  const [gender, setGender] = useState<Gender>('Woman');
  const [hasChildren, setHasChildren] = useState<boolean>(false);
  const [homeCounty, setHomeCounty] = useState<string>('Nairobi');
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>(['Soulmate', 'Hangout']);
  const [hateWithPassion, setHateWithPassion] = useState<HateWithPassionOption[]>(['Liar']);
  const [interestedIn, setInterestedIn] = useState<InterestedIn>('Both');
  const [bio, setBio] = useState('');

  // Mandatory 18+ Privacy Disclaimer state
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);
  const [signature, setSignature] = useState('');

  // Verify Email state
  const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  // Reset Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

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

  const disclaimerReady =
    confirmedAdult && acceptedResponsibility && signature.trim().length >= 2;

  const canSubmitRegister =
    regEmail.trim().includes('@') &&
    regPassword.length >= 6 &&
    nickname.trim().length >= 2 &&
    lookingFor.length >= 1 &&
    hateWithPassion.length >= 1 &&
    disclaimerReady &&
    !submitting;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await loginUser({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        const emailAddr = loginEmail.trim().toLowerCase();
        setVerifyEmailAddr(emailAddr);
        setMode('verify');
        setNotice(
          'Your email is not verified yet. Enter your 6-digit code or open the Dev Verification Inbox.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemoAccount = () => {
    setLoginEmail('demo@47cities.ke');
    setLoginPassword('Kenya2026!');
    setError(null);
    setNotice('Demo credentials filled! Click "Sign In with Email" to enter.');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!disclaimerReady) {
      setError(
        'You must confirm you are above 18, accept full responsibility, and sign the Privacy Disclaimer before registering.'
      );
      return;
    }
    if (lookingFor.length === 0) {
      setError('Select at least one "Looking For" preference.');
      return;
    }
    if (hateWithPassion.length === 0) {
      setError('Select at least one "Hate With Passion" option.');
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmail = regEmail.trim().toLowerCase();
      await register({
        email: normalizedEmail,
        password: regPassword,
        nickname: nickname.trim(),
        ageRange,
        gender,
        hasChildren,
        homeCounty,
        lookingFor,
        hateWithPassion,
        interestedIn,
        bio: bio.trim() || undefined,
        confirmedAdult,
        acceptedResponsibility,
        signature: signature.trim(),
      });
      setVerifyEmailAddr(normalizedEmail);
      setVerifyCode('');
      setMode('verify');
      setNotice(
        `Verification code sent to ${normalizedEmail}. Open the Dev Verification Inbox below to grab your 6-digit code!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await verifyEmailCode({
        email: verifyEmailAddr.trim().toLowerCase(),
        code: verifyCode.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verifyEmailAddr.trim()) {
      setError('Enter your email address first to resend a verification code.');
      return;
    }
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await resendCode(verifyEmailAddr.trim().toLowerCase(), 'verify');
      setNotice('A fresh 6-digit verification code has been sent. Check the Dev Verification Inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await forgotPassword(resetEmail.trim().toLowerCase());
      setResetCodeSent(true);
      setNotice(
        'Reset code sent! Open the Dev Verification Inbox to copy your 6-digit code and set a new password.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await resetPassword({
        email: resetEmail.trim().toLowerCase(),
        code: resetCode.trim(),
        newPassword,
      });
      setLoginEmail(resetEmail.trim().toLowerCase());
      setLoginPassword('');
      setResetCodeSent(false);
      setResetCode('');
      setNewPassword('');
      setMode('login');
      setNotice('Password reset successful! Sign in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeInboxFilter =
    mode === 'verify'
      ? verifyEmailAddr
      : mode === 'reset'
        ? resetEmail
        : regEmail || loginEmail;

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col">
      {/* Top minimal bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3">
        <BrandLogo size="lg" />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle Dark and Light Mode"
          className="inline-flex items-center gap-2 rounded-xl surface-subtle surface-hover px-3.5 py-2 text-xs font-semibold text-theme-secondary transition cursor-pointer"
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-cyan-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Responsive Split Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 lg:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* Left Afro-Futuristic Hero Column (Desktop Showcase + Compact Mobile Header) */}
        <section className="lg:col-span-5 lg:sticky lg:top-8 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            All 47 Kenyan Counties • Adults 20–50
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.08] text-theme-primary">
            Meet verified singles within{' '}
            <span className="gradient-text">10 km</span> of your city pulse.
          </h1>

          <p className="text-sm sm:text-base text-theme-secondary leading-relaxed">
            Kenya’s Afro-futuristic proximity social hub — blending real-time 10 km discovery,
            a public Blackboard with star milestones, 3-window simultaneous chat, and a private
            behind-the-hood AI companion that links you by real shared interests.
          </p>

          {/* Feature pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 pt-1">
            <div className="glass-card p-3.5 flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-theme-primary">Strict Privacy Shield</p>
                <p className="text-xs text-theme-muted mt-0.5">
                  Nearby members see only Photo, Nickname, Gender &amp; Age Range. Exact location,
                  email, county &amp; preferences stay hidden.
                </p>
              </div>
            </div>

            <div className="glass-card p-3.5 flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Radio className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-theme-primary">
                  10 km Live Radar + 3 Simultaneous Chats
                </p>
                <p className="text-xs text-theme-muted mt-0.5">
                  Chat side-by-side with up to 3 nearby matches using emojis, voice notes, and
                  auto-clearing ephemeral images (20 MB / 2h).
                </p>
              </div>
            </div>

            <div className="glass-card p-3.5 hidden sm:flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Compass className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-theme-primary">Email-Only Verified Access</p>
                <p className="text-xs text-theme-muted mt-0.5">
                  Zero social-login tracking, zero phone-number spam. Just verified email + 18+
                  signed community responsibility.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Auth Card Column */}
        <section className="lg:col-span-7 w-full">
          <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 space-y-5">
            {/* Mode Switcher Tabs (Strictly Email-Only) */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl surface-subtle"
              role="tablist"
              aria-label="Authentication mode"
            >
              {[
                { id: 'login' as const, label: 'Sign In', icon: Mail },
                { id: 'register' as const, label: 'Create Account', icon: UserPlus },
                { id: 'verify' as const, label: 'Verify Email', icon: CheckCircle2 },
                { id: 'reset' as const, label: 'Reset Password', icon: KeyRound },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchMode(tab.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 shadow-md'
                        : 'text-theme-secondary hover:text-theme-primary surface-hover'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Email-only policy pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-3.5 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Email-Only Registration &amp; Login (No OAuth / No Phone)
              </span>
              <button
                type="button"
                onClick={() => setDevInboxOpen(true)}
                className="inline-flex items-center gap-1 font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
              >
                <Inbox className="h-3.5 w-3.5" />
                Dev Verification Inbox
              </button>
            </div>

            {/* Error & Notice Alerts */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/12 px-4 py-3 text-sm text-rose-400"
              >
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-400"
              >
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {/* ======================== SIGN IN TAB ======================== */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-theme-primary">
                    Welcome back to 47 Cities
                  </h2>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Sign in using your verified email address and password.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-xs font-semibold text-theme-secondary">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.co.ke"
                    className="w-full rounded-xl surface-subtle px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-theme-secondary">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(loginEmail);
                        switchMode('reset');
                      }}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl surface-subtle px-4 py-3 pr-11 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary cursor-pointer"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Signing In...' : 'Sign In with Email'}
                </button>

                {/* Helpful Demo Account Hint */}
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Demo Account Hint (Quick Preview)
                    </p>
                    <p className="text-theme-secondary">
                      Email: <code className="font-mono font-semibold text-theme-primary">demo@47cities.ke</code>{' '}
                      • Password: <code className="font-mono font-semibold text-theme-primary">Kenya2026!</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillDemoAccount}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/25 transition shrink-0 cursor-pointer"
                  >
                    Fill Demo Login
                  </button>
                </div>

                <p className="text-center text-xs text-theme-muted">
                  New to 47 Cities?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-bold text-amber-400 hover:underline cursor-pointer"
                  >
                    Create an email account
                  </button>
                </p>
              </form>
            )}

            {/* ======================== REGISTER TAB ======================== */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-theme-primary">
                    Create Your 47 Cities Account
                  </h2>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Email-only registration for Kenyan city singles (ages 20–50). Your private
                    preferences power our behind-the-hood AI and are never exposed to other users.
                  </p>
                </div>

                {/* Section 1: Credentials & Public Card */}
                <div className="space-y-3.5 rounded-2xl surface-subtle p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    1. Email Credentials &amp; Public Card
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="reg-email" className="block text-xs font-semibold text-theme-secondary">
                        Email Address *
                      </label>
                      <input
                        id="reg-email"
                        name="email"
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@example.co.ke"
                        className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="reg-password" className="block text-xs font-semibold text-theme-secondary">
                        Password (min 6 chars) *
                      </label>
                      <div className="relative">
                        <input
                          id="reg-password"
                          name="password"
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full rounded-xl surface-subtle px-3.5 py-2.5 pr-10 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary cursor-pointer"
                          aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="reg-nickname" className="block text-xs font-semibold text-theme-secondary">
                        User Name / App Name (Nickname) *
                      </label>
                      <input
                        id="reg-nickname"
                        name="nickname"
                        type="text"
                        required
                        minLength={2}
                        maxLength={28}
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="e.g. NiaPulse"
                        className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="block text-xs font-semibold text-theme-secondary">
                        Gender *
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {GENDERS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className={`rounded-xl px-3 py-2.5 text-xs font-bold border transition cursor-pointer ${
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
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-theme-secondary">
                      Age Range (Adults 20–50) *
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {AGE_RANGES.map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setAgeRange(range)}
                          className={`rounded-xl px-2.5 py-2 text-xs font-bold border transition cursor-pointer ${
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
                </div>

                {/* Section 2: Hidden Private Profile (AI-Only) */}
                <div className="space-y-3.5 rounded-2xl surface-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                      2. Private Profile Details (Hidden from Members)
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      AI-Only Vault
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="reg-county" className="block text-xs font-semibold text-theme-secondary">
                        Home County (47 Counties of Kenya) *
                      </label>
                      <select
                        id="reg-county"
                        name="homeCounty"
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

                    <div className="space-y-1">
                      <span className="block text-xs font-semibold text-theme-secondary">
                        Child(ren) *
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
                            className={`rounded-xl px-3 py-2.5 text-xs font-bold border transition cursor-pointer ${
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
                    <span className="block text-xs font-semibold text-theme-secondary">
                      Interested In (Controls who you see in 10 km Radar) *
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
                      Looking For (Select 1 or more) *
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
                      Hate With Passion (Select 1 or more) *
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
                    <label htmlFor="reg-bio" className="block text-xs font-semibold text-theme-secondary">
                      Short Vibe Note (Optional — Private AI Signal)
                    </label>
                    <input
                      id="reg-bio"
                      name="bio"
                      type="text"
                      maxLength={140}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Coffee, Karura trails, live jazz, tech..."
                      className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                    />
                  </div>
                </div>

                {/* Section 3: Mandatory 18+ Privacy Disclaimer & Signature */}
                <div className="space-y-3 rounded-2xl border border-amber-500/35 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-wider">
                      3. Mandatory 18+ Eligibility &amp; Privacy Disclaimer
                    </p>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-xl surface-subtle p-3 text-xs leading-relaxed text-theme-secondary whitespace-pre-wrap">
                    {PRIVACY_DISCLAIMER_TEXT}
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-theme-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedAdult}
                      onChange={(e) => setConfirmedAdult(e.target.checked)}
                      data-testid="checkbox-adult"
                      className="mt-0.5 h-4 w-4 rounded accent-amber-500 shrink-0"
                    />
                    <span>I confirm I am above 18 years old (20–50 age bracket)</span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-theme-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedResponsibility}
                      onChange={(e) => setAcceptedResponsibility(e.target.checked)}
                      data-testid="checkbox-responsibility"
                      className="mt-0.5 h-4 w-4 rounded accent-amber-500 shrink-0"
                    />
                    <span>
                      I have read this privacy disclaimer and take full responsibility for my
                      actions and/or omissions
                    </span>
                  </label>

                  <div className="space-y-1">
                    <label
                      htmlFor="reg-signature"
                      className="block text-xs font-semibold text-theme-secondary"
                    >
                      Digital Signature *
                    </label>
                    <input
                      id="reg-signature"
                      name="signature"
                      type="text"
                      required
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Type your full name or nickname to sign"
                      className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    />
                  </div>
                </div>

                {!disclaimerReady && (
                  <p className="text-xs text-amber-400 font-medium text-center">
                    Check both 18+ disclaimer boxes and type your digital signature to unlock registration.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmitRegister}
                  data-testid="register-submit-btn"
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting
                    ? 'Creating Verified Account...'
                    : 'Sign Disclaimer & Register with Email'}
                </button>
              </form>
            )}

            {/* ======================== VERIFY EMAIL TAB ======================== */}
            {mode === 'verify' && (
              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-theme-primary">
                    Verify Your Email Address
                  </h2>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Enter the 6-digit verification code sent to your email. Local testers can open
                    the Dev Verification Inbox right here.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="verify-email" className="block text-xs font-semibold text-theme-secondary">
                    Registered Email
                  </label>
                  <input
                    id="verify-email"
                    type="email"
                    required
                    value={verifyEmailAddr}
                    onChange={(e) => setVerifyEmailAddr(e.target.value)}
                    placeholder="you@example.co.ke"
                    className="w-full rounded-xl surface-subtle px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="verify-code" className="block text-xs font-semibold text-theme-secondary">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-xl surface-subtle px-4 py-3 font-display text-center text-2xl font-bold tracking-[0.35em] text-amber-400 placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDevInboxOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/12 px-4 py-3 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                  >
                    <Inbox className="h-4 w-4" />
                    Open Dev Verification Inbox
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl surface-subtle surface-hover px-4 py-3 text-xs font-bold text-theme-secondary transition cursor-pointer"
                  >
                    Resend 6-Digit Code
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting || verifyCode.length < 6}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-45 cursor-pointer"
                >
                  {submitting ? 'Verifying...' : 'Verify Email & Continue'}
                </button>
              </form>
            )}

            {/* ======================== RESET PASSWORD TAB ======================== */}
            {mode === 'reset' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-theme-primary">
                    Reset Your Password
                  </h2>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Request a 6-digit password reset code via email, then choose a new password.
                  </p>
                </div>

                <form onSubmit={handleRequestResetCode} className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reset-email" className="block text-xs font-semibold text-theme-secondary">
                      Account Email Address
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="you@example.co.ke"
                        className="flex-1 rounded-xl surface-subtle px-4 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                      />
                      <button
                        type="submit"
                        disabled={submitting || !resetEmail.trim()}
                        className="rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-4 py-2.5 text-xs font-bold text-cyan-400 hover:bg-cyan-500/30 transition shrink-0 cursor-pointer"
                      >
                        {resetCodeSent ? 'Resend Reset Code' : 'Send Reset Code'}
                      </button>
                    </div>
                  </div>
                </form>

                <button
                  type="button"
                  onClick={() => setDevInboxOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                >
                  <Inbox className="h-4 w-4" />
                  Open Dev Verification Inbox
                </button>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-3 pt-1 border-t border-theme">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="reset-code" className="block text-xs font-semibold text-theme-secondary">
                        6-Digit Reset Code
                      </label>
                      <input
                        id="reset-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full rounded-xl surface-subtle px-3.5 py-2.5 font-display text-center text-lg font-bold tracking-[0.28em] text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="reset-new-password" className="block text-xs font-semibold text-theme-secondary">
                        New Password (min 6 chars)
                      </label>
                      <input
                        id="reset-new-password"
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New secure password"
                        className="w-full rounded-xl surface-subtle px-3.5 py-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || resetCode.length < 6 || newPassword.length < 6}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-45 cursor-pointer"
                  >
                    {submitting ? 'Updating Password...' : 'Confirm Password Reset'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </main>

      <DevInboxModal
        open={devInboxOpen}
        emailFilter={activeInboxFilter}
        onClose={() => setDevInboxOpen(false)}
        onSelectCode={(code, email) => {
          if (mode === 'reset') {
            setResetEmail(email);
            setResetCode(code);
          } else {
            setVerifyEmailAddr(email);
            setVerifyCode(code);
            if (mode !== 'verify') setMode('verify');
          }
        }}
      />
    </div>
  );
}
