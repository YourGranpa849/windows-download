import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {hostIsLocal,isInternetRequest,clientAddress,isSecureRequest,validPublicUrl} from './access.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'sounds'), { recursive: true });
const statePath = path.join(dataDir, 'workspace.json');
const controlPath = path.join(dataDir, 'host-control.json');
const controlToken = randomBytes(32).toString('hex');
const remoteMode = process.env.REMOTE_MODE === '1';
const remoteAccessPath = path.join(dataDir,'remote-access.json');
const joinCodePath = path.join(dataDir,'join-code.json');
let joinCode = { enabled: false, salt: '', hash: '' };
try { const saved = JSON.parse(fs.readFileSync(joinCodePath, 'utf8')); if (saved && typeof saved.enabled === 'boolean' && typeof saved.salt === 'string' && typeof saved.hash === 'string') joinCode = saved; } catch (e) { if (e.code !== 'ENOENT') throw new Error('Join-code settings cannot be read. Restore data/join-code.json from backup. ' + e.message); }
function persistJoinCode() { fs.writeFileSync(joinCodePath, JSON.stringify(joinCode), { mode: 0o600 }); }
// Always create the join-code settings file on first launch so the host setting is present in the data directory.
if (!fs.existsSync(joinCodePath)) persistJoinCode();
function verifyJoinCode(candidate) { if (!joinCode.enabled) return true; if (typeof candidate !== 'string' || !/^\d{4}$/.test(candidate) || !joinCode.salt || !/^[a-f0-9]{64}$/i.test(joinCode.hash)) return false; const actual = scryptSync(candidate, joinCode.salt, 32); const expected = Buffer.from(joinCode.hash, 'hex'); return expected.length === actual.length && timingSafeEqual(actual, expected); }
let remoteAccess;
if(remoteMode){try{remoteAccess=JSON.parse(fs.readFileSync(remoteAccessPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;remoteAccess={inviteKey:randomBytes(24).toString('base64url')};fs.writeFileSync(remoteAccessPath,JSON.stringify(remoteAccess),{mode:0o600});}}
if(remoteMode&&!/^[A-Za-z0-9_-]{32}$/.test(remoteAccess?.inviteKey||''))throw Error('Invalid internet invite configuration. Restore data/remote-access.json before starting.');
let publicUrl=validPublicUrl(process.env.PUBLIC_URL)||'';
const id = () => randomUUID();
const now = () => Date.now();
const text = (v, n = 4000) => typeof v === 'string' ? v.replace(/\u0000/g, '').slice(0, n).trim() : '';
const fail = (message) => { throw new Error(message); };
const initial = () => ({ version: 5, settings: { name: 'The local hangout', description: 'Good company. Zero accounts.', locked: false, retention: 0 }, users: [], channels: [
  { id: 'general', name: 'general', topic: 'The place for a little bit of everything.', category: 'THE HANGOUT', kind: 'text', createdBy: 'system', created: now(), members: [], slow: 0 },
  { id: 'introductions', name: 'introductions', topic: 'New around here? Say hello.', category: 'THE HANGOUT', kind: 'text', createdBy: 'system', created: now(), members: [], slow: 0 },
  { id: 'random', name: 'random', topic: 'Good finds, wild ideas, and everything in between.', category: 'THE HANGOUT', kind: 'text', createdBy: 'system', created: now(), members: [], slow: 0 },
  { id: 'projects', name: 'projects', topic: 'Make something great together.', category: 'MAKE STUFF', kind: 'text', createdBy: 'system', created: now(), members: [], slow: 0 },
  { id: 'resources', name: 'resources', topic: 'Useful links and files, all in one place.', category: 'MAKE STUFF', kind: 'text', createdBy: 'system', created: now(), members: [], slow: 0 }
], messages: [{ id: id(), channel: 'general', user: 'system', text: 'Welcome to Hacker Toes 6.0 👋\nThis is your own little corner of the internet. Pick a name, invite your people, and make yourself at home.\n\nTry sharing a file, starting a poll, or creating a channel for your next big idea.', created: now(), reactions: {}, pinned: true, attachments: [] }], files: [], sounds: [], scheduled: [], tasks: [], notes: {}, audit: [] });
let state;
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('Workspace cannot be read. Restore data/workspace.json from your backup. ' + e.message); state = initial(); }
if (!Array.isArray(state.sounds)) state.sounds = [];
const save = () => { const tmp = statePath + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, statePath); };
const soundLibraryIndexPath = path.join(dataDir,'sound-library-index.json');
try { const seeds = JSON.parse(fs.readFileSync(soundLibraryIndexPath,'utf8')); if (Array.isArray(seeds)) { const known = new Set(state.sounds.map(s=>s.id)); let added = 0; for (const seed of seeds) { if (!seed || typeof seed.id !== 'string' || known.has(seed.id) || typeof seed.disk !== 'string' || path.basename(seed.disk) !== seed.disk) continue; if (!fs.existsSync(path.join(dataDir,'sounds',seed.disk))) continue; state.sounds.push({ id:seed.id, name:text(seed.name,80)||'Starter sound', category:text(seed.category,32)||'Starter library', size:Number(seed.size)||0, mime:'audio/wav', disk:seed.disk, user:'system', created:now(), builtin:true }); known.add(seed.id); added++; } if (added) save(); } } catch (e) { if (e.code !== 'ENOENT') console.error('Starter sound library could not be loaded: '+e.message); }
const userByToken = (token) => typeof token === 'string' && state.users.find(u => u.tokenHash === createHash('sha256').update(token).digest('hex'));
const active = new Map();
const calls = new Map();
const playbacks = new Map();
const systemVolumeRequests = new Map();
const rate = new Map();
const soundSendCooldowns = new Map(); // Per sender/recipient cooldown.
const teacherAlerts = new Map(); // At most one active alert per recipient.
const teacherAlertCooldowns = new Map();
const SOUND_SEND_COOLDOWN_MS = Math.max(0, Math.min(30000, Number(process.env.SOUND_SEND_COOLDOWN_MS) || 3000));
const TEACHER_ALERT_DURATION_MS = 35000;
function limit(key, max, ms) { const row = rate.get(key) || { count: 0, until: now() + ms }; if (row.until < now()) { row.count = 0; row.until = now() + ms; } row.count++; rate.set(key, row); if (row.count > max) fail('A little too fast. Please wait a moment.'); }
const publicUser = u => ({ id: u.id, name: u.name, color: u.color, emoji: u.emoji, bio: u.bio, status: u.status, customStatus: u.customStatus, role: u.role, created: u.created, online: active.has(u.id) && u.status !== 'invisible', lastSeen: u.lastSeen, mutedUntil: u.mutedUntil || 0, soundboardReceive: u.soundboardReceive !== false, soundboardMuted: !!u.soundboardMuted, soundRemoteVolumeControl: u.soundRemoteVolumeControl === true, systemVolumeRemoteControl: u.systemVolumeRemoteControl === true, soundRemoteTransportControl: u.soundRemoteTransportControl === true, soundMinigame: u.soundMinigame === true, soundMonitorShare: u.soundMonitorShare === true, teacherAlertReceive: u.teacherAlertReceive !== false, soundMaxVolume: Math.max(30, Math.min(150, Number(u.soundMaxVolume) || 100)) });
const publicSound = s => ({ id: s.id, name: s.name, category: s.category || 'Unsorted', size: s.size, mime: s.mime, user: s.user, created: s.created, builtin: !!s.builtin });
const canSee = (u, c) => c && (c.kind === 'text' || c.members.includes(u.id));
const isMod = u => ['owner', 'moderator'].includes(u.role);
const canManage = (u, c) => isMod(u) || c.createdBy === u.id;
const getChannel = (u, cid) => { const c = state.channels.find(c => c.id === cid); if (!canSee(u, c)) fail('Channel not found.'); return c; };
const getMessage = (u, mid) => { const m = state.messages.find(m => m.id === mid); if (!m) fail('Message not found.'); getChannel(u, m.channel); return m; };
function editable(u, c) { if (c.archived) fail('This channel is archived.'); if (u.mutedUntil > now()) fail('You are temporarily timed out.'); if (c.readOnly && !canManage(u, c)) fail('Only moderators can post in this channel.'); }
function snapshot(u) {
  const channels = state.channels.filter(c => canSee(u, c)); const visible = new Set(channels.map(c => c.id));
  return { me: publicUser(u), settings: state.settings, users: state.users.filter(v => !v.banned).map(publicUser), channels, messages: state.messages.filter(m => visible.has(m.channel)), tasks: state.tasks.filter(t => visible.has(t.channel)), scheduled: state.scheduled.filter(m => m.user === u.id), notes: state.notes[u.id] || '', sounds: state.sounds.map(publicSound), audit: isMod(u) ? state.audit.slice(-100).reverse() : [], serverTime: now() };
}
function broadcast() { save(); for (const s of io.sockets.sockets.values()) { const u = state.users.find(u => u.id === s.data.uid); if (u && !u.banned) s.emit('state', snapshot(u)); } }
function log(u, action) { state.audit.push({ id: id(), user: u.id, action, created: now() }); state.audit = state.audit.slice(-500); }
const isLoopback = hostIsLocal;
const sameOrigin = req => { if (!req.headers.origin) return true; try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
const cookieToken = req => { try { return decodeURIComponent((req.headers.cookie || '').split('; ').find(c => c.startsWith('ht_session='))?.slice(11) || ''); } catch { return ''; } };
const auth = (req, res, next) => { const token = req.headers.authorization?.replace(/^Bearer /, '') || cookieToken(req); const u = userByToken(token); if (!u || u.banned) return res.status(401).json({ error: 'Join the hangout first.' }); req.user = u; next(); };
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Open Hacker Toes directly to continue.' });
  if(isInternetRequest(req)&&!remoteMode)return res.status(403).json({error:'Internet access is off. Use the Internet Server launcher on the host.'});
  if(remoteMode&&isInternetRequest(req)&&!isSecureRequest(req))return res.status(403).json({error:'Use the private HTTPS invite link for internet access.'});
  next();
});
app.use(express.json({ limit: '64kb' }));
let port = Number(process.env.PORT || 5050);
const addresses = () => Object.values(os.networkInterfaces()).flat().filter(n => n.family === 'IPv4' && !n.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n => `http://${n.address}:${port}`);
app.get('/api/info', (req, res) => res.json({ name: state.settings.name, description: state.settings.description, locked: state.settings.locked, version: appVersion, requiresJoinCode: !!joinCode.enabled, addresses: isInternetRequest(req)?[]:addresses(), online: [...active.keys()].filter(uid => state.users.find(u => u.id === uid)?.status !== 'invisible').length, maxFileSize: 20 * 1024 * 1024, remoteMode, publicUrl, requiresInvite:remoteMode&&!isLoopback(req)&&!joinCode.enabled, hostLocal:isLoopback(req) }));
app.get('/api/health', (req, res) => res.json({ ok: true, version: appVersion }));
app.post('/api/host/stop', (req, res) => {
  if (!isLoopback(req) || req.headers.authorization !== 'Bearer ' + controlToken) return res.status(403).json({error:'Host computer access required.'});
  res.json({ok:true}); setTimeout(shutdown,100);
});
app.post('/api/host/remote-url',(req,res)=>{
  if(!remoteMode||!isLoopback(req)||req.headers.authorization!=='Bearer '+controlToken)return res.status(403).json({error:'Host computer access required.'});
  const valid=validPublicUrl(req.body.url);if(!valid)return res.status(400).json({error:'A valid public HTTPS address is required.'});publicUrl=valid;res.json({ok:true});
});
app.get('/api/invite',auth,(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({remoteMode,publicUrl,addresses:addresses(),link:remoteMode&&publicUrl?(joinCode.enabled?publicUrl:`${publicUrl}/#invite=${remoteAccess.inviteKey}`):null,inviteKey:remoteMode&&!joinCode.enabled?remoteAccess.inviteKey:null});});
app.post('/api/join', (req, res) => { try {
  limit('join:' + clientAddress(req), 30, 60000);
  let u = userByToken(req.body.token); let token = req.body.token;
  if (u?.banned) fail('This name session has been removed by the host.');
  // Host recovery is deliberately limited to localhost on the host computer.
  // It rebinds the existing owner profile rather than creating a duplicate member.
  if (!u && req.body.hostRecovery === true) {
    if (!isLoopback(req)) fail('Host recovery is available only from localhost on the host computer.');
    limit('host-recovery:' + clientAddress(req), 3, 15 * 60 * 1000);
    const existingOwner = state.users.find(candidate => candidate.role === 'owner' && !candidate.banned);
    if (existingOwner) {
      if (active.has(existingOwner.id)) fail('The existing host account is already connected. Use that host session.');
      token = randomBytes(32).toString('hex');
      existingOwner.tokenHash = createHash('sha256').update(token).digest('hex');
      existingOwner.status = 'online';
      existingOwner.lastSeen = now();
      log(existingOwner, 'Recovered host access from the local computer');
      save();
      u = existingOwner;
    }
  }
  if (!u) {
    if(remoteMode&&!isLoopback(req)&&!joinCode.enabled&&req.body.invite!==remoteAccess.inviteKey)fail('Open the private invite link from the host, or enter its invite code.');
    if (joinCode.enabled && !verifyJoinCode(req.body.joinCode)) { limit('join-code:' + clientAddress(req), 8, 15 * 60 * 1000); fail('That four-digit join code is incorrect. Ask the host for the current code.'); }
    if (state.settings.locked && !isLoopback(req)) fail('The host has paused new joins.');
    if (state.users.length >= 500) fail('This workspace is full. Ask the host for help.');
    const name = text(req.body.name, 32); if (!name) fail('Pick a display name first.');
    token = randomBytes(32).toString('hex');
    u = { id: id(), tokenHash: createHash('sha256').update(token).digest('hex'), name, color: /^#[0-9a-f]{6}$/i.test(req.body.color) ? req.body.color : '#cbfa72', emoji: text(req.body.emoji, 8) || '👾', bio: '', status: 'online', customStatus: '', role: !state.users.some(u => u.role === 'owner') && isLoopback(req) ? 'owner' : 'member', created: now(), lastSeen: now() };
    state.users.push(u); log(u, 'Joined the hangout'); save();
  }
  res.cookie('ht_session', token, { httpOnly: true, secure:isSecureRequest(req), sameSite: 'strict', maxAge: 365 * 86400000, path: '/' });
  res.json({ token, user: publicUser(u) });
} catch (e) { res.status(400).json({ error: e.message }); } });
app.post('/api/logout', (req, res) => { res.clearCookie('ht_session', { path: '/' }); res.json({ ok: true }); });
const upload = multer({ dest: path.join(dataDir, 'uploads'), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
app.post('/api/upload', auth, (req, res, next) => { try { limit('upload:' + req.user.id, 20, 60000); if (state.files.reduce((n, f) => n + f.size, 0) > 1024 ** 3) fail('The 1 GB upload library is full. Ask the host to clear old files.'); next(); } catch(e) { res.status(429).json({ error: e.message }); } }, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Select a file.' });
  const f = req.file; const bytes = Buffer.alloc(16); const fd = fs.openSync(f.path, 'r'); fs.readSync(fd, bytes, 0, 16, 0); fs.closeSync(fd);
  let mime = 'application/octet-stream';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  else if (bytes.subarray(0, 3).toString() === 'GIF') mime = 'image/gif';
  else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') mime = 'image/webp';
  else if (['audio/mpeg','audio/ogg','audio/wav','video/mp4','video/webm'].includes(f.mimetype)) mime = f.mimetype;
  const record = { id: id(), name: text(f.originalname, 160), size: f.size, mime, disk: path.basename(f.path), user: req.user.id, created: now() }; state.files.push(record); save(); const { disk, ...safe } = record; res.json(safe);
});
app.get('/files/:id', auth, (req, res) => { const f = state.files.find(f => f.id === req.params.id); const permitted = f && (f.user === req.user.id || state.messages.some(m => m.attachments?.some(a => a.id === f.id) && canSee(req.user, state.channels.find(c => c.id === m.channel)))); if (!permitted) return res.status(404).end(); res.setHeader('Cache-Control', 'private, no-store'); res.type(f.mime); res.setHeader('Content-Disposition', `${req.query.download || f.mime === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}`); res.sendFile(path.join(dataDir, 'uploads', f.disk)); });
const SOUND_MAX = 8 * 1024 * 1024;
const SOUND_LIBRARY_MAX = 2000;
const SOUND_PER_USER_MAX = 500;
const SOUND_STORAGE_MAX = 2 * 1024 ** 3;
const soundExt = new Set(['mp3','wav','wave','ogg','oga','webm','m4a','mp4','aac','flac']);
function detectAudio(bytes, name) {
  const ext = String(name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!soundExt.has(ext)) return null;
  if (bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && ext === 'mp3')) return 'audio/mpeg';
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0 && ext === 'aac') return 'audio/aac';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE') return 'audio/wav';
  if (bytes.subarray(0, 4).toString() === 'OggS') return 'audio/ogg';
  if (bytes.subarray(0, 4).toString() === 'fLaC') return 'audio/flac';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'audio/webm';
  if (bytes.subarray(4, 8).toString() === 'ftyp') return 'audio/mp4';
  return null;
}
const soundUpload = multer({ dest: path.join(dataDir, 'sounds'), limits: { fileSize: SOUND_MAX, files: 1 } });
app.post('/api/sounds', auth, (req, res, next) => { try { limit('sound-upload:' + req.user.id, 1200, 60000); if (state.sounds.length >= SOUND_LIBRARY_MAX) fail('The sound library has reached its 2,000-sound safety limit.'); if (state.sounds.filter(s => s.user === req.user.id && !s.builtin).length >= SOUND_PER_USER_MAX) fail('Your account reached the 500-sound safety limit.'); if (state.sounds.reduce((total, sound) => total + sound.size, 0) >= SOUND_STORAGE_MAX) fail('The shared sound library has reached its 2 GB storage limit.'); next(); } catch (e) { res.status(429).json({ error: e.message }); } }, soundUpload.single('file'), (req, res) => {
  const remove = () => { if (req.file) fs.rmSync(req.file.path, { force: true }); };
  try {
    if (!req.file) return res.status(400).json({ error: 'Select an audio file.' });
    if (state.sounds.reduce((total, sound) => total + sound.size, 0) + req.file.size > SOUND_STORAGE_MAX) { remove(); return res.status(413).json({ error: 'The shared sound library has a 2 GB storage safety limit.' }); }
    if (req.file.size < 32) { remove(); return res.status(400).json({ error: 'That file is too small to be audio.' }); }
    const bytes = Buffer.alloc(16); const fd = fs.openSync(req.file.path, 'r'); fs.readSync(fd, bytes, 0, 16, 0); fs.closeSync(fd);
    const mime = detectAudio(bytes, req.file.originalname);
    if (!mime) { remove(); return res.status(400).json({ error: 'Use an MP3, WAV, OGG, WebM, M4A, AAC, or FLAC file.' }); }
    const category = text(req.body?.category, 32) || 'Unsorted';
    const record = { id: id(), name: text(req.file.originalname, 80) || 'sound', category, size: req.file.size, mime, disk: path.basename(req.file.path), user: req.user.id, created: now() };
    state.sounds.push(record); save(); broadcast(); const { disk, ...safe } = record; res.json(safe);
  } catch (e) { remove(); res.status(400).json({ error: e.message || 'Upload failed.' }); }
});
app.get('/sounds/:id', auth, (req, res) => { const f = state.sounds.find(s => s.id === req.params.id); if (!f) return res.status(404).end(); res.setHeader('Cache-Control', 'private, max-age=3600'); res.setHeader('Accept-Ranges', 'bytes'); res.type(f.mime); res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`); res.sendFile(path.join(dataDir, 'sounds', f.disk)); });
app.get('/api/export', auth, (req, res) => { res.setHeader('Content-Disposition', 'attachment; filename="hacker-toes-export.json"'); res.setHeader('Cache-Control', 'no-store'); res.json(snapshot(req.user)); });
app.use(express.static(path.join(root, 'dist'), { index: 'index.html' }));
app.get('/', (req,res) => res.status(503).send('Hacker Toes is getting ready. Run npm run build, then reload.'));
app.use((err, req, res, next) => res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? (req.path === '/api/sounds' ? 'Sounds can be up to 8 MB.' : 'Files can be up to 20 MB.') : err.message || 'Something went wrong.' }));
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 131072, allowRequest: (req, cb) => cb(null, sameOrigin(req)&&(remoteMode||!isInternetRequest(req))) });
io.use((socket, next) => { const u = userByToken(socket.handshake.auth.token); if (!u || u.banned) return next(new Error('Your session ended. Join again.')); socket.data.uid = u.id; next(); });

function makeMessage(u, p) {
  const c = getChannel(u, p.channel); editable(u, c);
  const body = text(p.text); const attachments = (Array.isArray(p.attachments) ? p.attachments : []).slice(0,5).map(fid => { const f = state.files.find(f => f.id === fid && f.user === u.id); if (!f) fail('Attachment not found.'); const { disk, ...safe } = f; return safe; });
  if (!body && !attachments.length && !p.poll) fail('Write a message first.');
  const last = state.messages.findLast(m => m.user === u.id && m.channel === c.id);
  if (c.slow && !canManage(u, c) && last && now() - last.created < c.slow * 1000) fail(`Slow mode: wait ${Math.ceil((last.created + c.slow * 1000 - now()) / 1000)} seconds.`);
  const reply = p.reply ? getMessage(u, p.reply) : null; if (reply && reply.channel !== c.id) fail('Reply in the same channel.');
  const m = { id: id(), channel: c.id, user: u.id, text: body, attachments, created: now(), reactions: {}, reply: reply?.id || null, thread: Boolean(p.thread && reply), kind: ['action','announcement'].includes(p.kind) ? p.kind : 'message' };
  if (p.poll) { const options = (Array.isArray(p.poll.options) ? p.poll.options : []).map(o => text(o,100)).filter(Boolean).slice(0,8); if (options.length < 2 || !text(p.poll.question,200)) fail('A poll needs a question and at least two options.'); m.poll = { question: text(p.poll.question,200), options, votes: {}, multiple: !!p.poll.multiple, closed: false }; }
  return m;
}
function publish(m) { state.messages.push(m); for (const s of io.sockets.sockets.values()) { const u = state.users.find(u => u.id === s.data.uid); if (u && canSee(u, state.channels.find(c => c.id === m.channel))) s.emit('message:new', m); } }
const handlers = {
  'invite:rotate'(u){if(u.role!=='owner'||!remoteMode)fail('Only the host in internet mode can reset the invite code.');remoteAccess.inviteKey=randomBytes(24).toString('base64url');fs.writeFileSync(remoteAccessPath,JSON.stringify(remoteAccess),{mode:0o600});log(u,'Reset the internet invite code');},
  'profile:update'(u, p) { if (p.name !== undefined) { const name = text(p.name,32); if (!name) fail('Your name cannot be empty.'); u.name = name; } if (/^#[0-9a-f]{6}$/i.test(p.color)) u.color = p.color; if (p.emoji) u.emoji = text(p.emoji,8); if (p.bio !== undefined) u.bio = text(p.bio,200); if (p.customStatus !== undefined) u.customStatus = text(p.customStatus,60); if (['online','away','busy','invisible'].includes(p.status)) u.status = p.status; return publicUser(u); },
  'channel:create'(u, p) { if (state.channels.length >= 150) fail('Channel limit reached.'); const name = text(p.name,40).toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''); if (!name) fail('Use letters or numbers in the channel name.'); if (state.channels.some(c => c.name === name && c.kind !== 'dm')) fail('That channel name is taken.'); const members = [u.id, ...(Array.isArray(p.members) ? p.members : []).filter(uid => state.users.some(u => u.id === uid && !u.banned))]; const c = { id: id(), name, topic: text(p.topic,200), category: text(p.category,30) || 'THE HANGOUT', kind: p.private ? 'private' : 'text', members: [...new Set(members)], createdBy: u.id, created: now(), slow: 0 }; state.channels.push(c); log(u, `Created #${name}`); return c; },
  'channel:update'(u, p) { const c = getChannel(u,p.id); if (!canManage(u,c)) fail('Only the creator or a moderator can change this channel.'); if (c.kind === 'dm') fail('Direct messages cannot be changed.'); if (p.name !== undefined) { const name = text(p.name,40).toLowerCase().replace(/[^a-z0-9_-]/g,'-'); if (!name || state.channels.some(other => other.id !== c.id && other.name === name)) fail('Choose a unique channel name.'); c.name = name; } for (const field of ['topic','category']) if (p[field] !== undefined) c[field] = text(p[field],field === 'topic' ? 200 : 30); if (p.archived !== undefined) c.archived = !!p.archived; if (p.readOnly !== undefined) c.readOnly = !!p.readOnly; if ([0,5,10,30,60].includes(Number(p.slow))) c.slow = Number(p.slow); if (c.kind === 'private' && Array.isArray(p.members)) c.members = [...new Set([c.createdBy, ...p.members.filter(uid => state.users.some(u => u.id === uid))])]; log(u, `Updated #${c.name}`); return c; },
  'channel:delete'(u, p) { const c = getChannel(u,p.id); if (!canManage(u,c)) fail('Only the creator or a moderator can delete a channel.'); if (c.id === 'general' || c.kind === 'dm') fail('This channel cannot be deleted.'); state.channels = state.channels.filter(v => v.id !== c.id); state.messages = state.messages.filter(m => m.channel !== c.id); state.tasks = state.tasks.filter(t => t.channel !== c.id); state.scheduled = state.scheduled.filter(m => m.channel !== c.id); log(u, `Deleted #${c.name}`); },
  'dm:create'(u,p) { const ids = [...new Set([u.id,...(Array.isArray(p.users) ? p.users : []).filter(uid => state.users.some(u => u.id === uid && !u.banned))])].sort(); if (ids.length < 2 || ids.length > 12) fail('Choose 1–11 people.'); let c = state.channels.find(c => c.kind === 'dm' && [...c.members].sort().join() === ids.join()); if (!c) { c = { id: id(), name: text(p.name,40) || 'Direct message', kind: 'dm', members: ids, createdBy: u.id, created: now(), topic: 'Only people in this conversation can see it.', category: 'DIRECT MESSAGES', slow: 0 }; state.channels.push(c); } return c; },
  'message:send'(u,p) { limit('message:' + u.id, 20, 10000); if (p.clientId && typeof p.clientId === 'string') { const duplicate = state.messages.find(m => m.user === u.id && m.clientId === p.clientId); if (duplicate) return duplicate; } const m = makeMessage(u,p); m.clientId = text(p.clientId,80); if (p.scheduledAt) { const at = Number(p.scheduledAt); if (!Number.isFinite(at) || at < now()+5000 || at > now()+7*86400000) fail('Schedule between 5 seconds and 7 days from now.'); if (state.scheduled.filter(m=>m.user===u.id).length >= 50) fail('You can queue 50 messages.'); state.scheduled.push({ ...m, scheduledAt: at }); return m; } publish(m); return m; },
  'schedule:delete'(u,p) { state.scheduled = state.scheduled.filter(m => !(m.id === p.id && m.user === u.id)); },
  'message:edit'(u,p) { const m = getMessage(u,p.id); if (m.user !== u.id || m.deleted) fail('You can only edit your own messages.'); editable(u,getChannel(u,m.channel)); const body = text(p.text); if (!body) fail('A message cannot be empty.'); m.text = body; m.edited = now(); },
  'message:delete'(u,p) { const m = getMessage(u,p.id); if (m.user !== u.id && !isMod(u)) fail('You can only delete your own messages.'); m.text = ''; m.attachments = []; m.poll = null; m.reactions = {}; m.deleted = true; m.pinned = false; if (m.user !== u.id) log(u,'Removed a message'); },
  'message:pin'(u,p) { const m = getMessage(u,p.id); if (m.deleted) fail('This message was deleted.'); m.pinned = !m.pinned; },
  'message:react'(u,p) { const m = getMessage(u,p.id); if (m.deleted) fail('This message was deleted.'); const emoji = text(p.emoji,16); if (!emoji || /[<>]/.test(emoji)) fail('Choose an emoji.'); if (!m.reactions[emoji] && Object.keys(m.reactions).length >= 20) fail('Reaction limit reached.'); const users = m.reactions[emoji] || []; m.reactions[emoji] = users.includes(u.id) ? users.filter(uid => uid !== u.id) : [...users,u.id]; if (!m.reactions[emoji].length) delete m.reactions[emoji]; },
  'poll:vote'(u,p) { const m = getMessage(u,p.id); if (!m.poll || m.poll.closed) fail('This poll is closed.'); const option = Number(p.option); if (!Number.isInteger(option) || option < 0 || option >= m.poll.options.length) fail('Option not found.'); const prior = m.poll.votes[u.id] || []; m.poll.votes[u.id] = prior.includes(option) ? prior.filter(i => i !== option) : m.poll.multiple ? [...prior,option] : [option]; },
  'poll:close'(u,p) { const m = getMessage(u,p.id); if (m.user !== u.id && !isMod(u)) fail('Only the author or a moderator can close a poll.'); if (!m.poll) fail('Poll not found.'); m.poll.closed = !m.poll.closed; },
  'task:create'(u,p) { const c = getChannel(u,p.channel); editable(u,c); const title = text(p.title,180); if (!title) fail('Give your task a title.'); if (state.tasks.length>=2000) fail('Task limit reached.'); const task = { id:id(), channel:c.id, title, user:u.id, assignee:state.users.some(v => v.id===p.assignee) ? p.assignee : '', due:text(p.due,10), done:false, created:now() }; state.tasks.push(task); return task; },
  'task:update'(u,p) { const t = state.tasks.find(t=>t.id===p.id); if(!t) fail('Task not found.'); editable(u,getChannel(u,t.channel)); if(p.done!==undefined) t.done=!!p.done; if(p.title!==undefined) { if(t.user!==u.id&&!isMod(u)) fail('Only the author can rename a task.'); t.title=text(p.title,180)||t.title; } },
  'task:delete'(u,p) { const t=state.tasks.find(t=>t.id===p.id); if(!t) fail('Task not found.'); getChannel(u,t.channel); if(t.user!==u.id&&!isMod(u)) fail('Only the author or a moderator can delete a task.'); state.tasks=state.tasks.filter(t=>t.id!==p.id); },
  'notes:save'(u,p) { state.notes[u.id]=text(p.text,20000); },
  'workspace:update'(u,p) { if(u.role!=='owner') fail('Only the host can change workspace settings.'); if(p.name!==undefined) state.settings.name=text(p.name,50)||state.settings.name; if(p.description!==undefined) state.settings.description=text(p.description,120); if(p.locked!==undefined) state.settings.locked=!!p.locked; if([0,7,30,90].includes(Number(p.retention))) state.settings.retention=Number(p.retention); if(p.joinCode!==undefined&&String(p.joinCode).length){ if(typeof p.joinCode!=='string'||!/^\d{4}$/.test(p.joinCode)) fail('The join code must contain exactly four digits.'); joinCode.salt=randomBytes(16).toString('hex'); joinCode.hash=scryptSync(p.joinCode,joinCode.salt,32).toString('hex'); joinCode.enabled=p.joinCodeEnabled===undefined?true:!!p.joinCodeEnabled; persistJoinCode(); } else if(p.joinCodeEnabled!==undefined){ if(p.joinCodeEnabled&&!joinCode.hash) fail('Set a four-digit join code before requiring one.'); joinCode.enabled=!!p.joinCodeEnabled; persistJoinCode(); } log(u,'Updated workspace settings'); },
  'member:moderate'(u,p) { if(!isMod(u)) fail('Moderator access required.'); const other=state.users.find(v=>v.id===p.id); if(!other||other.role==='owner'||other.id===u.id||(other.role==='moderator'&&u.role!=='owner')) fail('This member cannot be changed.'); if(p.action==='role') { if(u.role!=='owner') fail('Only the host can assign moderators.'); other.role=other.role==='moderator'?'member':'moderator'; } else if(p.action==='timeout') other.mutedUntil=now()+600000; else if(p.action==='unmute') other.mutedUntil=0; else if(p.action==='remove') { other.banned=true; for(const s of io.sockets.sockets.values()) if(s.data.uid===other.id) { s.emit('removed'); s.disconnect(true); } } else fail('Unknown action.'); log(u,`${p.action}: ${other.name}`); },
  'workspace:purge'(u,p) { if(u.role!=='owner') fail('Host access required.'); const c=getChannel(u,p.channel); if(c.kind==='dm') fail('Use message deletion in direct messages.'); state.messages=state.messages.filter(m=>m.channel!==c.id); log(u,`Cleared #${c.name}`); },
  'files:cleanup'(u) { if(u.role!=='owner') fail('Host access required.'); const used=new Set([...state.messages,...state.scheduled].flatMap(m=>m.attachments||[]).map(f=>f.id)); const unused=state.files.filter(f=>!used.has(f.id)&&now()-f.created>3600000); for(const f of unused) fs.rmSync(path.join(dataDir,'uploads',f.disk),{force:true}); state.files=state.files.filter(f=>!unused.includes(f)); log(u,`Cleaned ${unused.length} unused files`); return {count:unused.length}; },
  'sound:rename'(u,p) { const s=state.sounds.find(s=>s.id===p.id); if(!s) fail('Sound not found.'); if(s.builtin) fail('Hacker Toes starter sounds are read-only.'); if(s.user!==u.id&&!isMod(u)) fail('You can only rename your own sounds.'); const name=text(p.name,80); if(!name) fail('Give the sound a name.'); s.name=name; return publicSound(s); },
  'sound:category'(u,p) { const s=state.sounds.find(s=>s.id===p.id); if(!s) fail('Sound not found.'); if(s.builtin) fail('Hacker Toes starter sounds are read-only.'); if(s.user!==u.id&&!isMod(u)) fail('You can only organise your own sounds.'); s.category=text(p.category,32)||'Unsorted'; return publicSound(s); },
  'sound:delete'(u,p) { const s=state.sounds.find(s=>s.id===p.id); if(!s) fail('Sound not found.'); if(s.builtin) fail('Hacker Toes starter sounds are part of the built-in library and cannot be deleted.'); if(s.user!==u.id&&!isMod(u)) fail('You can only delete your own sounds.'); fs.rmSync(path.join(dataDir,'sounds',s.disk),{force:true}); state.sounds=state.sounds.filter(x=>x.id!==s.id); for(const play of [...playbacks.values()]) if(play.soundId===s.id) stopPlayback(play.id,'deleted'); },
  'soundboard:settings'(u,p) { if(p.receive!==undefined) u.soundboardReceive=!!p.receive; if(p.muted!==undefined) u.soundboardMuted=!!p.muted; if(p.remoteVolumeControl!==undefined) u.soundRemoteVolumeControl=!!p.remoteVolumeControl; if(p.systemVolumeRemoteControl!==undefined) u.systemVolumeRemoteControl=!!p.systemVolumeRemoteControl; if(p.remoteTransportControl!==undefined) u.soundRemoteTransportControl=!!p.remoteTransportControl; if(p.minigame!==undefined) u.soundMinigame=!!p.minigame; if(p.monitorShare!==undefined) u.soundMonitorShare=!!p.monitorShare; if(p.teacherAlertReceive!==undefined) { u.teacherAlertReceive=!!p.teacherAlertReceive; if(!u.teacherAlertReceive) { const activeAlert=teacherAlerts.get(u.id); if(activeAlert) { teacherAlerts.delete(u.id); emitUser(activeAlert.from,'teacher-alert:dismissed',{alertId:activeAlert.id,reason:'recipient-disabled'}); } } } if(p.maxVolume!==undefined) { const cap=Number(p.maxVolume); if(!Number.isInteger(cap)||cap<30||cap>150) fail('Your remote volume ceiling must be between 30 and 150.'); u.soundMaxVolume=cap; } if(u.soundMuted||u.soundboardReceive===false) { for(const play of [...playbacks.values()]) if(play.to===u.id) stopPlayback(play.id,u.soundboardReceive===false?'disabled':'muted'); } else { for(const play of [...playbacks.values()]) if(play.to===u.id) { play.remoteVolumeControl=u.soundRemoteVolumeControl===true; play.remoteTransportControl=u.soundRemoteTransportControl===true; play.monitorShare=u.soundMonitorShare===true; play.minigame=u.soundMinigame===true; play.maxVolume=Math.max(30,Math.min(150,Number(u.soundMaxVolume)||100)); if(play.floor>play.maxVolume) stopPlayback(play.id,'volume-limit'); else if(play.volume>play.maxVolume) { play.volume=play.maxVolume; emitUser(play.to,'sound:volume',{playbackId:play.id,volume:play.volume}); emitUser(play.from,'sound:status',playbackStatus(play)); } else emitUser(play.from,'sound:status',playbackStatus(play)); } } return publicUser(u); }
};
function allow(key, max, ms) { const row = rate.get(key) || { count: 0, until: now() + ms }; if (row.until < now()) { row.count = 0; row.until = now() + ms; } row.count++; rate.set(key, row); return row.count <= max; }
function socketsOf(uid) { return [...io.sockets.sockets.values()].filter(s => s.data.uid === uid); }
function emitUser(uid, event, payload) { for (const s of socketsOf(uid)) s.emit(event, payload); }
function publicCalls() { return [...calls.values()].map(c => ({ id: c.id, users: [c.a, c.b], status: c.status, since: c.acceptedAt || c.created })); }
function emitCalls() { io.emit('calls:update', publicCalls()); }
function endCall(call, reason, by) { if (!call || !calls.has(call.id)) return; calls.delete(call.id); const payload = { callId: call.id, reason, by: by || null }; emitUser(call.a, 'call:ended', payload); emitUser(call.b, 'call:ended', payload); emitCalls(); }
function playbackStatus(play) { return { playbackId:play.id, soundId:play.soundId, name:play.name, volume:play.volume, floor:play.floor, maxVolume:Math.min(play.maxVolume,play.overdrive?150:100), recipientMaxVolume:play.maxVolume, mode:play.mode, overdrive:play.overdrive, remoteVolumeControl:!!play.remoteVolumeControl, remoteTransportControl:!!play.remoteTransportControl, minigame:!!play.minigame, minigameProgress:Math.max(0,Math.min(3,Number(play.minigameProgress)||0)), minigameMissed:Math.max(0,Number(play.minigameMissed)||0), monitorShare:!!play.monitorShare, monitor:play.monitor||null, state:play.state||'playing' }; }
function stopPlayback(pid, reason) { const play = playbacks.get(pid); if (!play) return; playbacks.delete(pid); const payload = { playbackId: pid, reason }; emitUser(play.to, 'sound:stop', payload); if (play.from !== play.to) emitUser(play.from, 'sound:stop', payload); }
const defaultIce = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
function iceServers() {
  let extra = [];
  try { const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, 'ice-servers.json'), 'utf8')); if (Array.isArray(parsed)) extra = parsed; } catch (e) { if (e.code !== 'ENOENT') console.error('Ignoring ice-servers.json: ' + e.message); }
  const clean = [];
  for (const item of extra) {
    if (!item || typeof item !== 'object') continue;
    const urls = (Array.isArray(item.urls) ? item.urls : [item.urls]).filter(u => typeof u === 'string' && /^(stun|turn|turns):[^\s]+$/.test(u)).slice(0, 6);
    if (!urls.length) continue;
    const row = { urls: urls.length === 1 ? urls[0] : urls };
    if (typeof item.username === 'string' && item.username.length && item.username.length < 200) row.username = item.username;
    if (typeof item.credential === 'string' && item.credential.length && item.credential.length < 400) row.credential = item.credential;
    clean.push(row);
  }
  return [...defaultIce, ...clean].slice(0, 8);
}
function userInCall(uid) { return [...calls.values()].some(c => c.a === uid || c.b === uid); }
io.on('connection', socket => {
  const u=state.users.find(u=>u.id===socket.data.uid); const sockets=active.get(u.id)||new Set(); sockets.add(socket.id); active.set(u.id,sockets); socket.emit('calls:update', publicCalls()); broadcast();
  const reply=(ack,error,result)=>{ if(typeof ack==='function') ack(error?{ok:false,error}:{ok:true,...(result||{})}); };
  socket.on('call:invite',(payload,ack)=>{ try { if(u.banned) fail('Your session has ended.'); limit('call:'+u.id,8,20000); const other=state.users.find(v=>v.id===payload?.to&&!v.banned); if(!other) fail('That person is not in the hangout.'); if(other.id===u.id) fail('You cannot call yourself.'); if(!active.has(other.id)||other.status==='invisible') fail(other.name+' is offline.'); if(userInCall(u.id)||userInCall(other.id)) fail('Someone in this call is already on a call.'); const call={id:id(),a:u.id,b:other.id,status:'ringing',created:now(),acceptedAt:0,sockets:{[u.id]:socket.id}}; calls.set(call.id,call); emitUser(other.id,'call:incoming',{callId:call.id,from:publicUser(u)}); emitCalls(); reply(ack,null,{callId:call.id,to:publicUser(other)}); } catch(e){ reply(ack,e.message); } });
  socket.on('call:accept',(payload,ack)=>{ try { const call=calls.get(payload?.callId); if(!call||call.b!==u.id||call.status!=='ringing') fail('That call is no longer ringing.'); call.status='active'; call.acceptedAt=now(); call.sockets[u.id]=socket.id; const ice=iceServers(), caller=state.users.find(v=>v.id===call.a); io.sockets.sockets.get(call.sockets[call.a])?.emit('call:accepted',{callId:call.id,peer:publicUser(u),iceServers:ice,initiator:true}); socket.emit('call:accepted',{callId:call.id,peer:publicUser(caller),iceServers:ice,initiator:false}); for(const s of socketsOf(call.b)) if(s.id!==socket.id) s.emit('call:closed',{callId:call.id}); emitCalls(); reply(ack); } catch(e){ reply(ack,e.message); } });
  socket.on('call:decline',(payload,ack)=>{ try { const call=calls.get(payload?.callId); if(!call||call.b!==u.id||call.status!=='ringing') fail('That call is no longer ringing.'); endCall(call,'declined',u.id); reply(ack); } catch(e){ reply(ack,e.message); } });
  socket.on('call:end',(payload,ack)=>{ const call=calls.get(payload?.callId); if(!call||(call.a!==u.id&&call.b!==u.id)) return reply(ack,'Call not found.'); const reason=payload?.reason==='microphone'?'microphone':call.status==='ringing'&&call.a===u.id?'cancelled':'ended'; endCall(call,reason,u.id); reply(ack); });
  socket.on('call:signal',payload=>{ try { const call=calls.get(payload?.callId); if(!call||call.status!=='active'||(call.a!==u.id&&call.b!==u.id)||call.sockets?.[u.id]!==socket.id) return; const data=payload.data; if(!data||typeof data!=='object') return; if(!['offer','answer','ice','relay'].includes(data.kind)) return; if((data.kind==='offer'||data.kind==='answer')&&(typeof data.sdp!=='string'||data.sdp.length>60000)) return; if(data.kind==='ice'&&data.candidate!=null&&typeof data.candidate!=='string') return; if(data.kind==='ice'&&typeof data.candidate==='string'&&data.candidate.length>2000) return; if(!allow('signal:'+u.id,120,10000)) return; const other=u.id===call.a?call.b:call.a; const body=data.kind==='ice'?{kind:'ice',candidate:data.candidate,sdpMid:typeof data.sdpMid==='string'?data.sdpMid.slice(0,20):null,sdpMLineIndex:Number.isInteger(data.sdpMLineIndex)?data.sdpMLineIndex:0}:data.kind==='relay'?{kind:'relay'}:{kind:data.kind,sdp:data.sdp}; io.sockets.sockets.get(call.sockets?.[other])?.emit('call:signal',{callId:call.id,data:body}); } catch {} });
  socket.on('call:audio',payload=>{ try { const call=calls.get(payload?.callId); if(!call||call.status!=='active'||(call.a!==u.id&&call.b!==u.id)||call.sockets?.[u.id]!==socket.id) return; let pcm=payload.pcm; if(ArrayBuffer.isView(pcm)) pcm=Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength); else if(pcm instanceof ArrayBuffer) pcm=Buffer.from(pcm); else if(!Buffer.isBuffer(pcm)) return; if(pcm.length<2||pcm.length>8192||pcm.length%2) return; if(!allow('audio:'+u.id,40,1000)) return; const other=u.id===call.a?call.b:call.a; io.sockets.sockets.get(call.sockets?.[other])?.emit('call:audio',{callId:call.id,pcm}); } catch {} });
  socket.on('teacher-alert:send',(payload,ack)=>{ try {
    if(u.banned) fail('Your session has ended.');
    limit('teacher-alert:'+u.id,4,60000);
    const target=state.users.find(v=>v.id===payload?.target&&!v.banned);
    if(!target) fail('Choose someone who is here.');
    if(target.id===u.id) fail('Choose another person for a Teacher Alert.');
    if(!active.has(target.id)) fail(target.name+' is offline.');
    if(target.teacherAlertReceive===false) fail(target.name+' has disabled Teacher Alerts.');
    const existing=teacherAlerts.get(target.id);
    if(existing&&existing.expiresAt>now()) fail(target.name+' already has a Teacher Alert open.');
    if(existing) teacherAlerts.delete(target.id);
    const cooldownKey=target.id, until=teacherAlertCooldowns.get(cooldownKey)||0;
    if(until>now()) fail('Please wait '+Math.ceil((until-now())/1000)+' seconds before sending another Teacher Alert to '+target.name+'.');
    const alert={id:id(),from:u.id,to:target.id,createdAt:now(),expiresAt:now()+TEACHER_ALERT_DURATION_MS};
    teacherAlerts.set(target.id,alert); teacherAlertCooldowns.set(cooldownKey,alert.expiresAt);
    emitUser(target.id,'teacher-alert:incoming',{alertId:alert.id,from:publicUser(u),durationMs:TEACHER_ALERT_DURATION_MS});
    reply(ack,null,{alertId:alert.id,expiresAt:alert.expiresAt});
  } catch(e){ reply(ack,e.message); } });
  socket.on('teacher-alert:dismiss',(payload,ack)=>{ try {
    const alert=teacherAlerts.get(u.id);
    if(!alert||alert.id!==payload?.alertId) fail('That Teacher Alert is no longer active.');
    teacherAlerts.delete(u.id);
    emitUser(alert.from,'teacher-alert:dismissed',{alertId:alert.id,reason:'acknowledged'});
    reply(ack);
  } catch(e){ reply(ack,e.message); } });
  socket.on('system-volume:request',(payload,ack)=>{ try {
    limit('system-volume-request:'+u.id,8,1000);
    const target=state.users.find(v=>v.id===payload?.target&&!v.banned);
    if(!target||target.id===u.id||!active.has(target.id)) fail('That person is offline.');
    if(target.systemVolumeRemoteControl!==true) fail(target.name+' has not allowed remote system-volume control.');
    const action=payload?.action;
    if(!['get','set','mute'].includes(action)) fail('Invalid system-volume action.');
    const volume=Math.round(Number(payload?.volume));
    if(action==='set'&&(!Number.isFinite(volume)||volume<0||volume>100)) fail('Choose a volume between 0 and 100%.');
    for(const [key,value] of systemVolumeRequests) if(now()-value.created>15000) systemVolumeRequests.delete(key);
    const requestId=id();
    systemVolumeRequests.set(requestId,{from:u.id,to:target.id,created:now()});
    emitUser(target.id,'system-volume:command',{requestId,action,...(action==='set'?{volume}:action==='mute'?{muted:payload?.muted===true}:{})});
    reply(ack,null,{requestId,target:publicUser(target)});
  } catch(e){reply(ack,e.message);} });
  socket.on('system-volume:result',(payload)=>{ try {
    const pending=systemVolumeRequests.get(payload?.requestId);
    if(!pending||pending.to!==u.id||now()-pending.created>15000)return;
    systemVolumeRequests.delete(payload.requestId);
    const target=state.users.find(v=>v.id===u.id);
    if(target?.systemVolumeRemoteControl!==true)return;
    const result={requestId:payload.requestId,target:u.id,ok:payload.ok===true};
    if(result.ok&&payload.state&&Number.isFinite(Number(payload.state.volume))&&typeof payload.state.muted==='boolean')result.state={volume:Math.max(0,Math.min(100,Math.round(Number(payload.state.volume)))),muted:payload.state.muted};
    else result.error=String(payload.error||'The recipient could not change Windows master volume.').slice(0,240);
    emitUser(pending.from,'system-volume:result',result);
  } catch {} });
  socket.on('sound:play',(payload,ack)=>{ try {
    if(u.banned) fail('Your session has ended.');
    limit('sound-play:'+u.id,20,10000);
    const sound=state.sounds.find(s=>s.id===payload?.soundId); if(!sound) fail('Sound not found.');
    const target=state.users.find(v=>v.id===payload?.target&&!v.banned); if(!target) fail('Choose someone who is here.');
    if(!active.has(target.id)) fail(target.name+' is offline.');
    if(target.soundboardReceive===false) fail(target.name+' has remote sounds turned off.');
    if(target.soundboardMuted) fail(target.name+' has the soundboard muted.');
    const requestedVolume=Math.round(Number(payload?.volume)); const mode=['loser','tuff','detention'].includes(payload?.volumeMode)?payload.volumeMode:'detention';
    const floor={loser:30,tuff:40,detention:65}[mode]; const overdrive=!!payload?.overdrive; const senderMax=overdrive?150:100;
    const targetMax=Math.max(30,Math.min(150,Number(target.soundMaxVolume)||100));
    if(!Number.isFinite(requestedVolume)||requestedVolume<floor||requestedVolume>senderMax) fail(`Volume must be between ${floor}% and ${senderMax}% for ${mode} mode.`);
    if(targetMax<floor) fail(target.name+' has set a local volume ceiling below this mode’s '+floor+'% minimum.');
    const cooldownKey=u.id+':'+target.id; const cooldownUntil=soundSendCooldowns.get(cooldownKey)||0;
    if(cooldownUntil>now()) fail(`Please wait ${Math.ceil((cooldownUntil-now())/1000)} seconds before sending another sound to ${target.name}.`);
    const volume=Math.min(requestedVolume,targetMax);
    for(const play of [...playbacks.values()]) if(play.to===target.id) stopPlayback(play.id,'replaced');
    const play={id:id(),soundId:sound.id,from:u.id,to:target.id,volume,floor,mode,overdrive,name:sound.name,started:now(),maxVolume:targetMax,remoteVolumeControl:target.soundRemoteVolumeControl===true,remoteTransportControl:target.soundRemoteTransportControl===true,minigame:target.soundMinigame===true,minigameProgress:0,minigameMissed:0,monitorShare:target.soundMonitorShare===true,monitor:null,state:'playing'};
    playbacks.set(play.id,play); const nextAllowedAt=now()+SOUND_SEND_COOLDOWN_MS; soundSendCooldowns.set(cooldownKey,nextAllowedAt);
    const status=playbackStatus(play); emitUser(target.id,'sound:play',{...status,from:publicUser(u),url:'/sounds/'+sound.id}); emitUser(u.id,'sound:status',{...status,to:publicUser(target)});
    reply(ack,null,{playback:{...status,to:publicUser(target)},cooldownMs:SOUND_SEND_COOLDOWN_MS,nextAllowedAt});
  } catch(e){ reply(ack,e.message); } });
  socket.on('sound:volume',(payload,ack)=>{ try { limit('sound-volume:'+u.id,12,1000); const play=playbacks.get(payload?.playbackId); if(!play||play.from!==u.id) fail('You cannot adjust this playback.'); const target=state.users.find(v=>v.id===play.to&&!v.banned); if(!target||!active.has(target.id)) fail('The recipient is offline.'); if(target.soundboardMuted||target.soundboardReceive===false) fail('The recipient has muted or disabled remote sounds.'); if(!play.remoteVolumeControl||target.soundRemoteVolumeControl!==true) fail('The recipient has not enabled remote volume control.'); const volume=Math.round(Number(payload?.volume)); const max=Math.min(play.maxVolume||100,play.overdrive?150:100); if(!Number.isFinite(volume)||volume<play.floor||volume>max) fail(`Volume must be between ${play.floor}% and ${max}%.`); play.volume=volume; emitUser(play.to,'sound:volume',{playbackId:play.id,volume}); const status=playbackStatus(play); emitUser(play.from,'sound:status',{...status,to:publicUser(target)}); reply(ack,null,{playback:{...status,to:publicUser(target)}}); } catch(e) { reply(ack,e.message); } });
  socket.on('sound:transport',(payload,ack)=>{ try {
    limit('sound-transport:'+u.id,12,1000);
    const play=playbacks.get(payload?.playbackId);
    if(!play||play.from!==u.id) fail('Only the person who sent this sound can control its playback.');
    const action=payload?.action;
    if(!['pause','resume'].includes(action)) fail('Choose pause or resume.');
    const target=state.users.find(v=>v.id===play.to&&!v.banned);
    if(!target||!active.has(target.id)) fail('The recipient is offline.');
    if(target.soundboardMuted||target.soundboardReceive===false) fail('The recipient has muted or disabled remote sounds.');
    if(!play.remoteTransportControl||target.soundRemoteTransportControl!==true) fail('The recipient has not enabled remote pause/resume control.');
    if(action==='pause'&&play.state==='paused') fail('This sound is already paused.');
    if(action==='resume'&&play.state!=='paused') fail('This sound is not paused.');
    play.state=action==='pause'?'paused':'playing';
    emitUser(play.to,'sound:transport',{playbackId:play.id,action});
    const status=playbackStatus(play);
    emitUser(play.from,'sound:status',{...status,to:publicUser(target)});
    reply(ack,null,{playback:{...status,to:publicUser(target)}});
  } catch(e){ reply(ack,e.message); } });
  socket.on('sound:transport:failed',(payload,ack)=>{ try {
    const play=playbacks.get(payload?.playbackId);
    if(!play||play.to!==u.id) fail('You can only report transport errors for your own incoming sound.');
    play.state='paused';
    const message=text(payload?.error,180)||'The browser could not resume this audio.';
    emitUser(play.from,'sound:transport:failed',{playbackId:play.id,error:message});
    const status=playbackStatus(play), target=state.users.find(v=>v.id===play.to);
    emitUser(play.from,'sound:status',{...status,to:target?publicUser(target):null});
    reply(ack);
  } catch(e){ reply(ack,e.message); } });
  socket.on('sound:minigame:control',(payload,ack)=>{ try {
    limit('sound-minigame-control:'+u.id,8,1000);
    const play=playbacks.get(payload?.playbackId);
    if(!play||play.from!==u.id) fail('Only the person who sent this sound can control its challenge.');
    if(payload?.action!=='restart') fail('Unknown challenge action.');
    const target=state.users.find(v=>v.id===play.to&&!v.banned);
    if(!target||!active.has(target.id)) fail('The recipient is offline.');
    if(!play.minigame||target.soundMinigame!==true) fail('The recipient has not enabled the stop-sound minigame.');
    play.minigameProgress=0; play.minigameMissed=0;
    emitUser(play.to,'sound:minigame:control',{playbackId:play.id,action:'restart'});
    const status=playbackStatus(play);
    emitUser(play.from,'sound:status',{...status,to:publicUser(target)});
    reply(ack,null,{playback:{...status,to:publicUser(target)}});
  } catch(e){ reply(ack,e.message); } });
  socket.on('sound:minigame:progress',(payload,ack)=>{ try {
    limit('sound-minigame-progress:'+u.id,12,1000);
    const play=playbacks.get(payload?.playbackId);
    if(!play||play.to!==u.id) fail('You can only report your own challenge progress.');
    if(!play.minigame||u.soundMinigame!==true) fail('The stop-sound minigame is not enabled.');
    const hits=Number(payload?.hits), missed=Number(payload?.missed);
    if(!Number.isInteger(hits)||hits<0||hits>3||!Number.isInteger(missed)||missed<0||missed>10000) fail('Invalid challenge progress.');
    play.minigameProgress=hits; play.minigameMissed=missed;
    emitUser(play.from,'sound:minigame:progress',{playbackId:play.id,hits,missed,completed:payload?.completed===true&&hits===3});
    reply(ack);
  } catch(e){ reply(ack,e.message); } });
  socket.on('sound:monitor',(payload,ack)=>{ try { limit('sound-monitor:'+u.id,5,1000); const play=playbacks.get(payload?.playbackId); if(!play||play.to!==u.id) fail('You can only report your own received playback.'); if(!play.monitorShare||!u.soundMonitorShare) fail('Audio monitor sharing is disabled.'); const rawVolume=Number(payload?.playbackVolume); if(!Number.isFinite(rawVolume)||rawVolume<0||rawVolume>150) fail('Reported browser playback volume must be between 0 and 150.'); const playbackVolume=Math.round(rawVolume); const outputLabel=text(payload?.outputLabel,100)||'Default browser output (device label unavailable)'; play.monitor={playbackVolume,outputLabel,systemVolumeAvailable:false,updatedAt:now()}; emitUser(play.from,'sound:monitor',{playbackId:play.id,...play.monitor}); reply(ack); } catch(e) { reply(ack,e.message); } });
  socket.on('sound:stop',(payload,ack)=>{ const play=playbacks.get(payload?.playbackId); if(!play) return reply(ack); if(play.from!==u.id&&play.to!==u.id) return reply(ack,'You cannot stop that sound.'); stopPlayback(play.id,'stopped'); reply(ack); });
  socket.on('action', (request, ack) => { try { if(u.banned) fail('Your session has ended.'); limit('action:'+u.id,120,10000); if(!request || typeof request.type!=='string' || !Object.hasOwn(handlers,request.type)) fail('Unknown action.'); const result=handlers[request.type](u,request.payload||{}); broadcast(); if(typeof ack==='function') ack({ok:true,result}); } catch(e) { if(typeof ack==='function') ack({ok:false,error:e.message}); } });
  socket.on('typing', cid => { try { const c=getChannel(u,cid); if(u.status==='invisible') return; limit('typing:'+u.id,15,10000); for(const s of io.sockets.sockets.values()) { const other=state.users.find(u=>u.id===s.data.uid); if(s.id!==socket.id&&other&&canSee(other,c)) s.emit('typing',{user:u.id,channel:c.id,until:now()+4000}); } } catch {} });
  socket.on('ping:check',ack=>{if(typeof ack==='function')ack(now());});
  socket.on('disconnect',()=>{ const sockets=active.get(u.id); sockets?.delete(socket.id); if(!sockets?.size) {active.delete(u.id);u.lastSeen=now(); const alert=teacherAlerts.get(u.id); if(alert){teacherAlerts.delete(u.id);emitUser(alert.from,'teacher-alert:dismissed',{alertId:alert.id,reason:'recipient-disconnected'});} for(const [recipient,alertSent] of teacherAlerts) if(alertSent.from===u.id){teacherAlerts.delete(recipient);emitUser(recipient,'teacher-alert:dismissed',{alertId:alertSent.id,reason:'sender-disconnected'});} } for(const call of [...calls.values()]) { if(call.status==='ringing'&&call.a===u.id&&call.sockets?.[u.id]===socket.id) endCall(call,'cancelled',u.id); else if(call.status==='ringing'&&call.b===u.id&&!active.has(u.id)) endCall(call,'disconnected',u.id); else if(call.status==='active'&&call.sockets?.[u.id]===socket.id) endCall(call,'disconnected',u.id); } for(const play of [...playbacks.values()]) if((play.from===u.id||play.to===u.id)&&(!active.has(play.from)||!active.has(play.to))) stopPlayback(play.id,'disconnected'); broadcast(); });
});
const timer=setInterval(()=>{
  let changed=false;
  for(const scheduled of [...state.scheduled]) if(scheduled.scheduledAt<=now()) { const u=state.users.find(u=>u.id===scheduled.user); try { if(!u||u.banned) fail('Session removed.'); editable(u,getChannel(u,scheduled.channel)); publish({...scheduled,created:now(),scheduledAt:undefined}); } catch(e) { if(u) for(const s of io.sockets.sockets.values()) if(s.data.uid===u.id) s.emit('notice','Scheduled message was not sent: '+e.message); } state.scheduled=state.scheduled.filter(m=>m.id!==scheduled.id); changed=true; }
  if(state.settings.retention) { const cutoff=now()-state.settings.retention*86400000; const kept=state.messages.filter(m=>m.pinned||m.created>=cutoff); if(kept.length!==state.messages.length){state.messages=kept;changed=true;} }
  for(const [key,value] of rate) if(value.until<now()) rate.delete(key);
  for(const call of [...calls.values()]) if(call.status==='ringing'&&now()-call.created>45000) endCall(call,'missed');
  for(const play of [...playbacks.values()]) if(now()-play.started>180000) stopPlayback(play.id,'finished');
  if(changed) broadcast();
},1000); timer.unref();
http.listen(port,process.env.HOST||'0.0.0.0',()=>{port=http.address().port;save();fs.writeFileSync(controlPath,JSON.stringify({port,token:controlToken}),{mode:0o600});console.log(`\nHACKER TOES ${appVersion}\nThis computer: http://localhost:${port}\n${addresses().map(a=>'Share on your network: '+a).join('\n')}\nKeep this window open while people chat.\n`);if(process.env.OPEN_BROWSER==='1'){import('node:child_process').then(({spawn})=>{const url=`http://localhost:${port}`;if(process.platform==='darwin')spawn('open',[url]);else if(process.platform==='win32')spawn('cmd',['/c','start','',url]);});}});
http.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Hacker Toes may already be running. Open http://localhost:${port}, or choose another PORT.`:e);process.exit(1);});
function shutdown(){clearInterval(timer);save();try{if(JSON.parse(fs.readFileSync(controlPath,'utf8')).token===controlToken)fs.rmSync(controlPath,{force:true});}catch{}io.close();http.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
