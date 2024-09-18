document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  const authButton = document.getElementById("authButton");
  const authSection = document.getElementById("authSection");
  const userInfo = document.getElementById("userInfo");
  const avatar = document.getElementById("avatar");
  const username = document.getElementById("username");
  const errorMessage = document.getElementById("errorMessage");

  function showUserInfo(user) {
    console.log("Showing user info:", JSON.stringify(user, null, 2));
    if (!authSection || !userInfo || !avatar || !username) {
      console.error("One or more elements not found for showing user info");
      console.log("authSection:", authSection);
      console.log("userInfo:", userInfo);
      console.log("avatar:", avatar);
      console.log("username:", username);
      showError("Error displaying user info. Please try again.");
      return;
    }

    authSection.style.display = "none";
    userInfo.style.display = "block";

    // Handle avatar
    if (user.blogs && user.blogs[0] && user.blogs[0].avatar) {
      avatar.src = user.blogs[0].avatar[0].url;
      avatar.style.display = "inline";
    } else {
      console.log("No avatar found, hiding avatar element");
      avatar.style.display = "none";
    }

    // Handle username
    username.textContent = user.name || "Unknown User";

    console.log("User info displayed successfully");
  }

  function showAuthButton() {
    console.log("Showing auth button");
    if (authSection && userInfo) {
      authSection.style.display = "block";
      userInfo.style.display = "none";
    } else {
      console.error("Auth section or user info element not found");
      showError(
        "Error displaying authentication button. Please refresh the page."
      );
    }
  }

  function showError(message) {
    console.error("Error:", message);
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = "block";
    } else {
      console.error("Error message element not found");
      alert(message); // Fallback to alert if error element not found
    }
  }

  if (authButton) {
    authButton.addEventListener("click", () => {
      console.log("Auth button clicked");
      window.api.startAuth();
    });
  } else {
    console.error("Auth button not found");
    showError("Authentication button not found. Please refresh the page.");
  }

  window.api.onAuthSuccess((user) => {
    console.log("Auth success:", JSON.stringify(user, null, 2));
    showUserInfo(user);
  });

  window.api.onAuthFailure((error) => {
    console.error("Authentication failed:", error);
    showError("Authentication failed: " + error);
    showAuthButton();
  });

  window.api.onAuthRequired(() => {
    console.log("Auth required");
    showAuthButton();
  });
});
