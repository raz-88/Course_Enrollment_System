// admin-topics.js

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
const topicCourseSelect = document.getElementById("topicCourseSelect");
const topicForm = document.getElementById("topicForm");
const topicTitleInput = document.getElementById("topicTitle");
const topicMaxPeopleInput = document.getElementById("topicMaxPeople");
const topicFormMsg = document.getElementById("topicFormMsg");
const topicsTableBody = document.getElementById("topicsTableBody");

const topicsTotalEl = document.getElementById("topicsTotal");
const topicsActiveEl = document.getElementById("topicsActive");
const topicsTotalCapacityEl = document.getElementById("topicsTotalCapacity");
const topicsTotalUsedEl = document.getElementById("topicsTotalUsed");

const exportTopicsExcelBtn = document.getElementById("exportTopicsExcelBtn");
const exportTopicsPdfBtn = document.getElementById("exportTopicsPdfBtn");

let courseCache = {};
let topicsCache = {}; // topicId -> {title, maxPeople, status, usedCount}
let editingTopicId = null;

// -------------------------------
// Load all courses
// -------------------------------
function loadCourses() {
  db.ref("courses").on("value", (snapshot) => {
    courseCache = snapshot.val() || {};
    renderCourseOptions();
  });
}

function renderCourseOptions() {
  const old = topicCourseSelect.value;
  topicCourseSelect.innerHTML = `<option value="">-- Choose Course --</option>`;

  Object.entries(courseCache).forEach(([id, c]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = c.name || id;
    topicCourseSelect.appendChild(opt);
  });

  if (old && courseCache[old]) {
    topicCourseSelect.value = old;
    loadTopicsForSelectedCourse();
  }
}

// -------------------------------
// Load topics + usage (from ENROLLMENTS) for selected course
// -------------------------------
async function loadTopicsForSelectedCourse() {
  const courseId = topicCourseSelect.value;
  topicsTableBody.innerHTML = "";
  topicFormMsg.textContent = "";
  editingTopicId = null;
  topicsCache = {};
  updateSummary();

  if (!courseId) {
    topicsTableBody.innerHTML =
      '<tr><td colspan="6">Select a course to view topics.</td></tr>';
    return;
  }

  try {
    const [topicsSnap, enrollSnap] = await Promise.all([
      db.ref("courses/" + courseId + "/topics").get(),
      db.ref("enrollments/" + courseId).get(),
    ]);

    const rawTopics = topicsSnap.exists() ? topicsSnap.val() : {};
    const enrollments = enrollSnap.exists() ? enrollSnap.val() : {};

    // Calculate usedCount per topic from ENROLLMENTS
    const usedCounts = {}; // topicId -> count
    Object.values(enrollments).forEach((en) => {
      const tid = en.topicId;
      if (!tid) return;
      usedCounts[tid] = (usedCounts[tid] || 0) + 1;
    });

    topicsCache = {};
    Object.entries(rawTopics).forEach(([tid, t]) => {
      const status = t.status || "active";
      const maxPeople = t.maxPeople || 1;
      const used = usedCounts[tid] || 0;

      topicsCache[tid] = {
        title: t.title || "Untitled Topic",
        maxPeople,
        status,
        usedCount: used,
        isTaken: t.isTaken || false, // legacy/unused
      };
    });

    renderTopicsTable();
    updateSummary();
  } catch (err) {
    console.error(err);
    topicsTableBody.innerHTML =
      '<tr><td colspan="6">Error loading topics. Please try again.</td></tr>';
  }
}

function renderTopicsTable() {
  topicsTableBody.innerHTML = "";

  const ids = Object.keys(topicsCache);
  if (!ids.length) {
    topicsTableBody.innerHTML =
      '<tr><td colspan="7">No topics yet. Add topics using the form above.</td></tr>';
    return;
  }

  ids.forEach((tid, index) => {
    const t = topicsCache[tid];
    const remaining = t.maxPeople - t.usedCount;
    const remainingSafe = remaining < 0 ? 0 : remaining;
    const serialNo = index + 1;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${serialNo}</td>
      <td>${t.title}</td>
      <td>${t.maxPeople}</td>
      <td>${t.usedCount}</td>
      <td>${remainingSafe}</td>
      <td>
        <span class="status-badge ${
          t.status === "active" ? "status-active" : "status-suspended"
        }">
          ${t.status === "active" ? "Active" : "Suspended"}
        </span>
      </td>
      <td>
        <button class="btn-secondary btn-edit-topic" data-id="${tid}">
          Edit
        </button>
        <button class="btn-primary btn-toggle-topic-status"
                data-id="${tid}"
                data-status="${t.status}"
                style="margin-left:4px;">
          ${t.status === "active" ? "Suspend" : "Activate"}
        </button>
        <button class="btn-danger btn-delete-topic"
                data-id="${tid}"
                style="margin-left:4px;">
          Delete
        </button>
      </td>
    `;
    topicsTableBody.appendChild(tr);
  });

  attachTopicActionEvents();
}


function updateSummary() {
  const ids = Object.keys(topicsCache);
  let totalTopics = ids.length;
  let activeTopics = 0;
  let totalCapacity = 0;
  let totalUsed = 0;

  ids.forEach((tid) => {
    const t = topicsCache[tid];
    if (t.status === "active") activeTopics += 1;
    totalCapacity += t.maxPeople || 0;
    totalUsed += t.usedCount || 0;
  });

  topicsTotalEl.textContent = totalTopics;
  topicsActiveEl.textContent = activeTopics;
  topicsTotalCapacityEl.textContent = totalCapacity;
  topicsTotalUsedEl.textContent = totalUsed;
}

// -------------------------------
// Topic form (add / edit)
// -------------------------------
topicCourseSelect.addEventListener("change", () => {
  topicFormMsg.textContent = "";
  topicForm.reset();
  editingTopicId = null;
  loadTopicsForSelectedCourse();
});

topicForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  topicFormMsg.textContent = "";
  topicFormMsg.className = "message";

  const courseId = topicCourseSelect.value;
  const title = topicTitleInput.value.trim();
  const maxPeopleValue = topicMaxPeopleInput.value;
  const maxPeople = parseInt(maxPeopleValue, 10);

  if (!courseId) {
    topicFormMsg.textContent = "Please select a course first.";
    return;
  }
  if (!title) {
    topicFormMsg.textContent = "Please enter topic name.";
    return;
  }
  if (!maxPeople || maxPeople <= 0) {
    topicFormMsg.textContent = "Please enter a valid max people value.";
    return;
  }

  try {
    if (editingTopicId) {
      // Update existing topic
      const current = topicsCache[editingTopicId] || {};
      await db
        .ref("courses/" + courseId + "/topics/" + editingTopicId)
        .update({
          title,
          maxPeople,
          status: current.status || "active",
        });

      topicFormMsg.textContent = "Topic updated successfully.";
      topicFormMsg.classList.add("success");
    } else {
      // Create new topic
      const newTopicRef = db.ref("courses/" + courseId + "/topics").push();
      await newTopicRef.set({
        title,
        maxPeople,
        status: "active",
        isTaken: false,
      });

      topicFormMsg.textContent = "Topic added successfully.";
      topicFormMsg.classList.add("success");
    }

    topicForm.reset();
    editingTopicId = null;
    await loadTopicsForSelectedCourse();
  } catch (err) {
    console.error(err);
    topicFormMsg.textcontent = "Error saving topic. Please try again.";
  }
});

// -------------------------------
// Topic action buttons
// -------------------------------
function attachTopicActionEvents() {
  const editButtons = document.querySelectorAll(".btn-edit-topic");
  const toggleButtons = document.querySelectorAll(".btn-toggle-topic-status");
  const deleteButtons = document.querySelectorAll(".btn-delete-topic");

  editButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tid = btn.getAttribute("data-id");
      startEditTopic(tid);
    });
  });

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tid = btn.getAttribute("data-id");
      const currentStatus = btn.getAttribute("data-status") || "active";
      const newStatus = currentStatus === "active" ? "suspended" : "active";

      const courseId = topicCourseSelect.value;
      if (!courseId) return;

      const confirmToggle = confirm(
        `Are you sure you want to set this topic to "${newStatus.toUpperCase()}"?`
      );
      if (!confirmToggle) return;

      try {
        await db
          .ref("courses/" + courseId + "/topics/" + tid)
          .update({ status: newStatus });
        await loadTopicsForSelectedCourse();
      } catch (err) {
        console.error(err);
        alert("Error updating topic status. Please try again.");
      }
    });
  });

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tid = btn.getAttribute("data-id");
      const courseId = topicCourseSelect.value;
      if (!courseId) return;

      const topic = topicsCache[tid];
      const name = topic?.title || "this topic";

      const confirmDelete = confirm(
        `Delete "${name}"? It will no longer be available for new enrollments.`
      );
      if (!confirmDelete) return;

      try {
        await db.ref("courses/" + courseId + "/topics/" + tid).remove();
        await loadTopicsForSelectedCourse();
        alert("Topic deleted successfully.");
      } catch (err) {
        console.error(err);
        alert("Error deleting topic. Please try again.");
      }
    });
  });
}

function startEditTopic(tid) {
  const t = topicsCache[tid];
  if (!t) return;
  editingTopicId = tid;

  topicTitleInput.value = t.title || "";
  topicMaxPeopleInput.value = t.maxPeople || 1;
  topicFormMsg.textContent = "Editing topic. Save to update.";
  topicFormMsg.className = "message success";
}

// -------------------------------
// Export: Topics -> Excel
// -------------------------------
function exportTopicsToExcel() {
  const courseId = topicCourseSelect.value;
  if (!courseId) {
    alert("Please select a course first.");
    return;
  }

  const ids = Object.keys(topicsCache);
  if (!ids.length) {
    alert("No topics to export for this course.");
    return;
  }

  const courseName = courseCache[courseId]?.name || courseId;

  const dataForSheet = ids.map((tid, index) => {
    const t = topicsCache[tid];
    const remaining = t.maxPeople - t.usedCount;
    return {
      "S. No.": index + 1,
      Course: courseName,
      "Topic Name": t.title,
      "Max People": t.maxPeople,
      "Used (Enrollments)": t.usedCount,
      Remaining: remaining < 0 ? 0 : remaining,
      Status: t.status === "active" ? "Active" : "Suspended",
    };
  });


  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Topics");

  const fileName = `Topics_${courseName.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

// -------------------------------
// Export: Topics -> PDF
// -------------------------------
function exportTopicsToPdf() {
  const courseId = topicCourseSelect.value;
  if (!courseId) {
    alert("Please select a course first.");
    return;
  }

  /*const ids = Object.keys(topicsCache);
  if (!ids.length) {
    alert("No topics to export for this course.");
    return;
  }*/

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const courseName = courseCache[courseId]?.name || courseId;

  doc.setFontSize(14);
  doc.text("Topics List (by Enrollments)", 14, 16);

  doc.setFontSize(11);
  doc.text("Course: " + courseName, 14, 24);
  doc.text("Generated: " + new Date().toLocaleString(), 14, 32);

  const ids = Object.keys(topicsCache);
  const body = ids.map((tid, index) => {
    const t = topicsCache[tid];
    const remaining = t.maxPeople - t.usedCount;
    return [
      String(index + 1),
      t.title,
      String(t.maxPeople),
      String(t.usedCount),
      String(remaining < 0 ? 0 : remaining),
      t.status === "active" ? "Active" : "Suspended",
    ];
  });

  doc.autoTable({
    startY: 40,
    head: [["S. No.", "Topic Name", "Max People", "Used (Enroll)", "Remaining", "Status"]],
    body,
  });


  const fileName = `Topics_${courseName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

// -------------------------------
// Events
// -------------------------------
exportTopicsExcelBtn.addEventListener("click", exportTopicsToExcel);
exportTopicsPdfBtn.addEventListener("click", exportTopicsToPdf);

// -------------------------------
// Start
// -------------------------------
loadCourses();
