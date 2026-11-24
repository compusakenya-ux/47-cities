import { Router, type Response } from 'express';
import type { Gender, InterestedIn } from '../../src/shared/types.js';
import {
  requireActiveLocation,
  requireAuth,
  type AuthRequest,
} from '../auth.js';
import { getDb, type UserRow } from '../db.js';
import {
  canAccessMember,
  isWithinProximity,
  matchesInterestedIn,
  toPrivateUserProfile,
  toPublicMemberProfile,
} from '../geo.js';

export const locationRouter = Router();
export const membersRouter = Router();

// ============================================================================
// POST /api/location/activate
// ============================================================================
locationRouter.post('/activate', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.userRow!;
  const lat = req.body?.lat;
  const lng = req.body?.lng;
  const cityLabel =
    typeof req.body?.cityLabel === 'string' && req.body.cityLabel.trim().length > 0
      ? req.body.cityLabel.trim().slice(0, 80)
      : 'Active 10 km Portal';

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    res.status(400).json({
      error: 'INVALID_COORDINATES',
      message: 'Valid finite latitude (-90..90) and longitude (-180..180) are required.',
    });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();

  db.prepare(
    `UPDATE users
     SET location_active = 1,
         lat = ?,
         lng = ?,
         active_city_label = ?,
         is_online = 1,
         last_active_at = ?
     WHERE id = ?`
  ).run(lat, lng, cityLabel, nowIso, user.id);

  const updatedMe = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(user.id) as unknown as UserRow;

  const candidates = db
    .prepare(
      `SELECT * FROM users
       WHERE id != ? AND email_verified = 1 AND location_active = 1`
    )
    .all(user.id) as unknown as UserRow[];

  const nearbyCount = candidates.filter(
    (other) =>
      isWithinProximity(updatedMe, other) &&
      matchesInterestedIn(
        updatedMe.interested_in as InterestedIn,
        other.gender as Gender
      )
  ).length;

  res.json({
    ok: true,
    user: toPrivateUserProfile(updatedMe),
    nearbyCount,
  });
});

// ============================================================================
// POST /api/location/deactivate
// ============================================================================
locationRouter.post('/deactivate', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.userRow!;
  const db = getDb();
  const nowIso = new Date().toISOString();

  db.prepare(
    `UPDATE users
     SET location_active = 0,
         is_online = 0,
         last_active_at = ?
     WHERE id = ?`
  ).run(nowIso, user.id);

  const updatedMe = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(user.id) as unknown as UserRow;

  res.json({
    ok: true,
    user: toPrivateUserProfile(updatedMe),
  });
});

// ============================================================================
// GET /api/members/nearby?status=all|online|offline
// Strictly enforces Location Gate, 10 km proximity, Interested In, & Privacy Shield
// ============================================================================
membersRouter.get(
  '/nearby',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const rawStatus =
      typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'all';
    const status =
      rawStatus === 'online' || rawStatus === 'offline' ? rawStatus : 'all';

    const db = getDb();
    const candidates = db
      .prepare(
        `SELECT * FROM users
         WHERE id != ? AND email_verified = 1 AND location_active = 1`
      )
      .all(me.id) as unknown as UserRow[];

    const matched = candidates
      .filter(
        (candidate) =>
          isWithinProximity(me, candidate) &&
          matchesInterestedIn(
            me.interested_in as InterestedIn,
            candidate.gender as Gender
          )
      )
      .sort((a, b) => {
        if (Boolean(b.is_online) !== Boolean(a.is_online)) {
          return Number(Boolean(b.is_online)) - Number(Boolean(a.is_online));
        }
        return String(b.last_active_at).localeCompare(String(a.last_active_at));
      });

    const onlineCount = matched.filter((u) => Boolean(u.is_online)).length;
    const offlineCount = matched.length - onlineCount;
    const totalCount = matched.length;

    const filtered =
      status === 'online'
        ? matched.filter((u) => Boolean(u.is_online))
        : status === 'offline'
          ? matched.filter((u) => !Boolean(u.is_online))
          : matched;

    const members = filtered.map((row) => toPublicMemberProfile(row));

    res.json({
      members,
      onlineCount,
      offlineCount,
      totalCount,
    });
  }
);

// ============================================================================
// GET /api/members/:id
// ============================================================================
membersRouter.get(
  '/:id',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const targetId = String(req.params.id || '');
    const db = getDb();

    const target = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(targetId) as UserRow | undefined;

    if (!target) {
      res.status(404).json({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
      return;
    }

    const access = canAccessMember(me, target);
    if (!access.allowed) {
      res.status(403).json({
        error: 'PROFILE_RESTRICTED',
        message:
          access.reason ||
          'This member is outside your 10 km proximity radius or preferences.',
      });
      return;
    }

    res.json({
      member: toPublicMemberProfile(target),
    });
  }
);
