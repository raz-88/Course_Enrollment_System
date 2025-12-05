// admin-home.js

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
const homeTotalCoursesEl = document.getElementById("homeTotalCourses");
const homeTakenTopicsEl = document.getElementById("homeTakenTopics");
const homeTotalTopicsEl = document.getElementById("homeTotalTopics");
const homeTotalSeatsEl = document.getElementById("homeTotalSeats");
const homeTotalFilledEl = document.getElementById("homeTotalFilled");
const homeTotalRemainingEl = document.getElementById("homeTotalRemaining");
const homeTotalEnrollmentsEl = document.getElementById("homeTotalEnrollments");
const homeCoursesWithEnrollmentsEl = document.getElementById(
  "homeCoursesWithEnrollments"
);
const homeTotalGroupsEl = document.getElementById("homeTotalGroups");
const homeCoursesWithGroupsEl = document.getElementById(
  "homeCoursesWithGroups"
);

// -------------------------------
// Load all needed data
// -------------------------------
let coursesData = {};
let enrollmentsData = {};
let groupsData = {};

function loadAll() {
  // Load courses
  db.ref("courses").on("value", (snap) => {
    coursesData = snap.val() || {};
    updateFromAllData();
  });

  // Load enrollments
  db.ref("enrollments").on("value", (snap) => {
    enrollmentsData = snap.val() || {};
    updateFromAllData();
  });

  // Load groups
  db.ref("groups").on("value", (snap) => {
    groupsData = snap.val() || {};
    updateFromAllData();
  });
}

function updateFromAllData() {
  const courseIds = Object.keys(coursesData);

  // Courses & topics stats
  let totalCourses = courseIds.length;
  let totalSeats = 0;
  let totalFilled = 0;
  let totalRemaining = 0;
  let totalTopics = 0;
  let takenTopics = 0;

  courseIds.forEach((cid) => {
    const c = coursesData[cid];
    const maxSeats = c.maxSeats || 0;
    const filledSeats = c.filledSeats || 0;
    const remaining = maxSeats - filledSeats;

    totalSeats += maxSeats;
    totalFilled += filledSeats;
    if (remaining > 0) totalRemaining += remaining;

    const topics = c.topics || {};
    const topicIds = Object.keys(topics);
    totalTopics += topicIds.length;
    takenTopics += topicIds.filter((tid) => topics[tid].isTaken).length;
  });

  // Enrollments stats
  let totalEnrollments = 0;
  let coursesWithEnrollments = 0;
  Object.entries(enrollmentsData).forEach(([cid, enrolls]) => {
    const count = Object.keys(enrolls || {}).length;
    if (count > 0) {
      totalEnrollments += count;
      coursesWithEnrollments += 1;
    }
  });

  // Groups stats
  let totalGroups = 0;
  let coursesWithGroups = 0;
  Object.entries(groupsData).forEach(([cid, groups]) => {
    const count = Object.keys(groups || {}).length;
    if (count > 0) {
      totalGroups += count;
      coursesWithGroups += 1;
    }
  });

  // Fill UI
  if (homeTotalCoursesEl)
    homeTotalCoursesEl.textContent = totalCourses;
  if (homeTotalSeatsEl)
    homeTotalSeatsEl.textContent = totalSeats;
  if (homeTotalFilledEl)
    homeTotalFilledEl.textContent = totalFilled;
  if (homeTotalRemainingEl)
    homeTotalRemainingEl.textContent = totalRemaining;
  if (homeTotalTopicsEl)
    homeTotalTopicsEl.textContent = totalTopics;
  if (homeTakenTopicsEl)
    homeTakenTopicsEl.textContent = takenTopics;
  if (homeTotalEnrollmentsEl)
    homeTotalEnrollmentsEl.textContent = totalEnrollments;
  if (homeCoursesWithEnrollmentsEl)
    homeCoursesWithEnrollmentsEl.textContent = coursesWithEnrollments;
  if (homeTotalGroupsEl)
    homeTotalGroupsEl.textContent = totalGroups;
  if (homeCoursesWithGroupsEl)
    homeCoursesWithGroupsEl.textContent = coursesWithGroups;
}



// Start
loadAll();
