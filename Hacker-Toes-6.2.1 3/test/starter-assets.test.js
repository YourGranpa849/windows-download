import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('compact distribution omits the optional 1,000-effect WAV collection', async () => {
  const soundDirectory = path.join(root, 'data', 'sounds');
  const files = await readdir(soundDirectory);
  const bundledStarterWavs = files.filter(name => /^ht6-[a-z0-9-]+-\d{3}\.wav$/i.test(name));
  assert.equal(bundledStarterWavs.length, 0, 'the compact ZIP must not bundle the optional starter WAV collection');
  await assert.rejects(
    access(path.join(root, 'data', 'sound-library-index.json')),
    { code: 'ENOENT' },
    'the compact ZIP must not advertise a starter index whose WAV assets are absent'
  );
});
