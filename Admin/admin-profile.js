// admin-profile.js
// Requires firebase-app-compat, firebase-auth-compat and firebase-database-compat loaded in the page.

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

// DOM
const profileWrapper = document.getElementById("adminProfileWrapper");
const profileBtn = document.getElementById("adminProfileBtn");
const profileNameEl = document.getElementById("adminProfileName");
const profileInitialEl = document.getElementById("adminProfileInitial");
const profileDropdown = document.getElementById("adminProfileDropdown");
const profileLink = document.getElementById("adminProfileLink");
const changePwdLink = document.getElementById("adminChangePwdLink");
const logoutBtn = document.getElementById("adminLogoutBtn");

// util
function emailKey(email) { return email.trim().toLowerCase().replace(/\./g, ","); }

function setSignedOutUI() {
  if (!profileNameEl || !profileInitialEl) return;
  profileNameEl.textContent = "Sign in";
  profileInitialEl.textContent = "A";
  profileBtn.onclick = function () { window.location.href = "../auth.html"; };
  profileDropdown.classList.remove("show");
  profileDropdown.setAttribute("aria-hidden", "true");
}

// Listen for auth state change
auth.onAuthStateChanged(async (user) => {
  if (!profileBtn) return;
  if (!user) {
    setSignedOutUI();
    return;
  }

  // Fetch admin display name (users/{uid}/name) or fallback to email prefix
  let displayName = null;
  try {
    const uid = user.uid;
    const nameSnap = await db.ref("users/" + uid + "/name").get();
    if (nameSnap.exists() && nameSnap.val()) {
      displayName = nameSnap.val();
    } else {
      const email = user.email || "";
      if (email) {
        const sk = emailKey(email);
        const studSnap = await db.ref("students/" + sk + "/name").get();
        if (studSnap.exists() && studSnap.val()) displayName = studSnap.val();
      }
    }
  } catch (err) {
    console.error("admin profile read error:", err);
  }

  const short = displayName ? displayName.split(" ")[0] : (user.email ? user.email.split("@")[0] : "Admin");
  profileNameEl.textContent = displayName || (user.email ? user.email.split("@")[0] : "Admin");
  profileInitialEl.textContent = (short && short[0] ? short[0].toUpperCase() : "A");

  // Open/close dropdown
  profileBtn.onclick = function (ev) {
    ev.stopPropagation();
    const isShown = profileDropdown.classList.contains("show");
    if (isShown) {
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
    } else {
      profileDropdown.classList.add("show");
      profileDropdown.setAttribute("aria-hidden", "false");
      profileBtn.setAttribute("aria-expanded", "true");
    }
  };

  // Close dropdown when clicking outside
  document.addEventListener("click", (ev) => {
    if (!profileWrapper.contains(ev.target)) {
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Profile link -> admin profile page
  if (profileLink) {
    profileLink.onclick = function (ev) {
      ev.preventDefault();
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
      window.location.href = "admin-profile.html"; // create/edit as you like
    };
  }

  // Change password link -> change-password.html (same page used earlier)
  if (changePwdLink) {
    changePwdLink.onclick = function (ev) {
      ev.preventDefault();
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
      window.location.href = "change-password.html";
    };
  }

  // Logout handler
  if (logoutBtn) {
    logoutBtn.onclick = async function () {
      try {
        await auth.signOut();
        // after sign out redirect to auth page
        window.location.href = "../auth.html";
      } catch (err) {
        console.error("Logout failed:", err);
        alert("Logout failed. Try again.");
      }
    };
  }
});
