// admin-enrollments.js

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
const db = firebase.database();

// -------------------------------
// DOM elements
// -------------------------------
const enrolledCourseSelect = document.getElementById("enrolledCourseSelect");
const enrollmentsTableBody = document.getElementById("enrollmentsTableBody");
const enrollTotalEl = document.getElementById("enrollTotal");
const enrollTopicsUsedEl = document.getElementById("enrollTopicsUsed");

const enrollmentEditForm = document.getElementById("enrollmentEditForm");
const editStudentNameInput = document.getElementById("editStudentName");
const editStudentEmailInput = document.getElementById("editStudentEmail");
const editTopicSelect = document.getElementById("editTopicSelect");
const editGroupsContainer = document.getElementById("editGroupsContainer");
const enrollmentFormMsg = document.getElementById("enrollmentFormMsg");

const exportEnrollExcelBtn = document.getElementById("exportEnrollExcelBtn");
const exportEnrollPdfBtn = document.getElementById("exportEnrollPdfBtn");

// -------------------------------
// Data caches
// -------------------------------
let courseCache = {};
let topicsForCourse = {};     // topicId -> {title, maxPeople, status}
let enrollmentsList = [];     // [{id, name, email, topicId, topicTitle, timestamp}]
let groupsListForCourse = []; // [{groupId, groupName, members}]
let groupsByEnrollment = {};  // enrollmentId -> [{groupId, groupName}]

let editingEnrollmentId = null;
let editingEnrollmentOriginalTopicId = null;

// -------------------------------
// Load courses for dropdown
// -------------------------------
function loadCourses() {
  db.ref("courses").on("value", function (snap) {
    courseCache = snap.val() || {};
    renderCourseOptions();
  });
}

function renderCourseOptions() {
  const old = enrolledCourseSelect.value;
  enrolledCourseSelect.innerHTML = '<option value="">-- Choose Course --</option>';

  Object.keys(courseCache).forEach(function (id) {
    const c = courseCache[id];
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = c.name || id;
    enrolledCourseSelect.appendChild(opt);
  });

  if (old && courseCache[old]) {
    enrolledCourseSelect.value = old;
    loadCourseEnrollments();
  }
}

// -------------------------------
// Load topics, enrollments, groups for selected course
// -------------------------------
async function loadCourseEnrollments() {
  const courseId = enrolledCourseSelect.value;
  enrollmentsTableBody.innerHTML = "";
  enrollTotalEl.textContent = "0";
  enrollTopicsUsedEl.textContent = "0";
  editingEnrollmentId = null;
  editingEnrollmentOriginalTopicId = null;
  enrollmentEditForm.reset();
  enrollmentFormMsg.textContent = "";
  enrollmentFormMsg.className = "message";

  topicsForCourse = {};
  enrollmentsList = [];
  groupsListForCourse = [];
  groupsByEnrollment = {};

  if (!courseId) {
    enrollmentsTableBody.innerHTML =
      '<tr><td colspan="7">Please select a course.</td></tr>';
    return;
  }

  try {
    const [topicsSnap, enrollSnap, groupsSnap] = await Promise.all([
      db.ref("courses/" + courseId + "/topics").get(),
      db.ref("enrollments/" + courseId).get(),
      db.ref("groups/" + courseId).get()
    ]);

    // Topics
    if (topicsSnap.exists()) {
      const rawTopics = topicsSnap.val() || {};
      Object.keys(rawTopics).forEach(function (tid) {
        const t = rawTopics[tid];
        topicsForCourse[tid] = {
          title: t.title || "Untitled Topic",
          maxPeople: t.maxPeople || 1,
          status: t.status || "active"
        };
      });
    }

    // Enrollments
    if (enrollSnap.exists()) {
      enrollSnap.forEach(function (child) {
        const data = child.val();
        enrollmentsList.push({
          id: child.key,
          name: data.name || "",
          email: data.email || "",
          topicId: data.topicId || "",
          topicTitle: data.topicTitle || "",
          timestamp: data.timestamp || null
        });
      });
    }

    // Groups
    // Groups (NEW DB STRUCTURE)
    // groups/{courseId}/{topicId}/{groupId}/members
    if (groupsSnap.exists()) {
      groupsSnap.forEach(topicNode => {
        const topicId = topicNode.key;  
        const groupsInsideTopic = topicNode.val() || {};

        Object.entries(groupsInsideTopic).forEach(([groupId, groupObj]) => {
          const groupName = groupObj.groupName || "Unnamed Group";
          const members = groupObj.members || {};

          // Push into groups list (for edit dropdown)
          groupsListForCourse.push({
            groupId: groupId,
            topicId: topicId,
            groupName: groupName,
            members: members
          });

          // Map enrollmentId => list of groups
          Object.entries(members).forEach(([enrollmentId, m]) => {
            if (!groupsByEnrollment[enrollmentId]) {
              groupsByEnrollment[enrollmentId] = [];
            }
            groupsByEnrollment[enrollmentId].push({
              groupId: groupId,
              topicId: topicId,
              groupName: groupName,
              role: m.role || "Member"
            });
          });
        });
      });
    }


    renderEditTopicOptions();
    renderEnrollmentTable();
    updateSummary();
  } catch (err) {
    console.error(err);
    enrollmentsTableBody.innerHTML =
      '<tr><td colspan="7">Error loading data. Please try again.</td></tr>';
  }
}

// -------------------------------
// Render topics in editTopicSelect (with capacity info)
// -------------------------------
function renderEditTopicOptions(currentTopicId) {
  if (typeof currentTopicId === "undefined") currentTopicId = null;

  editTopicSelect.innerHTML = "";

  const ids = Object.keys(topicsForCourse);
  if (!ids.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No topics for this course.";
    opt.disabled = true;
    opt.selected = true;
    editTopicSelect.appendChild(opt);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select Topic --";
  placeholder.disabled = true;
  placeholder.selected = true;
  editTopicSelect.appendChild(placeholder);

  // usage from enrollments
  const usedCounts = {};
  enrollmentsList.forEach(function (en) {
    if (!en.topicId) return;
    if (!usedCounts[en.topicId]) usedCounts[en.topicId] = 0;
    usedCounts[en.topicId] += 1;
  });

  ids.forEach(function (tid) {
    const t = topicsForCourse[tid];
    const used = usedCounts[tid] || 0;
    const maxPeople = t.maxPeople || 1;
    const remaining = maxPeople - used;
    const remainingSafe = remaining < 0 ? 0 : remaining;

    const opt = document.createElement("option");
    opt.value = tid;

    let label = t.title + " (" + used + "/" + maxPeople + ")";
    let disabled = false;

    if (t.status !== "active") {
      label += " [Inactive]";
      disabled = true;
    } else if (remainingSafe <= 0 && tid !== currentTopicId) {
      label += " [Full]";
      disabled = true;
    }

    opt.textContent = label;
    opt.disabled = disabled;
    editTopicSelect.appendChild(opt);
  });
}

// -------------------------------
// Render group checkboxes for edit form
// -------------------------------
function renderEditGroupCheckboxes(enrollmentId) {
  editGroupsContainer.innerHTML = "";

  if (!groupsListForCourse.length) {
    editGroupsContainer.textContent = "No groups created for this course.";
    return;
  }

  const existingGroups = groupsByEnrollment[enrollmentId] || [];
  const existingGroupIds = {};
  existingGroups.forEach(function (g) {
    existingGroupIds[g.groupId] = true;
  });

  groupsListForCourse.forEach(function (g) {
    const wrapper = document.createElement("label");
    wrapper.className = "checkbox-label";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "edit-group-checkbox";
    cb.setAttribute("data-gid", g.groupId);
    if (existingGroupIds[g.groupId]) {
      cb.checked = true;
    }

    const span = document.createElement("span");
    const memberCount = Object.keys(g.members || {}).length;
    span.textContent = g.groupName + " (Members: " + memberCount + ")";

    wrapper.appendChild(cb);
    wrapper.appendChild(span);
    editGroupsContainer.appendChild(wrapper);
  });
}

// -------------------------------
// Render enrollment table
// -------------------------------
function renderEnrollmentTable() {
  enrollmentsTableBody.innerHTML = "";

  if (!enrollmentsList.length) {
    enrollmentsTableBody.innerHTML =
      '<tr><td colspan="7">No enrollments for this course yet.</td></tr>';
    return;
  }

  // sort oldest first
  enrollmentsList.sort(function (a, b) {
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  enrollmentsList.forEach(function (en, index) {
    const serial = index + 1;
    const dateStr = en.timestamp
      ? new Date(en.timestamp).toLocaleString()
      : "";

    const groupsInfo = groupsByEnrollment[en.id] || [];
    let groupLabel = "-";
    if (groupsInfo.length) {
      groupLabel = groupsInfo.map(function (g) { return g.groupName; }).join(", ");
    }

    let topicTitle = en.topicTitle || "";
    if (!topicTitle && en.topicId && topicsForCourse[en.topicId]) {
      topicTitle = topicsForCourse[en.topicId].title;
    }

    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + serial + "</td>" +
      "<td>" + (en.name || "") + "</td>" +
      "<td>" + (en.email || "") + "</td>" +
      "<td>" + (topicTitle || "-") + "</td>" +
      "<td>" + dateStr + "</td>" +
      "<td>" + groupLabel + "</td>" +
      '<td>' +
        '<button class="btn-secondary btn-edit-enrollment" data-id="' + en.id + '">Edit</button>' +
        '<button class="btn-danger btn-delete-enrollment" data-id="' + en.id + '" style="margin-left:4px;">Delete</button>' +
      "</td>";

    enrollmentsTableBody.appendChild(tr);
  });

  attachEnrollmentActionEvents();
}

// -------------------------------
// Summary
// -------------------------------
function updateSummary() {
  enrollTotalEl.textContent = String(enrollmentsList.length);

  const topicsSet = {};
  enrollmentsList.forEach(function (en) {
    if (en.topicId) topicsSet[en.topicId] = true;
  });
  enrollTopicsUsedEl.textContent = String(Object.keys(topicsSet).length);
}

// -------------------------------
// Row actions: Edit / Delete
// -------------------------------
function attachEnrollmentActionEvents() {
  const editBtns = document.querySelectorAll(".btn-edit-enrollment");
  const deleteBtns = document.querySelectorAll(".btn-delete-enrollment");

  editBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      startEditEnrollment(id);
    });
  });

  deleteBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      deleteEnrollment(id);
    });
  });
}

function startEditEnrollment(enrollmentId) {
  const en = enrollmentsList.find(function (x) { return x.id === enrollmentId; });
  if (!en) return;

  editingEnrollmentId = enrollmentId;
  editingEnrollmentOriginalTopicId = en.topicId || null;

  editStudentNameInput.value = en.name || "";
  editStudentEmailInput.value = en.email || "";

  renderEditTopicOptions(editingEnrollmentOriginalTopicId);
  if (en.topicId) {
    editTopicSelect.value = en.topicId;
  } else {
    editTopicSelect.value = "";
  }

  renderEditGroupCheckboxes(enrollmentId);

  enrollmentFormMsg.textContent = "Editing enrollment. Save to update.";
  enrollmentFormMsg.className = "message success";
}

// -------------------------------
// Delete enrollment (also remove from any groups)
// -------------------------------
async function deleteEnrollment(enrollmentId) {
  const courseId = enrolledCourseSelect.value;
  if (!courseId) return;

  const en = enrollmentsList.find(function (x) { return x.id === enrollmentId; });
  const name = en && en.name ? en.name : "this student";

  const confirmDel = confirm(
    'Delete enrollment for "' + name + '"? This will also remove them from any groups in this course.'
  );
  if (!confirmDel) return;

  try {
    const groupsSnap = await db.ref("groups/" + courseId).get();
    const updates = {};

    updates["enrollments/" + courseId + "/" + enrollmentId] = null;

    if (groupsSnap.exists()) {
      groupsSnap.forEach(function (child) {
        const groupId = child.key;
        const g = child.val() || {};
        const members = g.members || {};
        if (members[enrollmentId]) {
          updates["groups/" + courseId + "/" + groupId + "/members/" + enrollmentId] = null;
        }
      });
    }

    await db.ref().update(updates);
    alert("Enrollment deleted successfully.");
    await loadCourseEnrollments();
  } catch (err) {
    console.error(err);
    alert("Error deleting enrollment. Please try again.");
  }
}

// -------------------------------
// Save changes to enrollment (topic + group membership)
// -------------------------------
enrollmentEditForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  enrollmentFormMsg.textContent = "";
  enrollmentFormMsg.className = "message";

  const courseId = enrolledCourseSelect.value;
  if (!courseId) {
    enrollmentFormMsg.textContent = "Please select a course first.";
    return;
  }
  if (!editingEnrollmentId) {
    enrollmentFormMsg.textContent =
      "Select an enrollment from the table and click Edit first.";
    return;
  }

  const name = editStudentNameInput.value.trim();
  const email = editStudentEmailInput.value.trim();
  const newTopicId = editTopicSelect.value;

  if (!name || !email || !newTopicId) {
    enrollmentFormMsg.textContent =
      "Please fill all fields and select a topic.";
    return;
  }

  try {
    const [topicSnap, enrollSnap, groupsSnap] = await Promise.all([
      db.ref("courses/" + courseId + "/topics/" + newTopicId).get(),
      db.ref("enrollments/" + courseId).get(),
      db.ref("groups/" + courseId).get()
    ]);

    if (!topicSnap.exists()) {
      enrollmentFormMsg.textContent = "Selected topic no longer exists.";
      await loadCourseEnrollments();
      return;
    }

    const topicData = topicSnap.val();
    const maxPeople = topicData.maxPeople || 1;
    const status = topicData.status || "active";
    const topicTitle = topicData.title || "Untitled Topic";

    if (status !== "active") {
      enrollmentFormMsg.textContent =
        "Selected topic is inactive. Choose another topic.";
      await loadCourseEnrollments();
      return;
    }

    const enrollmentsAll = enrollSnap.exists() ? enrollSnap.val() : {};

    // capacity check if topic changed
    if (newTopicId !== editingEnrollmentOriginalTopicId) {
      let usedCount = 0;
      Object.keys(enrollmentsAll).forEach(function (eid) {
        const edata = enrollmentsAll[eid];
        if (eid === editingEnrollmentId) return;
        if (edata.topicId === newTopicId) usedCount += 1;
      });

      if (usedCount >= maxPeople) {
        enrollmentFormMsg.textContent =
          "This topic is already full. Please choose another topic.";
        await loadCourseEnrollments();
        return;
      }
    }

    // Collect selected groups from checkboxes
    const selectedGroupIds = [];
    const checkboxes = document.querySelectorAll(".edit-group-checkbox");
    checkboxes.forEach(function (cb) {
      if (cb.checked) {
        selectedGroupIds.push(cb.getAttribute("data-gid"));
      }
    });

    const updates = {};

    // Update enrollment
    const existingEnroll = enrollmentsAll[editingEnrollmentId] || {};
    updates["enrollments/" + courseId + "/" + editingEnrollmentId] = {
      name: name,
      email: email,
      topicId: newTopicId,
      topicTitle: topicTitle,
      timestamp: existingEnroll.timestamp || Date.now()
    };

    // Update group membership & member topic info
    if (groupsSnap.exists()) {
      groupsSnap.forEach(function (child) {
        const groupId = child.key;
        const g = child.val() || {};
        const members = g.members || {};
        const currentlyInGroup = !!members[editingEnrollmentId];
        const wantsInGroup = selectedGroupIds.indexOf(groupId) !== -1;

        if (wantsInGroup && !currentlyInGroup) {
          // add
          updates["groups/" + courseId + "/" + groupId + "/members/" + editingEnrollmentId] = {
            name: name,
            email: email,
            topicId: newTopicId,
            topicTitle: topicTitle,
            timestamp: Date.now(),
            role: members[editingEnrollmentId] && members[editingEnrollmentId].role
              ? members[editingEnrollmentId].role
              : "Member"
          };
        } else if (!wantsInGroup && currentlyInGroup) {
          // remove
          updates["groups/" + courseId + "/" + groupId + "/members/" + editingEnrollmentId] = null;
        } else if (wantsInGroup && currentlyInGroup) {
          // update info
          const oldMember = members[editingEnrollmentId] || {};
          updates["groups/" + courseId + "/" + groupId + "/members/" + editingEnrollmentId] = {
            name: name,
            email: email,
            topicId: newTopicId,
            topicTitle: topicTitle,
            timestamp: oldMember.timestamp || null,
            role: oldMember.role || "Member"
          };
        }
      });
    }

    await db.ref().update(updates);

    enrollmentFormMsg.textContent = "Enrollment updated successfully.";
    enrollmentFormMsg.classList.add("success");
    editingEnrollmentOriginalTopicId = newTopicId;

    await loadCourseEnrollments();
  } catch (err) {
    console.error(err);
    enrollmentFormMsg.textContent =
      "Error updating enrollment. Please try again.";
  }
});

// -------------------------------
// Export: Enrollments -> Excel
// -------------------------------
function exportEnrollmentsToExcel() {
  const courseId = enrolledCourseSelect.value;
  if (!courseId) {
    alert("Please select a course first.");
    return;
  }

  if (!enrollmentsList.length) {
    alert("No enrollments to export for this course.");
    return;
  }

  const courseName =
    courseCache[courseId] && courseCache[courseId].name
      ? courseCache[courseId].name
      : courseId;

  const dataForSheet = enrollmentsList.map(function (en, index) {
    const serial = index + 1;
    const dateStr = en.timestamp
      ? new Date(en.timestamp).toLocaleString()
      : "";

    const groupsInfo = groupsByEnrollment[en.id] || [];
    let groupLabel = "-";
    if (groupsInfo.length) {
      groupLabel = groupsInfo.map(function (g) { return g.groupName; }).join(", ");
    }

    let topicTitle = en.topicTitle || "";
    if (!topicTitle && en.topicId && topicsForCourse[en.topicId]) {
      topicTitle = topicsForCourse[en.topicId].title;
    }

    return {
      "S. No.": serial,
      Course: courseName,
      "Student Name": en.name,
      Email: en.email,
      Topic: topicTitle || "",
      "Enrolled At": dateStr,
      Groups: groupLabel
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Enrollments");

  const fileName = "Enrollments_" + courseName.replace(/\s+/g, "_") + ".xlsx";
  XLSX.writeFile(workbook, fileName);
}

// -------------------------------
// Export: Enrollments -> PDF
// -------------------------------
function exportEnrollmentsToPdf() {
  const courseId = enrolledCourseSelect.value;
  if (!courseId) {
    alert("Please select a course first.");
    return;
  }

  if (!enrollmentsList.length) {
    alert("No enrollments to export for this course.");
    return;
  }

  const courseName =
    courseCache[courseId] && courseCache[courseId].name
      ? courseCache[courseId].name
      : courseId;

  const jsPDFRef = window.jspdf;
  const doc = new jsPDFRef.jsPDF();

  doc.setFontSize(14);
  doc.text("Enrollments List", 14, 16);

  doc.setFontSize(11);
  doc.text("Course: " + courseName, 14, 24);
  doc.text("Generated: " + new Date().toLocaleString(), 14, 32);

  const body = enrollmentsList.map(function (en, index) {
    const serial = index + 1;
    const dateStr = en.timestamp
      ? new Date(en.timestamp).toLocaleString()
      : "";

    const groupsInfo = groupsByEnrollment[en.id] || [];
    let groupLabel = "-";
    if (groupsInfo.length) {
      groupLabel = groupsInfo.map(function (g) { return g.groupName; }).join(", ");
    }

    let topicTitle = en.topicTitle || "";
    if (!topicTitle && en.topicId && topicsForCourse[en.topicId]) {
      topicTitle = topicsForCourse[en.topicId].title;
    }

    return [
      String(serial),
      en.name || "",
      en.email || "",
      topicTitle || "",
      dateStr,
      groupLabel
    ];
  });

  doc.autoTable({
    startY: 40,
    head: [["S. No.", "Name", "Email", "Topic", "Enrolled At", "Groups"]],
    body: body
  });

  const fileName = "Enrollments_" + courseName.replace(/\s+/g, "_") + ".pdf";
  doc.save(fileName);
}

// -------------------------------
// Events
// -------------------------------
enrolledCourseSelect.addEventListener("change", loadCourseEnrollments);
exportEnrollExcelBtn.addEventListener("click", exportEnrollmentsToExcel);
exportEnrollPdfBtn.addEventListener("click", exportEnrollmentsToPdf);

// -------------------------------
// Start
// -------------------------------
loadCourses();
