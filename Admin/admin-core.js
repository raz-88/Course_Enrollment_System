/* ---------------------------------------------------
   admin-core.js (combined admin-profile + admin-home)
   Firebase init happens ONCE here.
--------------------------------------------------- */

// -------------------------------
// Firebase Initialization (only once)
// -------------------------------
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

/* ---------------------------------------------------
   ADMIN PROFILE SECTION (DROPDOWN / LOGOUT)
--------------------------------------------------- */

// DOM
const profileWrapper = document.getElementById("adminProfileWrapper");
const profileBtn = document.getElementById("adminProfileBtn");
const profileNameEl = document.getElementById("adminProfileName");
const profileInitialEl = document.getElementById("adminProfileInitial");
const profileDropdown = document.getElementById("adminProfileDropdown");
const profileLink = document.getElementById("adminProfileLink");
const changePwdLink = document.getElementById("adminChangePwdLink");
const logoutBtn = document.getElementById("adminLogoutBtn");

// utility
function emailKey(email) {
  return email.trim().toLowerCase().replace(/\./g, ",");
}

function setSignedOutUI() {
  if (!profileNameEl || !profileInitialEl || !profileBtn) return;
  profileNameEl.textContent = "Sign in";
  profileInitialEl.textContent = "A";
  profileBtn.onclick = function () {
    window.location.href = "../auth.html";
  };
  profileDropdown?.classList.remove("show");
  profileDropdown?.setAttribute("aria-hidden", "true");
}

// Auth state listener for admin profile
auth.onAuthStateChanged(async (user) => {
  if (!profileBtn) return;

  if (!user) {
    setSignedOutUI();
    return;
  }

  // Load admin name
  let displayName = null;
  try {
    const uid = user.uid;
    const nameSnap = await db.ref("users/" + uid + "/name").get();
    if (nameSnap.exists()) {
      displayName = nameSnap.val();
    } else {
      // fallback from students path
      const email = user.email || "";
      if (email) {
        const sk = emailKey(email);
        const studSnap = await db.ref("students/" + sk + "/name").get();
        if (studSnap.exists()) displayName = studSnap.val();
      }
    }
  } catch (err) {
    console.error("Admin profile read error:", err);
  }

  const shortName =
    displayName?.split(" ")[0] ||
    (user.email ? user.email.split("@")[0] : "Admin");

  profileNameEl.textContent =
    displayName || (user.email ? user.email.split("@")[0] : "Admin");
  profileInitialEl.textContent = shortName[0]?.toUpperCase() || "A";

  // dropdown toggle
  profileBtn.onclick = function (ev) {
    ev.stopPropagation();
    const show = !profileDropdown.classList.contains("show");
    profileDropdown.classList.toggle("show", show);
    profileDropdown.setAttribute("aria-hidden", show ? "false" : "true");
    profileBtn.setAttribute("aria-expanded", show ? "true" : "false");
  };

  document.addEventListener("click", (ev) => {
    if (!profileWrapper.contains(ev.target)) {
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
    }
  });

  // My profile page
  if (profileLink) {
    profileLink.onclick = function (ev) {
      ev.preventDefault();
      profileDropdown.classList.remove("show");
      window.location.href = "admin-profile.html";
    };
  }

  // Change password page
  if (changePwdLink) {
    changePwdLink.onclick = function (ev) {
      ev.preventDefault();
      profileDropdown.classList.remove("show");
      window.location.href = "change-password.html";
    };
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.onclick = async function () {
      try {
        await auth.signOut();
        window.location.href = "../auth.html";
      } catch (err) {
        console.error("Logout failed:", err);
        alert("Logout failed. Try again.");
      }
    };
  }
});

/* ---------------------------------------------------
   ADMIN HOME STATISTICS (Dashboard)
--------------------------------------------------- */

// DOM for homepage stats
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

// Live datasets
let coursesData = {};
let enrollmentsData = {};
let groupsData = {};

function loadAll() {
  // Load courses
  db.ref("courses").on("value", (snap) => {
    coursesData = snap.val() || {};
    updateDashboard();
  });

  // Load enrollments
  db.ref("enrollments").on("value", (snap) => {
    enrollmentsData = snap.val() || {};
    updateDashboard();
  });

  // Load groups
  db.ref("groups").on("value", (snap) => {
    groupsData = snap.val() || {};
    updateDashboard();
  });
}

function updateDashboard() {
  if (!homeTotalCoursesEl) return; // Means: current page is not dashboard

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
    const remaining = maxSeats - filledSeats;

    totalSeats += maxSeats;
    totalFilled += filledSeats;
    if (remaining > 0) totalRemaining += remaining;

    const topics = c.topics || {};
    const topicIds = Object.keys(topics);
    totalTopics += topicIds.length;
    takenTopics += topicIds.filter((tid) => topics[tid].isTaken).length;
  });

  // Enrollments
  let totalEnrollments = 0;
  let coursesWithEnrollments = 0;
  Object.entries(enrollmentsData).forEach(([cid, enrolls]) => {
    const count = Object.keys(enrolls || {}).length;
    if (count > 0) {
      totalEnrollments += count;
      coursesWithEnrollments++;
    }
  });

  // Groups
  let totalGroups = 0;
  let coursesWithGroups = 0;
  Object.entries(groupsData).forEach(([cid, groups]) => {
    const count = Object.keys(groups || {}).length;
    if (count > 0) {
      totalGroups += count;
      coursesWithGroups++;
    }
  });

  // Update UI
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
   ADMIN-ONLY PAGE PROTECTION (MUST BE LOGGED IN)
--------------------------------------------------- */
auth.onAuthStateChanged(async (user) => {
  // If not logged in → go to login page
  if (!user) {
    window.location.href = "../auth.html";
    return;
  }

  // Check user's role
  try {
    const snap = await db.ref("users/" + user.uid + "/role").get();
    const role = snap.val();

    // If no role or user is not admin => block access
    if (!role || role !== "admin") {
      alert("Access Denied: Admin Only");
      window.location.href = "../index.html";
      return;
    }

    // If admin → allow page to load normally
    console.log("Admin authenticated:", user.email);

  } catch (err) {
    console.error("Role check failed:", err);
    window.location.href = "../auth.html";
  }
});


// Start dashboard loading (only runs if dashboard elements exist)
loadAll();

/* ---------------------------------------------------
   END admin-core.js
--------------------------------------------------- */
