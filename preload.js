const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startAuth: () => ipcRenderer.send('start-auth'),
  onAuthSuccess: (callback) =>
    ipcRenderer.on('auth-success', (_, user) => callback(user)),
  onAuthFailure: (callback) =>
    ipcRenderer.on('auth-failure', (_, error) => callback(error)),
  onAuthRequired: (callback) =>
    ipcRenderer.on('auth-required', () => callback()),
  uploadPost: (formData) => ipcRenderer.invoke('upload-post', formData),
  openExternal: (url) => shell.openExternal(url),
  logout: () => ipcRenderer.send('logout'),
  onLogoutSuccess: (callback) => ipcRenderer.on('logout-success', () => callback()),
  getClipboardImage: () => ipcRenderer.invoke('get-clipboard-image'),
  getClipboardContent: () => ipcRenderer.invoke('get-clipboard-content'),
  fetch: (url, options) => fetch(url, options),
});
