// ============================================================================
// 47 CITIES — Shared Domain Types & API Contracts (Single Source of Truth)
// ============================================================================

export type AgeRange = '20-22' | '23-25' | '26-29' | '30-35' | '36-40' | '41-50';

export type Gender = 'Man' | 'Woman';

export type InterestedIn = 'Men' | 'Women' | 'Both';

export type LookingForOption =
  | 'Soulmate'
  | 'Friend'
  | 'Hangout'
  | 'Chat-Mate'
  | 'One Night Stand';

export type HateWithPassionOption = 'Ujinga' | 'Lazy' | 'Alcoholic' | 'Liar';

export type BlackboardTopic =
  | 'Politics'
  | 'Health'
  | 'Sports'
  | 'Lifestyle'
  | 'Hangouts';

export type ReactionType = 'love' | 'fire' | 'vibe' | 'laugh' | 'inspire';

// Core platform constants
export const PROXIMITY_RADIUS_KM = 10;
export const MAX_SIMULTANEOUS_CHATS = 3;
export const MAX_SESSION_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
export const IMAGE_TTL_SECONDS = 7200; // 2 hours

/**
 * STRICT PUBLIC PROFILE CONTRACT:
 * Visible to other verified members inside the 10 km proximity gate.
 * MUST NEVER include email, lat, lng, distance, homeCounty, hasChildren,
 * lookingFor, hateWithPassion, or interestedIn.
 */
export interface PublicMemberProfile {
  id: string;
  nickname: string;
  avatarUrl: string;
  gender: Gender;
  ageRange: AgeRange;
  isOnline: boolean;
  lastActiveAt: string;
  withinProximity: true;
}

/**
 * PRIVATE SELF PROFILE CONTRACT:
 * Returned ONLY to the authenticated owner (e.g., GET /api/auth/me or profile update).
 * Never exposed to any other user.
 */
export interface PrivateUserProfile extends PublicMemberProfile {
  email: string;
  emailVerified: boolean;
  hasChildren: boolean;
  homeCounty: string;
  lookingFor: LookingForOption[];
  hateWithPassion: HateWithPassionOption[];
  interestedIn: InterestedIn;
  disclaimerSigned: boolean;
  disclaimerSignedAt: string | null;
  disclaimerSignature: string | null;
  locationActive: boolean;
  activeCityLabel: string | null;
  bio: string;
  createdAt: string;
}

// ============================================================================
// Authentication, Email Verification & Onboarding Payloads
// ============================================================================

export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  ageRange: AgeRange;
  interestedIn: InterestedIn;
  hasChildren: boolean;
  homeCounty: string;
  lookingFor: LookingForOption[];
  hateWithPassion: HateWithPassionOption[];
  bio?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyEmailPayload {
  email: string;
  code: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

export interface SignDisclaimerPayload {
  signature: string;
  confirmedAdult: boolean;
  acceptedResponsibility: boolean;
}

export interface UpdateProfilePayload {
  nickname?: string;
  avatarUrl?: string;
  gender?: Gender;
  ageRange?: AgeRange;
  interestedIn?: InterestedIn;
  hasChildren?: boolean;
  homeCounty?: string;
  lookingFor?: LookingForOption[];
  hateWithPassion?: HateWithPassionOption[];
  bio?: string;
}

export interface DevEmailMessage {
  id: string;
  to: string;
  subject: string;
  purpose: 'verify' | 'reset';
  code: string;
  text: string;
  createdAt: string;
}

// ============================================================================
// Proximity & Location Gate Contracts
// ============================================================================

export interface LocationActivatePayload {
  lat: number;
  lng: number;
  cityLabel?: string;
  source?: 'gps' | 'test-pin';
}

export interface TestCityPin {
  id: string;
  label: string;
  county: string;
  lat: number;
  lng: number;
  tagline: string;
}

// ============================================================================
// Blackboard (Public Community Feed) & Stories Contracts
// ============================================================================

export interface BlackboardPost {
  id: string;
  author: PublicMemberProfile;
  topic: BlackboardTopic;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  viewCount: number;
  starCount: number;
  readerStars: number;
  viewMilestoneStars: number;
  milestone10Unlocked: boolean;
  milestone100Unlocked: boolean;
  userHasStarred: boolean;
  reactions: Record<ReactionType, number>;
  userReaction: ReactionType | null;
  commentCount: number;
  repostCount: number;
  userHasReposted: boolean;
  userHasBookmarked: boolean;
}

export interface BlackboardComment {
  id: string;
  postId: string;
  author: PublicMemberProfile;
  content: string;
  createdAt: string;
}

export interface CreatePostPayload {
  topic: BlackboardTopic;
  content: string;
  imageUrl?: string | null;
}

export interface StoryItem {
  id: string;
  author: PublicMemberProfile;
  caption: string;
  imageUrl: string | null;
  accentFrom: string;
  accentTo: string;
  topic?: BlackboardTopic;
  createdAt: string;
  expiresAt: string;
  viewed?: boolean;
}

export interface CreateStoryPayload {
  caption: string;
  imageUrl?: string | null;
  topic?: BlackboardTopic;
  accentFrom?: string;
  accentTo?: string;
}

// ============================================================================
// 3-Window Simultaneous Chat, Voice Notes & Ephemeral Image Contracts
// ============================================================================

export type ChatMessageType = 'text' | 'voice' | 'image';

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  type: ChatMessageType;
  text: string | null;
  audioUrl: string | null;
  audioDurationSec: number | null;
  imageUrl: string | null;
  imageSizeBytes: number | null;
  imageExpiresAt: string | null;
  createdAt: string;
}

export interface ChatThread {
  threadId: string;
  peer: PublicMemberProfile;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface SessionImageBudget {
  usedBytes: number;
  maxBytes: number; // 20 MB = 20 * 1024 * 1024
  remainingBytes: number;
  activeImageCount: number;
  ttlSeconds: number; // 7200s (2 hours)
}

// ============================================================================
// Behind-the-Hood AI Companionship & Prediction Contracts
// ============================================================================

/**
 * Privacy-safe AI match suggestion.
 * `reasons` MUST ONLY describe high-level shared vibes/activity and NEVER expose
 * hidden private fields (homeCounty, hasChildren, lookingFor, hateWithPassion,
 * email, or exact coordinates/distance).
 */
export interface AIMatchSuggestion {
  member: PublicMemberProfile;
  compatibilityScore: number;
  vibeLabel: string;
  reasons: string[];
  sharedTopics: BlackboardTopic[];
  icebreaker: string;
}

export interface WhatsNextPrediction {
  id: string;
  title: string;
  subtitle: string;
  actionType: 'chat' | 'blackboard' | 'discover' | 'story' | 'topic';
  targetId?: string;
  topic?: BlackboardTopic;
  confidence: number;
}

export interface CountyPulseTopic {
  topic: BlackboardTopic;
  momentumScore: number;
  postCount: number;
  totalStars: number;
  summary: string;
  trendingTag: string;
}

export interface AIPolishResponse {
  original: string;
  polished: string;
  tone: 'bold' | 'warm' | 'witty' | 'concise';
  suggestedTopic: BlackboardTopic;
  suggestedTags: string[];
}

export interface AIIcebreakerResponse {
  targetMemberId: string;
  openers: string[];
  contextHint: string;
}

// ============================================================================
// Seed Data Record Shapes (Server Initialization Only)
// ============================================================================

export interface SeedUserRecord {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  gender: Gender;
  ageRange: AgeRange;
  interestedIn: InterestedIn;
  hasChildren: boolean;
  homeCounty: string;
  lookingFor: LookingForOption[];
  hateWithPassion: HateWithPassionOption[];
  bio: string;
  lat: number;
  lng: number;
  activeCityLabel: string;
  isOnline: boolean;
  lastActiveOffsetMinutes: number;
  interestKeywords: string[];
}

export interface SeedPostRecord {
  id: string;
  authorId: string;
  topic: BlackboardTopic;
  content: string;
  imageUrl: string | null;
  initialViewCount: number;
  initialReaderStars: number;
  initialReactions: Record<ReactionType, number>;
  createdOffsetMinutes: number;
}

export interface SeedStoryRecord {
  id: string;
  authorId: string;
  caption: string;
  imageUrl: string | null;
  accentFrom: string;
  accentTo: string;
  topic: BlackboardTopic;
  createdOffsetMinutes: number;
}
