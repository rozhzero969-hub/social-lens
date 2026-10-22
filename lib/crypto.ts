import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
function key() {
  const value = process.env.TOKEN_ENCRYPTION_KEY;
  if (!value || Buffer.from(value, 'hex').length !== 32)
    throw new Error('Set a 32-byte TOKEN_ENCRYPTION_KEY before connecting accounts.');
  return Buffer.from(value, 'hex');
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function decrypt<T>(value: string): T {
  const b = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString('utf8'),
  ) as T;
}
export { randomBytes };
