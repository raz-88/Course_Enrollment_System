// student-home.js (Personalized + Public view + Profile dropdown + Logout)
// -------------------------------
// Firebase init (same config)
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
const db = firebase.database();
const auth = firebase.auth();

// -------------------------------
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

// helpers
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

// -------------------------------
// Public course loading (runs immediately)
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
      const courseEnrollments = enrollData[courseId] || {};
      enrollmentsByCourse[courseId] = Object.keys(courseEnrollments).length;
    });

    renderCourseCards();
  } catch (err) {
    console.error(err);
    coursesInfo.textContent = "Error loading courses. Please try again later.";
  }
}

function renderCourseCards() {
  coursesGrid.innerHTML = "";

  const ids = Object.keys(courseCache);
  if (!ids.length) {
    coursesInfo.textContent = "No courses are available right now.";
    return;
  }

  // Filter only active courses
  const activeCourses = ids.filter((id) => {
    const c = courseCache[id];
    const status = c && c.status ? c.status : "active";
    return status === "active";
  });

  if (!activeCourses.length) {
    coursesInfo.textContent = "No active courses available at the moment.";
    return;
  }

  coursesInfo.textContent = `Showing ${activeCourses.length} active course(s).`;

  activeCourses.forEach((courseId) => {
    const c = courseCache[courseId];
    const name = c.name || "Untitled Course";
    const desc = c.description || "";
    const maxSeats = c.maxSeats || 0;

    // Prefer stored filledSeats if present, else use count from enrollments
    let filledSeats = 0;
    if (typeof c.filledSeats === "number") {
      filledSeats = c.filledSeats;
    } else if (enrollmentsByCourse[courseId]) {
      filledSeats = enrollmentsByCourse[courseId];
    }

    const remaining = maxSeats > 0 ? maxSeats - filledSeats : 0;
    const remainingSafe = remaining < 0 ? 0 : remaining;

    // Determine seat badge
    let badgeClass = "badge-seats-ok";
    let badgeText = "Seats available";

    if (maxSeats === 0) {
      badgeText = "Open seats";
      badgeClass = "badge-seats-ok";
    } else if (remainingSafe <= 0) {
      badgeText = "Course full";
      badgeClass = "badge-seats-full";
    } else if (remainingSafe <= Math.max(1, Math.floor(maxSeats * 0.2))) {
      badgeText = "Few seats left";
      badgeClass = "badge-seats-low";
    }

    const startDate = c.startDate || "";
    const duration = c.duration || "";

    const card = document.createElement("article");
    card.className = "course-card";

    card.innerHTML = `
      <div>
        <div class="course-header">
          <h3 class="course-title">${escapeHtml(name)}</h3>
        </div>
        <p class="course-desc">
          ${escapeHtml(desc) || "No description provided for this course."}
        </p>
        <div class="course-meta">
          ${
            startDate
              ? `<span><strong>Start:</strong> ${escapeHtml(startDate)}</span>`
              : ""
          }
          ${
            duration
              ? `<span><strong>Duration:</strong> ${escapeHtml(duration)}</span>`
              : ""
          }
          <span class="seat-line">
            <strong>Seats:</strong>
            ${
              maxSeats > 0
                ? `${filledSeats}/${maxSeats} enrolled`
                : `${filledSeats} enrolled`
            }
          </span>
        </div>
      </div>
      <div class="course-footer">
        <span class="badge ${badgeClass}">${badgeText}</span>
        <div style="display:flex; gap:6px;">
          <a href="Student_Enrollment/course-details.html?courseId=${encodeURIComponent(
            courseId
          )}" class="btn btn-secondary">
            View Details
          </a>
          <a href="Student_Enrollment/enroll.html?courseId=${encodeURIComponent(
            courseId
          )}" class="btn btn-primary ${
            remainingSafe <= 0 && maxSeats > 0 ? "disabled" : ""
          }" ${
            remainingSafe <= 0 && maxSeats > 0 ? 'aria-disabled="true"' : ""
          }>
            Enroll
          </a>
        </div>
      </div>
    `;

    coursesGrid.appendChild(card);
  });
}

// Start public load
loadStudentCourses();

// -------------------------------
// Auth-aware personalization (no redirect)
// - If signed in: show welcome name + dropdown & load courses (refresh to show user-specific UI if needed).
// - If not signed in: profile button redirects to auth page.
auth.onAuthStateChanged(async (user) => {
  if (!profileBtn) return;

  if (!user) {
    // Signed out: show "Sign in"
    profileNameEl.textContent = "Sign in";
    profileInitialEl.textContent = "A";
    // clicking opens auth page
    profileBtn.onclick = function () {
      window.location.href = "auth.html";
    };
    // hide dropdown
    profileDropdown.classList.remove("show");
    profileDropdown.setAttribute("aria-hidden", "true");
    return;
  }

  // Signed in: show name + initial and attach dropdown actions
  let displayName = null;
  try {
    // Try users/{uid}/name
    const uid = user.uid;
    const userNameSnap = await db.ref("users/" + uid + "/name").get();
    if (userNameSnap.exists() && userNameSnap.val()) {
      displayName = userNameSnap.val();
    } else {
      // fallback: students by email
      const email = user.email || "";
      if (email) {
        const sk = emailKey(email);
        const studSnap = await db.ref("students/" + sk + "/name").get();
        if (studSnap.exists() && studSnap.val()) displayName = studSnap.val();
      }
    }
  } catch (err) {
    console.error("Error reading display name:", err);
  }

  const short = displayName
    ? displayName.split(" ").slice(0, 1)[0]
    : (user.email ? user.email.split("@")[0] : "You");

  profileNameEl.textContent = displayName || (user.email ? user.email.split("@")[0] : "User");
  profileInitialEl.textContent = (short && short[0] ? short[0].toUpperCase() : "U");

  // profile button opens/closes dropdown
  profileBtn.onclick = function (evt) {
    evt.stopPropagation();
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

  // clicking outside closes dropdown
  document.addEventListener("click", function (ev) {
    if (!profileWrapper.contains(ev.target)) {
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Profile link already points to student-my-enrollments.html
  profileLink.onclick = function () {
    // close dropdown and navigate
    profileDropdown.classList.remove("show");
    profileDropdown.setAttribute("aria-hidden", "true");
    profileBtn.setAttribute("aria-expanded", "false");
    window.location.href = "student-my-enrollments.html";
  };

  // logout
  logoutBtn.onclick = async function () {
    try {
      await auth.signOut();
      // after sign out, show signin label
      profileNameEl.textContent = "Sign in";
      profileInitialEl.textContent = "A";
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
      // optional: redirect to auth page
      window.location.href = "../auth.html";
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Try again.");
    }
  };

  // refresh courses (optional) — some apps might show different content for logged users
  loadStudentCourses();
});
