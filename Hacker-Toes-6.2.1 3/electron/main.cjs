const { app, BrowserWindow, Menu, dialog, desktopCapturer, ipcMain, session, shell } = require('electron');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { autoUpdater } = require('electron-updater');

const PRODUCT_NAME = 'Hacker Toes';
app.setName(PRODUCT_NAME);
if (process.platform === 'win32') app.setAppUserModelId('app.hackertoes.desktop');
const APP_ROOT = app.getAppPath();
const USER_ROOT = app.getPath('userData');
const DATA_DIR = path.join(USER_ROOT, 'data');
const TOOLS_DIR = path.join(USER_ROOT, 'tools');
const CONFIG_PATH = path.join(USER_ROOT, 'internet.config.json');
const TOKEN_PATH = path.join(DATA_DIR, 'cloudflare-token.txt');
const PREFS_PATH = path.join(USER_ROOT, 'desktop-settings.json');
const SERVER_URL_HOST = '127.0.0.1';
let serverUrl = `http://${SERVER_URL_HOST}:5050`;

let mainWindow = null;
let backendProcess = null;
let backendStartedByApp = false;
let quitting = false;
let hostMode = 'local';
let hostMessage = 'Local hosting is ready.';
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: 0,
  message: 'Check for updates when you are ready.'
};
let desktopPrefs = { autoCheckForUpdates: true };

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

function sendUpdateState(next) {
  updateState = { ...updateState, ...next, currentVersion: app.getVersion() };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:update-state', updateState);
  }
}

function safeSender(event) {
  try {
    const url = new URL(event.senderFrame.url);
    const trusted = new URL(serverUrl);
    return url.protocol === 'http:' && url.origin === trusted.origin;
  } catch { return false; }
}

function assertTrustedSender(event) {
  if (!safeSender(event)) throw new Error('This desktop action is only available to the Hacker Toes window.');
}

function ensureUserFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'sounds'), { recursive: true });
  fs.mkdirSync(TOOLS_DIR, { recursive: true });

  if (!fs.existsSync(CONFIG_PATH)) {
    const bundled = path.join(APP_ROOT, 'internet.config.example.json');
    const fallback = { mode: 'named', publicUrl: 'https://chat.hackertoes.bid', tokenFile: 'data/cloudflare-token.txt' };
    const config = fs.existsSync(bundled) ? readJson(bundled, fallback) : fallback;
    writeJson(CONFIG_PATH, config);
  }
  if (!fs.existsSync(TOKEN_PATH)) fs.writeFileSync(TOKEN_PATH, '', { mode: 0o600 });
  if (!fs.existsSync(PREFS_PATH)) writeJson(PREFS_PATH, desktopPrefs);
  desktopPrefs = { ...desktopPrefs, ...readJson(PREFS_PATH, {}) };
}

function reservePort(preferred = 5050) {
  const probePort = port => new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, SERVER_URL_HOST, () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
    });
  });
  return probePort(preferred).catch(error => {
    if (error.code !== 'EADDRINUSE') throw error;
    return probePort(0);
  });
}

async function waitForServer(url, child, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child && child.exitCode !== null) throw new Error(`Hacker Toes server stopped during startup (exit ${child.exitCode}).`);
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return;
    } catch { /* The backend is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw new Error('Hacker Toes did not start within 45 seconds. Check the desktop log in the app data folder.');
}

function startNodeScript(scriptName, env, port) {
  const scriptPath = path.join(APP_ROOT, scriptName);
  if (!fs.existsSync(scriptPath)) throw new Error(`Missing application file: ${scriptName}`);
  const child = spawn(process.execPath, [scriptPath], {
    cwd: USER_ROOT,
    env: {
      ...process.env,
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ATTACH_CONSOLE: '1',
      DATA_DIR,
      TOOLS_DIR,
      APP_WORKING_DIR: USER_ROOT,
      HOST: SERVER_URL_HOST,
      PORT: String(port),
      OPEN_BROWSER: '0'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  const logPath = path.join(USER_ROOT, 'desktop-server.log');
  const log = fs.createWriteStream(logPath, { flags: 'a', mode: 0o600 });
  const append = chunk => {
    const line = String(chunk);
    log.write(line);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('desktop:server-log', line.slice(-4000));
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.once('exit', (code, signal) => {
    log.end();
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:server-exit', { code, signal, logPath });
    }
  });
  child.once('error', error => append(`\nCould not launch server process: ${error.message}\n`));
  return child;
}

async function startBackend() {
  ensureUserFiles();
  try {
    const existing = await fetch('http://127.0.0.1:5050/api/health', { signal: AbortSignal.timeout(800) });
    if (existing.ok) {
      serverUrl = 'http://127.0.0.1:5050';
      hostMode = 'existing local host';
      hostMessage = 'An existing Hacker Toes server is already running. This desktop window has connected to it.';
      backendProcess = null;
      backendStartedByApp = false;
      return serverUrl;
    }
  } catch { /* No existing Hacker Toes server on the preferred port. */ }
  const config = readJson(CONFIG_PATH, { mode: 'named' });
  const tokenExists = fs.existsSync(TOKEN_PATH) && fs.statSync(TOKEN_PATH).size > 40;
  const canStartInternet = config.mode === 'quick' || (config.mode === 'named' && tokenExists);
  const port = await reservePort();
  const localUrl = `http://${SERVER_URL_HOST}:${port}`;
  serverUrl = localUrl;
  const env = { PORT: String(port) };

  if (canStartInternet) {
    hostMode = config.mode === 'quick' ? 'temporary tunnel' : 'named Cloudflare tunnel';
    hostMessage = config.mode === 'quick'
      ? 'The app is starting a temporary Cloudflare address. Network policies may prevent the tunnel from connecting.'
      : 'The app is starting your configured Cloudflare tunnel.';
    env.INTERNET_CONFIG_PATH = CONFIG_PATH;
    env.CLOUDFLARE_TOKEN_FILE = TOKEN_PATH;
    backendProcess = startNodeScript('internet-server.js', env, port);
  } else {
    hostMode = 'local only';
    hostMessage = 'The desktop app is running locally. Add your Cloudflare token in the app data folder and restart to enable internet hosting.';
    backendProcess = startNodeScript('server.js', env, port);
  }
  backendStartedByApp = true;
  await waitForServer(localUrl, backendProcess);
  return localUrl;
}

function setupMediaPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    let trusted = false;
    try { trusted = new URL(webContents.getURL()).origin === new URL(serverUrl).origin; } catch { trusted = false; }
    const allowed = new Set(['media', 'notifications', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write']);
    callback(trusted && allowed.has(permission));
  });
  ses.setPermissionCheckHandler((webContents, permission) => {
    try {
      const trusted = new URL(webContents.getURL()).origin === new URL(serverUrl).origin;
      return trusted && ['media', 'notifications', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission);
    } catch { return false; }
  });

  // Electron requires an explicit source decision for getDisplayMedia. The app
  // presents the native chooser and never selects a screen/window automatically.
  ses.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 240, height: 135 },
        fetchWindowIcons: true
      });
      if (!sources.length || !mainWindow || mainWindow.isDestroyed()) return callback({});
      const choices = sources.slice(0, 12);
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Share your screen',
        message: 'Choose what to share with the person on your call.',
        detail: 'Only the screen or window you select will be shared. You can stop sharing from Hacker Toes at any time.',
        buttons: [...choices.map(source => source.name), 'Cancel'],
        cancelId: choices.length,
        defaultId: 0,
        noLink: true
      });
      if (result.response < 0 || result.response >= choices.length) return callback({});
      callback({ video: choices[result.response] });
    } catch (error) {
      sendUpdateState({ message: `Screen sharing chooser error: ${error.message}` });
      callback({});
    }
  });
}

function setupUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => sendUpdateState({ status: 'checking', message: 'Checking the published Hacker Toes release…' }));
  autoUpdater.on('update-available', info => sendUpdateState({ status: 'available', availableVersion: info.version, percent: 0, message: `Version ${info.version} is available. Download it when you are ready.` }));
  autoUpdater.on('update-not-available', info => sendUpdateState({ status: 'not-available', availableVersion: null, message: `You are up to date${info?.version ? ` (version ${info.version})` : ''}.` }));
  autoUpdater.on('download-progress', progress => sendUpdateState({ status: 'downloading', availableVersion: updateState.availableVersion, percent: Math.max(0, Math.min(100, Math.round(progress.percent || 0))), message: `Downloading update… ${Math.round(progress.percent || 0)}%` }));
  autoUpdater.on('update-downloaded', info => sendUpdateState({ status: 'downloaded', availableVersion: info.version, percent: 100, message: `Version ${info.version} is downloaded and ready to install.` }));
  autoUpdater.on('error', error => sendUpdateState({ status: 'error', message: error?.message || 'The updater encountered an error.' }));
}

function buildMenu() {
  const template = [];
  if (process.platform === 'darwin') {
    template.push({ label: PRODUCT_NAME, submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Check for Updates…', click: () => openUpdates() },
      { type: 'separator' },
      { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }
    ] });
  }
  template.push({ label: 'File', submenu: [
    { label: 'Check for Updates…', click: () => openUpdates() },
    { type: 'separator' },
    { role: 'close' },
    ...(process.platform === 'darwin' ? [] : [{ role: 'quit' }])
  ] });
  template.push({ label: 'View', submenu: [
    { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }
  ] });
  template.push({ label: 'Help', submenu: [
    { label: 'Open Hacker Toes website', click: () => shell.openExternal('https://chat.hackertoes.bid/') },
    { label: 'Open desktop app data folder', click: () => shell.openPath(USER_ROOT) },
    { label: 'Check for Updates…', click: () => openUpdates() }
  ] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openUpdates() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('desktop:open-updates');
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#101410',
    title: PRODUCT_NAME,
    ...(process.platform === 'win32' ? { icon: path.join(APP_ROOT, 'build', 'icon.png') } : {}),
    webPreferences: {
      preload: path.join(APP_ROOT, 'electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      const parsed = new URL(target);
      if (parsed.protocol === 'https:') shell.openExternal(target);
    } catch { /* Ignore malformed or unsafe targets. */ }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    try {
      const parsed = new URL(target);
      if (!(parsed.protocol === 'http:' && parsed.host === new URL(url).host)) event.preventDefault();
    } catch { event.preventDefault(); }
  });
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(url);
}

function registerIpc() {
  ipcMain.handle('desktop:get-info', event => {
    assertTrustedSender(event);
    return {
      isDesktop: true,
      version: app.getVersion(),
      platform: process.platform,
      architecture: process.arch,
      packaged: app.isPackaged,
      hostMode,
      hostMessage,
      localUrl: serverUrl
    };
  });
  ipcMain.handle('desktop:system-volume', async (event, command = {}) => {
    assertTrustedSender(event);
    const action = command.action;
    if (!['get', 'set', 'mute'].includes(action)) throw new Error('Invalid system-volume command.');
    if (process.platform === 'win32') {
      const script = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'windows-system-volume.ps1')
        : path.join(APP_ROOT, 'electron', 'windows-system-volume.ps1');
      if (!fs.existsSync(script)) throw new Error('Windows system-volume helper is missing. Reinstall Hacker Toes.');
      const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', action];
      if (action === 'set') args.push('-Volume', String(Math.max(0, Math.min(100, Number(command.volume) || 0))));
      if (action === 'mute') args.push('-Muted', command.muted === true ? '1' : '0');
      try {
        const { stdout } = await execFileAsync('powershell.exe', args, { windowsHide: true, timeout: 8000, maxBuffer: 4096 });
        const result = JSON.parse(stdout.trim());
        if (!Number.isFinite(result.volume) || typeof result.muted !== 'boolean') throw new Error('Windows returned an invalid volume response.');
        return result;
      } catch (error) { throw new Error(error.stderr?.trim() || error.message || 'Could not change Windows master volume.'); }
    }
    if (process.platform === 'darwin') {
      // macOS controls the built-in output master volume via the system AppleScript interface.
      const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      try {
        if (action === 'set') {
          await execFileAsync('osascript', ['-e', `set volume output volume ${clamp(command.volume)}`], { timeout: 8000, maxBuffer: 4096 });
        } else if (action === 'mute') {
          await execFileAsync('osascript', ['-e', `set volume output muted ${command.muted === true ? 'true' : 'false'}`], { timeout: 8000, maxBuffer: 4096 });
        }
        const { stdout } = await execFileAsync('osascript', ['-e', 'get volume settings'], { timeout: 8000, maxBuffer: 4096 });
        const volumeMatch = stdout.match(/output volume:\s*(\d+)/i);
        const mutedMatch = stdout.match(/output muted:\s*(true|false)/i);
        if (!volumeMatch || !mutedMatch) throw new Error('macOS returned an unreadable volume response.');
        return { volume: Number(volumeMatch[1]), muted: mutedMatch[1].toLowerCase() === 'true' };
      } catch (error) { throw new Error(error.stderr?.trim() || error.message || 'Could not change macOS master volume.'); }
    }
    throw new Error('Remote system-volume control requires the installed Windows or macOS desktop app.');
  });
  ipcMain.handle('desktop:get-update-state', event => { assertTrustedSender(event); return updateState; });
  ipcMain.handle('desktop:get-auto-check', event => { assertTrustedSender(event); return !!desktopPrefs.autoCheckForUpdates; });
  ipcMain.handle('desktop:set-auto-check', (event, value) => {
    assertTrustedSender(event);
    desktopPrefs.autoCheckForUpdates = value === true;
    writeJson(PREFS_PATH, desktopPrefs);
    return desktopPrefs.autoCheckForUpdates;
  });
  ipcMain.handle('desktop:check-updates', async event => {
    assertTrustedSender(event);
    if (!app.isPackaged) {
      sendUpdateState({ status: 'development', message: 'Update checks are available in an installed desktop build, not the development window.' });
      return updateState;
    }
    try {
      await autoUpdater.checkForUpdates();
      return updateState;
    } catch (error) {
      sendUpdateState({ status: 'error', message: error?.message || 'Could not check for updates.' });
      throw new Error(updateState.message);
    }
  });
  ipcMain.handle('desktop:download-update', async event => {
    assertTrustedSender(event);
    if (!app.isPackaged || updateState.status !== 'available') throw new Error('There is no available update to download.');
    try { await autoUpdater.downloadUpdate(); return updateState; }
    catch (error) { sendUpdateState({ status: 'error', message: error?.message || 'Update download failed.' }); throw new Error(updateState.message); }
  });
  ipcMain.handle('desktop:install-update', event => {
    assertTrustedSender(event);
    if (!app.isPackaged || updateState.status !== 'downloaded') throw new Error('Download an update before installing it.');
    sendUpdateState({ status: 'installing', message: 'Closing Hacker Toes and installing the update…' });
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 300);
    return { ok: true };
  });
}

async function stopBackend() {
  if (!backendProcess || !backendStartedByApp || backendProcess.killed) return;
  const child = backendProcess;
  backendProcess = null;
  await new Promise(resolve => {
    const timeout = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    try { child.kill('SIGTERM'); } catch { clearTimeout(timeout); resolve(); }
  });
}

app.whenReady().then(async () => {
  try {
    ensureUserFiles();
    setupMediaPermissions();
    setupUpdater();
    registerIpc();
    buildMenu();
    const url = await startBackend();
    createWindow(url);
    if (app.isPackaged && desktopPrefs.autoCheckForUpdates) {
      setTimeout(() => {
        if (!quitting) autoUpdater.checkForUpdates().catch(error => sendUpdateState({ status: 'error', message: error?.message || 'Automatic update check failed.' }));
      }, 7000);
    }
  } catch (error) {
    await dialog.showMessageBox({ type: 'error', title: `${PRODUCT_NAME} could not start`, message: error?.message || 'Unknown startup error', detail: `App data: ${USER_ROOT}\nLog: ${path.join(USER_ROOT, 'desktop-server.log')}` });
    app.quit();
  }
});

app.on('before-quit', event => {
  if (quitting) return;
  quitting = true;
  if (backendProcess && backendStartedByApp) {
    event.preventDefault();
    stopBackend().finally(() => app.quit());
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    waitForServer(serverUrl, backendProcess, 5000).then(() => createWindow(serverUrl)).catch(() => app.quit());
  }
});
