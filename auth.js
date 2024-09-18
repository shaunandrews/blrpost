import { BrowserWindow, ipcMain } from "electron";
import OAuth from "oauth";
import url from "url";
import querystring from "querystring";
import Store from "electron-store";
import dotenv from "dotenv";
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
            console.log("Raw API response:", userInfo);
            if (userInfo && userInfo.response && userInfo.response.user) {
              resolve(userInfo.response.user);
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
  getRequestToken()
    .then(({ oauthToken, oauthTokenSecret }) => {
      store.set("oauthTokenSecret", oauthTokenSecret);

      const authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authURL = `${AUTHORIZE_URL}?${querystring.stringify({
        oauth_token: oauthToken,
      })}`;

      authWindow.loadURL(authURL);

      const filter = {
        urls: [CALLBACK_URL + "*"],
      };

      const {
        session: { webRequest },
      } = authWindow.webContents;

      webRequest.onBeforeRequest(filter, async (details, callback) => {
        const parsedUrl = url.parse(details.url, true);
        const { oauth_verifier } = parsedUrl.query;

        const storedSecret = store.get("oauthTokenSecret");

        try {
          const { oauthAccessToken, oauthAccessTokenSecret } =
            await getAccessToken(oauthToken, storedSecret, oauth_verifier);

          store.set("oauthAccessToken", oauthAccessToken);
          store.set("oauthAccessTokenSecret", oauthAccessTokenSecret);

          // Fetch user info
          const userInfo = await getUserInfo(
            oauthAccessToken,
            oauthAccessTokenSecret
          );

          // Notify the main window with user info
          mainWindow.webContents.send("auth-success", userInfo);

          authWindow.close();
          callback({ cancel: false });
        } catch (err) {
          console.error("Error in authentication process:", err);
          mainWindow.webContents.send(
            "auth-failure",
            err.message || "Unknown error occurred"
          );
          authWindow.close();
          callback({ cancel: false });
        }
      });
    })
    .catch((error) => {
      console.error("Error getting request token:", error);
      mainWindow.webContents.send(
        "auth-failure",
        error.message || "Error getting request token"
      );
    });
}

export { authenticate };
