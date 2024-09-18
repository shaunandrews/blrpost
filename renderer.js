document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  const authButton = document.getElementById("authButton");
  const authSection = document.getElementById("authSection");
  const userInfo = document.getElementById("userInfo");
  const avatar = document.getElementById("avatar");
  const username = document.getElementById("username");
  const errorMessage = document.getElementById("errorMessage");

  // New variables
  const fileInput = document.getElementById("fileInput");
  const postSection = document.getElementById("postSection");
  const postText = document.getElementById("postText");
  const uploadButton = document.getElementById("uploadButton");
  const loading = document.getElementById("loading");
  const viewPostButton = document.getElementById("viewPostButton");

  let selectedFile = null;
  let postUrl = "";

  // Handle file selection
  fileInput.addEventListener("change", (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
      postSection.style.display = "block";
    }
  });

  // Handle post upload
  uploadButton.addEventListener("click", () => {
    if (!selectedFile) {
      showError("Please select an image to upload.");
      return;
    }

    const textContent = postText.value || "";
    uploadPost(selectedFile, textContent);
  });

  // Upload post function
  function uploadPost(file, text) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const base64Image = event.target.result.split(',')[1];
      const postData = {
        type: "photo",
        caption: text || "",
        data64: base64Image
      };

      loading.style.display = "block";
      postSection.style.display = "none";

      window.api.uploadPost(postData)
        .then((response) => {
          loading.style.display = "none";
          if (response.success) {
            postUrl = response.url;
            viewPostButton.style.display = "block";
          } else {
            showError("Failed to upload post: " + response.error);
            postSection.style.display = "block";
          }
        })
        .catch((error) => {
          loading.style.display = "none";
          showError("Error uploading post: " + error.message);
          postSection.style.display = "block";
        });
    };
    reader.readAsDataURL(file);
  }

  // Open post in default browser
  viewPostButton.addEventListener("click", () => {
    if (postUrl) {
      window.api.openExternal(postUrl);
    }
  });

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

  const logoutButton = document.getElementById("logoutButton");

  logoutButton.addEventListener("click", () => {
    window.api.logout();
  });

  window.api.onLogoutSuccess(() => {
    userInfo.style.display = "none";
    authSection.style.display = "block";
    // Clear any displayed user data
    document.getElementById("username").textContent = "";
    document.getElementById("avatar").src = "";
  });
});
