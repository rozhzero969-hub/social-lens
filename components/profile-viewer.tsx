'use client';
import { FormEvent, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type { Bookmark, Profile } from '@/lib/types';
import { contentEmbed, profileCollection, profileEmbed } from '@/lib/embeds';
import SocialEmbed from './social-embed';
import { tiktokLiveUrl } from '@/lib/platforms';

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
  const [tab, setTab] = useState<'profile' | 'saved'>('profile');
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
        <div className="segmented">
          <button onClick={() => setTab('profile')} aria-pressed={tab === 'profile'}>
            Profile
          </button>
          <button onClick={() => setTab('saved')} aria-pressed={tab === 'saved'}>
            Saved posts{saved.length ? ` · ${saved.length}` : ''}
          </button>
        </div>
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
      {tab === 'profile' && (
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
      )}
      {tab === 'saved' && (
        <section className="profile-posts">
          <h3>Save a post</h3>
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
          <div className="embedded-posts">
            {saved.map((post) => (
              <SocialEmbed key={post.id} {...post.embed} title={post.title} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
