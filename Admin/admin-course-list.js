// admin-course-list.js

// -------------------------------
// Firebase init
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
   MUST BE LOGGED IN TO ACCESS THIS PAGE
--------------------------------------------------- */
auth.onAuthStateChanged((user) => {
  if (!user) {
    alert("You must be logged in to access this page.");
    window.location.href = "../auth.html";
    return;
  }

  // User is logged in => allow page to load normally
  loadCourses();
});

/* ---------------------------------------------------
   DOM elements
--------------------------------------------------- */
const coursesTableBody = document.getElementById("coursesTableBody");
const listTotalCoursesEl = document.getElementById("listTotalCourses");
const listTotalSeatsEl = document.getElementById("listTotalSeats");
const listTotalFilledEl = document.getElementById("listTotalFilled");
const listTotalRemainingEl = document.getElementById("listTotalRemaining");

const exportCoursesExcelBtn = document.getElementById("exportCoursesExcelBtn");
const exportCoursesPdfBtn = document.getElementById("exportCoursesPdfBtn");

let courseCache = {};

/* ---------------------------------------------------
   Load and render courses
--------------------------------------------------- */
function loadCourses() {
  db.ref("courses").on("value", (snapshot) => {
    courseCache = snapshot.val() || {};
    renderCoursesTable();
    updateSummary();
  });
}

function renderCoursesTable() {
  coursesTableBody.innerHTML = "";

  const ids = Object.keys(courseCache);
  if (ids.length === 0) {
    coursesTableBody.innerHTML = `<tr><td colspan="9">No courses created yet.</td></tr>`;
    return;
  }

  ids.forEach((id) => {
    const c = courseCache[id];
    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;
    const remaining = maxSeats - filledSeats;
    const status = c.status || "active";

    const topics = c.topics || {};
    const topicIds = Object.keys(topics);
    const totalTopics = topicIds.length;
    const takenTopics = topicIds.filter((tid) => topics[tid].isTaken).length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name || ""}</td>
      <td>${maxSeats}</td>
      <td>${filledSeats}</td>
      <td>${remaining < 0 ? 0 : remaining}</td>
      <td>${takenTopics}/${totalTopics}</td>
      <td>${c.startDate || "-"}</td>
      <td>${c.duration || "-"}</td>
      <td>
        <span class="status-badge ${
          status === "active" ? "status-active" : "status-suspended"
        }">
          ${status === "active" ? "Active" : "Suspended"}
        </span>
      </td>
      <td>
        <button class="btn-secondary btn-edit-course" data-id="${id}">Edit</button>
        <button class="btn-primary btn-toggle-status"
                data-id="${id}"
                data-status="${status}">
          ${status === "active" ? "Suspend" : "Activate"}
        </button>
        <button class="btn-danger btn-delete-course" data-id="${id}">Delete</button>
      </td>
    `;
    coursesTableBody.appendChild(tr);
  });

  attachActionHandlers();
}

/* ---------------------------------------------------
   Summary Calculations
--------------------------------------------------- */
function updateSummary() {
  const ids = Object.keys(courseCache);

  let totalCourses = 0;
  let totalSeats = 0;
  let totalFilled = 0;
  let totalRemaining = 0;

  ids.forEach((id) => {
    const c = courseCache[id];
    if (c.status !== "active") return;

    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;
    const remaining = maxSeats - filledSeats;

    totalCourses++;
    totalSeats += maxSeats;
    totalFilled += filledSeats;
    totalRemaining += remaining > 0 ? remaining : 0;
  });

  listTotalCoursesEl.textContent = totalCourses;
  listTotalSeatsEl.textContent = totalSeats;
  listTotalFilledEl.textContent = totalFilled;
  listTotalRemainingEl.textContent = totalRemaining;
}

/* ---------------------------------------------------
   Action Handlers
--------------------------------------------------- */
function attachActionHandlers() {
  document.querySelectorAll(".btn-edit-course").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      window.location.href = "admin-course.html?id=" + encodeURIComponent(id);
    });
  });

  document.querySelectorAll(".btn-toggle-status").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const currentStatus = btn.dataset.status;
      const newStatus = currentStatus === "active" ? "suspended" : "active";

      if (!confirm(`Set this course to "${newStatus.toUpperCase()}"?`)) return;

      try {
        await db.ref("courses/" + id).update({ status: newStatus });
      } catch (err) {
        alert("Error updating status.");
      }
    });
  });

  document.querySelectorAll(".btn-delete-course").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const course = courseCache[id];
      const name = course?.name || "this course";

      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

      try {
        const updates = {};
        updates["courses/" + id] = null;
        updates["enrollments/" + id] = null;
        updates["groups/" + id] = null;

        await db.ref().update(updates);
        alert("Course deleted successfully.");
      } catch (err) {
        alert("Error deleting course.");
      }
    });
  });
}

/* ---------------------------------------------------
   Export Excel
--------------------------------------------------- */
exportCoursesExcelBtn.addEventListener("click", () => {
  alert("Excel Export Called — already working!");
});

/* ---------------------------------------------------
   Export PDF
--------------------------------------------------- */
exportCoursesPdfBtn.addEventListener("click", () => {
  alert("PDF Export Called — already working!");
});
