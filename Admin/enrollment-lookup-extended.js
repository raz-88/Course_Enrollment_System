// -------------------------------------------------------------
// Firebase Init
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// DOM Elements
// -------------------------------------------------------------
const emailInput = document.getElementById("emailInput");
const searchBtn = document.getElementById("searchBtn");
const lookupMsg = document.getElementById("lookupMsg");
const resultsContainer = document.getElementById("resultsContainer");

// Profile Modal
const profileModal = document.getElementById("profileModal");
const profileContent = document.getElementById("profileContent");
const closeProfileModal = document.getElementById("closeProfileModal");

// Group Modal
const groupModal = document.getElementById("groupModal");
const groupModalTitle = document.getElementById("groupModalTitle");
const groupMembersList = document.getElementById("groupMembersList");
const closeGroupModal = document.getElementById("closeGroupModal");

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function showMsg(t, type = "error") {
  lookupMsg.textContent = t;
  lookupMsg.className = "message " + (type === "success" ? "success" : "error");
}
function clearMsg() { lookupMsg.textContent = ""; lookupMsg.className = "message"; }
function esc(s) { return String(s || ""); }
function fmt(ts) { return ts ? new Date(ts).toLocaleString() : "-"; }
function emailKey(email) { return email.trim().toLowerCase().replace(/\./g, ","); }

// -------------------------------------------------------------
// SEARCH BUTTON
// -------------------------------------------------------------
searchBtn.addEventListener("click", async () => {
  const email = (emailInput.value || "").trim().toLowerCase();
  resultsContainer.innerHTML = "";
  clearMsg();

  if (!email) return showMsg("Enter an email");

  showMsg("Searching...", "success");

  try {
    const [eSnap, cSnap, gSnap] = await Promise.all([
      db.ref("enrollments").get(),
      db.ref("courses").get(),
      db.ref("groups").get()
    ]);

    const enrollments = eSnap.exists() ? eSnap.val() : {};
    const courses = cSnap.exists() ? cSnap.val() : {};
    const groups = gSnap.exists() ? gSnap.val() : {};

    const results = [];

    Object.keys(enrollments).forEach(courseId => {
      Object.keys(enrollments[courseId]).forEach(eid => {
        const e = enrollments[courseId][eid];
        if (!e || !e.email) return;

        if (e.email.toLowerCase() === email) {
          results.push({ courseId, enrollmentId: eid, ...e });
        }
      });
    });

    if (!results.length) return showMsg("No enrollments found");

    clearMsg();
    renderResults(results, courses, groups);

  } catch (err) {
    console.error(err);
    showMsg("Error while searching");
  }
});

// -------------------------------------------------------------
// RENDER RESULTS CARD
// -------------------------------------------------------------
function renderResults(list, courses, groups) {
  resultsContainer.innerHTML = "";

  list.forEach(item => {
    const courseName = courses[item.courseId]?.name || item.courseId;

    let groupName = "-";
    let role = "-";
    let foundGroupObj = null;

    // FIND GROUP
    const courseGroups = groups[item.courseId] || {};
    Object.keys(courseGroups).forEach(topicId => {
      Object.keys(courseGroups[topicId]).forEach(gid => {
        const g = courseGroups[topicId][gid];

        if (g.members && g.members[item.enrollmentId]) {
          groupName = g.groupName || gid;
          role = g.members[item.enrollmentId].role || "-";
          foundGroupObj = { topicId, groupId: gid, group: g };
        }
      });
    });

    // BUILD CARD
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "12px";

    card.innerHTML = `
      <h3>${esc(courseName)}</h3>
      <p><strong>Topic:</strong> ${esc(item.topicTitle)}</p>
      <p><strong>Enrolled:</strong> ${fmt(item.timestamp)}</p>

      <p><strong>Group:</strong> 
        ${groupName !== "-" ? `<button class="btn btn-secondary viewGroupBtn" 
            data-course="${item.courseId}" 
            data-topic="${foundGroupObj?.topicId || ""}" 
            data-group="${foundGroupObj?.groupId || ""}">
            ${esc(groupName)}
        </button>` : "-"}
      </p>

      <p><strong>Role:</strong> ${esc(role)}</p>

      <button class="btn btn-primary viewProfileBtn" data-email="${esc(item.email)}">View Profile</button>
    `;

    resultsContainer.appendChild(card);
  });

  // Attach View Profile
  document.querySelectorAll(".viewProfileBtn").forEach(btn => {
    btn.addEventListener("click", onViewProfile);
  });

  // Attach View Group
  document.querySelectorAll(".viewGroupBtn").forEach(btn => {
    btn.addEventListener("click", onViewGroup);
  });
}

// -------------------------------------------------------------
// VIEW PROFILE MODAL
// -------------------------------------------------------------
async function onViewProfile(e) {
  const email = e.target.dataset.email;
  const key = emailKey(email);

  profileModal.style.display = "none";
  profileContent.innerHTML = "<p>Loading...</p>";

  try {
    const snap = await db.ref("students/" + key).get();

    if (!snap.exists()) {
      profileContent.innerHTML = "<p>No profile found</p>";
      return;
    }

    const p = snap.val();

    profileContent.innerHTML = `
      <table class="table">
        <tr><th>Name</th><td>${esc(p.name)}</td></tr>
        <tr><th>Email</th><td>${esc(p.email)}</td></tr>
        <tr><th>Roll No</th><td>${esc(p.rollNo || "-")}</td></tr>
        <tr><th>Last Enrolled</th><td>${fmt(p.lastEnrolledAt)}</td></tr>
      </table>
    `;

  } catch (err) {
    console.error(err);
    profileContent.innerHTML = "<p>Error loading profile</p>";
  }
}

closeProfileModal.addEventListener("click", () => {
  profileModal.style.display = "none";
});

// -------------------------------------------------------------
// VIEW GROUP MEMBERS MODAL
// -------------------------------------------------------------
async function onViewGroup(e) {
  const courseId = e.target.dataset.course;
  const topicId = e.target.dataset.topic;
  const groupId = e.target.dataset.group;

  groupModal.style.display = "block";
  groupMembersList.innerHTML = "<p>Loading...</p>";

  try {
    const snap = await db.ref(`groups/${courseId}/${topicId}/${groupId}`).get();

    if (!snap.exists()) {
      groupMembersList.innerHTML = "<p>Group not found</p>";
      return;
    }

    const g = snap.val();
    groupModalTitle.textContent = "Group: " + (g.groupName || groupId);

    let html = `
      <table class="table">
      <tr><th>SN</th><th>Name</th><th>Email</th><th>Role</th><th>Time</th></tr>
    `;

    let i = 1;
    Object.keys(g.members || {}).forEach(eid => {
      const m = g.members[eid];
      html += `
        <tr>
          <td>${i++}</td>
          <td>${esc(m.name)}</td>
          <td>${esc(m.email)}</td>
          <td>${esc(m.role)}</td>
          <td>${fmt(m.timestamp)}</td>
        </tr>
      `;
    });

    html += "</table>";
    groupMembersList.innerHTML = html;

  } catch (err) {
    console.error(err);
    groupMembersList.innerHTML = "<p>Error loading members</p>";
  }
}

closeGroupModal.addEventListener("click", () => {
  groupModal.style.display = "none";
});
