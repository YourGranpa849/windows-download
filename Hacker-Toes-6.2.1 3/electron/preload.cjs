const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('hackerToesDesktop', Object.freeze({
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  getUpdateState: () => ipcRenderer.invoke('desktop:get-update-state'),
  systemVolume: command => ipcRenderer.invoke('desktop:system-volume', command),
  onSystemVolumeCommand: callback => subscribe('desktop:system-volume-command', callback),
  getAutoCheck: () => ipcRenderer.invoke('desktop:get-auto-check'),
  setAutoCheck: value => ipcRenderer.invoke('desktop:set-auto-check', value === true),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('desktop:download-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  onUpdateState: callback => subscribe('desktop:update-state', callback),
  onOpenUpdates: callback => subscribe('desktop:open-updates', callback),
  onServerExit: callback => subscribe('desktop:server-exit', callback)
}));
