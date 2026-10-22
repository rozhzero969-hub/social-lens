import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectChanges, inQuietHours, localClock, reportDue, Snapshot } from '../lib/monitoring';
import { parseProfile, safeContentUrl } from '../lib/platforms';
import { defaultPreferences } from '../lib/types';
import { encrypt, decrypt } from '../lib/crypto';
import { platformFetch } from '../lib/adapters';
const profile = {
  id: 'p',
  platform: 'tiktok' as const,
  username: 'test',
  url: 'https://www.tiktok.com/@test',
};
const baseline: Snapshot = {
  bio: 'A bio',
  followers: 10,
  baseline_at: '2026-10-20T10:00:00Z',
  known_post_ids: ['old'],
  posts: [{ id: 'old', title: 'Old post', url: profile.url, posted_at: '2026-10-19T10:00:00Z' }],
};
test('first sync establishes a baseline with no historical alerts', () =>
  assert.deepEqual(detectChanges(null, baseline, profile), []));
test('unchanged successful snapshots produce no changes', () =>
  assert.deepEqual(detectChanges(baseline, baseline, profile), []));
test('missing posts are not called deleted', () =>
  assert.deepEqual(detectChanges(baseline, { ...baseline, posts: [] }, profile), []));
test('older content discovered later never becomes a new post alert', () =>
  assert.equal(
    detectChanges(
      baseline,
      { ...baseline, posts: [{ ...baseline.posts[0], id: 'older' }] },
      profile,
    ).length,
    0,
  ));
test('new posts have distinct posted and detected timestamps; known IDs are suppressed', () => {
  const current = {
    ...baseline,
    posts: [
      ...baseline.posts,
      { id: 'new', title: 'New post', url: profile.url, posted_at: '2026-10-21T10:00:00Z' },
    ],
  };
  const events = detectChanges(baseline, current, profile, '2026-10-22T10:00:00Z');
  assert.equal(events.length, 1);
  assert.equal(events[0].posted_at, '2026-10-21T10:00:00Z');
  assert.notEqual(events[0].posted_at, events[0].detected_at);
  assert.equal(
    detectChanges({ ...baseline, known_post_ids: ['old', 'new'] }, current, profile).length,
    0,
  );
});
test('follower deltas only appear when both counts are available', () => {
  assert.equal(detectChanges(baseline, { ...baseline, followers: null }, profile).length, 0);
  const events = detectChanges(baseline, { ...baseline, followers: 12 }, profile);
  assert.match(events[0].title, /increased by 2/);
  assert.match(events[0].detail, /not identified/);
});
test('quiet hours cross midnight in the user local clock', () => {
  assert.equal(inQuietHours('22:00', '08:00', '23:00'), true);
  assert.equal(inQuietHours('22:00', '08:00', '07:59'), true);
  assert.equal(inQuietHours('22:00', '08:00', '08:00'), false);
  assert.equal(inQuietHours('09:00', '09:00', '09:00'), false);
});
test('reports use the selected timezone and run once per local calendar day', () => {
  const now = new Date('2026-10-22T06:01:00Z');
  assert.deepEqual(localClock('Asia/Baghdad', now), { date: '2026-10-22', time: '09:01' });
  assert.equal(reportDue(defaultPreferences, now), true);
  assert.equal(reportDue({ ...defaultPreferences, last_report_date: '2026-10-22' }, now), false);
  assert.equal(reportDue(defaultPreferences, new Date('2026-10-22T05:59:00Z')), false);
});
test('profile parsing rejects off-platform, post links and injection characters', () => {
  assert.equal(parseProfile('https://www.tiktok.com/@Studio.North', 'tiktok'), 'studio.north');
  assert.equal(parseProfile('@studio.north', 'instagram'), 'studio.north');
  for (const value of [
    'https://evil.com/name',
    'https://instagram.com/p/123',
    'https://instagram.com/name/extra',
    '<script>',
    'https://instagram.com/reel',
  ])
    assert.throws(() => parseProfile(value, 'instagram'));
});
test('bookmarks accept only HTTPS social-platform origins', () => {
  assert.equal(safeContentUrl('https://www.instagram.com/p/abc/').platform, 'instagram');
  for (const url of [
    'javascript:alert(1)',
    'http://tiktok.com/@test',
    'https://tiktok.com.evil.com/',
    'https://user:pass@tiktok.com/',
  ])
    assert.throws(() => safeContentUrl(url));
});
test('tokens are authenticated encrypted; tampering fails closed', () => {
  process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  const sealed = encrypt({ access_token: 'private' });
  assert.ok(!sealed.includes('private'));
  assert.deepEqual(decrypt(sealed), { access_token: 'private' });
  const bytes = Buffer.from(sealed, 'base64url');
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => decrypt(bytes.toString('base64url')));
});
test('failed platform checks throw rather than produce an empty successful snapshot', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ error: { code: 'rate_limit_exceeded' } }, { status: 429 });
    await assert.rejects(
      platformFetch('https://open.tiktokapis.com/v2/user/info/'),
      /could not complete/,
    );
    globalThis.fetch = async () =>
      Response.json({ error: { message: 'Invalid token', code: 190 } }, { status: 401 });
    await assert.rejects(platformFetch('https://graph.instagram.com/me'), /expired/);
  } finally {
    globalThis.fetch = original;
  }
});
