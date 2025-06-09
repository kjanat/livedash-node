export function formatError(error: unknown, env?: { WORKER_ENV?: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    error: 'Internal Server Error',
    message: error instanceof Error ? error.message : 'Unknown error'
  };
  
  // Only include stack trace in development environment
  // In Cloudflare Workers, check environment via env parameter
  const isDevelopment = env?.WORKER_ENV !== 'production';
  
  if (isDevelopment) {
    payload.stack = error instanceof Error ? error.stack : undefined;
  }
  
  return payload;
}
