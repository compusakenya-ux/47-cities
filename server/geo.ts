import {
  PROXIMITY_RADIUS_KM,
  type AgeRange,
  type Gender,
  type HateWithPassionOption,
  type InterestedIn,
  type LookingForOption,
  type PrivateUserProfile,
  type PublicMemberProfile,
} from '../src/shared/types.js';

export interface GeoUserLike {
  id?: string;
  lat?: number | null;
  lng?: number | null;
  location_active?: number | boolean | null;
  email_verified?: number | boolean | null;
  gender?: string | null;
  interested_in?: string | null;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle Haversine distance in kilometers between two GPS points.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Strictly enforces the 10 km proximity radius and active location requirement.
 */
export function isWithinProximity(u1: GeoUserLike, u2: GeoUserLike): boolean {
  if (!u1 || !u2) return false;
  if (!u1.location_active || !u2.location_active) return false;
  if (
    typeof u1.lat !== 'number' ||
    typeof u1.lng !== 'number' ||
    typeof u2.lat !== 'number' ||
    typeof u2.lng !== 'number' ||
    !Number.isFinite(u1.lat) ||
    !Number.isFinite(u1.lng) ||
    !Number.isFinite(u2.lat) ||
    !Number.isFinite(u2.lng)
  ) {
    return false;
  }

  return haversineKm(u1.lat, u1.lng, u2.lat, u2.lng) <= PROXIMITY_RADIUS_KM;
}

/**
 * Checks whether a target member's gender matches the viewer's "Interested In" setting.
 */
export function matchesInterestedIn(
  viewerInterestedIn: InterestedIn,
  targetGender: Gender
): boolean {
  if (viewerInterestedIn === 'Both') return true;
  if (viewerInterestedIn === 'Men') return targetGender === 'Man';
  if (viewerInterestedIn === 'Women') return targetGender === 'Woman';
  return false;
}

/**
 * STRICT PRIVACY SHIELD:
 * Serializes another member's DB row into ONLY the permitted public fields:
 * id, nickname, avatarUrl, gender, ageRange, isOnline, lastActiveAt, withinProximity: true.
 * NEVER exposes email, lat, lng, distance, homeCounty, hasChildren, lookingFor,
 * hateWithPassion, or interestedIn.
 */
export function toPublicMemberProfile(row: Record<string, any>): PublicMemberProfile {
  return {
    id: String(row.id),
    nickname: String(row.nickname),
    avatarUrl: String(row.avatar_url),
    gender: row.gender as Gender,
    ageRange: row.age_range as AgeRange,
    isOnline: Boolean(row.is_online),
    lastActiveAt: String(row.last_active_at),
    withinProximity: true,
  };
}

function safeParseArray<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (typeof json !== 'string' || !json.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * PRIVATE SELF PROFILE:
 * Returned ONLY to the authenticated owner (never to other members).
 */
export function toPrivateUserProfile(row: Record<string, any>): PrivateUserProfile {
  return {
    ...toPublicMemberProfile(row),
    email: String(row.email),
    emailVerified: Boolean(row.email_verified),
    hasChildren: Boolean(row.has_children),
    homeCounty: String(row.home_county),
    lookingFor: safeParseArray<LookingForOption>(row.looking_for_json),
    hateWithPassion: safeParseArray<HateWithPassionOption>(row.hate_with_passion_json),
    interestedIn: row.interested_in as InterestedIn,
    disclaimerSigned: Boolean(row.disclaimer_signed),
    disclaimerSignedAt: row.disclaimer_signed_at ? String(row.disclaimer_signed_at) : null,
    disclaimerSignature: row.disclaimer_signature ? String(row.disclaimer_signature) : null,
    locationActive: Boolean(row.location_active),
    activeCityLabel: row.active_city_label ? String(row.active_city_label) : null,
    bio: row.bio ? String(row.bio) : '',
    createdAt: String(row.created_at),
  };
}

/**
 * Enforces proximity (<= 10 km), active location, email verification,
 * and Interested In preference when viewing or chatting with another member.
 */
export function canAccessMember(
  viewerRow: GeoUserLike | null | undefined,
  targetRow: GeoUserLike | null | undefined
): { allowed: boolean; reason?: string } {
  if (!viewerRow || !targetRow) {
    return { allowed: false, reason: 'Member not found.' };
  }

  if (
    !viewerRow.location_active ||
    typeof viewerRow.lat !== 'number' ||
    typeof viewerRow.lng !== 'number'
  ) {
    return {
      allowed: false,
      reason: 'Turn on your location to view or message nearby members.',
    };
  }

  if (!targetRow.email_verified) {
    return {
      allowed: false,
      reason: 'This member account is not verified.',
    };
  }

  if (viewerRow.id && targetRow.id && viewerRow.id === targetRow.id) {
    return { allowed: true };
  }

  if (!isWithinProximity(viewerRow, targetRow)) {
    return {
      allowed: false,
      reason: 'This member is outside your 10 km proximity radius.',
    };
  }

  const viewerInterested = viewerRow.interested_in as InterestedIn;
  const targetGender = targetRow.gender as Gender;
  if (!matchesInterestedIn(viewerInterested, targetGender)) {
    return {
      allowed: false,
      reason: 'This member does not match your Interested In preference.',
    };
  }

  return { allowed: true };
}
