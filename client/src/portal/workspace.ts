export function getDataCenterWorkspace(url?: string): URL | undefined {
  try {
    const candidate = new URL(url ?? '');
    if (
      candidate.origin === window.location.origin &&
      candidate.pathname === '/metabase/' &&
      !candidate.username &&
      !candidate.password &&
      !candidate.search &&
      !candidate.hash &&
      (candidate.protocol === 'http:' || candidate.protocol === 'https:')
    ) {
      return candidate;
    }
  } catch {
    // Invalid configuration never mounts a workspace or receives logout requests.
  }

  return undefined;
}
