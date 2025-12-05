// admin-group-create.js

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
const groupCourseSelect = document.getElementById("groupCourseSelect");
const studentsTableBody = document.getElementById("studentsTableBody");
const groupForm = document.getElementById("groupForm");
const groupNameInput = document.getElementById("groupName");
const groupDescriptionInput = document.getElementById("groupDescription");
const groupFormMsg = document.getElementById("groupFormMsg");

let courseCache = {};
let enrollmentCache = [];   // list of enrollments for selected course
let groupedEnrollmentIds = new Set(); // enrollmentIds already in some group for that course

// -------------------------------
// Load courses for dropdown
// -------------------------------
function loadCourses() {
  db.ref("courses").on("value", (snapshot) => {
    courseCache = snapshot.val() || {};
    renderCourseOptions();
  });
}

function renderCourseOptions() {
  const old = groupCourseSelect.value;
  groupCourseSelect.innerHTML = `<option value="">-- Choose Course --</option>`;

  Object.entries(courseCache).forEach(([id, c]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = c.name || id;
    groupCourseSelect.appendChild(opt);
  });

  if (old && courseCache[old]) {
    groupCourseSelect.value = old;
  }
}

// -------------------------------
// Load enrollments + groups for selected course
// -------------------------------
async function loadCourseData() {
  const courseId = groupCourseSelect.value;
  studentsTableBody.innerHTML = "";
  groupFormMsg.textContent = "";
  enrollmentCache = [];
  groupedEnrollmentIds = new Set();

  if (!courseId) {
    return;
  }

  // Load enrollments
  const enrollSnap = await db.ref("enrollments/" + courseId).get();
  if (enrollSnap.exists()) {
    enrollSnap.forEach((child) => {
      const data = child.val();
      enrollmentCache.push({
        enrollmentId: child.key,
        name: data.name || "",
        email: data.email || "",
        topicTitle: data.topicTitle || "-",
        topicId: data.topicId || "",
        timestamp: data.timestamp || null,
      });
    });
  }

  // Load groups to know which enrollments are already in some group
  const groupSnap = await db.ref("groups/" + courseId).get();
  if (groupSnap.exists()) {
    groupSnap.forEach((groupChild) => {
      const groupData = groupChild.val() || {};
      const members = groupData.members || {};
      Object.keys(members).forEach((enrollmentId) => {
        groupedEnrollmentIds.add(enrollmentId);
      });
    });
  }

  renderStudentsTable();
}

function renderStudentsTable() {
  studentsTableBody.innerHTML = "";

  if (!enrollmentCache.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7">No enrollments found for this course.</td>`;
    studentsTableBody.appendChild(tr);
    return;
  }

  enrollmentCache.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  enrollmentCache.forEach((e) => {
    const alreadyGrouped = groupedEnrollmentIds.has(e.enrollmentId);
    const dateStr = e.timestamp ? new Date(e.timestamp).toLocaleString() : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="checkbox"
               class="student-checkbox"
               data-eid="${e.enrollmentId}"
               ${alreadyGrouped ? "disabled" : ""} />
      </td>
      <td>${e.name}</td>
      <td>${e.email}</td>
      <td>${e.topicTitle}</td>
      <td>${dateStr}</td>
      <td>
        <select class="role-select" data-eid="${e.enrollmentId}" ${alreadyGrouped ? "disabled" : ""}>
          <option value="Member">Member</option>
          <option value="Lead">Lead</option>
        </select>
      </td>
      <td>${alreadyGrouped ? "Already in a group" : "Available"}</td>
    `;
    studentsTableBody.appendChild(tr);
  });
}

// -------------------------------
// Handle course change
// -------------------------------
groupCourseSelect.addEventListener("change", () => {
  loadCourseData();
});

// -------------------------------
// Handle Group Creation
// -------------------------------
groupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  groupFormMsg.textContent = "";
  groupFormMsg.className = "message";

  const courseId = groupCourseSelect.value;
  const groupName = groupNameInput.value.trim();
  const groupDescription = groupDescriptionInput.value.trim();

  if (!courseId) {
    groupFormMsg.textContent = "Please select a course.";
    return;
  }
  if (!groupName) {
    groupFormMsg.textContent = "Please enter a group name.";
    return;
  }

  // Collect selected students
  const selectedIds = [];
  const checkboxes = document.querySelectorAll(".student-checkbox");
  checkboxes.forEach((cb) => {
    if (cb.checked && !cb.disabled) {
      selectedIds.push(cb.getAttribute("data-eid"));
    }
  });

  if (!selectedIds.length) {
    groupFormMsg.textContent = "Please select at least one student.";
    return;
  }

  try {
    const members = {};
    selectedIds.forEach((eid) => {
      const e = enrollmentCache.find((x) => x.enrollmentId === eid);
      if (!e) return;

      const roleSelect = document.querySelector(
        `.role-select[data-eid="${eid}"]`
      );
      const role = roleSelect ? roleSelect.value : "Member";

      members[eid] = {
        name: e.name,
        email: e.email,
        topicId: e.topicId,
        topicTitle: e.topicTitle,
        role: role,
        timestamp: e.timestamp || null,
      };
    });

    const groupRef = db.ref("groups/" + courseId).push();
    await groupRef.set({
      groupName,
      description: groupDescription,
      createdAt: Date.now(),
      members,
    });

    groupFormMsg.textContent = "Group created successfully.";
    groupFormMsg.classList.add("success");

    // Clear only name/description; keep course selection
    groupNameInput.value = "";
    groupDescriptionInput.value = "";

    // Reload so grouped status updates
    await loadCourseData();
  } catch (err) {
    console.error(err);
    groupFormMsg.textContent = "Error creating group. Please try again.";
  }
});

// -------------------------------
// Start
// -------------------------------
loadCourses();
