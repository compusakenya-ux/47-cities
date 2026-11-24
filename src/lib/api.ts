import type {
  AIIcebreakerResponse,
  AIMatchSuggestion,
  AIPolishResponse,
  BlackboardComment,
  BlackboardPost,
  BlackboardTopic,
  ChatMessage,
  ChatThread,
  CountyPulseTopic,
  CreatePostPayload,
  CreateStoryPayload,
  DevEmailMessage,
  LocationActivatePayload,
  LoginPayload,
  PrivateUserProfile,
  PublicMemberProfile,
  ReactionType,
  RegisterPayload,
  ResetPasswordPayload,
  SessionImageBudget,
  SignDisclaimerPayload,
  StoryItem,
  UpdateProfilePayload,
  VerifyEmailPayload,
  WhatsNextPrediction,
} from '../shared/types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers = new Headers(init.headers);
  if (!isFormData && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const code =
      typeof data.error === 'string'
        ? data.error
        : typeof data.code === 'string'
          ? data.code
          : `HTTP_${res.status}`;
    const message =
      typeof data.message === 'string'
        ? data.message
        : typeof data.error === 'string'
          ? data.error
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, code, message, data);
  }

  return data as T;
}

// ============================================================================
// Auth & Profile API
// ============================================================================

export type RegisterWithDisclaimerPayload = RegisterPayload &
  SignDisclaimerPayload & {
    avatarUrl?: string;
  };

export async function register(
  payload: RegisterWithDisclaimerPayload
): Promise<{ ok: true; email: string; verificationRequired: boolean }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(
  payload: LoginPayload
): Promise<{ ok: true; user: PrivateUserProfile }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<{ ok: true; clearedImages: number }> {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
  });
}

export async function verifyEmail(
  payload: VerifyEmailPayload
): Promise<{ ok: true; user: PrivateUserProfile }> {
  return apiRequest('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendCode(
  email: string,
  purpose: 'verify' | 'reset' = 'verify'
): Promise<{ ok: true; email?: string }> {
  return apiRequest('/api/auth/resend-code', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  });
}

export async function forgotPassword(
  email: string
): Promise<{ ok: true; email?: string }> {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<{ ok: true }> {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<{
  user: PrivateUserProfile | null;
  authenticated?: boolean;
}> {
  return apiRequest('/api/auth/me', { method: 'GET' });
}

export async function getDevInbox(
  email?: string
): Promise<{ messages: DevEmailMessage[] }> {
  const query = email ? `?email=${encodeURIComponent(email)}` : '';
  return apiRequest(`/api/auth/dev-inbox${query}`, { method: 'GET' });
}

export async function updateProfile(
  payload: UpdateProfilePayload
): Promise<{ user: PrivateUserProfile }> {
  return apiRequest('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(
  fileOrDataUrl: File | string
): Promise<{ user: PrivateUserProfile }> {
  if (typeof fileOrDataUrl === 'string') {
    return apiRequest('/api/profile/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl: fileOrDataUrl }),
    });
  }
  const form = new FormData();
  form.append('avatar', fileOrDataUrl);
  return apiRequest('/api/profile/avatar', {
    method: 'POST',
    body: form,
  });
}

// ============================================================================
// Location & Nearby Members API
// ============================================================================

export async function activateLocation(
  payload: LocationActivatePayload
): Promise<{ ok: true; user: PrivateUserProfile; nearbyCount: number }> {
  return apiRequest('/api/location/activate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deactivateLocation(): Promise<{
  ok: true;
  user: PrivateUserProfile;
}> {
  return apiRequest('/api/location/deactivate', {
    method: 'POST',
  });
}

export async function getNearbyMembers(
  status: 'all' | 'online' | 'offline' = 'all'
): Promise<{
  members: PublicMemberProfile[];
  onlineCount: number;
  offlineCount: number;
  totalCount: number;
}> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/api/members/nearby${query}`, { method: 'GET' });
}

export async function getMemberById(
  id: string
): Promise<{ member: PublicMemberProfile }> {
  return apiRequest(`/api/members/${encodeURIComponent(id)}`, { method: 'GET' });
}

// ============================================================================
// Blackboard & Proximity Stories API
// ============================================================================

export async function getBlackboardPosts(
  topic: BlackboardTopic | 'All' = 'All',
  sort: 'forYou' | 'latest' | 'stars' = 'forYou'
): Promise<{ posts: BlackboardPost[] }> {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  if (sort) params.set('sort', sort);
  return apiRequest(`/api/blackboard?${params.toString()}`, { method: 'GET' });
}

export async function createBlackboardPost(
  payload: CreatePostPayload
): Promise<{ post: BlackboardPost }> {
  return apiRequest('/api/blackboard', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function recordPostView(
  postId: string
): Promise<{ post: BlackboardPost; unlockedMilestone: 100 | 10 | null }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/view`, {
    method: 'POST',
  });
}

export async function togglePostStar(
  postId: string
): Promise<{ post: BlackboardPost }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/star`, {
    method: 'POST',
  });
}

export async function togglePostReaction(
  postId: string,
  reaction: ReactionType
): Promise<{ post: BlackboardPost }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/react`, {
    method: 'POST',
    body: JSON.stringify({ reaction }),
  });
}

export async function togglePostRepost(
  postId: string
): Promise<{ post: BlackboardPost }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/repost`, {
    method: 'POST',
  });
}

export async function togglePostBookmark(
  postId: string
): Promise<{ post: BlackboardPost }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/bookmark`, {
    method: 'POST',
  });
}

export async function getPostComments(
  postId: string
): Promise<{ comments: BlackboardComment[] }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/comments`, {
    method: 'GET',
  });
}

export async function addPostComment(
  postId: string,
  content: string
): Promise<{ comment: BlackboardComment; commentCount?: number }> {
  return apiRequest(`/api/blackboard/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function getStories(): Promise<{ stories: StoryItem[] }> {
  return apiRequest('/api/stories', { method: 'GET' });
}

export async function createStory(
  payload: CreateStoryPayload
): Promise<{ story: StoryItem }> {
  return apiRequest('/api/stories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markStoryViewed(storyId: string): Promise<{ ok: true }> {
  return apiRequest(`/api/stories/${encodeURIComponent(storyId)}/view`, {
    method: 'POST',
  });
}

// ============================================================================
// Multi-Window Chat, Voice & Ephemeral Images API
// ============================================================================

export async function getChatThreads(): Promise<{
  threads: ChatThread[];
  budget: SessionImageBudget;
}> {
  return apiRequest('/api/chat/threads', { method: 'GET' });
}

export async function getChatMessages(peerId: string): Promise<{
  threadId: string;
  peer: PublicMemberProfile;
  messages: ChatMessage[];
  budget: SessionImageBudget;
}> {
  return apiRequest(`/api/chat/messages/${encodeURIComponent(peerId)}`, {
    method: 'GET',
  });
}

export async function sendTextMessage(
  peerId: string,
  text: string
): Promise<{ message: ChatMessage; extractedTopics: string[] }> {
  return apiRequest(`/api/chat/messages/${encodeURIComponent(peerId)}/text`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function sendVoiceMessage(
  peerId: string,
  payload: FormData | { audioDataUrl: string; durationSec: number }
): Promise<{ message: ChatMessage }> {
  if (payload instanceof FormData) {
    return apiRequest(`/api/chat/messages/${encodeURIComponent(peerId)}/voice`, {
      method: 'POST',
      body: payload,
    });
  }
  return apiRequest(`/api/chat/messages/${encodeURIComponent(peerId)}/voice`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendImageMessage(
  peerId: string,
  fileOrData: File | { imageDataUrl: string; fileName?: string }
): Promise<{ message: ChatMessage; budget: SessionImageBudget }> {
  if (fileOrData instanceof File) {
    const form = new FormData();
    form.append('image', fileOrData);
    return apiRequest(`/api/chat/messages/${encodeURIComponent(peerId)}/image`, {
      method: 'POST',
      body: form,
    });
  }
  return apiRequest(`/api/chat/messages/${encodeURIComponent(peerId)}/image`, {
    method: 'POST',
    body: JSON.stringify(fileOrData),
  });
}

export async function getImageBudget(): Promise<{ budget: SessionImageBudget }> {
  return apiRequest('/api/chat/image-budget', { method: 'GET' });
}

export async function clearSessionImages(): Promise<{
  ok: true;
  clearedCount: number;
  budget: SessionImageBudget;
}> {
  return apiRequest('/api/chat/clear-session-images', {
    method: 'POST',
  });
}

export function beaconClearSessionImages(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify({ reason: 'session_end' })], {
      type: 'application/json',
    });
    navigator.sendBeacon('/api/chat/clear-session-images', blob);
  }
}

// ============================================================================
// Behind-the-Hood AI Co-Pilot API
// ============================================================================

export async function getAIMatches(): Promise<{
  matches: AIMatchSuggestion[];
  minedInterests: string[];
}> {
  return apiRequest('/api/ai/matches', { method: 'GET' });
}

export async function getWhatsNext(): Promise<{
  predictions: WhatsNextPrediction[];
  countyPulse: CountyPulseTopic[];
}> {
  return apiRequest('/api/ai/whats-next', { method: 'GET' });
}

export async function getAIIcebreaker(
  targetMemberId: string
): Promise<AIIcebreakerResponse> {
  return apiRequest('/api/ai/icebreaker', {
    method: 'POST',
    body: JSON.stringify({ targetMemberId }),
  });
}

export async function polishPost(
  content: string,
  topic?: BlackboardTopic
): Promise<AIPolishResponse> {
  return apiRequest('/api/ai/polish-post', {
    method: 'POST',
    body: JSON.stringify({ content, topic }),
  });
}
