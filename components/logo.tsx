export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="sl-logo">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="15" fill="#818cf8" />
        <circle cx="22" cy="25" r="12" fill="none" stroke="#101426" strokeWidth="3" />
        <circle cx="22" cy="25" r="5" fill="#101426" />
        <path d="m35 7 1.7 4.3L41 13l-4.3 1.7L35 19l-1.7-4.3L29 13l4.3-1.7Z" fill="#fff" />
      </svg>
      {!compact && (
        <span>
          Social<span className="logo-light">Lens</span>
        </span>
      )}
    </span>
  );
}
