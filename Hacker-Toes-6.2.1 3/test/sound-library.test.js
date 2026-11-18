import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';

async function start(dataDir) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error(output || 'Server startup timed out')), 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
  });
  return { child, url };
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}

test('built-in starter sounds are indexed once, authenticated, and read-only', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ht6-starter-sounds-'));
  let child, socket, url;
  try {
    const soundsDir = path.join(dir, 'sounds');
    await mkdir(soundsDir, { recursive: true });
    const wav = Buffer.alloc(128);
    wav.write('RIFF', 0); wav.writeUInt32LE(120, 4); wav.write('WAVE', 8);
    await writeFile(path.join(soundsDir, 'starter.wav'), wav);
    await writeFile(path.join(dir, 'sound-library-index.json'), JSON.stringify([{
      id: 'starter-sound-test', name: 'Starter Test Chime', category: 'Interface', size: wav.length, disk: 'starter.wav'
    }]));

    ({ child, url } = await start(dir));
    const joined = await fetch(url + '/api/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Starter Library Host' })
    });
    assert.equal(joined.status, 200);
    const host = await joined.json();
    socket = io(url, { auth: { token: host.token }, transports: ['websocket'], reconnection: false });
    const state = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('State snapshot timed out')), 5000);
      socket.once('state', data => { clearTimeout(timer); resolve(data); });
      socket.once('connect_error', reject);
    });
    const sound = state.sounds.find(s => s.id === 'starter-sound-test');
    assert.ok(sound);
    assert.equal(sound.builtin, true);
    assert.equal(sound.category, 'Interface');
    const fetchSound = await fetch(url + '/sounds/starter-sound-test', { headers: { Authorization: 'Bearer ' + host.token } });
    assert.equal(fetchSound.status, 200);
    const deletion = await new Promise(resolve => socket.timeout(3000).emit('action', { type: 'sound:delete', payload: { id: 'starter-sound-test' } }, (err, result) => resolve(err ? { ok: false, error: err.message } : result)));
    assert.equal(deletion.ok, false);
    assert.match(deletion.error, /starter sounds/i);

    await stop(child); child = null;
    ({ child } = await start(dir));
    const persisted = JSON.parse(await readFile(path.join(dir, 'workspace.json'), 'utf8'));
    assert.equal(persisted.sounds.filter(s => s.id === 'starter-sound-test').length, 1);
  } finally {
    socket?.disconnect();
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  }
});
