'use client';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { isTrustedEmbed } from '@/lib/embeds';

export default function SocialEmbed({
  src,
  original,
  title,
  compact = false,
}: {
  src: string;
  original: string;
  title: string;
  compact?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [slow, setSlow] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setWaiting(true);
    setSlow(false);
    pending.current = setTimeout(() => {
      setWaiting(false);
      setSlow(true);
    }, 15000);
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [src, attempt]);
  if (!isTrustedEmbed(src)) return <p role="alert">This preview source is not supported.</p>;
  return (
    <div className={`social-preview ${compact ? 'compact' : ''}`}>
      {waiting && (
        <div className="embed-loading embed-skeleton" role="status">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines" />
          <span>
            <Loader2 size={17} className="spin" /> Opening profile…
          </span>
        </div>
      )}
      <iframe
        key={src + attempt}
        src={src}
        title={title}
        className="social-frame"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={() => {
          if (pending.current) clearTimeout(pending.current);
          setWaiting(false);
          setSlow(false);
        }}
        onError={() => {
          if (pending.current) clearTimeout(pending.current);
          setWaiting(false);
          setSlow(true);
        }}
      />
      <div className="embed-tools">
        <button
          type="button"
          className="text-button"
          onClick={() => setAttempt((a) => a + 1)}
          aria-label={`Reload ${title}`}
        >
          <RefreshCw size={14} /> Reload
        </button>
        <a href={original} target="_blank" rel="noreferrer">
          Open original <ExternalLink size={14} />
        </a>
      </div>
      {slow && (
        <p className="embed-help helper" role="status">
          Taking longer than expected. Reload the preview or open it on the platform.
        </p>
      )}
      {!compact && (
        <details className="helper embed-help">
          <summary>Preview help</summary>
          <p>
            If the preview is blank or asks you to sign in, the platform is limiting its embed. You
            can reload or open the original.
          </p>
        </details>
      )}
    </div>
  );
}
