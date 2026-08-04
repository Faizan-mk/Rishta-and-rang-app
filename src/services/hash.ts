// Local-demo only: this app has no backend yet, so there is no server to hash passwords
// properly (bcrypt/argon2). This obfuscates plaintext in on-device storage but must be
// replaced by real server-side hashing once a backend exists — never reuse in production.
export function mockHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `v1:${Math.abs(hash)}:${value.length}`;
}
