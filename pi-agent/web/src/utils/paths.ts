/** Prefix site-root paths without changing external, fragment, or relative URLs. */
export function withBase(path: string, base = import.meta.env.BASE_URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const prefix = base.replace(/\/+$/, '');
  if (!prefix || path === prefix ||
      path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`)) {
    return path;
  }
  return `${prefix}${path}`;
}
