// admin-course.js

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
const courseForm = document.getElementById("courseForm");
const courseFormMsg = document.getElementById("courseFormMsg");
const coursePageTitle = document.getElementById("coursePageTitle");
const coursePageNote = document.getElementById("coursePageNote");
const courseStatusInfo = document.getElementById("courseStatusInfo");
const courseStatusLabel = document.getElementById("courseStatusLabel");

const courseNameInput = document.getElementById("courseName");
const courseDescriptionInput = document.getElementById("courseDescription");
const maxSeatsInput = document.getElementById("maxSeats");
const startDateInput = document.getElementById("startDate");
const durationInput = document.getElementById("duration");

let editingCourseId = null;
let editingCourseData = null;

// -------------------------------
// Read query param (?id=courseId)
// -------------------------------
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id") || null,
  };
}

// -------------------------------
// Load existing course if editing
// -------------------------------
async function loadEditingCourse() {
  const { id } = getQueryParams();
  if (!id) return;

  editingCourseId = id;

  try {
    const snap = await db.ref("courses/" + id).get();
    if (!snap.exists()) {
      console.warn("Course not found for editing:", id);
      return;
    }

    editingCourseData = snap.val() || {};

    // Update UI to "edit" mode
    coursePageTitle.textContent = "Update Course";
    coursePageNote.textContent =
      "You are editing an existing course. Changes will update this course only.";

    courseNameInput.value = editingCourseData.name || "";
    courseDescriptionInput.value = editingCourseData.description || "";
    maxSeatsInput.value = editingCourseData.maxSeats || "";
    startDateInput.value = editingCourseData.startDate || "";
    durationInput.value = editingCourseData.duration || "";

    const status = editingCourseData.status || "active";
    courseStatusLabel.textContent = status === "active" ? "Active" : "Suspended";
    courseStatusLabel.className = "";
    courseStatusLabel.classList.add(
      "status-badge",
      status === "active" ? "status-active" : "status-suspended"
    );
    courseStatusInfo.style.display = "block";
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------
// Handle form submit (create or update)
// -------------------------------
courseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  courseFormMsg.textContent = "";
  courseFormMsg.className = "message";

  const name = courseNameInput.value.trim();
  const description = courseDescriptionInput.value.trim();
  const maxSeatsValue = maxSeatsInput.value;
  const startDate = startDateInput.value;
  const duration = durationInput.value.trim();

  const maxSeats = parseInt(maxSeatsValue, 10);

  if (!name || !maxSeats || maxSeats <= 0) {
    courseFormMsg.textContent = "Please enter course name and valid max seats.";
    return;
  }

  try {
    // If editing by ID -> update this course directly
    if (editingCourseId) {
      const current = editingCourseData || {};
      await db.ref("courses/" + editingCourseId).update({
        name,
        description,
        maxSeats,
        startDate: startDate || "",
        duration: duration || "",
        filledSeats: current.filledSeats || 0,
        status: current.status || "active",
      });

      courseFormMsg.textContent = "Course updated successfully.";
      courseFormMsg.classList.add("success");
      // refresh label
      editingCourseData = {
        ...current,
        name,
        description,
        maxSeats,
        startDate: startDate || "",
        duration: duration || "",
      };
      return;
    }

    // Else: create or update by name (old behavior)
    const snap = await db.ref("courses").get();
    let existingId = null;
    let existingData = null;

    snap.forEach((child) => {
      const value = child.val();
      if (value.name && value.name.toLowerCase() === name.toLowerCase()) {
        existingId = child.key;
        existingData = value;
      }
    });

    if (existingId) {
      const current = existingData || {};
      await db.ref("courses/" + existingId).update({
        name,
        description,
        maxSeats,
        startDate: startDate || current.startDate || "",
        duration: duration || current.duration || "",
        filledSeats: current.filledSeats || 0,
        status: current.status || "active",
      });
      courseFormMsg.textContent = "Course updated successfully.";
      courseFormMsg.classList.add("success");
    } else {
      await db.ref("courses").push({
        name,
        description,
        maxSeats,
        startDate: startDate || "",
        duration: duration || "",
        filledSeats: 0,
        status: "active",
      });
      courseFormMsg.textContent = "Course created successfully.";
      courseFormMsg.classList.add("success");
    }

    courseForm.reset();
    courseStatusInfo.style.display = "none";
  } catch (err) {
    console.error(err);
    courseFormMsg.textContent = "Error saving course. Please try again.";
  }
});

// -------------------------------
// Init
// -------------------------------
loadEditingCourse();
