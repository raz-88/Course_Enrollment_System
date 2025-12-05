// enroll.js (UPDATED)
// Enrollment page logic with atomic increment of courses/{courseId}/filledSeats
// and optional student profile creation at students/{emailKey}

// -------------------------------
// Firebase init (your config)
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
// DOM refs (same as before)
const courseIdInput = document.getElementById("courseIdInput");
const courseNameEl = document.getElementById("courseName");
const courseShortDescEl = document.getElementById("courseShortDesc");
const courseMetaEl = document.getElementById("courseMeta");
const topicSelect = document.getElementById("topicSelect");
const enrollForm = document.getElementById("enrollForm");
const studentNameInput = document.getElementById("studentName");
const studentEmailInput = document.getElementById("studentEmail");
const enrollMsg = document.getElementById("enrollMsg");
const submitBtn = document.getElementById("submitEnrollBtn");
const backToCourse = document.getElementById("backToCourse");
const pageTitle = document.getElementById("pageTitle");

// URL params
function getParam(name) { return new URLSearchParams(window.location.search).get(name); }
const courseId = getParam("courseId");
const preselectedTopicId = getParam("topicId") || null;

courseIdInput.value = courseId || "";
backToCourse.href = courseId ? "course-details.html?courseId=" + encodeURIComponent(courseId) : "../index.html";

if (!courseId) {
  pageTitle.textContent = "Course not specified";
  enrollMsg.textContent = "Missing courseId in URL. Open a course from the course listing.";
  enrollMsg.className = "message error";
  submitBtn.disabled = true;
} else {
  loadCourseAndTopics(courseId, preselectedTopicId);
}

// -------------------------------
// Helper to normalize email for use as RTDB key
function emailKey(email) {
  return email.trim().toLowerCase().replace(/\./g, ','); // replace dot to avoid key issues
}

// -------------------------------
// Load course, topics, enrollments (same UI logic)
async function loadCourseAndTopics(courseId, preTopicId) {
  setLoadingState(true, "Loading course and topics...");
  try {
    const [courseSnap, topicsSnap, enrollSnap] = await Promise.all([
      db.ref("courses/" + courseId).get(),
      db.ref("courses/" + courseId + "/topics").get(),
      db.ref("enrollments/" + courseId).get()
    ]);

    if (!courseSnap.exists()) {
      setLoadingState(false, "Course not found.", true);
      return;
    }

    const course = courseSnap.val() || {};
    const topicsObj = topicsSnap.exists() ? topicsSnap.val() : {};
    const enrollObj = enrollSnap.exists() ? enrollSnap.val() : {};

    // UI meta
    courseNameEl.textContent = course.name || "Untitled Course";
    courseShortDescEl.textContent = course.description || "";
    const startDate = course.startDate || "";
    const duration = course.duration || "";
    const maxSeats = course.maxSeats || 0;
    const filledSeats = typeof course.filledSeats === "number" ? course.filledSeats : Object.keys(enrollObj).length;
    const remaining = maxSeats > 0 ? Math.max(0, maxSeats - filledSeats) : "Open";

    let metaHtml = "";
    if (startDate) metaHtml += "<span><strong>Start:</strong> " + escapeHtml(startDate) + "</span>";
    if (duration) metaHtml += "<span><strong>Duration:</strong> " + escapeHtml(duration) + "</span>";
    if (maxSeats > 0) metaHtml += `<span><strong>Seats:</strong> ${filledSeats}/${maxSeats} enrolled</span>`;
    else metaHtml += `<span><strong>Seats:</strong> ${filledSeats} enrolled</span>`;
    courseMetaEl.innerHTML = metaHtml;

    // compute used per topic
    const usedCounts = {};
    Object.keys(enrollObj || {}).forEach(function (eid) {
      const en = enrollObj[eid];
      if (!en || !en.topicId) return;
      usedCounts[en.topicId] = (usedCounts[en.topicId] || 0) + 1;
    });

    // build topic select
    topicSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select Topic --";
    placeholder.disabled = true; placeholder.selected = true;
    topicSelect.appendChild(placeholder);

    const topicIds = Object.keys(topicsObj);
    if (!topicIds.length) {
      const opt = document.createElement("option");
      opt.value = ""; opt.textContent = "No topics available for this course";
      opt.disabled = true; opt.selected = true;
      topicSelect.appendChild(opt);
      setLoadingState(false, "No topics configured yet.", true);
      return;
    }

    let preselectedApplied = false;
    topicIds.forEach(function (tid) {
      const t = topicsObj[tid] || {};
      const title = t.title || "Untitled";
      const maxPeople = t.maxPeople || 1;
      const status = t.status || "active";
      const used = usedCounts[tid] || 0;
      const remainingTopic = Math.max(0, maxPeople - used);
      const opt = document.createElement("option");
      opt.value = tid;
      let label = title + " (" + used + " / " + maxPeople + ")";
      if (status !== "active") label += " [Inactive]";
      else if (remainingTopic <= 0) label += " [Full]";
      opt.textContent = label;
      if (status !== "active" || remainingTopic <= 0) opt.disabled = true;
      topicSelect.appendChild(opt);
      if (!preselectedApplied && preTopicId && preTopicId === tid && !(status !== "active" || remainingTopic <= 0)) {
        topicSelect.value = tid; preselectedApplied = true;
      }
    });

    if (preselectedApplied === false && preTopicId) {
      showMessage("Requested topic not available (full or inactive).", "error");
    } else {
      showMessage("", "");
    }

    setLoadingState(false, "");
  } catch (err) {
    console.error(err);
    setLoadingState(false, "Error loading course data. Try again.", true);
  }
}

// -------------------------------
// Submit handler with atomic transaction for filledSeats
enrollForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  clearMessage();
  if (!courseId) { showMessage("Course not specified.", "error"); return; }

  const name = studentNameInput.value.trim();
  const email = studentEmailInput.value.trim();
  const topicId = topicSelect.value;

  if (!name || !email || !topicId) { showMessage("Please fill all fields and select a topic.", "error"); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking availability...";

  try {
    // Re-read topic and course atomically where possible
    const [topicSnap, courseSnap, enrollSnap] = await Promise.all([
      db.ref("courses/" + courseId + "/topics/" + topicId).get(),
      db.ref("courses/" + courseId).get(),
      db.ref("enrollments/" + courseId).get()
    ]);

    if (!topicSnap.exists() || !courseSnap.exists()) {
      showMessage("Course or topic no longer exists.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      await loadCourseAndTopics(courseId, null);
      return;
    }

    const topicData = topicSnap.val();
    const courseData = courseSnap.val();
    const maxPeople = topicData.maxPeople || 1;
    const topicStatus = topicData.status || "active";
    const topicTitle = topicData.title || "Untitled Topic";

    if (topicStatus !== "active") {
      showMessage("Selected topic is inactive.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      await loadCourseAndTopics(courseId, null);
      return;
    }

    // calculate used for this topic from enrollments snapshot
    const enrollAll = enrollSnap.exists() ? enrollSnap.val() : {};
    let usedCount = 0;
    Object.keys(enrollAll).forEach(function (eid) {
      const ed = enrollAll[eid];
      if (ed && ed.topicId === topicId) usedCount += 1;
    });

    if (usedCount >= maxPeople) {
      showMessage("This topic is full. Choose another topic.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      await loadCourseAndTopics(courseId, null);
      return;
    }

    // Now do a transaction on courses/{courseId}/filledSeats to ensure course-level capacity
    const maxSeats = courseData.maxSeats || 0;
    // If no per-course seat limit, we only rely on topic capacity (but we still increment filledSeats if present)
    const courseRef = db.ref("courses/" + courseId + "/filledSeats");

    const transactionResult = await courseRef.transaction(function (current) {
      // current may be null
      const cur = typeof current === "number" ? current : (typeof courseData.filledSeats === "number" ? courseData.filledSeats : Object.keys(enrollAll).length);
      // If course has a maxSeats and incrementing would exceed it, abort by returning
      if (maxSeats > 0 && cur + 1 > maxSeats) {
        return; // abort transaction
      }
      return cur + 1;
    }, /*applyLocally=*/ false);

    if (!transactionResult.committed) {
      // Transaction aborted: likely course-level capacity reached by concurrent writer
      showMessage("Sorry, the course seats got filled while you were enrolling. Try another topic or course.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      await loadCourseAndTopics(courseId, null);
      return;
    }

    // Transaction committed — proceed to write enrollment record and optional student profile
    submitBtn.textContent = "Enrolling...";

    const newRef = db.ref("enrollments/" + courseId).push();
    const payload = {
      name: name,
      email: email,
      topicId: topicId,
      topicTitle: topicTitle,
      timestamp: Date.now()
    };

    await newRef.set(payload);

    // Optional: create/update lightweight student profile so My Enrollments can be linked
    try {
      const sk = emailKey(email);
      await db.ref("students/" + sk).update({
        name: name,
        email: email,
        lastEnrolledAt: Date.now()
      });
    } catch (pfErr) {
      // non-fatal: profile update failed - continue
      console.warn("Profile write failed:", pfErr);
    }

    showMessage("Enrolled successfully! ✅", "success");
    submitBtn.textContent = "Enrolled";
    submitBtn.disabled = true;

    // Refresh UI after a short delay
    setTimeout(function () {
      loadCourseAndTopics(courseId, null);
      studentNameInput.value = "";
      // keep email for convenience
      submitBtn.disabled = false;
      submitBtn.textContent = "Enroll Now";
    }, 700);

  } catch (err) {
    console.error(err);
    showMessage("Error when enrolling. Please try again.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Enroll Now";
  }
});

// -------------------------------
// UI helpers (same as previous)
function setLoadingState(isLoading, message, isError) {
  if (isLoading) {
    showMessage(message || "Loading...", isError ? "error" : "");
    submitBtn.disabled = true;
  } else {
    if (!message) clearMessage();
    else showMessage(message, isError ? "error" : "");
    submitBtn.disabled = false;
  }
}
function showMessage(msg, type) {
  enrollMsg.textContent = msg || "";
  enrollMsg.className = "message";
  if (type === "success") enrollMsg.classList.add("success");
  else if (type === "error") enrollMsg.classList.add("error");
}
function clearMessage() { enrollMsg.textContent = ""; enrollMsg.className = "message"; }
function escapeHtml(str) { return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
