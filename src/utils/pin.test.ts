import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin } from './pin.ts';

test('hashPin produces a deterministic 64-char hex digest', async () => {
  const hash1 = await hashPin('1234');
  const hash2 = await hashPin('1234');
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('hashPin produces different digests for different PINs', async () => {
  const hash1 = await hashPin('1234');
  const hash2 = await hashPin('4321');
  assert.notEqual(hash1, hash2);
});

test('verifyPin returns true for the matching PIN and false otherwise', async () => {
  const hash = await hashPin('marrenta1234');
  assert.equal(await verifyPin('marrenta1234', hash), true);
  assert.equal(await verifyPin('wrong', hash), false);
});
