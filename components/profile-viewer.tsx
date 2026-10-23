'use client';
import { FormEvent, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type { Bookmark, Profile } from '@/lib/types';
import { contentEmbed, profileCollection, profileEmbed } from '@/lib/embeds';
import SocialEmbed from './social-embed';
import { storyAccess, tiktokLiveUrl } from '@/lib/platforms';

export default function ProfileViewer({
  profile,
  bookmarks,
  onSave,
}: {
  profile: Profile;
  bookmarks: Bookmark[];
  onSave: (url: string, collection: string) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const stories = storyAccess(profile.platform, profile.username);
  const collection = profileCollection(profile.platform, profile.username);
  const saved = bookmarks
    .filter((b) => b.collection === collection)
    .flatMap((b) => {
      try {
        return [{ ...b, embed: contentEmbed(b.url) }];
      } catch {
        return [];
      }
    });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError('');
    try {
      const embed = contentEmbed(String(new FormData(form).get('url') || ''));
      if (embed.platform !== profile.platform)
        throw new Error('Use a post from the same platform as this profile.');
      setSaving(true);
      await onSave(embed.original, collection);
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this post.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="profile-viewer">
      <div className="profile-viewer-nav">
        <span className="collection-label">Profile & posts</span>
        {profile.platform === 'tiktok' && (
          <a
            className="secondary live-link"
            href={tiktokLiveUrl(profile.username)}
            target="_blank"
            rel="noreferrer"
            title="Opens TikTok’s live page. Broadcast status is not verified."
          >
            Open LIVE ↗
          </a>
        )}
      </div>
      <>
        <SocialEmbed
          {...profileEmbed(profile.platform, profile.username)}
          title={`@${profile.username} public profile`}
        />
        <p className="helper">
          Public content provided by{' '}
          {profile.platform === 'snapchat'
            ? 'Snapchat'
            : profile.platform === 'instagram'
              ? 'Instagram'
              : 'TikTok'}
          . The platform controls what appears.
          {profile.platform === 'tiktok' &&
            ' LIVE opens on TikTok; current broadcast status is not verified.'}
        </p>
      </>
      <section className="profile-stories">
        {stories.mode === 'embed' ? (
          <p className="helper">
            When shared publicly, stories appear in the Snapchat preview above.
          </p>
        ) : (
          <div className="story-platform-link">
            <h3>Stories</h3>
            <p>
              Stories for @{profile.username} open on{' '}
              {profile.platform === 'instagram' ? 'Instagram' : 'TikTok'}. This platform doesn’t
              provide stories in its public profile embed.
            </p>
            <a className="primary" href={stories.url} target="_blank" rel="noreferrer">
              View on {profile.platform === 'instagram' ? 'Instagram' : 'TikTok'} ↗
            </a>
            <p className="helper">
              The platform may require sign-in. Story availability isn’t verified here.
            </p>
          </div>
        )}
      </section>
      <section className="profile-posts">
        <h3>Saved posts{saved.length ? ` · ${saved.length}` : ''}</h3>
        <details className="save-post-details">
          <summary>Save another post</summary>
          <p>Paste a public link. Your saved posts appear on all your devices.</p>
          <form onSubmit={save} className="embed-add-form">
            <label className="field">
              <span>Post or video link</span>
              <input
                type="url"
                name="url"
                required
                placeholder={
                  profile.platform === 'instagram'
                    ? 'https://www.instagram.com/reel/…'
                    : profile.platform === 'snapchat'
                      ? 'https://www.snapchat.com/spotlight/…'
                      : 'https://www.tiktok.com/@name/video/…'
                }
              />
            </label>
            <button className="primary" disabled={saving} type="submit">
              {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Save post
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </details>
        <div className="embedded-posts">
          {!saved.length && <p className="helper">No posts saved for this profile yet.</p>}
          {saved.map((post) => (
            <SocialEmbed key={post.id} {...post.embed} title={post.title} />
          ))}
        </div>
      </section>
    </div>
  );
}
