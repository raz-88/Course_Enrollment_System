// change-password.js
// Requires firebase-app-compat and firebase-auth-compat loaded in HTML

const firebaseConfig = {
  apiKey: "AIzaSyBjcNmWxI91atAcnv1ALZM4723Cer6OFGo",
  authDomain: "student-enrollment-39c2f.firebaseapp.com",
  databaseURL: "https://student-enrollment-39c2f-default-rtdb.firebaseio.com",
  projectId: "student-enrollment-39c2f",
  storageBucket: "student-enrollment-39c2f.firebasestorage.app",
  messagingSenderId: "810600465736",
  appId: "1:810600465736:web:953640e6f15a530ee25f7d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const form = document.getElementById("changePwdForm");
const currentPwdInput = document.getElementById("currentPwd");
const newPwdInput = document.getElementById("newPwd");
const confirmNewPwdInput = document.getElementById("confirmNewPwd");
const msgEl = document.getElementById("changePwdMsg");
const btn = document.getElementById("changePwdBtn");

// Ensure user is signed in; otherwise redirect to login
auth.onAuthStateChanged((user) => {
  if (!user) {
    // not signed in -> redirect to auth
    window.location.href = "../auth.html";
  }
});

// Helper: show message
function showMessage(text, type) {
  msgEl.textContent = text || "";
  msgEl.className = "message";
  if (type === "success") msgEl.classList.add("success");
  else if (type === "error") msgEl.classList.add("error");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage("", "");

  const currentPwd = currentPwdInput.value || "";
  const newPwd = newPwdInput.value || "";
  const confirmPwd = confirmNewPwdInput.value || "";

  if (!currentPwd || !newPwd || !confirmPwd) {
    showMessage("Please fill all fields.", "error");
    return;
  }
  if (newPwd.length < 6) {
    showMessage("New password must be at least 6 characters.", "error");
    return;
  }
  if (newPwd !== confirmPwd) {
    showMessage("New passwords do not match.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      showMessage("No signed-in user found. Please sign in again.", "error");
      btn.disabled = false;
      btn.textContent = "Change Password";
      return;
    }

    // Reauthenticate user with email + current password
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPwd);

    await user.reauthenticateWithCredential(credential);

    // If reauth succeeded, update password
    await user.updatePassword(newPwd);

    showMessage("Password changed successfully. You may need to sign in again.", "success");

    // Optionally sign out user to force re-login
    setTimeout(async () => {
      try {
        await auth.signOut();
        window.location.href = "../auth.html";
      } catch (e) {
        console.warn("Could not sign out after password change:", e);
      }
    }, 1400);

  } catch (err) {
    console.error("Password change error:", err);
    // Friendly error messages for common codes
    const code = err.code || "";
    if (code === "auth/wrong-password") {
      showMessage("Current password is incorrect.", "error");
    } else if (code === "auth/weak-password") {
      showMessage("New password is too weak. Choose a stronger password.", "error");
    } else if (code === "auth/requires-recent-login") {
      showMessage("Session expired. Please sign in again and retry.", "error");
      // optionally sign out to force re-login
      try { await auth.signOut(); } catch (e) {}
      setTimeout(() => { window.location.href = "../auth.html"; }, 900);
    } else {
      showMessage(err.message || "Error changing password. Try again.", "error");
    }
    btn.disabled = false;
    btn.textContent = "Change Password";
  }
});
