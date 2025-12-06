// course-details.js
// Shows course info and topic list with live used/max counts

// Firebase config (your project)
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

const courseTitleEl = document.getElementById("courseTitle");
const courseDescEl = document.getElementById("courseDesc");
const courseMetaEl = document.getElementById("courseMeta");
const topicsListEl = document.getElementById("topicsList");

// ⛔ Removed enrollCourseBtn — not required
// const enrollCourseBtn = document.getElementById("enrollCourseBtn");

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("courseId");
}

const courseId = getCourseIdFromUrl();
if (!courseId) {
  courseTitleEl.textContent = "Course not specified";
  courseDescEl.textContent = "No courseId found in URL. Go back to All Courses.";
  topicsListEl.innerHTML = "";
} else {
  loadCourseDetails(courseId);
}

async function loadCourseDetails(courseId) {
  courseTitleEl.textContent = "Loading...";
  courseDescEl.textContent = "";
  courseMetaEl.innerHTML = "";
  topicsListEl.innerHTML = "";

  try {
    // Fetch course and topics + enrollments (to compute used counts)
    const [courseSnap, topicsSnap, enrollmentsSnap] = await Promise.all([
      db.ref("courses/" + courseId).get(),
      db.ref("courses/" + courseId + "/topics").get(),
      db.ref("enrollments/" + courseId).get()
    ]);

    if (!courseSnap.exists()) {
      courseTitleEl.textContent = "Course not found";
      courseDescEl.textContent =
        "The course you requested does not exist or was removed.";
      return;
    }

    const course = courseSnap.val() || {};
    const topicsObj = topicsSnap.exists() ? topicsSnap.val() : {};
    const enrollObj = enrollmentsSnap.exists() ? enrollmentsSnap.val() : {};

    // Build enroll counts per topicId
    const usedCounts = {};
    Object.keys(enrollObj).forEach(function (eid) {
      const en = enrollObj[eid];
      if (!en) return;
      const tid = en.topicId;
      if (!tid) return;
      if (!usedCounts[tid]) usedCounts[tid] = 0;
      usedCounts[tid] += 1;
    });

    // Course header
    courseTitleEl.textContent = course.name || "Untitled Course";
    courseDescEl.textContent = course.description || "No description provided.";

    // meta
    const startDate = course.startDate || "";
    const duration = course.duration || "";
    const maxSeats = course.maxSeats || 0;

    let filledSeats = typeof course.filledSeats === "number"
      ? course.filledSeats
      : Object.keys(enrollObj).length;

    const remaining = maxSeats > 0 ? maxSeats - filledSeats : 0;
    const remainingSafe = remaining < 0 ? 0 : remaining;

    const metaParts = [];
    if (startDate)
      metaParts.push("<span><strong>Start:</strong> " + escapeHtml(startDate) + "</span>");
    if (duration)
      metaParts.push("<span><strong>Duration:</strong> " + escapeHtml(duration) + "</span>");
    if (maxSeats > 0) {
      metaParts.push("<span class='seat-line'><strong>Seats:</strong> " + filledSeats + "/" + maxSeats + " enrolled</span>");
    } else {
      metaParts.push("<span class='seat-line'><strong>Seats:</strong> " + filledSeats + " enrolled</span>");
    }
    courseMetaEl.innerHTML = metaParts.join("");

    // ⛔ Removed this completely:
    // enrollCourseBtn.href = "enroll.html?courseId=" + encodeURIComponent(courseId);

    // Topics list
    const topicIds = Object.keys(topicsObj);
    if (!topicIds.length) {
      topicsListEl.innerHTML = "<div class='note'>No topics configured for this course yet.</div>";
      return;
    }

    topicsListEl.innerHTML = "";

    topicIds.forEach(function (tid) {
      const t = topicsObj[tid] || {};
      const title = t.title || "Untitled Topic";
      const maxPeople = t.maxPeople || 1;
      const status = t.status || "active";
      const used = usedCounts[tid] || 0;
      const remainingTopic = Math.max(0, maxPeople - used);

      const topicRow = document.createElement("div");
      topicRow.className = "topic-row";

      const left = document.createElement("div");
      left.className = "topic-left";

      const titleEl = document.createElement("div");
      titleEl.className = "topic-title";
      titleEl.textContent = title;

      const metaEl = document.createElement("div");
      metaEl.className = "topic-meta";
      metaEl.innerHTML =
        "Capacity: " + used + " / " + maxPeople;

      const capacityEl = document.createElement("div");
      capacityEl.className = "topic-capacity";
      if (status !== "active") {
        capacityEl.innerHTML = "<span class='status-badge status-suspended'>Inactive</span>";
      } else if (remainingTopic <= 0) {
        capacityEl.innerHTML = "<span class='status-badge status-suspended'>Full</span>";
      } else if (remainingTopic <= Math.max(1, Math.floor(maxPeople * 0.2))) {
        capacityEl.innerHTML =
          "<span class='status-badge status-active'>Few seats left: " +
          remainingTopic +
          "</span>";
      } else {
        capacityEl.innerHTML =
          "<span class='status-badge status-active'>Seats left: " +
          remainingTopic +
          "</span>";
      }

      left.appendChild(titleEl);
      left.appendChild(metaEl);
      left.appendChild(capacityEl);

      /* Topic actions */
      const actions = document.createElement("div");
      actions.className = "topic-actions";

      const viewBtn = document.createElement("a");
      viewBtn.className = "btn btn-secondary";
      viewBtn.href = "#";
      viewBtn.textContent = "View";

      const enrollBtn = document.createElement("a");
      enrollBtn.className = "btn btn-primary";
      enrollBtn.href =
        "enroll.html?courseId=" +
        encodeURIComponent(courseId) +
        "&topicId=" +
        encodeURIComponent(tid);
      enrollBtn.textContent = "Enroll";

      if (status !== "active" || remainingTopic <= 0) {
        enrollBtn.classList.add("disabled");
        enrollBtn.setAttribute("aria-disabled", "true");
        enrollBtn.href = "#";
      }

      actions.appendChild(viewBtn);
      actions.appendChild(enrollBtn);

      topicRow.appendChild(left);
      topicRow.appendChild(actions);

      topicsListEl.appendChild(topicRow);
    });
  } catch (err) {
    console.error(err);
    courseTitleEl.textContent = "Error loading course";
    courseDescEl.textContent = "There was a problem loading details.";
  }
}

/* Helper */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
