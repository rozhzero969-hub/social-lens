import type { Platform } from './types';
export const capabilities = {
  instagram: {
    label: 'Instagram',
    eligibility: 'Creator and business accounts',
    scopes: ['instagram_business_basic'],
    publicMonitoring: false,
    stories: false,
    description:
      'Connect an eligible professional account to read approved profile information and media.',
  },
  tiktok: {
    label: 'TikTok',
    eligibility: 'Accounts approved for the connected app',
    scopes: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'],
    publicMonitoring: false,
    stories: false,
    description:
      'Connect your account to read approved profile details, recent videos and available counts.',
  },
} as const;
export function parseProfile(input: string, platform: Platform): string {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (host !== (platform === 'instagram' ? 'instagram.com' : 'tiktok.com'))
      throw new Error('The profile link must match the selected platform.');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1)
      throw new Error('Use a profile link, rather than a post or video link.');
    value = parts[0];
    if (platform === 'tiktok' && !value.startsWith('@'))
      throw new Error('Use a TikTok profile link containing @username.');
  }
  value = value.replace(/^@/, '').replace(/\/$/, '');
  if (
    !/^[a-zA-Z0-9._]{1,30}$/.test(value) ||
    ['p', 'reel', 'reels', 'stories', 'explore'].includes(value.toLowerCase())
  )
    throw new Error('Enter a valid profile username, using letters, numbers, dots or underscores.');
  return value.toLowerCase();
}
export const profileUrl = (p: Platform, u: string) =>
  p === 'instagram'
    ? `https://www.instagram.com/${encodeURIComponent(u)}/`
    : `https://www.tiktok.com/@${encodeURIComponent(u)}`;
export function safeContentUrl(input: string): { url: string; platform: Platform } {
  const u = new URL(input);
  if (u.protocol !== 'https:' || u.username || u.password)
    throw new Error('Use a secure Instagram or TikTok link.');
  const host = u.hostname.replace(/^www\./, '');
  if (!['instagram.com', 'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(host))
    throw new Error('Only Instagram and TikTok links are supported.');
  return { url: u.toString(), platform: host.includes('instagram') ? 'instagram' : 'tiktok' };
}
