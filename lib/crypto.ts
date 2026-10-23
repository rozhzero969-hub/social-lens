import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
function key() {
  const value = process.env.TOKEN_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
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
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 131072)
    throw new Error('Invalid encrypted data.');
  const b = Buffer.from(value, 'base64url');
  if (b.length < 29) throw new Error('Invalid encrypted data.');
  const cipher = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString('utf8'),
  ) as T;
}
export { randomBytes };
