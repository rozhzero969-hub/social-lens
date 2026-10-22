import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentEmbed, profileCollection, profileEmbed } from '../lib/embeds';

test('profile frames use fixed platform origins and validated usernames', () => {
  assert.equal(profileEmbed('tiktok', '@scout2015').src, 'https://www.tiktok.com/embed/@scout2015');
  assert.equal(
    profileEmbed('instagram', 'https://instagram.com/instagram/').src,
    'https://www.instagram.com/instagram/embed/',
  );
  for (const input of ['<script>', '//evil.com', 'https://evil.com/a', 'name/../../other'])
    assert.throws(() => profileEmbed('instagram', input));
});
test('post embeds accept only known content paths, never arbitrary iframe sources', () => {
  assert.equal(
    contentEmbed('https://www.tiktok.com/@scout2015/video/6718335390845095173').src,
    'https://www.tiktok.com/player/v1/6718335390845095173?autoplay=0',
  );
  assert.equal(
    contentEmbed('https://instagram.com/reel/AbC_-123/?utm_source=test').src,
    'https://www.instagram.com/reel/AbC_-123/embed/',
  );
  for (const input of [
    'javascript:alert(1)',
    'https://instagram.com.evil.com/p/x',
    'https://instagram.com/accounts/login',
    'https://instagram.com/stories/user/123',
    'https://vm.tiktok.com/short',
    'https://tiktok.com/@name',
  ])
    assert.throws(() => contentEmbed(input));
});
test('profile collections normalize consistently across devices', () => {
  assert.equal(
    profileCollection('instagram', '@Some.Name'),
    profileCollection('instagram', 'some.name'),
  );
  assert.notEqual(profileCollection('instagram', 'name'), profileCollection('tiktok', 'name'));
});
