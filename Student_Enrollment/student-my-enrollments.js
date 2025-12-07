// -----------------------------
// Firebase Init
// -----------------------------
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

const myListEl = document.getElementById("myEnrollmentsList");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -----------------------------
// Require Login
// -----------------------------
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "../auth.html";
    return;
  }
  loadMyEnrollments(user.email);
});

// -----------------------------
// Load Enrollments for Logged User
// -----------------------------
async function loadMyEnrollments(email) {
  myListEl.innerHTML = "<p>Loading your enrollments...</p>";

  try {
    const enrollSnap = await db.ref("enrollments").get();
    if (!enrollSnap.exists()) {
      myListEl.innerHTML = "<p>No enrollments found.</p>";
      return;
    }

    const enrollData = enrollSnap.val();
    const results = [];

    Object.keys(enrollData).forEach(courseId => {
      const courseEnrollments = enrollData[courseId];
      Object.keys(courseEnrollments).forEach(enId => {
        const en = courseEnrollments[enId];
        if (en.email === email) {
          results.push({ courseId, enId, ...en });
        }
      });
    });

    if (!results.length) {
      myListEl.innerHTML = "<p>You have no enrollments yet.</p>";
      return;
    }

    // Load course names + group membership
    const courseSnap = await db.ref("courses").get();
    const courses = courseSnap.exists() ? courseSnap.val() : {};

    const groupsSnap = await db.ref("groups").get();
    const groups = groupsSnap.exists() ? groupsSnap.val() : {};

    myListEl.innerHTML = "";

    results.forEach(item => {
      const courseName = courses[item.courseId]?.name || "Unknown Course";
      const topicTitle = item.topicTitle || "Unknown Topic";
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : "";

      // Find group (NEW STRUCTURE)
      let groupName = "-";
      if (groups[item.courseId]) {
        const topicGroups = groups[item.courseId];

        Object.keys(topicGroups).forEach(topicId => {
          const groupsUnderTopic = topicGroups[topicId];

          Object.keys(groupsUnderTopic).forEach(groupId => {
            const gData = groupsUnderTopic[groupId];
            if (gData.members && gData.members[item.enId]) {
              groupName = gData.groupName || "Group";
            }
          });
        });
      }

      const row = document.createElement("div");
      row.className = "enroll-row";

      row.innerHTML = `
        <div class="enroll-left">
          <div class="en-title">${escapeHtml(courseName)}</div>
          <div class="muted">Topic: ${escapeHtml(topicTitle)}</div>
          <div class="muted">Enrolled: ${escapeHtml(dateStr)}</div>
          <div class="muted">Group: ${escapeHtml(groupName)}</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <a class="btn btn-secondary" href="course-details.html?courseId=${item.courseId}">
            View Details
          </a>

          <button class="btn-ghost" onclick="cancelEnroll('${item.courseId}', '${item.enId}')">
            Cancel
          </button>
        </div>
      `;

      myListEl.appendChild(row);
    });


  } catch (err) {
    console.error(err);
    myListEl.innerHTML = "<p>Error loading enrollments.</p>";
  }
}

// -----------------------------
// Cancel Enrollment
// -----------------------------
async function cancelEnroll(courseId, enId) {
  if (!confirm("Are you sure you want to cancel your enrollment?")) return;

  try {
    const updates = {};
    updates[`enrollments/${courseId}/${enId}`] = null;

    // Remove from groups
    const grpSnap = await db.ref(`groups/${courseId}`).get();
    if (grpSnap.exists()) {
      grpSnap.forEach(g => {
        if (g.val().members && g.val().members[enId]) {
          updates[`groups/${courseId}/${g.key}/members/${enId}`] = null;
        }
      });
    }

    await db.ref().update(updates);
    alert("Enrollment canceled successfully.");
    window.location.reload();

  } catch (err) {
    console.error(err);
    alert("Error canceling enrollment. Try again.");
  }
}
