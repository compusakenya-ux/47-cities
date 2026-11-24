import { useId } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  subtitleExtra?: string | null;
  className?: string;
}

/**
 * 3D Peace Emblem + "47 Cities" / "One Mission" Brand Lockup.
 * Uses multi-layered SVG gradients, 3D extrusion shadows, beveled metallic ring,
 * glassmorphic dome highlight, and soaring peace symbol + dove silhouette.
 */
export function PeaceLogo3D({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const uid = useId().replace(/:/g, '');
  const dim = size === 'sm' ? 38 : size === 'lg' ? 54 : 44;

  return (
    <div
      className="relative shrink-0 inline-flex items-center justify-center select-none"
      style={{ width: dim, height: dim }}
      aria-hidden="true"
    >
      {/* Ambient 3D floating glow */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full blur-md opacity-55"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, rgba(251,191,36,0.55), rgba(6,182,212,0.45) 55%, rgba(16,185,129,0.25) 100%)',
        }}
      />

      <svg
        width={dim}
        height={dim}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
      >
        <defs>
          {/* 3D metallic gold outer bezel */}
          <linearGradient id={`${uid}-bezel`} x1="12" y1="8" x2="88" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="32%" stopColor="#F59E0B" />
            <stop offset="68%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>

          {/* 3D dark inner rim for depth */}
          <linearGradient id={`${uid}-rim`} x1="18" y1="18" x2="82" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#082F49" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* 3D iridescent peace orb sphere */}
          <radialGradient id={`${uid}-orb`} cx="35%" cy="28%" r="72%" fx="32%" fy="24%">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="28%" stopColor="#0EA5E9" />
            <stop offset="62%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#090F1E" />
          </radialGradient>

          {/* Glossy glass specular highlight */}
          <linearGradient id={`${uid}-gloss`} x1="25" y1="14" x2="65" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* 3D extruded pearl-gold peace emblem gradient */}
          <linearGradient id={`${uid}-emblem`} x1="26" y1="20" x2="76" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#FEF3C7" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>

          {/* 3D drop shadow filter for peace emblem */}
          <filter id={`${uid}-shadow`} x="-15%" y="-15%" width="140%" height="140%">
            <feDropShadow dx="1.8" dy="3.2" stdDeviation="1.8" floodColor="#04101F" floodOpacity="0.72" />
          </filter>
        </defs>

        {/* Grounded 3D ellipse shadow */}
        <ellipse cx="52" cy="92" rx="28" ry="4.5" fill="#000000" fillOpacity="0.32" />

        {/* Outer extruded 3D bezel bottom lip */}
        <circle cx="51" cy="52" r="44" fill="#0C1729" fillOpacity="0.75" />

        {/* Metallic gradient 3D bezel */}
        <circle cx="50" cy="49" r="44" fill={`url(#${uid}-bezel)`} />

        {/* Bezel inner recess */}
        <circle cx="50" cy="49" r="39" fill={`url(#${uid}-rim)`} />

        {/* Luminous 3D glassmorphic orb */}
        <circle cx="50" cy="49" r="36.5" fill={`url(#${uid}-orb)`} />

        {/* Subtle equatorial 3D globe arc (unity across 47 counties) */}
        <ellipse
          cx="50"
          cy="50"
          rx="32"
          ry="11"
          stroke="#A5F3FC"
          strokeOpacity="0.22"
          strokeWidth="1.4"
          transform="rotate(-14 50 50)"
        />

        {/* 3D Depth Extrusion Layer of Peace Symbol */}
        <g transform="translate(2.2, 3.2)" opacity="0.58">
          <circle cx="50" cy="49" r="24" stroke="#082F49" strokeWidth="6.2" />
          <line x1="50" y1="25" x2="50" y2="73" stroke="#082F49" strokeWidth="6.2" strokeLinecap="round" />
          <line x1="50" y1="50" x2="33" y2="66" stroke="#082F49" strokeWidth="6.2" strokeLinecap="round" />
          <line x1="50" y1="50" x2="67" y2="66" stroke="#082F49" strokeWidth="6.2" strokeLinecap="round" />
        </g>

        {/* Primary Sculpted 3D Peace Symbol */}
        <g filter={`url(#${uid}-shadow)`}>
          <circle cx="50" cy="49" r="24" stroke={`url(#${uid}-emblem)`} strokeWidth="5.6" />
          <line
            x1="50"
            y1="25"
            x2="50"
            y2="73"
            stroke={`url(#${uid}-emblem)`}
            strokeWidth="5.6"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="50"
            x2="33.5"
            y2="65.5"
            stroke={`url(#${uid}-emblem)`}
            strokeWidth="5.6"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="50"
            x2="66.5"
            y2="65.5"
            stroke={`url(#${uid}-emblem)`}
            strokeWidth="5.6"
            strokeLinecap="round"
          />
        </g>

        {/* Subtle olive-leaf / peace dove wing glint at center crest */}
        <path
          d="M42 40.5C45.5 36.2 51 35 58 37.5C54 41.2 49.5 43.2 44.5 43.2C43.2 43.2 42.3 42.1 42 40.5Z"
          fill="#FFFFFF"
          fillOpacity="0.92"
        />

        {/* Top-left 3D glass specular dome highlight */}
        <ellipse
          cx="39"
          cy="28"
          rx="21"
          ry="11"
          fill={`url(#${uid}-gloss)`}
          transform="rotate(-24 39 28)"
        />
        <circle cx="29" cy="24" r="3.2" fill="#FFFFFF" fillOpacity="0.7" />
      </svg>
    </div>
  );
}

export function BrandLogo({ size = 'md', subtitleExtra, className = '' }: BrandLogoProps) {
  const titleSize =
    size === 'sm'
      ? 'text-sm sm:text-base'
      : size === 'lg'
        ? 'text-xl sm:text-2xl'
        : 'text-lg';

  const missionSize =
    size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : 'text-[11px]';

  return (
    <div className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      <PeaceLogo3D size={size} />
      <div className="min-w-0 text-left">
        <div
          className={`font-display ${titleSize} font-extrabold tracking-tight text-theme-primary leading-tight truncate`}
        >
          47 Cities
        </div>
        <div
          className={`${missionSize} font-bold tracking-[0.14em] uppercase gradient-text leading-tight truncate`}
        >
          One Mission
        </div>
        {subtitleExtra && (
          <div className="text-[10px] text-emerald-400 font-semibold truncate mt-0.5">
            {subtitleExtra}
          </div>
        )}
      </div>
    </div>
  );
}
