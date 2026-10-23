export function safeApiBase(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const u = new URL(input);
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') return undefined;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    if (
      u.protocol !== 'https:' &&
      !(process.env.NODE_ENV !== 'production' && local && u.protocol === 'http:')
    )
      return undefined;
    return u.origin;
  } catch {
    return undefined;
  }
}

// OAuth state is stored in an HttpOnly, SameSite=Lax cookie. Keep the app,
// initiation request and callback on one origin so browsers preserve that cookie.
export function connectionApiBase({
  configured,
  basePath,
  origin,
}: {
  configured?: string;
  basePath?: string;
  origin?: string;
}): string | undefined {
  const current = safeApiBase(origin);
  if (!current) return undefined;
  if (configured) return safeApiBase(configured) === current ? current : undefined;
  return basePath ? undefined : current;
}
