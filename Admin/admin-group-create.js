// admin-group-create.js (FINAL VERSION — DB STRUCTURE FIXED)

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

// -------------------------------
// Data caches
// -------------------------------
let courseCache = {};
let enrollmentCache = [];
let groupedEnrollmentIds = new Set(); // students already inside ANY group

// -------------------------------
// Load courses in dropdown
// -------------------------------
function loadCourses() {
  db.ref("courses").on("value", snapshot => {
    courseCache = snapshot.val() || {};
    renderCourseOptions();
  });
}

function renderCourseOptions() {
  groupCourseSelect.innerHTML = `<option value="">-- Choose Course --</option>`;

  Object.entries(courseCache).forEach(([cid, c]) => {
    const opt = document.createElement("option");
    opt.value = cid;
    opt.textContent = c.name || cid;
    groupCourseSelect.appendChild(opt);
  });
}

// -------------------------------
// When a course is selected → load students + group status
// -------------------------------
groupCourseSelect.addEventListener("change", () => {
  loadCourseData();
});

// -------------------------------
// Load enrollments & detect grouped students
// -------------------------------
async function loadCourseData() {
  const courseId = groupCourseSelect.value;
  studentsTableBody.innerHTML = "";
  groupFormMsg.textContent = "";

  enrollmentCache = [];
  groupedEnrollmentIds = new Set();

  if (!courseId) return;

  // -------------------------------
  // Load ALL enrollments for this course
  // -------------------------------
  const enrollSnap = await db.ref(`enrollments/${courseId}`).get();
  if (enrollSnap.exists()) {
    enrollSnap.forEach(child => {
      const d = child.val();
      enrollmentCache.push({
        enrollmentId: child.key,
        name: d.name,
        email: d.email,
        topicId: d.topicId,
        topicTitle: d.topicTitle,
        timestamp: d.timestamp,
      });
    });
  }

  // -------------------------------
  // Load ALL groups inside ALL topics:
  // groups/{courseId}/{topicId}/{groupId}/members
  // -------------------------------
  const groupRootSnap = await db.ref(`groups/${courseId}`).get();

  if (groupRootSnap.exists()) {
    groupRootSnap.forEach(topicNode => {
      const topicId = topicNode.key;
      const groupsInsideTopic = topicNode.val() || {};

      Object.entries(groupsInsideTopic).forEach(([groupId, groupObj]) => {
        const members = groupObj.members || {};

        Object.keys(members).forEach(enrollId => {
          groupedEnrollmentIds.add(enrollId);
        });
      });
    });
  }

  renderStudentsTable();
}

// -------------------------------
// Render Students Table
// -------------------------------
function renderStudentsTable() {
  studentsTableBody.innerHTML = "";

  if (!enrollmentCache.length) {
    studentsTableBody.innerHTML =
      `<tr><td colspan="7">No enrollments found for this course.</td></tr>`;
    return;
  }

  // Sort by registration time
  enrollmentCache.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  enrollmentCache.forEach(e => {
    const isGrouped = groupedEnrollmentIds.has(e.enrollmentId);
    const dateStr = e.timestamp ? new Date(e.timestamp).toLocaleString() : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="checkbox"
               class="student-checkbox"
               data-eid="${e.enrollmentId}"
               ${isGrouped ? "disabled" : ""}>
      </td>
      <td>${e.name}</td>
      <td>${e.email}</td>
      <td>${e.topicTitle}</td>
      <td>${dateStr}</td>
      <td>
        <select class="role-select"
                data-eid="${e.enrollmentId}"
                ${isGrouped ? "disabled" : ""}>
          <option value="Member">Member</option>
          <option value="Lead">Lead</option>
        </select>
      </td>
      <td style="color:${isGrouped ? 'red' : 'green'};">
         ${isGrouped ? "Already in group" : "Available"}
      </td>
    `;

    studentsTableBody.appendChild(tr);
  });
}

// -------------------------------
// Create Group
// -------------------------------
groupForm.addEventListener("submit", async e => {
  e.preventDefault();
  groupFormMsg.textContent = "";
  groupFormMsg.className = "message";

  const courseId = groupCourseSelect.value;
  const groupName = groupNameInput.value.trim();
  const groupDescription = groupDescriptionInput.value.trim();

  if (!courseId) {
    return (groupFormMsg.textContent = "Please select a course.");
  }
  if (!groupName) {
    return (groupFormMsg.textContent = "Please enter group name.");
  }

  // Collect selected students
  const selectedIds = [];
  document.querySelectorAll(".student-checkbox").forEach(cb => {
    if (cb.checked && !cb.disabled) {
      selectedIds.push(cb.dataset.eid);
    }
  });

  if (!selectedIds.length) {
    groupFormMsg.textContent = "Please select at least one student.";
    return;
  }

  try {
    // Create group under DEFAULT topic?  
    // You said you DO NOT want selecting topic here.
    // So group will go under a special topic "general"
    // OR should I auto-use student's topic? (tell me)
    
    const topicId = "general";
    const topicTitle = "General Group";

    const members = {};

    selectedIds.forEach(eid => {
      const e = enrollmentCache.find(x => x.enrollmentId === eid);
      const role = document.querySelector(`.role-select[data-eid="${eid}"]`).value;

      members[eid] = {
        name: e.name,
        email: e.email,
        topicId: e.topicId,
        topicTitle: e.topicTitle,
        role,
        timestamp: e.timestamp,
      };
    });

    const groupRef = db.ref(`groups/${courseId}/${topicId}`).push();

    await groupRef.set({
      groupName,
      description: groupDescription,
      createdAt: Date.now(),
      topicId,
      topicTitle,
      members,
    });

    groupFormMsg.textContent = "Group created successfully!";
    groupFormMsg.classList.add("success");

    groupNameInput.value = "";
    groupDescriptionInput.value = "";

    await loadCourseData();

  } catch (err) {
    console.error(err);
    groupFormMsg.textContent = "Error creating group.";
  }
});

// -------------------------------
// Init
// -------------------------------
loadCourses();
