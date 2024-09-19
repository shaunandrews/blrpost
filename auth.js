import { BrowserWindow, ipcMain } from "electron";
import OAuth from "oauth";
import url from "url";
import querystring from "querystring";
import Store from "electron-store";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

const store = new Store();

const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const REQUEST_TOKEN_URL = "https://www.tumblr.com/oauth/request_token";
const ACCESS_TOKEN_URL = "https://www.tumblr.com/oauth/access_token";
const AUTHORIZE_URL = "https://www.tumblr.com/oauth/authorize";
const CALLBACK_URL = "http://localhost:12345/callback";

const oauth = new OAuth.OAuth(
  REQUEST_TOKEN_URL,
  ACCESS_TOKEN_URL,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  "1.0A",
  CALLBACK_URL,
  "HMAC-SHA1"
);

function getRequestToken() {
  return new Promise((resolve, reject) => {
    oauth.getOAuthRequestToken(
      (error, oauthToken, oauthTokenSecret, results) => {
        if (error) {
          reject(error);
        } else {
          resolve({ oauthToken, oauthTokenSecret });
        }
      }
    );
  });
}

function getAccessToken(oauthToken, oauthTokenSecret, oauthVerifier) {
  return new Promise((resolve, reject) => {
    oauth.getOAuthAccessToken(
      oauthToken,
      oauthTokenSecret,
      oauthVerifier,
      (error, oauthAccessToken, oauthAccessTokenSecret, results) => {
        if (error) {
          reject(error);
        } else {
          resolve({ oauthAccessToken, oauthAccessTokenSecret });
        }
      }
    );
  });
}

function getUserInfo(accessToken, accessTokenSecret) {
  return new Promise((resolve, reject) => {
    oauth.get(
      "https://api.tumblr.com/v2/user/info",
      accessToken,
      accessTokenSecret,
      (error, data, response) => {
        if (error) {
          console.error("Error fetching user info:", error);
          reject(error);
        } else {
          try {
            const userInfo = JSON.parse(data);
            console.log("Raw API response:", JSON.stringify(userInfo, null, 2));
            if (userInfo && userInfo.response && userInfo.response.user) {
              const user = userInfo.response.user;
              console.log("User object:", JSON.stringify(user, null, 2));

              // Store the blog identifier (assuming the first blog)
              if (user.blogs && user.blogs.length > 0) {
                const blogIdentifier = user.blogs[0].name;
                store.set("blogIdentifier", blogIdentifier);
                console.log("Stored blog identifier:", blogIdentifier);
              } else {
                console.error("No blogs found in user info");
                reject(new Error("No blogs found for user"));
              }

              // Store the entire user object
              store.set("userInfo", user);

              resolve(user);
            } else {
              console.error("Unexpected API response structure:", userInfo);
              reject(new Error("Unexpected API response structure"));
            }
          } catch (parseError) {
            console.error("Error parsing API response:", parseError);
            reject(parseError);
          }
        }
      }
    );
  });
}

function authenticate(mainWindow) {
  return new Promise((resolve, reject) => {
    // Clear any existing tokens before starting a new authentication
    store.delete('oauthAccessToken');
    store.delete('oauthAccessTokenSecret');

    getRequestToken()
      .then(({ oauthToken, oauthTokenSecret }) => {
        store.set("oauthTokenSecret", oauthTokenSecret);

        const authWindow = new BrowserWindow({
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
          parent: mainWindow,
          modal: true,
        });

        // Set Content Security Policy for auth window
        authWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [
                "default-src 'self' https://*.tumblr.com; " +
                "script-src 'self' https://*.tumblr.com; " +
                "style-src 'self' 'unsafe-inline' https://*.tumblr.com; " +
                "img-src 'self' data: https://*.tumblr.com; " +
                "connect-src 'self' https://*.tumblr.com;"
              ]
            }
          })
        });

        const authURL = `${AUTHORIZE_URL}?${querystring.stringify({
          oauth_token: oauthToken,
          scope: 'write offline_access'
        })}`;

        authWindow.loadURL(authURL);

        const filter = {
          urls: [CALLBACK_URL + "*"],
        };

        authWindow.webContents.session.webRequest.onBeforeRequest(
          filter,
          async (details, callback) => {
            const parsedUrl = url.parse(details.url, true);
            const { oauth_verifier } = parsedUrl.query;

            const storedSecret = store.get("oauthTokenSecret");

            try {
              const { oauthAccessToken, oauthAccessTokenSecret } =
                await getAccessToken(oauthToken, storedSecret, oauth_verifier);

              store.set("oauthAccessToken", oauthAccessToken);
              store.set("oauthAccessTokenSecret", oauthAccessTokenSecret);
              console.log("Stored credentials:", { oauthAccessToken, oauthAccessTokenSecret });

              // Fetch user info
              const userInfo = await getUserInfo(
                oauthAccessToken,
                oauthAccessTokenSecret
              );
              console.log("User info after authentication:", JSON.stringify(userInfo, null, 2));
              console.log("Blog identifier after authentication:", store.get("blogIdentifier"));

              // Notify the main window with user info
              mainWindow.webContents.send("auth-success", userInfo);

              authWindow.close();
              callback({ cancel: false });
              resolve(userInfo);
            } catch (err) {
              console.error("Error in authentication process:", err);
              mainWindow.webContents.send(
                "auth-failure",
                err.message || "Unknown error occurred"
              );
              authWindow.close();
              callback({ cancel: false });
              reject(err);
            }
          }
        );

        authWindow.on("closed", () => {
          reject(new Error("Authentication window was closed"));
        });
      })
      .catch((error) => {
        console.error("Error getting request token:", error);
        mainWindow.webContents.send(
          "auth-failure",
          error.message || "Error getting request token"
        );
        reject(error);
      });
  });
}

function checkStoredCredentials() {
  const accessToken = store.get("oauthAccessToken");
  const accessTokenSecret = store.get("oauthAccessTokenSecret");
  return accessToken && accessTokenSecret
    ? { accessToken, accessTokenSecret }
    : null;
}

function authenticateWithStoredCredentials(mainWindow) {
  return new Promise((resolve, reject) => {
    const credentials = checkStoredCredentials();
    if (credentials) {
      getUserInfo(credentials.accessToken, credentials.accessTokenSecret)
        .then((userInfo) => {
          // Store user info in the electron-store
          store.set("userInfo", userInfo);
          console.log("Blog identifier after stored credentials auth:", store.get("blogIdentifier"));
          mainWindow.webContents.send("auth-success", userInfo);
          resolve(userInfo);
        })
        .catch((error) => {
          console.error("Error authenticating with stored credentials:", error);
          mainWindow.webContents.send(
            "auth-failure",
            "Stored credentials invalid"
          );
          // Clear invalid credentials
          store.delete("oauthAccessToken");
          store.delete("oauthAccessTokenSecret");
          store.delete("userInfo");
          reject(error);
        });
    } else {
      mainWindow.webContents.send("auth-required");
      resolve(null); // Resolve with null if no stored credentials
    }
  });
}

function getStoredUserInfo() {
  return store.get("userInfo");
}

async function refreshOAuthToken() {
  const storedCredentials = checkStoredCredentials();
  if (!storedCredentials) {
    throw new Error("No stored credentials found");
  }

  return new Promise((resolve, reject) => {
    oauth.getOAuthAccessToken(
      storedCredentials.accessToken,
      storedCredentials.accessTokenSecret,
      (error, oauthAccessToken, oauthAccessTokenSecret, results) => {
        if (error) {
          console.error("Error refreshing OAuth token:", error);
          reject(error);
        } else {
          store.set("oauthAccessToken", oauthAccessToken);
          store.set("oauthAccessTokenSecret", oauthAccessTokenSecret);
          console.log("Refreshed OAuth token:", { oauthAccessToken, oauthAccessTokenSecret });
          resolve({ oauthAccessToken, oauthAccessTokenSecret });
        }
      }
    );
  });
}

async function uploadPost(formData) {
  const credentials = checkStoredCredentials();
  const blogIdentifier = store.get("blogIdentifier");

  if (!credentials || !blogIdentifier) {
    throw new Error("Missing authentication credentials or blog identifier");
  }

  let { accessToken, accessTokenSecret } = credentials;
  const uploadUrl = `https://api.tumblr.com/v2/blog/${blogIdentifier}/post`;

  const attemptUpload = () => {
    return new Promise((resolve, reject) => {
      oauth.post(
        uploadUrl,
        accessToken,
        accessTokenSecret,
        formData,
        "application/json",
        (error, data, response) => {
          if (error) {
            console.error("Upload error:", error);
            reject(error);
          } else {
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.meta.status === 201 && parsedData.response && parsedData.response.id) {
                const postId = parsedData.response.id;
                const postSlug = parsedData.response.slug || '';
                const postUrl = `https://${blogIdentifier}.tumblr.com/post/${postId}/${postSlug}`;
                resolve({ success: true, url: postUrl });
              } else {
                reject(new Error(parsedData.errors ? parsedData.errors[0].detail : "Upload failed"));
              }
            } catch (parseError) {
              console.error("Error parsing API response:", parseError);
              reject(parseError);
            }
          }
        }
      );
    });
  };

  try {
    return await attemptUpload();
  } catch (error) {
    if (error.statusCode === 401) {
      console.log("Attempting to refresh OAuth token...");
      const newCredentials = await refreshOAuthToken();
      accessToken = newCredentials.oauthAccessToken;
      accessTokenSecret = newCredentials.oauthAccessTokenSecret;
      return await attemptUpload();
    }
    throw error;
  }
}

function logout() {
  store.delete('oauthAccessToken');
  store.delete('oauthAccessTokenSecret');
  store.delete('userInfo');
  store.delete('blogIdentifier');
  console.log("Logged out: Cleared all stored credentials and user info");
}

export { authenticate, authenticateWithStoredCredentials, getStoredUserInfo, uploadPost, logout };
