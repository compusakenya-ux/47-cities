import type {
  AgeRange,
  BlackboardTopic,
  Gender,
  HateWithPassionOption,
  InterestedIn,
  LookingForOption,
  SeedPostRecord,
  SeedStoryRecord,
  SeedUserRecord,
  TestCityPin,
} from './types.js';

// ============================================================================
// Official 47 Counties of Kenya (001 Mombasa -> 047 Nairobi)
// ============================================================================

export const KENYA_COUNTIES: readonly string[] = [
  'Mombasa',
  'Kwale',
  'Kilifi',
  'Tana River',
  'Lamu',
  'Taita-Taveta',
  'Garissa',
  'Wajir',
  'Mandera',
  'Marsabit',
  'Isiolo',
  'Meru',
  'Tharaka-Nithi',
  'Embu',
  'Kitui',
  'Machakos',
  'Makueni',
  'Nyandarua',
  'Nyeri',
  'Kirinyaga',
  "Murang'a",
  'Kiambu',
  'Turkana',
  'West Pokot',
  'Samburu',
  'Trans Nzoia',
  'Uasin Gishu',
  'Elgeyo-Marakwet',
  'Nandi',
  'Baringo',
  'Laikipia',
  'Nakuru',
  'Narok',
  'Kajiado',
  'Kericho',
  'Bomet',
  'Kakamega',
  'Vihiga',
  'Bungoma',
  'Busia',
  'Siaya',
  'Kisumu',
  'Homa Bay',
  'Migori',
  'Kisii',
  'Nyamira',
  'Nairobi',
] as const;

// ============================================================================
// Profile & Community Option Catalogs
// ============================================================================

export const AGE_RANGES: readonly AgeRange[] = [
  '20-22',
  '23-25',
  '26-29',
  '30-35',
  '36-40',
  '41-50',
] as const;

export const GENDERS: readonly Gender[] = ['Man', 'Woman'] as const;

export const INTERESTED_IN_OPTIONS: readonly InterestedIn[] = [
  'Men',
  'Women',
  'Both',
] as const;

export const LOOKING_FOR_OPTIONS: readonly LookingForOption[] = [
  'Soulmate',
  'Friend',
  'Hangout',
  'Chat-Mate',
  'One Night Stand',
] as const;

export const HATE_WITH_PASSION_OPTIONS: readonly HateWithPassionOption[] = [
  'Ujinga',
  'Lazy',
  'Alcoholic',
  'Liar',
] as const;

export const BLACKBOARD_TOPICS: readonly BlackboardTopic[] = [
  'Politics',
  'Health',
  'Sports',
  'Lifestyle',
  'Hangouts',
] as const;

export const CHAT_EMOJIS: readonly string[] = [
  '🔥',
  '💛',
  '😂',
  '😍',
  '✨',
  '🇰🇪',
  '🥂',
  '☕',
  '🫶',
  '😎',
  '🎉',
  '🚀',
  '💬',
  '🌟',
  '🙌',
  '💯',
  '🎶',
  '🌴',
  '⚡',
  '❤️‍🔥',
  '🤝',
  '😉',
  '🥳',
  '👀',
] as const;

// ============================================================================
// Test City Pins for One-Click Location Activation & QA Testing
// ============================================================================

export const TEST_CITY_PINS: readonly TestCityPin[] = [
  {
    id: 'nairobi-cbd',
    label: 'Nairobi — Westlands / CBD',
    county: 'Nairobi',
    lat: -1.2864,
    lng: 36.8172,
    tagline: 'Silicon Savannah skyline, rooftop coffee & fast-lane energy',
  },
  {
    id: 'mombasa-nyali',
    label: 'Mombasa — Nyali / CBD',
    county: 'Mombasa',
    lat: -4.0435,
    lng: 39.6682,
    tagline: 'Ocean breeze, Swahili night markets & coastal vibes',
  },
  {
    id: 'kisumu-milimani',
    label: 'Kisumu — Milimani',
    county: 'Kisumu',
    lat: -0.0917,
    lng: 34.768,
    tagline: 'Lake Victoria sunsets, Dunga breezes & warm conversations',
  },
  {
    id: 'nakuru-cbd',
    label: 'Nakuru — CBD',
    county: 'Nakuru',
    lat: -0.3031,
    lng: 36.08,
    tagline: 'Rift Valley crater views & crisp highland evenings',
  },
  {
    id: 'eldoret-cbd',
    label: 'Eldoret — CBD',
    county: 'Uasin Gishu',
    lat: 0.5143,
    lng: 35.2698,
    tagline: 'City of Champions — athletics, highland chill & ambition',
  },
] as const;

// ============================================================================
// Mandatory Privacy, Adult Eligibility & Responsibility Disclaimer
// ============================================================================

export const PRIVACY_DISCLAIMER_TEXT = `47 CITIES COMMUNITY ACCESS, 18+ ELIGIBILITY & PRIVACY DISCLAIMER

By signing below and entering 47 Cities, I explicitly confirm, warrant, and agree that:

1. ADULTS ONLY (18+): I am at least 18 years of age (and legally an adult in Kenya and my jurisdiction). I understand that 47 Cities is strictly an adult companionship and social discovery platform.

2. FULL PERSONAL RESPONSIBILITY: I accept full and sole personal responsibility for all of my actions and/or omissions, messages, shared media, Blackboard posts, and any online or offline meetings I choose to initiate or attend. 47 Cities provides a digital proximity venue and does not conduct background checks or guarantee member conduct.

3. 10 KM PROXIMITY PRIVACY SHIELD: To protect every member's safety and privacy, 47 Cities uses my active location strictly on the server to confirm membership within a 10 km radius. My exact GPS coordinates, distance, email address, Home County, parental status, preferences, and dealbreakers are NEVER displayed to other members. Other members only see my Nickname, Profile Photo, Gender, Age Range, and Online status.

4. EPHEMERAL MEDIA & RESPECTFUL CONDUCT: Chat images are capped at 20 MB per active session and automatically expire after 2 hours. I will treat fellow members with dignity, respect consent at all times, and refrain from harassment, fraud, or impersonation.

Typing my full nickname/signature below constitutes my binding electronic acceptance of these terms.`;

// ============================================================================
// Zero-Dependency Procedural SVG Avatar Helper
// ============================================================================

export function makeAvatarSvg(
  initials: string,
  primaryHex: string,
  secondaryHex: string
): string {
  const cleanInitials = initials.trim().slice(0, 2).toUpperCase() || '47';
  const safePrimary = primaryHex.replace(/[^#a-zA-Z0-9]/g, '') || '#F59E0B';
  const safeSecondary = secondaryHex.replace(/[^#a-zA-Z0-9]/g, '') || '#06B6D4';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safePrimary}"/>
      <stop offset="100%" stop-color="${safeSecondary}"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="22%" r="72%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#070B14" stop-opacity="0.22"/>
    </radialGradient>
  </defs>
  <rect width="160" height="160" rx="80" fill="url(#bg)"/>
  <rect width="160" height="160" rx="80" fill="url(#glow)"/>
  <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" stroke-dasharray="6 6"/>
  <path d="M26 118 Q80 94 134 118" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
  <text x="80" y="92" text-anchor="middle" fill="#FFFFFF" font-family="Space Grotesk, Plus Jakarta Sans, sans-serif" font-size="50" font-weight="700" letter-spacing="2">${cleanInitials}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// Seeded Kenyan Singles (18 Users: 9 Women, 9 Men)
// - 12 inside 1–7 km of Nairobi CBD (-1.2864, 36.8172) [6 Women, 6 Men]
// - 2 at ~18 km outside Nairobi (proves >10 km exclusion) [1 Woman, 1 Man]
// - 2 inside 1–5 km of Mombasa Nyali/CBD (-4.0435, 39.6682) [1 Woman, 1 Man]
// - 2 inside 1–5 km of Kisumu Milimani (-0.0917, 34.7680) [1 Woman, 1 Man]
// ============================================================================

export const SEED_USERS: readonly SeedUserRecord[] = [
  // --- NAIROBI INNER (12 users within 1.1–6.8 km of -1.2864, 36.8172) ---
  {
    id: 'user-nbo-01',
    email: 'amani.k@47cities.ke',
    nickname: 'AmaniVibes',
    avatarUrl: makeAvatarSvg('AV', '#F59E0B', '#F43F5E'),
    gender: 'Woman',
    ageRange: '26-29',
    interestedIn: 'Men',
    hasChildren: false,
    homeCounty: 'Kiambu',
    lookingFor: ['Soulmate', 'Hangout'],
    hateWithPassion: ['Liar', 'Lazy'],
    bio: 'Kilimani espresso hunter, rooftop jazz & Sunday Karura trail walks.',
    lat: -1.2921, // ~0.9 km -> actually let's place at ~2.1 km (Kilimani)
    lng: 36.7995,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 1,
    interestKeywords: ['coffee', 'jazz', 'karura', 'running', 'rooftop', 'tech', 'brunch'],
  },
  {
    id: 'user-nbo-02',
    email: 'jabali.o@47cities.ke',
    nickname: 'JabaliNBO',
    avatarUrl: makeAvatarSvg('JN', '#06B6D4', '#10B981'),
    gender: 'Man',
    ageRange: '26-29',
    interestedIn: 'Women',
    hasChildren: false,
    homeCounty: 'Kisumu',
    lookingFor: ['Soulmate', 'Friend', 'Hangout'],
    hateWithPassion: ['Ujinga', 'Liar'],
    bio: 'Fintech product builder in Westlands. Arsenal fan, nyama choma critic.',
    lat: -1.2647, // ~2.9 km (Westlands)
    lng: 36.8036,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 2,
    interestKeywords: ['fintech', 'football', 'arsenal', 'nyama choma', 'coffee', 'tech', 'music'],
  },
  {
    id: 'user-nbo-03',
    email: 'zuri.m@47cities.ke',
    nickname: 'ZuriSpark',
    avatarUrl: makeAvatarSvg('ZS', '#EC4899', '#8B5CF6'),
    gender: 'Woman',
    ageRange: '23-25',
    interestedIn: 'Both',
    hasChildren: false,
    homeCounty: 'Mombasa',
    lookingFor: ['Hangout', 'Chat-Mate', 'Friend'],
    hateWithPassion: ['Alcoholic', 'Ujinga'],
    bio: 'Visual designer & vinyl collector. Always down for art galleries or late-night banter.',
    lat: -1.2712, // ~1.9 km (Parklands)
    lng: 36.8245,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 3,
    interestKeywords: ['design', 'art', 'vinyl', 'afrobeats', 'galleries', 'fashion', 'rooftop'],
  },
  {
    id: 'user-nbo-04',
    email: 'baraka.w@47cities.ke',
    nickname: 'BarakaPulse',
    avatarUrl: makeAvatarSvg('BP', '#F59E0B', '#06B6D4'),
    gender: 'Man',
    ageRange: '30-35',
    interestedIn: 'Women',
    hasChildren: true,
    homeCounty: 'Nyeri',
    lookingFor: ['Soulmate', 'Chat-Mate'],
    hateWithPassion: ['Liar', 'Alcoholic'],
    bio: 'Architect sketching Nairobi skylines. Proud dad, cyclist, slow-brew coffee nerd.',
    lat: -1.3045, // ~2.5 km (Upper Hill / Madaraka)
    lng: 36.8112,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 5,
    interestKeywords: ['architecture', 'cycling', 'coffee', 'karura', 'books', 'politics', 'wellness'],
  },
  {
    id: 'user-nbo-05',
    email: 'neema.k@47cities.ke',
    nickname: 'NeemaGlow',
    avatarUrl: makeAvatarSvg('NG', '#10B981', '#06B6D4'),
    gender: 'Woman',
    ageRange: '30-35',
    interestedIn: 'Men',
    hasChildren: false,
    homeCounty: 'Machakos',
    lookingFor: ['Soulmate', 'Friend'],
    hateWithPassion: ['Lazy', 'Liar'],
    bio: 'Pediatric nurse & half-marathon runner. Calm energy, sharp humor, real talks.',
    lat: -1.2988, // ~4.2 km (Kileleshwa)
    lng: 36.7812,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 4,
    interestKeywords: ['health', 'running', 'marathon', 'wellness', 'brunch', 'travel', 'books'],
  },
  {
    id: 'user-nbo-06',
    email: 'kibet.r@47cities.ke',
    nickname: 'KibetStride',
    avatarUrl: makeAvatarSvg('KS', '#14B8A6', '#3B82F6'),
    gender: 'Man',
    ageRange: '23-25',
    interestedIn: 'Both',
    hasChildren: false,
    homeCounty: 'Uasin Gishu',
    lookingFor: ['Hangout', 'Friend', 'One Night Stand'],
    hateWithPassion: ['Ujinga', 'Lazy'],
    bio: 'Sound engineer & rugby sevens fanatic. Catch me at Ngong Road live sessions.',
    lat: -1.3019, // ~5.1 km (Junction / Ngong Rd)
    lng: 36.7745,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 6,
    interestKeywords: ['rugby', 'music', 'afrobeats', 'live bands', 'sports', 'hangout', 'nightlife'],
  },
  {
    id: 'user-nbo-07',
    email: 'wambui.n@47cities.ke',
    nickname: 'WambuiLuxe',
    avatarUrl: makeAvatarSvg('WL', '#F43F5E', '#FB923C'),
    gender: 'Woman',
    ageRange: '36-40',
    interestedIn: 'Men',
    hasChildren: true,
    homeCounty: 'Nakuru',
    lookingFor: ['Soulmate', 'Hangout'],
    hateWithPassion: ['Liar', 'Alcoholic'],
    bio: 'Hospitality consultant who knows every hidden courtyard eatery in Lavington.',
    lat: -1.2785, // ~5.6 km (Lavington)
    lng: 36.7675,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: false,
    lastActiveOffsetMinutes: 28,
    interestKeywords: ['food', 'wine', 'hospitality', 'travel', 'jazz', 'lifestyle', 'business'],
  },
  {
    id: 'user-nbo-08',
    email: 'tariq.s@47cities.ke',
    nickname: 'TariqWave',
    avatarUrl: makeAvatarSvg('TW', '#6366F1', '#06B6D4'),
    gender: 'Man',
    ageRange: '20-22',
    interestedIn: 'Women',
    hasChildren: false,
    homeCounty: 'Kilifi',
    lookingFor: ['Chat-Mate', 'Hangout', 'Friend'],
    hateWithPassion: ['Ujinga'],
    bio: 'Computer science finalist building AI toys & chasing Nairobi sunset photography.',
    lat: -1.2791, // ~1.4 km (Chiromo / Museum Hill)
    lng: 36.8075,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 2,
    interestKeywords: ['tech', 'ai', 'photography', 'gaming', 'music', 'coffee', 'campus'],
  },
  {
    id: 'user-nbo-09',
    email: 'asha.b@47cities.ke',
    nickname: 'AshaSolar',
    avatarUrl: makeAvatarSvg('AS', '#F59E0B', '#10B981'),
    gender: 'Woman',
    ageRange: '20-22',
    interestedIn: 'Both',
    hasChildren: false,
    homeCounty: 'Nairobi',
    lookingFor: ['Friend', 'Chat-Mate', 'Hangout'],
    hateWithPassion: ['Liar', 'Ujinga'],
    bio: 'Climate-tech storyteller & matcha enthusiast. Big on good playlists and memes.',
    lat: -1.3118, // ~3.5 km (South B)
    lng: 36.8355,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 7,
    interestKeywords: ['climate', 'sustainability', 'playlists', 'coffee', 'art', 'memes', 'hangout'],
  },
  {
    id: 'user-nbo-10',
    email: 'mwangi.d@47cities.ke',
    nickname: 'MwangiApex',
    avatarUrl: makeAvatarSvg('MA', '#0EA5E9', '#2563EB'),
    gender: 'Man',
    ageRange: '36-40',
    interestedIn: 'Women',
    hasChildren: false,
    homeCounty: "Murang'a",
    lookingFor: ['Soulmate', 'Hangout'],
    hateWithPassion: ['Lazy', 'Liar'],
    bio: 'Corporate lawyer by day, salsa dancer & Rift Valley road-tripper on weekends.',
    lat: -1.2582, // ~4.4 km (Muthaiga edge)
    lng: 36.8452,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: false,
    lastActiveOffsetMinutes: 42,
    interestKeywords: ['salsa', 'roadtrips', 'politics', 'law', 'wine', 'golf', 'lifestyle'],
  },
  {
    id: 'user-nbo-11',
    email: 'chebet.l@47cities.ke',
    nickname: 'ChebetZen',
    avatarUrl: makeAvatarSvg('CZ', '#A855F7', '#F43F5E'),
    gender: 'Woman',
    ageRange: '41-50',
    interestedIn: 'Men',
    hasChildren: true,
    homeCounty: 'Kericho',
    lookingFor: ['Soulmate', 'Friend', 'Chat-Mate'],
    hateWithPassion: ['Alcoholic', 'Liar'],
    bio: 'Tea exporter & yoga instructor. Looking for grown conversations and laughter.',
    lat: -1.2421, // ~6.2 km (Gigiri / Runda edge)
    lng: 36.7918,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 9,
    interestKeywords: ['yoga', 'wellness', 'tea', 'health', 'travel', 'books', 'business'],
  },
  {
    id: 'user-nbo-12',
    email: 'omondi.v@47cities.ke',
    nickname: 'OmondiJet',
    avatarUrl: makeAvatarSvg('OJ', '#EF4444', '#F59E0B'),
    gender: 'Man',
    ageRange: '41-50',
    interestedIn: 'Both',
    hasChildren: true,
    homeCounty: 'Siaya',
    lookingFor: ['Hangout', 'Chat-Mate', 'One Night Stand'],
    hateWithPassion: ['Ujinga', 'Lazy'],
    bio: 'Aviation ops lead. Loves smooth rhumba, grilled tilapia, and honest company.',
    lat: -1.3264, // ~6.4 km (Lang'ata / Wilson edge)
    lng: 36.7764,
    activeCityLabel: 'Nairobi — Westlands / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 11,
    interestKeywords: ['rhumba', 'aviation', 'food', 'sports', 'nightlife', 'travel', 'music'],
  },

  // --- OUTSIDE NAIROBI (>10 km, ~18 km away to verify proximity exclusion!) ---
  {
    id: 'user-far-01',
    email: 'farida.ruiru@47cities.ke',
    nickname: 'FaridaRuiru',
    avatarUrl: makeAvatarSvg('FR', '#D97706', '#9333EA'),
    gender: 'Woman',
    ageRange: '26-29',
    interestedIn: 'Men',
    hasChildren: false,
    homeCounty: 'Kiambu',
    lookingFor: ['Soulmate', 'Friend'],
    hateWithPassion: ['Liar'],
    bio: 'Out in Ruiru — 18 km north of Nairobi CBD (outside 10 km CBD radius).',
    lat: -1.1244, // ~18.0 km north of Nairobi CBD
    lng: 36.8172,
    activeCityLabel: 'Ruiru — Kiambu',
    isOnline: true,
    lastActiveOffsetMinutes: 4,
    interestKeywords: ['coffee', 'business', 'brunch', 'books'],
  },
  {
    id: 'user-far-02',
    email: 'dennis.kitengela@47cities.ke',
    nickname: 'DennisPlains',
    avatarUrl: makeAvatarSvg('DP', '#059669', '#0284C7'),
    gender: 'Man',
    ageRange: '30-35',
    interestedIn: 'Women',
    hasChildren: false,
    homeCounty: 'Kajiado',
    lookingFor: ['Hangout', 'Soulmate'],
    hateWithPassion: ['Ujinga'],
    bio: 'Out near Kitengela — 18 km south of Nairobi CBD (outside 10 km CBD radius).',
    lat: -1.4484, // ~18.0 km south of Nairobi CBD
    lng: 36.8172,
    activeCityLabel: 'Kitengela — Kajiado',
    isOnline: true,
    lastActiveOffsetMinutes: 8,
    interestKeywords: ['nyama choma', 'roadtrips', 'sports', 'tech'],
  },

  // --- MOMBASA INNER (2 users within 1–5 km of -4.0435, 39.6682) ---
  {
    id: 'user-msa-01',
    email: 'halima.coast@47cities.ke',
    nickname: 'HalimaBreeze',
    avatarUrl: makeAvatarSvg('HB', '#06B6D4', '#F59E0B'),
    gender: 'Woman',
    ageRange: '26-29',
    interestedIn: 'Both',
    hasChildren: false,
    homeCounty: 'Mombasa',
    lookingFor: ['Soulmate', 'Hangout', 'Chat-Mate'],
    hateWithPassion: ['Liar', 'Alcoholic'],
    bio: 'Nyali sunrise swimmer, Swahili fusion chef & coastal dhow trip lover.',
    lat: -4.0281, // ~2.8 km (Nyali)
    lng: 39.6872,
    activeCityLabel: 'Mombasa — Nyali / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 3,
    interestKeywords: ['ocean', 'food', 'swahili', 'swimming', 'hangout', 'lifestyle', 'music'],
  },
  {
    id: 'user-msa-02',
    email: 'salim.nyali@47cities.ke',
    nickname: 'SalimTide',
    avatarUrl: makeAvatarSvg('ST', '#10B981', '#2563EB'),
    gender: 'Man',
    ageRange: '30-35',
    interestedIn: 'Women',
    hasChildren: false,
    homeCounty: 'Lamu',
    lookingFor: ['Soulmate', 'Friend', 'Hangout'],
    hateWithPassion: ['Ujinga', 'Lazy'],
    bio: 'Marine logistics lead in Mombasa. Beach volleyball, kahawa tungu & good energy.',
    lat: -4.0592, // ~1.9 km (Mombasa Island / Tudor)
    lng: 39.6615,
    activeCityLabel: 'Mombasa — Nyali / CBD',
    isOnline: true,
    lastActiveOffsetMinutes: 5,
    interestKeywords: ['volleyball', 'ocean', 'coffee', 'sports', 'travel', 'hangout'],
  },

  // --- KISUMU INNER (2 users within 1–5 km of -0.0917, 34.7680) ---
  {
    id: 'user-ksm-01',
    email: 'akinyi.lake@47cities.ke',
    nickname: 'AkinyiSunset',
    avatarUrl: makeAvatarSvg('AK', '#F43F5E', '#F59E0B'),
    gender: 'Woman',
    ageRange: '23-25',
    interestedIn: 'Men',
    hasChildren: false,
    homeCounty: 'Kisumu',
    lookingFor: ['Soulmate', 'Hangout', 'Friend'],
    hateWithPassion: ['Liar', 'Lazy'],
    bio: 'Milimani pharmacist & sunset photographer along Dunga Hill Camp.',
    lat: -0.1045, // ~1.6 km (Milimani / Dunga road)
    lng: 34.7595,
    activeCityLabel: 'Kisumu — Milimani',
    isOnline: true,
    lastActiveOffsetMinutes: 4,
    interestKeywords: ['health', 'photography', 'lake', 'music', 'hangout', 'wellness'],
  },
  {
    id: 'user-ksm-02',
    email: 'otieno.dunga@47cities.ke',
    nickname: 'OtienoLake',
    avatarUrl: makeAvatarSvg('OL', '#3B82F6', '#10B981'),
    gender: 'Man',
    ageRange: '26-29',
    interestedIn: 'Both',
    hasChildren: false,
    homeCounty: 'Homa Bay',
    lookingFor: ['Friend', 'Hangout', 'Chat-Mate'],
    hateWithPassion: ['Ujinga'],
    bio: 'Agri-tech founder in Kisumu. Live ohangla-fusion nights & weekend cycling.',
    lat: -0.0812, // ~1.5 km (Kisumu CBD / Kibuye)
    lng: 34.7768,
    activeCityLabel: 'Kisumu — Milimani',
    isOnline: true,
    lastActiveOffsetMinutes: 6,
    interestKeywords: ['tech', 'cycling', 'music', 'politics', 'hangout', 'business'],
  },
] as const;

// ============================================================================
// Seeded Blackboard Posts (14 Posts across all 5 Topics)
// Includes:
// - post-milestone-10 at initialViewCount: 9 (1 view unlocks 10-view Star!)
// - post-milestone-100 at initialViewCount: 99 (1 view unlocks 100-view Star!)
// ============================================================================

export const SEED_BLACKBOARD_POSTS: readonly SeedPostRecord[] = [
  {
    id: 'post-milestone-10',
    authorId: 'user-nbo-01',
    topic: 'Hangouts',
    content:
      'Saturday sunrise Karura Forest 7km loop + iced cold brew right after at River Cafe. Who is in for an unhurried Nairobi morning? Drop a vibe if you are joining! 🌿☕',
    imageUrl: null,
    initialViewCount: 9,
    initialReaderStars: 3,
    initialReactions: { love: 4, fire: 2, vibe: 5, laugh: 0, inspire: 1 },
    createdOffsetMinutes: 14,
  },
  {
    id: 'post-milestone-100',
    authorId: 'user-nbo-02',
    topic: 'Sports',
    content:
      'Shujaa Rugby 7s energy is unmatched — if Nairobi hosted an expanded East Africa Sevens night festival under floodlights at Nyayo, that stadium would sell out in 4 hours flat. Agree or disagree? 🏉🇰🇪',
    imageUrl: null,
    initialViewCount: 99,
    initialReaderStars: 14,
    initialReactions: { love: 9, fire: 18, vibe: 7, laugh: 2, inspire: 6 },
    createdOffsetMinutes: 32,
  },
  {
    id: 'post-nbo-03',
    authorId: 'user-nbo-04',
    topic: 'Politics',
    content:
      'Real urban planning talk: if Nairobi built continuous shaded pedestrian & bike corridors linking Westlands, CBD, and Kilimani, our evening traffic and stress levels would drop overnight. Which road needs a walkable upgrade first?',
    imageUrl: null,
    initialViewCount: 46,
    initialReaderStars: 8,
    initialReactions: { love: 5, fire: 7, vibe: 4, laugh: 1, inspire: 11 },
    createdOffsetMinutes: 55,
  },
  {
    id: 'post-nbo-04',
    authorId: 'user-nbo-05',
    topic: 'Health',
    content:
      'Friendly reminder from your neighborhood nurse: 2 liters of water, 20 minutes of morning sunlight, and actually logging off by 11 PM fixes 70% of that weekday fatigue. How is your sleep streak this week? 💚',
    imageUrl: null,
    initialViewCount: 64,
    initialReaderStars: 11,
    initialReactions: { love: 12, fire: 3, vibe: 6, laugh: 2, inspire: 9 },
    createdOffsetMinutes: 78,
  },
  {
    id: 'post-nbo-05',
    authorId: 'user-nbo-03',
    topic: 'Lifestyle',
    content:
      'Spotted an indie vinyl & afro-house listening pop-up tucked behind Westlands this Friday evening. Intimate lighting, great acoustics, zero shouting over speakers — my kind of social spot. ✨🎶',
    imageUrl: null,
    initialViewCount: 27,
    initialReaderStars: 6,
    initialReactions: { love: 6, fire: 8, vibe: 9, laugh: 0, inspire: 3 },
    createdOffsetMinutes: 105,
  },
  {
    id: 'post-nbo-06',
    authorId: 'user-nbo-06',
    topic: 'Sports',
    content:
      'Honest debate: which Nairobi 5-a-side football turf has the cleanest pitch and best post-match nyama choma within walking distance? Asking for Thursday night squad plans ⚽🔥',
    imageUrl: null,
    initialViewCount: 18,
    initialReaderStars: 4,
    initialReactions: { love: 2, fire: 6, vibe: 5, laugh: 4, inspire: 0 },
    createdOffsetMinutes: 130,
  },
  {
    id: 'post-nbo-07',
    authorId: 'user-nbo-09',
    topic: 'Lifestyle',
    content:
      'Kenya’s electric boda & e-bus wave is quietly changing city air quality faster than anyone predicted. Rode a silent e-bus down Ngong Road today and felt like we jumped to 2035. ⚡🏙️',
    imageUrl: null,
    initialViewCount: 112,
    initialReaderStars: 19,
    initialReactions: { love: 11, fire: 13, vibe: 8, laugh: 1, inspire: 14 },
    createdOffsetMinutes: 165,
  },
  {
    id: 'post-nbo-08',
    authorId: 'user-nbo-11',
    topic: 'Health',
    content:
      'Sunset breathwork + mobility stretch session this Sunday at Arboretum lawn. Bring a mat, zero ego, all levels welcome — your lower back after a week at a desk will thank you. 🧘🏾‍♀️',
    imageUrl: null,
    initialViewCount: 33,
    initialReaderStars: 7,
    initialReactions: { love: 8, fire: 2, vibe: 6, laugh: 0, inspire: 7 },
    createdOffsetMinutes: 210,
  },
  {
    id: 'post-nbo-09',
    authorId: 'user-nbo-10',
    topic: 'Politics',
    content:
      'Digital public services across all 47 counties work best when citizens can track county budgets in plain language from their phones. What is one county service you wish was 100% instant online?',
    imageUrl: null,
    initialViewCount: 52,
    initialReaderStars: 9,
    initialReactions: { love: 4, fire: 6, vibe: 3, laugh: 1, inspire: 10 },
    createdOffsetMinutes: 240,
  },
  {
    id: 'post-nbo-10',
    authorId: 'user-nbo-08',
    topic: 'Hangouts',
    content:
      'Golden hour rooftop photo walk near Museum Hill at 5:15 PM today — smartphones or mirrorless cameras welcome. Best skyline frame gets coffee on me! 📸🌇',
    imageUrl: null,
    initialViewCount: 15,
    initialReaderStars: 5,
    initialReactions: { love: 5, fire: 4, vibe: 7, laugh: 1, inspire: 2 },
    createdOffsetMinutes: 275,
  },
  {
    id: 'post-nbo-11',
    authorId: 'user-nbo-07',
    topic: 'Hangouts',
    content:
      'Unpopular opinion: weekday dinner dates beat Friday night clubs every single time. You actually hear each other laugh, the kitchen isn’t rushed, and you wake up fresh. Who seconds this? 🥂',
    imageUrl: null,
    initialViewCount: 84,
    initialReaderStars: 16,
    initialReactions: { love: 15, fire: 5, vibe: 11, laugh: 3, inspire: 4 },
    createdOffsetMinutes: 320,
  },
  {
    id: 'post-nbo-12',
    authorId: 'user-nbo-12',
    topic: 'Lifestyle',
    content:
      'Classic Congolese rhumba + hot grilled tilapia on a breezy Friday evening is peak Kenyan therapy. Name the one track that instantly gets everyone on the floor 🎸✨',
    imageUrl: null,
    initialViewCount: 41,
    initialReaderStars: 7,
    initialReactions: { love: 7, fire: 6, vibe: 9, laugh: 2, inspire: 1 },
    createdOffsetMinutes: 390,
  },
  {
    id: 'post-msa-01',
    authorId: 'user-msa-01',
    topic: 'Hangouts',
    content:
      'Nyali breeze is unreal tonight — organizing a sunset dhow cruise + Swahili tapas hangout this Saturday at 4:30 PM. Mombasa crew, roll call! 🌊⛵',
    imageUrl: null,
    initialViewCount: 29,
    initialReaderStars: 8,
    initialReactions: { love: 8, fire: 5, vibe: 10, laugh: 0, inspire: 2 },
    createdOffsetMinutes: 65,
  },
  {
    id: 'post-ksm-01',
    authorId: 'user-ksm-01',
    topic: 'Lifestyle',
    content:
      'Nothing beats a Lake Victoria tangerine sunset from Dunga Hill with live acoustic guitar in the background. Kisumu really hits different at 6 PM. 🌅💛',
    imageUrl: null,
    initialViewCount: 37,
    initialReaderStars: 9,
    initialReactions: { love: 10, fire: 4, vibe: 8, laugh: 0, inspire: 5 },
    createdOffsetMinutes: 90,
  },
] as const;

// ============================================================================
// Seeded Proximity Stories (6 Stories)
// ============================================================================

export const SEED_STORIES: readonly SeedStoryRecord[] = [
  {
    id: 'story-01',
    authorId: 'user-nbo-01',
    caption: 'Morning pour-over in Kilimani before the city wakes up ☕✨',
    imageUrl: null,
    accentFrom: '#F59E0B',
    accentTo: '#F43F5E',
    topic: 'Hangouts',
    createdOffsetMinutes: 18,
  },
  {
    id: 'story-02',
    authorId: 'user-nbo-02',
    caption: 'Westlands skyline looking straight out of Neo-Nairobi 2040 🌆⚡',
    imageUrl: null,
    accentFrom: '#06B6D4',
    accentTo: '#10B981',
    topic: 'Lifestyle',
    createdOffsetMinutes: 35,
  },
  {
    id: 'story-03',
    authorId: 'user-nbo-03',
    caption: 'Spinning classic afro-soul vinyls — drop your top track 🎶💫',
    imageUrl: null,
    accentFrom: '#EC4899',
    accentTo: '#8B5CF6',
    topic: 'Lifestyle',
    createdOffsetMinutes: 52,
  },
  {
    id: 'story-04',
    authorId: 'user-nbo-05',
    caption: '10 km Karura tempo run done before 7:30 AM! Endorphins maxed 🏃🏾‍♀️💚',
    imageUrl: null,
    accentFrom: '#10B981',
    accentTo: '#06B6D4',
    topic: 'Health',
    createdOffsetMinutes: 74,
  },
  {
    id: 'story-05',
    authorId: 'user-nbo-06',
    caption: 'Soundcheck for tonight’s Ngong Road acoustic & jazz session 🎷🔥',
    imageUrl: null,
    accentFrom: '#F59E0B',
    accentTo: '#3B82F6',
    topic: 'Hangouts',
    createdOffsetMinutes: 95,
  },
  {
    id: 'story-06',
    authorId: 'user-msa-01',
    caption: 'Golden tide rolling in along Nyali beach 🌊🌴',
    imageUrl: null,
    accentFrom: '#06B6D4',
    accentTo: '#F59E0B',
    topic: 'Hangouts',
    createdOffsetMinutes: 40,
  },
] as const;
