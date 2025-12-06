// auth.js
// Combined Login + Register page using Firebase Auth + Realtime DB

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

/* ---------------- DOM ---------------- */
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginPane = document.getElementById("loginPane");
const registerPane = document.getElementById("registerPane");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMsg = document.getElementById("loginMsg");

const registerForm = document.getElementById("registerForm");
const regName = document.getElementById("regName");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regConfirm = document.getElementById("regConfirm");
const regMsg = document.getElementById("regMsg");

const forgotPwd = document.getElementById("forgotPwd");

/* ---------------- HELPERS ---------------- */
function showPane(which) {
  if (which === "login") {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginPane.classList.remove("hidden");
    registerPane.classList.add("hidden");
    clearMessages();
  } else {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerPane.classList.remove("hidden");
    loginPane.classList.add("hidden");
    clearMessages();
  }
}
function clearMessages() {
  loginMsg.textContent = "";
  loginMsg.className = "form-message";
  regMsg.textContent = "";
  regMsg.className = "form-message";
}

tabLogin.addEventListener("click", () => showPane("login"));
tabRegister.addEventListener("click", () => showPane("register"));

function emailKey(email) {
  return email.trim().toLowerCase().replace(/\./g, ",");
}

/* ---------------- REGISTER ---------------- */
registerForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  regMsg.textContent = "";
  regMsg.className = "form-message";

  const name = regName.value.trim();
  const email = regEmail.value.trim();
  const pw = regPassword.value;
  const confirm = regConfirm.value;

  if (!name || !email || !pw || !confirm) {
    regMsg.textContent = "Please fill all fields.";
    regMsg.classList.add("error");
    return;
  }
  if (pw.length < 6) {
    regMsg.textContent = "Password must be at least 6 characters.";
    regMsg.classList.add("error");
    return;
  }
  if (pw !== confirm) {
    regMsg.textContent = "Passwords do not match.";
    regMsg.classList.add("error");
    return;
  }

  const btn = registerForm.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, pw);
    const uid = userCred.user.uid;

    const userRec = {
      uid: uid,
      name: name,
      email: email,
      role: "student",
      createdAt: Date.now(),
      suspended: false          // ⭐ ADDED – ensure new users are not suspended
    };

    await db.ref("users/" + uid).set(userRec);

    const sk = emailKey(email);
    await db.ref("students/" + sk).set({
      uid: uid,
      name: name,
      email: email,
      createdAt: Date.now()
    });

    regMsg.textContent = "Account created. Redirecting…";
    regMsg.classList.add("success");
  } catch (err) {
    regMsg.textContent = err.message || "Registration failed.";
    regMsg.classList.add("error");
    btn.disabled = false;
    btn.textContent = "Create student account";
  }
});

/* ---------------- LOGIN ---------------- */
loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  loginMsg.textContent = "";
  loginMsg.className = "form-message";

  const email = loginEmail.value.trim();
  const pw = loginPassword.value;

  if (!email || !pw) {
    loginMsg.textContent = "Please enter email and password.";
    loginMsg.classList.add("error");
    return;
  }

  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (err) {
    loginMsg.textContent = err.message || "Login failed.";
    loginMsg.classList.add("error");
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

/* ---------------- FORGOT PASSWORD ---------------- */
forgotPwd.addEventListener("click", function (e) {
  e.preventDefault();
  const email = loginEmail.value.trim() || regEmail.value.trim();
  if (!email) {
    return alert("Enter your registered email first.");
  }
  if (!confirm("Send password reset email to " + email + "?")) return;

  auth.sendPasswordResetEmail(email)
    .then(() => alert("Password reset email sent."))
    .catch(err => alert("Error: " + err.message));
});

/* ---------------- AUTH STATE + ROLE + SUSPENDED CHECK ---------------- */
auth.onAuthStateChanged(async function (user) {
  if (!user) return;

  try {
    const uid = user.uid;

    // ⭐ READ USER RECORD FIRST
    const userSnap = await db.ref("users/" + uid).get();
    if (!userSnap.exists()) {
      await auth.signOut();
      alert("Your account is removed or unavailable.");
      return;
    }

    const profile = userSnap.val();

    // ⭐ BLOCK SUSPENDED USER
    if (profile.suspended === true) {
      await auth.signOut();
      alert("Your account is suspended. Contact admin.");
      return;
    }

    // ROLE DETECTION (your original logic)
    let role = profile.role || "student";

    // Redirect
    if (role === "admin") {
      window.location.href = "Admin/admin.html";
    } else {
      window.location.href = "index.html";
    }

  } catch (err) {
    console.error("Role-detection error:", err);
    window.location.href = "index.html";
  }
});

/* ---------------- 5-MIN INACTIVITY AUTO LOGOUT ---------------- */
// ⭐ ADDED AUTO LOGOUT SYSTEM
let inactivityTimer;
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    auth.signOut().then(() => {
      alert("You were logged out due to inactivity.");
      window.location.href = "auth.html";
    });
  }, INACTIVITY_LIMIT);
}

// Events that count as user activity
["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(evt => {
  window.addEventListener(evt, resetInactivityTimer);
});

// Start timer immediately
resetInactivityTimer();
