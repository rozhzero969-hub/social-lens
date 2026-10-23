import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOAuthState } from '../lib/oauth-state';
import { encrypt, decrypt } from '../lib/crypto';
import { platformReady, authorizationUrl } from '../lib/adapters';
import { safeApiBase } from '../lib/api-config';
test('authorization state binds the provider, valid timestamp, user and constant-length random state', () => {
  const now = 1000000;
  const s = {
    userId: '11111111-1111-4111-8111-111111111111',
    state: 'a'.repeat(48),
    platform: 'tiktok',
    issuedAt: now,
  };
  assert.equal(validateOAuthState(s, 'tiktok', s.state, now).userId, s.userId);
  for (const invalid of [
    { ...s, platform: 'instagram' },
    { ...s, issuedAt: now + 1 },
    { ...s, issuedAt: now - 600001 },
    { ...s, issuedAt: NaN },
    { ...s, userId: 'other' },
    { ...s, state: 'short' },
  ])
    assert.throws(() => validateOAuthState(invalid, 'tiktok', s.state, now));
  assert.throws(() => validateOAuthState(s, 'tiktok', 'b'.repeat(48), now));
});
test('encryption rejects malformed keys and malformed ciphertext', () => {
  process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64) + 'invalid';
  assert.throws(() => encrypt({ token: 'secret' }));
  process.env.TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
  assert.throws(() => decrypt('short'));
  assert.throws(() => decrypt('not valid base64!'));
});
test('Snapchat cannot accidentally use Instagram OAuth credentials', () => {
  assert.equal(platformReady('snapchat'), false);
  assert.throws(() => authorizationUrl('snapchat', 'state'));
});
test('API configuration cannot send authentication tokens to insecure or credential-bearing URLs', () => {
  assert.equal(safeApiBase('https://backend.example'), 'https://backend.example');
  for (const input of [
    'http://remote.example',
    'https://name:secret@backend.example',
    'javascript:alert(1)',
    'https://backend.example/?token=secret',
    'https://backend.example/api',
  ])
    assert.equal(safeApiBase(input), undefined);
});
