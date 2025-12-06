// student-home.js (Require Login + Profile Dropdown + Courses)
// ------------------------------------------------------------

// Firebase init
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
const db = firebase.database();
const auth = firebase.auth();

// DOM elements
const coursesGrid = document.getElementById("coursesGrid");
const coursesInfo = document.getElementById("coursesInfo");

const profileWrapper = document.getElementById("profileWrapper");
const profileBtn = document.getElementById("profileBtn");
const profileNameEl = document.getElementById("profileName");
const profileInitialEl = document.getElementById("profileInitial");
const profileDropdown = document.getElementById("profileDropdown");
const profileLink = document.getElementById("profileLink");
const logoutBtn = document.getElementById("logoutBtn");

function emailKey(email) {
  return email.trim().toLowerCase().replace(/\./g, ",");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------------------------------
// REQUIRE LOGIN BEFORE LOADING ANYTHING
// ------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Redirect instantly if not logged in
    window.location.href = "auth.html";
    return;
  }

  // User is logged in → Load personalized UI
  await setupUserProfile(user);
  loadStudentCourses();
});

// ------------------------------------------------------------
// Setup profile UI for logged-in user
// ------------------------------------------------------------
async function setupUserProfile(user) {
  let displayName = null;

  try {
    const uid = user.uid;
    const userNameSnap = await db.ref("users/" + uid + "/name").get();

    if (userNameSnap.exists()) {
      displayName = userNameSnap.val();
    } else if (user.email) {
      const sk = emailKey(user.email);
      const studSnap = await db.ref("students/" + sk + "/name").get();
      if (studSnap.exists()) displayName = studSnap.val();
    }
  } catch {}

  const short = displayName
    ? displayName.split(" ")[0]
    : user.email.split("@")[0];

  profileNameEl.textContent = displayName || short;
  profileInitialEl.textContent = short[0].toUpperCase();

  profileBtn.onclick = function (evt) {
    evt.stopPropagation();
    const open = profileDropdown.classList.contains("show");
    profileDropdown.classList.toggle("show", !open);
    profileDropdown.setAttribute("aria-hidden", open ? "true" : "false");
  };

  document.addEventListener("click", function (ev) {
    if (!profileWrapper.contains(ev.target)) {
      profileDropdown.classList.remove("show");
    }
  });

  // Profile page
  profileLink.onclick = function () {
    window.location.href = "Student_Enrollment/student-my-enrollments.html";
  };

  // Logout
  logoutBtn.onclick = async function () {
    await auth.signOut();
    window.location.href = "auth.html";
  };
}

// ------------------------------------------------------------
// Load all courses that student can see
// ------------------------------------------------------------
let courseCache = {};
let enrollmentsByCourse = {};

async function loadStudentCourses() {
  coursesInfo.textContent = "Loading courses...";
  coursesGrid.innerHTML = "";

  try {
    const [coursesSnap, enrollmentsSnap] = await Promise.all([
      db.ref("courses").get(),
      db.ref("enrollments").get()
    ]);

    courseCache = coursesSnap.exists() ? coursesSnap.val() : {};
    const enrollData = enrollmentsSnap.exists() ? enrollmentsSnap.val() : {};

    enrollmentsByCourse = {};
    Object.keys(enrollData).forEach((courseId) => {
      enrollmentsByCourse[courseId] =
        Object.keys(enrollData[courseId] || {}).length;
    });

    renderCourseCards();
  } catch (err) {
    coursesInfo.textContent = "Error loading courses.";
  }
}

// ------------------------------------------------------------
// Render course cards
// ------------------------------------------------------------
function renderCourseCards() {
  coursesGrid.innerHTML = "";

  const ids = Object.keys(courseCache);
  if (!ids.length) {
    coursesInfo.textContent = "No courses available.";
    return;
  }

  const activeCourses = ids.filter((id) => {
    const c = courseCache[id];
    return (c.status || "active") === "active";
  });

  if (!activeCourses.length) {
    coursesInfo.textContent = "No active courses right now.";
    return;
  }

  coursesInfo.textContent = `Showing ${activeCourses.length} active course(s).`;

  activeCourses.forEach((courseId) => {
    const c = courseCache[courseId];
    const filled = typeof c.filledSeats === "number"
      ? c.filledSeats
      : (enrollmentsByCourse[courseId] || 0);

    const maxSeats = c.maxSeats || 0;
    const remaining = maxSeats > 0 ? maxSeats - filled : 0;
    const remainingSafe = Math.max(remaining, 0);

    let badge = "badge-seats-ok";
    let badgeText = "Seats available";
    if (maxSeats === 0) {
      badgeText = "Open seats";
    } else if (remainingSafe === 0) {
      badgeText = "Course full";
      badge = "badge-seats-full";
    } else if (remainingSafe <= Math.max(1, Math.floor(maxSeats * 0.2))) {
      badgeText = "Few seats left";
      badge = "badge-seats-low";
    }

    const card = document.createElement("article");
    card.className = "course-card";

    card.innerHTML = `
      <div>
        <h3 class="course-title">${escapeHtml(c.name)}</h3>
        <p class="course-desc">${escapeHtml(c.description)}</p>

        <div class="course-meta">
          ${c.startDate ? `<span><strong>Start:</strong> ${escapeHtml(c.startDate)}</span>` : ""}
          ${c.duration ? `<span><strong>Duration:</strong> ${escapeHtml(c.duration)}</span>` : ""}
          <span><strong>Seats:</strong> ${filled}/${maxSeats || "∞"}</span>
        </div>
      </div>

      <div class="course-footer">
        <span class="badge ${badge}">${badgeText}</span>

        <div style="display:flex; gap:6px;">
          <a href="Student_Enrollment/course-details.html?courseId=${courseId}" class="btn btn-secondary">
            View Details
          </a>

          <a href="Student_Enrollment/enroll.html?courseId=${courseId}"
            class="btn btn-primary ${remainingSafe === 0 && maxSeats > 0 ? "disabled" : ""}">
            Enroll
          </a>
        </div>
      </div>
    `;

    coursesGrid.appendChild(card);
  });
}
