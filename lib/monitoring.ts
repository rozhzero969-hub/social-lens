import type { Change, Platform, Preferences } from './types';
export type Snapshot = {
  bio: string;
  followers: number | null;
  baseline_at?: string;
  known_post_ids?: string[];
  posts: { id: string; title: string; url: string; posted_at: string }[];
};
export function detectChanges(
  previous: Snapshot | null,
  current: Snapshot,
  profile: { id: string; platform: Platform; username: string; url: string },
  at = new Date().toISOString(),
): Change[] {
  if (!previous) return [];
  const base = {
    profile_id: profile.id,
    platform: profile.platform,
    username: profile.username,
    detected_at: at,
    posted_at: null,
    source_url: profile.url,
    read: false,
  };
  const result: Change[] = [];
  const ids = new Set([...(previous.known_post_ids || []), ...previous.posts.map((p) => p.id)]);
  for (const post of current.posts)
    if (
      !ids.has(post.id) &&
      (!previous.baseline_at || Date.parse(post.posted_at) > Date.parse(previous.baseline_at))
    )
      result.push({
        ...base,
        id: `${profile.id}:post:${post.id}`,
        kind: 'post',
        title: post.title || 'A new post is available',
        detail: 'First observed during a successful check after the initial baseline.',
        posted_at: post.posted_at,
        source_url: post.url,
      });
  if (previous.bio !== current.bio)
    result.push({
      ...base,
      id: `${profile.id}:bio:${at}`,
      kind: 'bio',
      title: 'Profile bio updated',
      detail: `Bio changed to “${current.bio}”.`,
    });
  if (
    current.followers !== null &&
    previous.followers !== null &&
    current.followers !== previous.followers
  ) {
    const delta = current.followers - previous.followers;
    result.push({
      ...base,
      id: `${profile.id}:metric:${at}`,
      kind: 'metric',
      title: `Follower count ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta).toLocaleString()}`,
      detail: 'Change between successful snapshots. Individual followers are not identified.',
    });
  }
  return result;
}
export function localClock(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
export function inQuietHours(start: string, end: string, time: string) {
  return start === end
    ? false
    : start < end
      ? time >= start && time < end
      : time >= start || time < end;
}
export function reportDue(p: Preferences, now = new Date()) {
  const local = localClock(p.timezone, now);
  return local.time >= p.report_time && p.last_report_date !== local.date;
}
