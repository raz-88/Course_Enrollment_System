// auth.js
// Combined Login + Register page using Firebase Auth + Realtime DB
// Paste your firebaseConfig here (same as other files)

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
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginPane = document.getElementById("loginPane");
const registerPane = document.getElementById("registerPane");

// login form
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMsg = document.getElementById("loginMsg");

// register form
const registerForm = document.getElementById("registerForm");
const regName = document.getElementById("regName");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regConfirm = document.getElementById("regConfirm");
const regMsg = document.getElementById("regMsg");

// forgot password link
const forgotPwd = document.getElementById("forgotPwd");

// helpers
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
  loginMsg.textContent = ""; loginMsg.className = "form-message";
  regMsg.textContent = ""; regMsg.className = "form-message";
}

// tab clicks
tabLogin.addEventListener("click", function(){ showPane("login"); });
tabRegister.addEventListener("click", function(){ showPane("register"); });

// email -> safe key (for students node)
function emailKey(email){
  return email.trim().toLowerCase().replace(/\./g, ',');
}

// register flow (student only)
registerForm.addEventListener("submit", async function(e){
  e.preventDefault();
  regMsg.textContent = ""; regMsg.className = "form-message";

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

  // Disable UI while working
  const btn = registerForm.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  try {
    // Create auth user
    const userCred = await auth.createUserWithEmailAndPassword(email, pw);
    const uid = userCred.user.uid;

    // Save user metadata and student profile in DB
    const userRec = {
      uid: uid,
      name: name,
      email: email,
      role: "student",
      createdAt: Date.now()
    };

    await db.ref("users/" + uid).set(userRec);

    // student profile keyed by sanitized email for lookup in My Enrollments
    const sk = emailKey(email);
    await db.ref("students/" + sk).set({
      uid: uid,
      name: name,
      email: email,
      createdAt: Date.now()
    });

    regMsg.textContent = "Account created. Redirecting…";
    regMsg.classList.add("success");

    // auto-login handled by Firebase auth state change — redirect in onAuthStateChanged below
  } catch (err) {
    console.error("Register error:", err);
    regMsg.textContent = err.message || "Registration failed.";
    regMsg.classList.add("error");
    btn.disabled = false;
    btn.textContent = "Create student account";
  }
});

// login flow (student + admin)
loginForm.addEventListener("submit", async function(e){
  e.preventDefault();
  loginMsg.textContent = ""; loginMsg.className = "form-message";

  const email = loginEmail.value.trim();
  const pw = loginPassword.value;
  if (!email || !pw) {
    loginMsg.textContent = "Please enter email and password.";
    loginMsg.classList.add("error");
    return;
  }

  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Signing in...";

  try {
    const cred = await auth.signInWithEmailAndPassword(email, pw);
    // onAuthStateChanged will handle redirect & role detection
  } catch (err) {
    console.error("Login failed:", err);
    loginMsg.textContent = err.message || "Login failed.";
    loginMsg.classList.add("error");
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

// forgot password
forgotPwd.addEventListener("click", function(e){
  e.preventDefault();
  const email = loginEmail.value.trim() || regEmail.value.trim();
  if (!email) {
    alert("Enter your registered email in the Email field first and click 'Forgot password'.");
    return;
  }
  if (!confirm("Send password reset email to " + email + "?")) return;
  auth.sendPasswordResetEmail(email).then(function(){
    alert("Password reset email sent. Check your inbox.");
  }).catch(function(err){
    alert("Error sending reset email: " + (err.message || err));
  });
});

// detect auth state changes and route based on role
auth.onAuthStateChanged(async function(user){
  if (!user) return; // no logged-in user

  // After login/registration, decide where to send user
  try {
    const uid = user.uid;

    // read role: check users/{uid}/role OR admins/{uid}
    const [usersSnap, adminSnap] = await Promise.all([
      db.ref("users/" + uid + "/role").get(),
      db.ref("admins/" + uid).get()
    ]);

    let role = null;
    if (usersSnap.exists()) {
      role = usersSnap.val();
    } else if (adminSnap.exists()) {
      // legacy admin node present
      role = "admin";
    } else {
      // fallback: check users/{uid} record for role property
      const userRec = await db.ref("users/" + uid).get();
      if (userRec.exists()) {
        const ur = userRec.val();
        if (ur && ur.role) role = ur.role;
      }
    }

    // If role still not known, default to student (safe) or fetch from 'students' by email
    if (!role) {
      // try to see if a student profile exists
      const emailKeyVal = emailKey(user.email || "");
      const sSnap = await db.ref("students/" + emailKeyVal).get();
      if (sSnap.exists()) role = "student";
    }

    // Redirect based on role
    if (role === "admin") {
      // redirect to admin dashboard
      window.location.href = "Admin/admin.html";
    } else {
      // default to student home
      window.location.href = "index.html";
    }
  } catch (err) {
    console.error("Role-detection error:", err);
    // fallback
    window.location.href = "index.html";
  }
});
