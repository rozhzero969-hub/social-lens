'use client';
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';

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
  useEffect(() => {
    setWaiting(true);
    const timer = setTimeout(() => setWaiting(false), 12000);
    return () => clearTimeout(timer);
  }, [src, attempt]);
  return (
    <div className={`social-preview ${compact ? 'compact' : ''}`}>
      {waiting && (
        <div className="embed-loading" role="status">
          <Loader2 size={17} className="spin" /> Loading public preview…
        </div>
      )}
      <iframe
        key={src + attempt}
        src={src}
        title={title}
        className="social-frame"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={() => setWaiting(false)}
        onError={() => setWaiting(false)}
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
      {!compact && (
        <p className="helper embed-help">
          If the preview is blank or asks you to sign in, the platform is limiting its embed. You
          can reload or open the original.
        </p>
      )}
    </div>
  );
}
