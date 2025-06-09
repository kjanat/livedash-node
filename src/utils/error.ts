export function formatError(error: unknown): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    error: 'Internal Server Error',
    message: error instanceof Error ? error.message : 'Unknown error'
  };
  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV !== 'production'
  ) {
    payload.stack = error instanceof Error ? error.stack : undefined;
  }
  return payload;
}
