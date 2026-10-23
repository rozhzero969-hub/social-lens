import type { Platform } from './types';
export const capabilities = {
  snapchat: {
    label: 'Snapchat',
    eligibility: 'Public profile previews',
    scopes: [],
    publicMonitoring: false,
    stories: false,
    description: 'View public Snapchat profiles and supported shared content.',
  },
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
  if (!['instagram', 'tiktok', 'snapchat'].includes(platform))
    throw new Error('Unsupported platform.');
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      throw new Error('Use a secure profile URL.');
    if (
      host !==
      { instagram: 'instagram.com', tiktok: 'tiktok.com', snapchat: 'snapchat.com' }[platform]
    )
      throw new Error('The profile link must match the selected platform.');
    const parts = url.pathname.split('/').filter(Boolean);
    if (platform === 'snapchat' && parts[0] === 'add') parts.shift();
    if (parts.length !== 1)
      throw new Error('Use a profile link, rather than a post or video link.');
    value = parts[0];
    if (platform === 'tiktok' && !value.startsWith('@'))
      throw new Error('Use a TikTok profile link containing @username.');
  }
  value = value.replace(/^@/, '').replace(/\/$/, '');
  if (
    !(platform === 'snapchat' ? /^[a-zA-Z][a-zA-Z0-9._-]{2,14}$/ : /^[a-zA-Z0-9._]{1,30}$/).test(
      value,
    ) ||
    ['p', 'reel', 'reels', 'stories', 'explore'].includes(value.toLowerCase())
  )
    throw new Error('Enter a valid profile username, using letters, numbers, dots or underscores.');
  return value.toLowerCase();
}
export const profileUrl = (p: Platform, input: string) => {
  const u = encodeURIComponent(parseProfile(input, p));
  return p === 'instagram'
    ? `https://www.instagram.com/${u}/`
    : p === 'snapchat'
      ? `https://www.snapchat.com/add/${u}`
      : `https://www.tiktok.com/@${u}`;
};
export const tiktokLiveUrl = (username: string) => `${profileUrl('tiktok', username)}/live`;
export function storyAccess(platform: Platform, input: string) {
  const username = parseProfile(input, platform);
  return {
    mode: platform === 'snapchat' ? ('embed' as const) : ('external' as const),
    url:
      platform === 'instagram'
        ? `https://www.instagram.com/stories/${encodeURIComponent(username)}/`
        : profileUrl(platform, username),
  };
}
export function safeContentUrl(input: string): { url: string; platform: Platform } {
  const u = new URL(input);
  if (u.protocol !== 'https:' || u.username || u.password || u.port)
    throw new Error('Use a secure Instagram or TikTok link.');
  const host = u.hostname.replace(/^www\./, '');
  if (
    !['instagram.com', 'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'snapchat.com'].includes(
      host,
    )
  )
    throw new Error('Use an Instagram, TikTok or Snapchat link.');
  return {
    url: u.toString(),
    platform:
      host === 'snapchat.com' ? 'snapchat' : host === 'instagram.com' ? 'instagram' : 'tiktok',
  };
}
