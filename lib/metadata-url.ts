type MetadataEnvironment = {
  APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

// Metadata only: never use this fallback to authorize redirects or requests.
export function resolveMetadataUrl(env: MetadataEnvironment): URL {
  const candidates = [
    env.APP_URL?.trim(),
    ...[env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL].map((host) =>
      host?.trim() ? `https://${host.trim()}` : undefined,
    ),
    'http://localhost:3000',
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password
      ) {
        return new URL(url.origin);
      }
    } catch {
      // A missing or malformed optional metadata URL must not crash the build.
    }
  }
  return new URL('http://localhost:3000');
}
