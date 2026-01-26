/* ---------------------------------------------------
   admin-core.js (CLEAN & FIXED)
--------------------------------------------------- */

// ===============================
// Firebase Initialization (ONCE)
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyBjcNmWxI91atAcnv1ALZM4723Cer6OFGo",
  authDomain: "student-enrollment-39c2f.firebaseapp.com",
  databaseURL: "https://student-enrollment-39c2f-default-rtdb.firebaseio.com",
  projectId: "student-enrollment-39c2f",
  storageBucket: "student-enrollment-39c2f.firebasestorage.app",
  messagingSenderId: "810600465736",
  appId: "1:810600465736:web:953640e6f15a530ee25f7d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// ===============================
// DOM – PROFILE
// ===============================
const profileWrapper = document.getElementById("adminProfileWrapper");
const profileBtn = document.getElementById("adminProfileBtn");
const profileNameEl = document.getElementById("adminProfileName");
const profileInitialEl = document.getElementById("adminProfileInitial");
const profileDropdown = document.getElementById("adminProfileDropdown");
const profileLink = document.getElementById("adminProfileLink");
const changePwdLink = document.getElementById("adminChangePwdLink");
const logoutBtn = document.getElementById("adminLogoutBtn");

// ===============================
// DOM – DASHBOARD STATS
// ===============================
const homeTotalCoursesEl = document.getElementById("homeTotalCourses");
const homeTakenTopicsEl = document.getElementById("homeTakenTopics");
const homeTotalTopicsEl = document.getElementById("homeTotalTopics");
const homeTotalSeatsEl = document.getElementById("homeTotalSeats");
const homeTotalFilledEl = document.getElementById("homeTotalFilled");
const homeTotalRemainingEl = document.getElementById("homeTotalRemaining");
const homeTotalEnrollmentsEl = document.getElementById("homeTotalEnrollments");
const homeCoursesWithEnrollmentsEl = document.getElementById("homeCoursesWithEnrollments");
const homeTotalGroupsEl = document.getElementById("homeTotalGroups");
const homeCoursesWithGroupsEl = document.getElementById("homeCoursesWithGroups");

// ===============================
// HELPERS
// ===============================
function emailKey(email) {
  return email.trim().toLowerCase().replace(/\./g, ",");
}

// ===============================
// SINGLE AUTH LISTENER (IMPORTANT)
// ===============================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "../auth.html";
    return;
  }

  /* -------- ROLE CHECK -------- */
  try {
    const roleSnap = await db.ref("users/" + user.uid + "/role").get();
    if (!roleSnap.exists() || roleSnap.val() !== "admin") {
      alert("Access Denied: Admin Only");
      window.location.href = "index.html";
      return;
    }
  } catch (err) {
    console.error("Role check failed:", err);
    window.location.href = "../auth.html";
    return;
  }

  /* -------- PROFILE UI -------- */
  let displayName = null;

  try {
    const nameSnap = await db.ref("users/" + user.uid + "/name").get();
    if (nameSnap.exists()) {
      displayName = nameSnap.val();
    } else if (user.email) {
      const sk = emailKey(user.email);
      const studSnap = await db.ref("students/" + sk + "/name").get();
      if (studSnap.exists()) displayName = studSnap.val();
    }
  } catch {}

  const short =
    displayName?.split(" ")[0] ||
    (user.email ? user.email.split("@")[0] : "Admin");

  if (profileNameEl) profileNameEl.textContent = displayName || short;
  if (profileInitialEl) profileInitialEl.textContent = short[0].toUpperCase();

  if (profileBtn && profileDropdown) {
    profileBtn.onclick = (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("show");
    };

    document.addEventListener("click", (e) => {
      if (!profileWrapper.contains(e.target)) {
        profileDropdown.classList.remove("show");
      }
    });
  }

  if (profileLink) {
    profileLink.onclick = () => (window.location.href = "admin-profile.html");
  }

  if (changePwdLink) {
    changePwdLink.onclick = () =>
      (window.location.href = "change-password.html");
  }

  /* -------- LOGOUT (FIXED) -------- */
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (!confirm("Are you sure you want to logout?")) return;
      await auth.signOut();
      window.location.href = "../auth.html";
    };
  }

  /* -------- DASHBOARD -------- */
  loadDashboard();
});

// ===============================
// DASHBOARD DATA
// ===============================
let coursesData = {};
let enrollmentsData = {};
let groupsData = {};

function loadDashboard() {
  if (!homeTotalCoursesEl) return;

  db.ref("courses").on("value", (s) => {
    coursesData = s.val() || {};
    updateDashboard();
  });

  db.ref("enrollments").on("value", (s) => {
    enrollmentsData = s.val() || {};
    updateDashboard();
  });

  db.ref("groups").on("value", (s) => {
    groupsData = s.val() || {};
    updateDashboard();
  });
}

function updateDashboard() {
  const courseIds = Object.keys(coursesData);

  let totalCourses = courseIds.length;
  let totalSeats = 0;
  let totalFilled = 0;
  let totalRemaining = 0;
  let totalTopics = 0;
  let takenTopics = 0;

  courseIds.forEach((cid) => {
    const c = coursesData[cid] || {};
    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;

    totalSeats += maxSeats;
    totalFilled += filledSeats;
    totalRemaining += Math.max(0, maxSeats - filledSeats);

    const topics = c.topics || {};
    totalTopics += Object.keys(topics).length;
    takenTopics += Object.values(topics).filter(t => t.isTaken).length;
  });

  let totalEnrollments = 0;
  let coursesWithEnrollments = 0;
  Object.values(enrollmentsData).forEach(e => {
    const c = Object.keys(e || {}).length;
    if (c > 0) {
      totalEnrollments += c;
      coursesWithEnrollments++;
    }
  });

  let totalGroups = 0;
  let coursesWithGroups = 0;
  Object.values(groupsData).forEach(g => {
    const c = Object.keys(g || {}).length;
    if (c > 0) {
      totalGroups += c;
      coursesWithGroups++;
    }
  });

  homeTotalCoursesEl.textContent = totalCourses;
  homeTotalSeatsEl.textContent = totalSeats;
  homeTotalFilledEl.textContent = totalFilled;
  homeTotalRemainingEl.textContent = totalRemaining;
  homeTotalTopicsEl.textContent = totalTopics;
  homeTakenTopicsEl.textContent = takenTopics;
  homeTotalEnrollmentsEl.textContent = totalEnrollments;
  homeCoursesWithEnrollmentsEl.textContent = coursesWithEnrollments;
  homeTotalGroupsEl.textContent = totalGroups;
  homeCoursesWithGroupsEl.textContent = coursesWithGroups;
}

/* ---------------------------------------------------
   END admin-core.js
--------------------------------------------------- */
