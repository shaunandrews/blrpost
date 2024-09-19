import { app, BrowserWindow, ipcMain, clipboard, nativeImage } from "electron";
import path from "path";
import Store from "electron-store";
import {
  authenticate,
  authenticateWithStoredCredentials,
  getStoredUserInfo,
  uploadPost,
} from "./auth.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fetch from "node-fetch";
import { logout } from "./auth.js";

const store = new Store();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 540,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' https://*.tumblr.com; " +
              "script-src 'self' https://*.tumblr.com; " +
              "style-src 'self' 'unsafe-inline' https://*.tumblr.com; " +
              "img-src 'self' data: https://*.tumblr.com; " +
              "connect-src 'self' https://*.tumblr.com;",
          ],
        },
      });
    }
  );

  mainWindow.loadFile("index.html");

  // Check for stored user info immediately after window creation
  const storedUserInfo = getStoredUserInfo();
  if (storedUserInfo) {
    mainWindow.webContents.on("did-finish-load", () => {
      mainWindow.webContents.send("auth-success", storedUserInfo);
    });
  } else {
    // Try to authenticate with stored credentials on app start
    authenticateWithStoredCredentials(mainWindow)
      .then((userInfo) => {
        if (userInfo) {
          console.log("Authenticated with stored credentials");
        } else {
          console.log("No stored credentials or authentication required");
        }
      })
      .catch((error) => {
        console.error("Error authenticating with stored credentials:", error);
        mainWindow.webContents.send(
          "auth-failure",
          "Error authenticating with stored credentials"
        );
      });
  }

  // Handle manual authentication request
  ipcMain.on("start-auth", () => {
    authenticate(mainWindow)
      .then(() => console.log("Manual authentication successful"))
      .catch((error) => {
        console.error("Error during manual authentication:", error);
        mainWindow.webContents.send(
          "auth-failure",
          "Error during authentication"
        );
      });
  });

  // Handle logout request
  ipcMain.on("logout", (event) => {
    logout();
    mainWindow.webContents.send("logout-success");
  });

  // Handle clipboard image request
  ipcMain.handle('get-clipboard-image', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return null;
    }
    return image.toPNG();
  });
}

ipcMain.handle("upload-post", async (event, formData) => {
  console.log("Received upload-post request");
  console.log("Current blog identifier:", store.get("blogIdentifier"));
  try {
    const result = await uploadPost(formData);
    console.log("Upload result:", result);
    return result;
  } catch (error) {
    console.error("Error in upload-post handler:", error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  // Register other IPC handlers here
  ipcMain.on("start-auth", () => {
    authenticate(mainWindow)
      .then(() => console.log("Manual authentication successful"))
      .catch((error) => {
        console.error("Error during manual authentication:", error);
        mainWindow.webContents.send(
          "auth-failure",
          "Error during authentication"
        );
      });
  });

  ipcMain.on("logout", (event) => {
    logout();
    mainWindow.webContents.send("logout-success");
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
