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

const lookupEmailInput = document.getElementById("lookupEmail");
const lookupBtn = document.getElementById("lookupBtn");
const lookupMsg = document.getElementById("lookupMsg");
const resultsContainer = document.getElementById("resultsContainer");

function showMsg(text, type="error") {
  lookupMsg.textContent = text;
  lookupMsg.className = "msg " + type;
  lookupMsg.style.display = "block";
}

function clearMsg() {
  lookupMsg.style.display = "none";
}

// Escape HTML safely
function esc(str) { 
  return String(str || "").replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[m])); 
}

// -----------------------------
// Button Event
// -----------------------------
lookupBtn.addEventListener("click", () => {
  const email = lookupEmailInput.value.trim().toLowerCase();
  if (!email) return showMsg("Please enter an email.");

  clearMsg();
  resultsContainer.innerHTML = "<p>Searching...</p>";

  searchEnrollmentsByEmail(email);
});

// -----------------------------
// Main Lookup Function
// -----------------------------
async function searchEnrollmentsByEmail(email) {
  try {
    const enrollSnap = await db.ref("enrollments").get();

    if (!enrollSnap.exists()) {
      resultsContainer.innerHTML = "<p>No enrollments found.</p>";
      return;
    }

    const enrollDB = enrollSnap.val();
    let matches = [];

    // Filter enrollments by email
    Object.keys(enrollDB).forEach(courseId => {
      Object.keys(enrollDB[courseId]).forEach(enId => {
        const en = enrollDB[courseId][enId];
        if (en.email && en.email.toLowerCase() === email) {
          matches.push({ courseId, enId, ...en });
        }
      });
    });

    if (matches.length === 0) {
      resultsContainer.innerHTML = "<p>No enrollments found for this email.</p>";
      return;
    }

    // Load course names
    const courseSnap = await db.ref("courses").get();
    const courses = courseSnap.exists() ? courseSnap.val() : {};

    // Load groups full structure
    const groupsSnap = await db.ref("groups").get();
    const groups = groupsSnap.exists() ? groupsSnap.val() : {};

    resultsContainer.innerHTML = "";

    // Render each enrollment
    matches.forEach(item => {
      const courseName = courses[item.courseId]?.name || "Unknown Course";
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : "";

      // Find group name (NEW FORMAT)
      let groupName = "-";
      let role = "-";

      if (groups[item.courseId]) {
        Object.keys(groups[item.courseId]).forEach(topicId => {
          const topicGroups = groups[item.courseId][topicId];
          Object.keys(topicGroups).forEach(groupId => {
            const g = topicGroups[groupId];
            if (g.members && g.members[item.enId]) {
              groupName = g.groupName || "Group";
              role = g.members[item.enId].role || "Member";
            }
          });
        });
      }

      const div = document.createElement("div");
      div.className = "result-card";
      div.innerHTML = `
        <div class="row-title">${esc(courseName)}</div>
        <div class="muted">Topic: ${esc(item.topicTitle)}</div>
        <div class="muted">Enrolled At: ${esc(dateStr)}</div>
        <div class="muted">Group: ${esc(groupName)}</div>
        <div class="muted">Group Role: ${esc(role)}</div>
      `;

      resultsContainer.appendChild(div);
    });

    showMsg("Results loaded successfully.", "success");

  } catch (err) {
    console.error(err);
    showMsg("Error fetching data.");
  }
}
