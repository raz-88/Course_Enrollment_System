// admin-group-details.js (UPDATED for groups/{courseId}/{topicId}/{groupId} structure)

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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------------------
// DOM elements
// -------------------------------
const groupCourseFilter = document.getElementById("groupCourseFilter");
const groupsTableBody = document.getElementById("groupsTableBody");
const groupsMsg = document.getElementById("groupsMsg");

const groupMembersSection = document.getElementById("groupMembersSection");
const membersTitle = document.getElementById("membersTitle");
const membersSubtitle = document.getElementById("membersSubtitle");
const groupMembersTableBody = document.getElementById("groupMembersTableBody");

const exportGroupPdfBtn = document.getElementById("exportGroupPdfBtn");

const addMemberBtn = document.getElementById("addMemberBtn");
const availableMembersSection = document.getElementById("availableMembersSection");
const availableMembersTableBody = document.getElementById("availableMembersTableBody");
const availableMembersMsg = document.getElementById("availableMembersMsg");
const confirmAddMembersBtn = document.getElementById("confirmAddMembersBtn");

let courseCache = {};
let groupsCache = []; // list of groups for selected course (flat list, each entry includes topicId)
let currentCourseId = null;
let currentGroupTopicId = null; // topicId for currently viewed group
let currentGroupId = null;

// enrollment cache for selected course
let enrollmentCacheForCourse = [];          // all enrollments of this course
let groupedEnrollmentIdsForCourse = new Set(); // enrollmentIds already in ANY group of this course

// -------------------------------
// Load courses
// -------------------------------
function loadCourses() {
  db.ref("courses").on("value", (snapshot) => {
    courseCache = snapshot.val() || {};
    renderCourseOptions();
  });
}

function renderCourseOptions() {
  const old = groupCourseFilter.value;
  groupCourseFilter.innerHTML = `<option value="">-- Choose Course --</option>`;

  Object.entries(courseCache).forEach(([id, c]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = c.name || id;
    groupCourseFilter.appendChild(opt);
  });

  if (old && courseCache[old]) {
    groupCourseFilter.value = old;
  }
}

// -------------------------------
// Load groups + enrollments for selected course
// -------------------------------
async function loadGroups() {
  const courseId = groupCourseFilter.value;
  currentCourseId = courseId;
  groupsTableBody.innerHTML = "";
  groupsMsg.textContent = "";
  groupsCache = [];
  groupMembersSection.style.display = "none";
  groupMembersTableBody.innerHTML = "";
  availableMembersSection.style.display = "none";
  availableMembersTableBody.innerHTML = "";
  availableMembersMsg.textContent = "";

  enrollmentCacheForCourse = [];
  groupedEnrollmentIdsForCourse = new Set();
  currentGroupId = null;
  currentGroupTopicId = null;

  if (!courseId) {
    groupsMsg.textContent = "Please select a course.";
    return;
  }

  try {
    // Load enrollments + groups in parallel
    const [enrollSnap, groupsRootSnap] = await Promise.all([
      db.ref("enrollments/" + courseId).get(),
      db.ref("groups/" + courseId).get(), // THIS returns topic nodes, each containing groups
    ]);

    // Enrollments
    if (enrollSnap.exists()) {
      enrollmentCacheForCourse = []; // reset
      enrollSnap.forEach((child) => {
        const data = child.val();
        enrollmentCacheForCourse.push({
          enrollmentId: child.key,
          name: data.name || "",
          email: data.email || "",
          topicTitle: data.topicTitle || "-",
          topicId: data.topicId || "",
          timestamp: data.timestamp || null,
        });
      });
    }

    // Groups: traverse topicId layer then group nodes
    if (groupsRootSnap.exists()) {
      groupsCache = [];
      groupsRootSnap.forEach((topicChild) => {
        const topicId = topicChild.key;
        const groupsUnderTopic = topicChild.val() || {};
        Object.entries(groupsUnderTopic).forEach(([groupId, groupData]) => {
          const members = groupData.members || {};
          groupsCache.push({
            groupId,
            topicId,
            topicTitle: groupData.topicTitle || "",
            courseId,
            groupName: groupData.groupName || "",
            description: groupData.description || "",
            createdAt: groupData.createdAt || null,
            members,
            // optional: include any group-level meta
          });

          // track which enrollments are already in some group
          Object.keys(members).forEach((enrollmentId) => {
            groupedEnrollmentIdsForCourse.add(enrollmentId);
          });
        });
      });
    }

    if (!groupsCache.length) {
      groupsMsg.textContent = "No groups created for this course yet.";
      return;
    }

    renderGroupsTable();
  } catch (err) {
    console.error(err);
    groupsMsg.textContent = "Error loading groups/enrollments.";
  }
}

function renderGroupsTable() {
  groupsTableBody.innerHTML = "";

  groupsCache.forEach((g) => {
    const memberIds = Object.keys(g.members || {});
    const count = memberIds.length;
    const dateStr = g.createdAt ? new Date(g.createdAt).toLocaleString() : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.groupName || ""}</td>
      <td>${g.topicTitle || "-"}</td>
      <td>${g.description || "-"}</td>
      <td>${count}</td>
      <td>${dateStr}</td>
      <td>
        <button class="btn-secondary btn-view-members" data-gid="${g.groupId}" data-tid="${g.topicId}">
          View Members
        </button>
        <button class="btn-primary btn-delete-group" data-gid="${g.groupId}" data-tid="${g.topicId}" style="margin-left:6px;">
          Delete
        </button>
      </td>
    `;
    groupsTableBody.appendChild(tr);
  });

  attachGroupActionEvents();
}

function attachGroupActionEvents() {
  const viewButtons = document.querySelectorAll(".btn-view-members");
  const deleteButtons = document.querySelectorAll(".btn-delete-group");

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const groupId = btn.getAttribute("data-gid");
      const topicId = btn.getAttribute("data-tid");
      showGroupMembers(topicId, groupId);
    });
  });

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const groupId = btn.getAttribute("data-gid");
      const topicId = btn.getAttribute("data-tid");
      deleteGroup(topicId, groupId);
    });
  });
}

// -------------------------------
// Show group members
// -------------------------------
function showGroupMembers(topicId, groupId) {
  // find group in flat cache by both topicId & groupId
  const g = groupsCache.find((x) => x.groupId === groupId && x.topicId === topicId);
  if (!g) return;

  currentGroupId = groupId;
  currentGroupTopicId = topicId;

  const courseName = courseCache[g.courseId]?.name || g.courseId;
  membersTitle.textContent = `Group: ${g.groupName}`;
  membersSubtitle.textContent = `Course: ${courseName} | Topic: ${g.topicTitle || '-'} | Members: ${Object.keys(
    g.members || {}
  ).length}`;

  groupMembersTableBody.innerHTML = "";

  const memberEntries = Object.entries(g.members || {});
  if (!memberEntries.length) {
    groupMembersTableBody.innerHTML =
      '<tr><td colspan="6">No members in this group.</td></tr>';
  } else {
    memberEntries.forEach(([enrollmentId, m]) => {
      const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";
      const role = m.role || "Member";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.name || ""}</td>
        <td>${m.email || ""}</td>
        <td>${m.topicTitle || "-"}</td>
        <td>${role}</td>
        <td>${dateStr}</td>
        <td>
          <button class="btn-secondary btn-remove-member"
                  data-eid="${enrollmentId}">
            Remove
          </button>
        </td>
      `;
      groupMembersTableBody.appendChild(tr);
    });
  }

  attachMemberRemoveEvents();
  groupMembersSection.style.display = "block";
  groupMembersSection.scrollIntoView({ behavior: "smooth" });

  // Hide available list until user clicks "Add Member"
  availableMembersSection.style.display = "none";
  availableMembersTableBody.innerHTML = "";
  availableMembersMsg.textContent = "";
}

// -------------------------------
// Delete entire group
// -------------------------------
async function deleteGroup(topicId, groupId) {
  if (!currentCourseId) return;
  const g = groupsCache.find((x) => x.groupId === groupId && x.topicId === topicId);
  if (!g) return;

  const confirmDelete = confirm(
    `Are you sure you want to delete group "${g.groupName}"? This will remove all its members from this group (but not their enrollments).`
  );
  if (!confirmDelete) return;

  try {
    await db.ref(`groups/${currentCourseId}/${topicId}/${groupId}`).remove();
    alert("Group deleted successfully.");

    // Reload groups list
    await loadGroups();

    // If we just deleted the group being viewed, hide members section
    if (currentGroupId === groupId && currentGroupTopicId === topicId) {
      groupMembersSection.style.display = "none";
      groupMembersTableBody.innerHTML = "";
      currentGroupId = null;
      currentGroupTopicId = null;
    }
  } catch (err) {
    console.error(err);
    alert("Error deleting group. Please try again.");
  }
}

// -------------------------------
// Remove a single member from a group
// -------------------------------
function attachMemberRemoveEvents() {
  const removeButtons = document.querySelectorAll(".btn-remove-member");
  removeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const enrollmentId = btn.getAttribute("data-eid");
      removeMemberFromGroup(enrollmentId);
    });
  });
}

async function removeMemberFromGroup(enrollmentId) {
  if (!currentCourseId || !currentGroupId || !currentGroupTopicId) return;

  const g = groupsCache.find((x) => x.groupId === currentGroupId && x.topicId === currentGroupTopicId);
  if (!g) return;

  const member = g.members?.[enrollmentId];
  const studentName = member?.name || "this member";

  const confirmRemove = confirm(
    `Remove ${studentName} from "${g.groupName}"? This does NOT delete their enrollment or topic.`
  );
  if (!confirmRemove) return;

  try {
    await db
      .ref(`groups/${currentCourseId}/${currentGroupTopicId}/${currentGroupId}/members/${enrollmentId}`)
      .remove();

    // Update local cache: remove from this group
    delete g.members[enrollmentId];
    // also remove from groupedEnrollmentIdsForCourse set
    groupedEnrollmentIdsForCourse.delete(enrollmentId);

    // Refresh members table
    showGroupMembers(currentGroupTopicId, currentGroupId);

    alert("Member removed from group.");
  } catch (err) {
    console.error(err);
    alert("Error removing member. Please try again.");
  }
}

// -------------------------------
// Show available students (not in ANY group) for this course
// -------------------------------
function showAvailableMembers() {
  availableMembersTableBody.innerHTML = "";
  availableMembersMsg.textContent = "";

  if (!currentCourseId || !currentGroupId || !currentGroupTopicId) {
    availableMembersMsg.textContent =
      "Select a course and open a group first.";
    availableMembersSection.style.display = "block";
    return;
  }

  if (!enrollmentCacheForCourse.length) {
    availableMembersMsg.textContent =
      "No enrollments for this course.";
    availableMembersSection.style.display = "block";
    return;
  }

  const availableList = enrollmentCacheForCourse.filter(
    (e) => !groupedEnrollmentIdsForCourse.has(e.enrollmentId)
  );

  if (!availableList.length) {
    availableMembersMsg.textContent =
      "No students are available. All enrolled students are already in some group.";
    availableMembersSection.style.display = "block";
    return;
  }

  // sort by time
  availableList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  availableList.forEach((e) => {
    const dateStr = e.timestamp ? new Date(e.timestamp).toLocaleString() : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="checkbox"
               class="available-member-checkbox"
               data-eid="${e.enrollmentId}" />
      </td>
      <td>${e.name}</td>
      <td>${e.email}</td>
      <td>${e.topicTitle}</td>
      <td>${dateStr}</td>
      <td>
        <select class="available-role-select" data-eid="${e.enrollmentId}">
          <option value="Member">Member</option>
          <option value="Lead">Lead</option>
        </select>
      </td>
    `;
    availableMembersTableBody.appendChild(tr);
  });

  availableMembersSection.style.display = "block";
  availableMembersSection.scrollIntoView({ behavior: "smooth" });
}

// -------------------------------
// Add selected available members to current group
// -------------------------------
async function addSelectedMembersToGroup() {
  if (!currentCourseId || !currentGroupId || !currentGroupTopicId) {
    alert("Please select a course and open a group first.");
    return;
  }

  const checkboxes = document.querySelectorAll(".available-member-checkbox");
  const selectedIds = [];
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      selectedIds.push(cb.getAttribute("data-eid"));
    }
  });

  if (!selectedIds.length) {
    alert("Please select at least one student to add.");
    return;
  }

  try {
    // find cached group
    const g = groupsCache.find((x) => x.groupId === currentGroupId && x.topicId === currentGroupTopicId);
    if (!g) {
      alert("Group no longer exists. Please reload.");
      return;
    }

    // check group capacity if topic has groupMaxMembers set (we need to read topic config)
    // Attempt to read topic config to know groupMaxMembers (best-effort)
    const topicSnap = await db.ref(`courses/${currentCourseId}/topics/${currentGroupTopicId}`).get();
    const topicData = topicSnap.exists() ? topicSnap.val() : null;
    const groupMax = topicData?.groupMaxMembers || null;

    const currentCount = Object.keys(g.members || {}).length;
    if (groupMax && currentCount + selectedIds.length > groupMax) {
      alert(`Cannot add ${selectedIds.length} members. Group capacity (${groupMax}) will be exceeded.`);
      return;
    }

    const updates = {};
    selectedIds.forEach((eid) => {
      const e = enrollmentCacheForCourse.find(
        (x) => x.enrollmentId === eid
      );
      if (!e) return;

      const roleSelect = document.querySelector(
        `.available-role-select[data-eid="${eid}"]`
      );
      const role = roleSelect ? roleSelect.value : "Member";

      // write full member object under groups/{courseId}/{topicId}/{groupId}/members/{enrollmentId}
      updates[
        `groups/${currentCourseId}/${currentGroupTopicId}/${currentGroupId}/members/${eid}`
      ] = {
        name: e.name,
        email: e.email,
        topicId: e.topicId,
        topicTitle: e.topicTitle,
        role: role,
        timestamp: e.timestamp || null,
      };

      // update local caches
      groupedEnrollmentIdsForCourse.add(eid);
      g.members = g.members || {};
      g.members[eid] = {
        name: e.name,
        email: e.email,
        topicId: e.topicId,
        topicTitle: e.topicTitle,
        role: role,
        timestamp: e.timestamp || null,
      };
    });

    // perform single multi-path update
    await db.ref().update(updates);

    alert("Selected students added to the group.");

    // Refresh current group members & available list
    showGroupMembers(currentGroupTopicId, currentGroupId);
    showAvailableMembers();
  } catch (err) {
    console.error(err);
    alert("Error adding members. Please try again.");
  }
}

// -------------------------------
// Export Groups + Members to PDF (with roles)
// -------------------------------
function exportGroupsToPdf() {
  if (!currentCourseId) {
    alert("Please select a course first.");
    return;
  }
  if (!groupsCache.length) {
    alert("No groups to export for this course.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const courseName = courseCache[currentCourseId]?.name || currentCourseId;

  // Title
  doc.setFontSize(14);
  doc.text("Group Details Report", 14, 16);

  doc.setFontSize(11);
  doc.text("Course: " + courseName, 14, 24);
  doc.text("Generated: " + new Date().toLocaleString(), 14, 32);

  // 1) Summary table of groups
  const summaryBody = groupsCache.map((g) => {
    const memberCount = Object.keys(g.members || {}).length;
    const dateStr = g.createdAt ? new Date(g.createdAt).toLocaleString() : "";
    return [
      g.groupName || "",
      g.topicTitle || "",
      g.description || "",
      String(memberCount),
      dateStr,
    ];
  });

  doc.autoTable({
    startY: 40,
    head: [["Group Name", "Topic", "Description", "Members", "Created At"]],
    body: summaryBody,
  });

  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 40;

  // 2) Detailed members for each group (with Role)
  groupsCache.forEach((g) => {
    const memberEntries = Object.entries(g.members || {});
    if (!memberEntries.length) {
      return;
    }

    finalY += 10;
    if (finalY > 260) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(12);
    doc.text(
      `Group: ${g.groupName}  (Topic: ${g.topicTitle || '-'})  (Members: ${memberEntries.length})`,
      14,
      finalY
    );

    const membersBody = memberEntries.map(([id, m]) => [
      m.name || "",
      m.email || "",
      m.topicTitle || "-",
      m.role || "Member",
      m.timestamp ? new Date(m.timestamp).toLocaleString() : "",
    ]);

    doc.autoTable({
      startY: finalY + 4,
      head: [["Student Name", "Email", "Topic", "Role", "Enrolled At"]],
      body: membersBody,
    });

    finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY + 30;
  });

  const fileName = `Groups_${courseName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

// -------------------------------
// Events
// -------------------------------
groupCourseFilter.addEventListener("change", loadGroups);
exportGroupPdfBtn.addEventListener("click", exportGroupsToPdf);
addMemberBtn.addEventListener("click", showAvailableMembers);
confirmAddMembersBtn.addEventListener("click", addSelectedMembersToGroup);

// -------------------------------
// Start
// -------------------------------
loadCourses();
