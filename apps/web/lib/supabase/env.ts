import "server-only";

/**
 * Reads an environment variable when a client is created, not when the module
 * loads, so `next build` passes without it. The dynamic key also stops Next
 * from inlining a `NEXT_PUBLIC_*` value at build time.
 */
export function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to the app's environment.`);
  }
  return value;
}
