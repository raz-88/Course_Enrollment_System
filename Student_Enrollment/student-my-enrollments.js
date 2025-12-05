// student-my-enrollments.js
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

const myEmailInput = document.getElementById("myEmail");
const loadBtn = document.getElementById("loadEnrollmentsBtn");
const clearBtn = document.getElementById("clearBtn");
const listEl = document.getElementById("myEnrollmentsList");

function emailKey(email) { return email.trim().toLowerCase().replace(/\./g, ','); }

loadBtn.addEventListener("click", async function () {
  const email = myEmailInput.value.trim();
  if (!email) { alert("Enter your email"); return; }
  listEl.innerHTML = "<p class='muted'>Loading...</p>";

  // Approach: iterate all courses under /enrollments and find matches.
  try {
    const enrollmentsSnap = await db.ref("enrollments").get();
    if (!enrollmentsSnap.exists()) {
      listEl.innerHTML = "<p class='muted'>No enrollments found.</p>";
      return;
    }

    const results = []; // {courseId, enrollId, data, courseName}
    const enrollData = enrollmentsSnap.val() || {};
    // iterate courses
    await Promise.all(Object.keys(enrollData).map(async function (courseId) {
      const courseEnrolls = enrollData[courseId] || {};
      // iterate enrollments
      Object.keys(courseEnrolls).forEach(function (eid) {
        const ed = courseEnrolls[eid] || {};
        if (ed.email && ed.email.trim().toLowerCase() === email.toLowerCase()) {
          results.push({ courseId: courseId, enrollId: eid, data: ed });
        }
      });
      // fetch course name (optional)
    }));

    if (!results.length) {
      listEl.innerHTML = "<p class='muted'>No enrollments found for this email.</p>";
      return;
    }

    // fetch course names in batch
    const courseIds = Array.from(new Set(results.map(r => r.courseId)));
    const coursePromises = courseIds.map(id => db.ref("courses/" + id + "/name").get());
    const courseSnaps = await Promise.all(coursePromises);
    const courseNameMap = {};
    courseSnaps.forEach((s, idx) => {
      if (s.exists()) courseNameMap[courseIds[idx]] = s.val();
      else courseNameMap[courseIds[idx]] = courseIds[idx];
    });

    // build UI list
    listEl.innerHTML = "";
    results.sort((a,b) => (a.data.timestamp || 0) - (b.data.timestamp || 0));
    results.forEach(function (r, index) {
      const row = document.createElement("div");
      row.className = "enroll-row";

      const left = document.createElement("div");
      left.className = "enroll-left";
      const nameLine = document.createElement("div");
      nameLine.innerHTML = "<strong>" + escapeHtml(r.data.name || "") + "</strong> — <span class='muted'>" + escapeHtml(courseNameMap[r.courseId] || r.courseId) + "</span>";
      const metaLine = document.createElement("div");
      const dateStr = r.data.timestamp ? new Date(r.data.timestamp).toLocaleString() : "-";
      metaLine.className = "muted";
      metaLine.textContent = (r.data.topicTitle ? r.data.topicTitle + " • " : "") + dateStr;

      left.appendChild(nameLine);
      left.appendChild(metaLine);

      const right = document.createElement("div");
      right.style.display = "flex"; right.style.gap = "8px"; right.style.alignItems = "center";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-ghost";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", function () { confirmCancelEnrollment(r.courseId, r.enrollId); });

      right.appendChild(cancelBtn);
      row.appendChild(left);
      row.appendChild(right);
      listEl.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    listEl.innerHTML = "<p class='muted'>Error loading enrollments.</p>";
  }
});

clearBtn.addEventListener("click", function () {
  myEmailInput.value = "";
  listEl.innerHTML = "";
});

// Cancel flow: delete enrollment and decrement courses/{courseId}/filledSeats transactionally
async function confirmCancelEnrollment(courseId, enrollId) {
  if (!confirm("Cancel this enrollment? This will free the seat.")) return;

  try {
    // Read membership for any groups containing this enrollment (to remove)
    const groupsSnap = await db.ref("groups/" + courseId).get();
    const updates = {};
    // delete enrollment
    updates["enrollments/" + courseId + "/" + enrollId] = null;

    // remove from groups if present
    if (groupsSnap.exists()) {
      groupsSnap.forEach(function (child) {
        const groupId = child.key;
        const g = child.val() || {};
        const members = g.members || {};
        if (members[enrollId]) {
          updates["groups/" + courseId + "/" + groupId + "/members/" + enrollId] = null;
        }
      });
    }

    // apply deletes first
    await db.ref().update(updates);

    // decrement filledSeats via transaction safely
    const courseRef = db.ref("courses/" + courseId + "/filledSeats");
    await courseRef.transaction(function (current) {
      const cur = typeof current === "number" ? current : null;
      if (cur === null) {
        // try to avoid negative: set to 0 if unknown
        return 0;
      }
      const next = cur - 1;
      return next < 0 ? 0 : next;
    }, false);

    alert("Enrollment cancelled and seat freed.");
    // refresh the list for the same email
    document.getElementById("loadEnrollmentsBtn").click();
  } catch (err) {
    console.error(err);
    alert("Error cancelling enrollment. Try again.");
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
