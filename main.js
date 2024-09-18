import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { authenticate, authenticateWithStoredCredentials } from "./auth.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self';" +
              "script-src 'self';" +
              "style-src 'self' 'unsafe-inline';" +
              "img-src 'self' https://*.tumblr.com https://*.media.tumblr.com data:;" +
              "connect-src 'self' https://api.tumblr.com;",
          ],
        },
      });
    }
  );

  mainWindow.loadFile("index.html");

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
}

app.whenReady().then(createWindow);

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
