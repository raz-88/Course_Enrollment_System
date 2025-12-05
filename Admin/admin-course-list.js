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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------------------
// DOM elements
// -------------------------------
const coursesTableBody = document.getElementById("coursesTableBody");
const listTotalCoursesEl = document.getElementById("listTotalCourses");
const listTotalSeatsEl = document.getElementById("listTotalSeats");
const listTotalFilledEl = document.getElementById("listTotalFilled");
const listTotalRemainingEl = document.getElementById("listTotalRemaining");

const exportCoursesExcelBtn = document.getElementById("exportCoursesExcelBtn");
const exportCoursesPdfBtn = document.getElementById("exportCoursesPdfBtn");

let courseCache = {};

// -------------------------------
// Load and render courses
// -------------------------------
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
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9">No courses created yet.</td>`;
    coursesTableBody.appendChild(tr);
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
        <button class="btn-secondary btn-edit-course" data-id="${id}">
          Edit
        </button>
        <button class="btn-primary btn-toggle-status"
                data-id="${id}"
                data-status="${status}"
                style="margin-left:4px;">
          ${status === "active" ? "Suspend" : "Activate"}
        </button>
        <button class="btn-danger btn-delete-course"
                data-id="${id}"
                style="margin-left:4px;">
          Delete
        </button>
      </td>
    `;
    coursesTableBody.appendChild(tr);
  });

  attachActionHandlers();
}

function updateSummary() {
  const ids = Object.keys(courseCache);
  let totalCourses = 0;
  let totalSeats = 0;
  let totalFilled = 0;
  let totalRemaining = 0;

  ids.forEach((id) => {
    const c = courseCache[id];
    const status = c.status || "active";
    // Only count ACTIVE courses in summary
    if (status !== "active") return;

    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;
    const remaining = maxSeats - filledSeats;

    totalCourses += 1;
    totalSeats += maxSeats;
    totalFilled += filledSeats;
    totalRemaining += remaining > 0 ? remaining : 0;
  });

  listTotalCoursesEl.textContent = totalCourses;
  listTotalSeatsEl.textContent = totalSeats;
  listTotalFilledEl.textContent = totalFilled;
  listTotalRemainingEl.textContent = totalRemaining;
}

// -------------------------------
// Action handlers (edit / status / delete)
// -------------------------------
function attachActionHandlers() {
  const editButtons = document.querySelectorAll(".btn-edit-course");
  const toggleButtons = document.querySelectorAll(".btn-toggle-status");
  const deleteButtons = document.querySelectorAll(".btn-delete-course");

  editButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      window.location.href = "admin-course.html?id=" + encodeURIComponent(id);
    });
  });

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const currentStatus = btn.getAttribute("data-status") || "active";
      const newStatus = currentStatus === "active" ? "suspended" : "active";

      const confirmToggle = confirm(
        `Are you sure you want to set this course to "${newStatus.toUpperCase()}"?`
      );
      if (!confirmToggle) return;

      try {
        await db.ref("courses/" + id).update({ status: newStatus });
      } catch (err) {
        console.error(err);
        alert("Error updating status. Please try again.");
      }
    });
  });

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const course = courseCache[id];
      const name = course?.name || "this course";

      const confirmDelete = confirm(
        `Delete "${name}"? This will also remove its enrollments and groups. This cannot be undone.`
      );
      if (!confirmDelete) return;

      try {
        // Multi-path delete: course, enrollments, groups
        const updates = {};
        updates["courses/" + id] = null;
        updates["enrollments/" + id] = null;
        updates["groups/" + id] = null;

        await db.ref().update(updates);
        alert("Course and related data deleted successfully.");
      } catch (err) {
        console.error(err);
        alert("Error deleting course. Please try again.");
      }
    });
  });
}

// -------------------------------
// Export: Courses -> Excel
// -------------------------------
function exportCoursesToExcel() {
  const ids = Object.keys(courseCache);
  if (!ids.length) {
    alert("No courses to export.");
    return;
  }

  const dataForSheet = ids.map((id) => {
    const c = courseCache[id];
    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;
    const remaining = maxSeats - filledSeats;
    const status = c.status || "active";

    const topics = c.topics || {};
    const topicIds = Object.keys(topics);
    const totalTopics = topicIds.length;
    const takenTopics = topicIds.filter((tid) => topics[tid].isTaken).length;

    return {
      "Course Name": c.name || "",
      "Max Seats": maxSeats,
      Filled: filledSeats,
      Remaining: remaining < 0 ? 0 : remaining,
      "Topics Taken": takenTopics,
      "Topics Total": totalTopics,
      "Start Date": c.startDate || "",
      Duration: c.duration || "",
      Status: status === "active" ? "Active" : "Suspended",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Courses");

  const fileName = "Courses_List.xlsx";
  XLSX.writeFile(workbook, fileName);
}

// -------------------------------
// Export: Courses -> PDF
// -------------------------------
function exportCoursesToPdf() {
  const ids = Object.keys(courseCache);
  if (!ids.length) {
    alert("No courses to export.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Courses List", 14, 16);

  doc.setFontSize(11);
  doc.text("Generated: " + new Date().toLocaleString(), 14, 24);

  const body = ids.map((id) => {
    const c = courseCache[id];
    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;
    const remaining = maxSeats - filledSeats;
    const status = c.status || "active";

    const topics = c.topics || {};
    const topicIds = Object.keys(topics);
    const totalTopics = topicIds.length;
    const takenTopics = topicIds.filter((tid) => topics[tid].isTaken).length;

    return [
      c.name || "",
      String(maxSeats),
      String(filledSeats),
      String(remaining < 0 ? 0 : remaining),
      `${takenTopics}/${totalTopics}`,
      c.startDate || "",
      c.duration || "",
      status === "active" ? "Active" : "Suspended",
    ];
  });

  doc.autoTable({
    startY: 32,
    head: [
      [
        "Course Name",
        "Max Seats",
        "Filled",
        "Remaining",
        "Topics (T/T)",
        "Start Date",
        "Duration",
        "Status",
      ],
    ],
    body,
  });

  doc.save("Courses_List.pdf");
}

// -------------------------------
// Events
// -------------------------------
exportCoursesExcelBtn.addEventListener("click", exportCoursesToExcel);
exportCoursesPdfBtn.addEventListener("click", exportCoursesToPdf);

// -------------------------------
// Start
// -------------------------------
loadCourses();
