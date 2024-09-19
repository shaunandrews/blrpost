document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  const authButton = document.getElementById("authButton");
  const authSection = document.getElementById("authSection");
  const postSection = document.getElementById("postSection");
  const avatar = document.getElementById("avatar");
  const username = document.getElementById("username");
  const errorMessage = document.getElementById("errorMessage");

  // New variables
  const selectFileButton = document.getElementById("selectFileButton");
  const fileInput = document.getElementById("fileInput");
  const previewContainer = document.getElementById("previewContainer");
  const filePreview = document.getElementById("filePreview");
  const clearFileButton = document.getElementById("clearFileButton");
  const postCreation = document.getElementById("postCreation");
  const uploadButton = document.getElementById("uploadButton");
  const loading = document.getElementById("loading");
  const viewPostButton = document.getElementById("viewPostButton");
  const selectClipboardButton = document.getElementById(
    "selectClipboardButton"
  );

  let selectedFile = null;
  let postUrl = "";

  // Handle select file button click
  selectFileButton.addEventListener("click", () => {
    fileInput.click();
  });

  // Handle select clipboard button click
  selectClipboardButton.addEventListener("click", () => {
    window.api
      .getClipboardImage()
      .then((clipboardImage) => {
        if (clipboardImage) {
          selectedFile = new File([clipboardImage], "clipboard_image.png", {
            type: "image/png",
          });
          showImagePreview(selectedFile);
        } else {
          showError("No image found in clipboard.");
        }
      })
      .catch((error) => {
        showError("Error accessing clipboard: " + error.message);
      });
  });

  // Function to show image preview
  function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      filePreview.src = e.target.result;
      previewContainer.style.display = "block";
      selectFileButton.style.display = "none";
      selectClipboardButton.style.display = "none";
      postCreation.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  // Handle file selection
  fileInput.addEventListener("change", (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
      showImagePreview(selectedFile);
    }
  });

  // Handle clear file selection
  clearFileButton.addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    previewContainer.style.display = "none";
    selectFileButton.style.display = "block";
    selectClipboardButton.style.display = "block";
    postCreation.style.display = "none";
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
    reader.onload = function (event) {
      const base64Image = event.target.result.split(",")[1];
      const postData = {
        type: "photo",
        caption: text || "",
        data64: base64Image,
      };

      loading.style.display = "block";
      postCreation.style.display = "none";

      window.api
        .uploadPost(postData)
        .then((response) => {
          loading.style.display = "none";
          if (response.success) {
            postUrl = response.url;
            viewPostButton.style.display = "block";
          } else {
            showError("Failed to upload post: " + response.error);
            postCreation.style.display = "block";
          }
        })
        .catch((error) => {
          loading.style.display = "none";
          showError("Error uploading post: " + error.message);
          postCreation.style.display = "block";
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
    if (!authSection || !postSection || !avatar || !username) {
      console.error("One or more elements not found for showing user info");
      console.log("authSection:", authSection);
      console.log("postSection:", postSection);
      console.log("avatar:", avatar);
      console.log("username:", username);
      showError("Error displaying user info. Please try again.");
      return;
    }

    authSection.style.display = "none";
    postSection.style.display = "flex"; // Change this to 'flex' to match the CSS

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
    if (authSection && postSection) {
      authSection.style.display = "block";
      postSection.style.display = "none";
    } else {
      console.error("Auth section or post section element not found");
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
    postSection.style.display = "none";
    authSection.style.display = "block";
    // Clear any displayed user data
    document.getElementById("username").textContent = "";
    document.getElementById("avatar").src = "";
  });
});
