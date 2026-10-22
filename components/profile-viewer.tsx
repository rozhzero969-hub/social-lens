'use client';
import { FormEvent, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type { Bookmark, Profile } from '@/lib/types';
import { contentEmbed, profileCollection, profileEmbed } from '@/lib/embeds';
import SocialEmbed from './social-embed';

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
      <SocialEmbed
        {...profileEmbed(profile.platform, profile.username)}
        title={`@${profile.username} public profile`}
      />
      <div className="profile-preview-note">
        This is the platform’s public preview. Available photos, profile details and recent posts
        appear inside it. Stories, highlights and the complete post archive are not provided by
        these embeds.
      </div>
      <section className="profile-posts">
        <h3>Posts you want to keep</h3>
        <p>
          Paste a public post or video link to view it here and save it to this profile. Saved posts
          sync to your other devices.
        </p>
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
    </div>
  );
}
