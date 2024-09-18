const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  startAuth: () => ipcRenderer.send("start-auth"),
  onAuthSuccess: (callback) =>
    ipcRenderer.on("auth-success", (_, user) => callback(user)),
  onAuthFailure: (callback) =>
    ipcRenderer.on("auth-failure", (_, error) => callback(error)),
  onAuthRequired: (callback) =>
    ipcRenderer.on("auth-required", () => callback()),
});
