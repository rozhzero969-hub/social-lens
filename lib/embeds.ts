import { parseProfile, profileUrl, safeContentUrl } from './platforms';
import type { Platform } from './types';

// Frames always point to the platform itself. Never render provider-supplied HTML
// or run a third-party embed script in the authenticated app's document.
export function profileEmbed(platform: Platform, input: string) {
  const username = parseProfile(input, platform);
  return {
    original: profileUrl(platform, username),
    src:
      platform === 'tiktok'
        ? `https://www.tiktok.com/embed/@${encodeURIComponent(username)}`
        : `https://www.instagram.com/${encodeURIComponent(username)}/embed/`,
  };
}

export function contentEmbed(input: string) {
  const { url, platform } = safeContentUrl(input);
  const path = new URL(url).pathname;
  if (platform === 'instagram') {
    const match = path.match(/^\/(p|reel|reels)\/([A-Za-z0-9_-]+)\/?$/);
    if (match)
      return {
        platform,
        original: `https://www.instagram.com/${match[1]}/${match[2]}/`,
        src: `https://www.instagram.com/${match[1]}/${match[2]}/embed/`,
      };
  } else {
    const match = path.match(/^\/@[A-Za-z0-9._]+\/video\/(\d+)\/?$/);
    if (match)
      return {
        platform,
        original: url,
        src: `https://www.tiktok.com/player/v1/${match[1]}?autoplay=0`,
      };
  }
  throw new Error(
    'Paste a full Instagram post/Reel link or TikTok video link. Short links and stories cannot be embedded here.',
  );
}

export const profileCollection = (platform: Platform, username: string) =>
  `Profile:${platform}:${parseProfile(username, platform)}`;
