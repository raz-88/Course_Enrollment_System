// enroll.js
// Enrollment page — topic passed via URL (topicId). Supports Individual and Group (groups stored at groups/{courseId}/{topicId}/{groupId}).
// Writes full member objects under groups/.../members/{enrollId} and sets role per member.

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
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------------------
// DOM refs
const courseIdInput = document.getElementById("courseIdInput");
const courseNameEl = document.getElementById("courseName");
const courseShortDescEl = document.getElementById("courseShortDesc");
const courseMetaEl = document.getElementById("courseMeta");
const topicSelectEl = document.getElementById("topicSelect"); // may be removed if topic in URL
const enrollForm = document.getElementById("enrollForm");
const studentNameInput = document.getElementById("studentName");
const studentEmailInput = document.getElementById("studentEmail");
const enrollMsg = document.getElementById("enrollMsg");
const submitBtn = document.getElementById("submitEnrollBtn");
const backToCourse = document.getElementById("backToCourse");
const pageTitle = document.getElementById("pageTitle");

// Container where we will render topic header & group UI (inserted above enrollMsg)
let renderContainer = null;
function ensureRenderContainer() {
  if (!renderContainer) {
    renderContainer = document.createElement("div");
    if (enrollMsg && enrollMsg.parentNode === enrollForm) enrollForm.insertBefore(renderContainer, enrollMsg);
    else enrollForm.appendChild(renderContainer);
  }
}

// -------------------------------
// Helpers
function getParam(name) { return new URLSearchParams(window.location.search).get(name); }
function emailKey(email) { return email.trim().toLowerCase().replace(/\./g, ','); }
function escapeHtml(str) { return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

// -------------------------------
// URL params and initial checks
const courseId = getParam("courseId");
const topicIdFromUrl = getParam("topicId"); // required per your request

courseIdInput.value = courseId || "";
backToCourse.href = courseId ? "course-details.html?courseId=" + encodeURIComponent(courseId) : "../index.html";

if (!courseId) {
  pageTitle.textContent = "Course not specified";
  showMessage("Missing courseId in URL. Open a course from the course listing.", "error");
  submitBtn.disabled = true;
} else if (!topicIdFromUrl) {
  pageTitle.textContent = "Topic not specified";
  showMessage("Missing topicId in URL. Please open enroll from a course topic.", "error");
  submitBtn.disabled = true;
} else {
  loadCourseTopicAndRender(courseId, topicIdFromUrl);
}

// -------------------------------
// Load course, topic, enrollments and groups (topic-layered)
async function loadCourseTopicAndRender(courseId, topicId) {
  setLoadingState(true, "Loading course & topic...");
  try {
    // fetch course, topic, enrollments(for counts), groups for this topic only
    const [courseSnap, topicSnap, enrollSnap, groupsSnap] = await Promise.all([
      db.ref("courses/" + courseId).get(),
      db.ref("courses/" + courseId + "/topics/" + topicId).get(),
      db.ref("enrollments/" + courseId).get(),
      db.ref("groups/" + courseId + "/" + topicId).get() // EXACT: topic layer then groups
    ]);

    if (!courseSnap.exists()) { setLoadingState(false, "Course not found.", true); return; }
    if (!topicSnap.exists()) { setLoadingState(false, "Topic not found (deleted or inactive).", true); return; }

    const course = courseSnap.val() || {};
    const topic = topicSnap.val() || {};
    const enrollObj = enrollSnap.exists() ? enrollSnap.val() : {};
    const groupsObj = groupsSnap.exists() ? groupsSnap.val() : {}; // groups under the topic

    // Course UI summary
    courseNameEl.textContent = course.name || "Untitled Course";
    courseShortDescEl.textContent = course.description || "";
    const maxSeats = course.maxSeats || 0;
    const filledSeats = typeof course.filledSeats === "number" ? course.filledSeats : Object.keys(enrollObj || {}).length;
    courseMetaEl.innerHTML = maxSeats > 0 ? `<span><strong>Seats:</strong> ${filledSeats}/${maxSeats}</span>` : `<span><strong>Seats:</strong> ${filledSeats}</span>`;

    // compute usage for topic depending on enrollmentMode
    let enrollmentMode = (topic.enrollmentMode || "individual"); // "individual" or "group"
    // member-level used:
    let membersUsed = 0;
    Object.values(enrollObj || {}).forEach(e => { if (e && e.topicId === topicId) membersUsed++; });

    // group-level used (number of groups created under this topic)
    const groupCount = Object.keys(groupsObj || {}).length;
    let displayUsed = (enrollmentMode === "group") ? groupCount : membersUsed;
    const remainingTopic = Math.max(0, (topic.maxPeople || 1) - displayUsed);

    // render container and header
    ensureRenderContainer();
    renderContainer.innerHTML = "";
    const header = document.createElement("div");
    header.innerHTML = `<h3 style="margin:0 0 6px 0;">${escapeHtml(topic.title || "Untitled Topic")}</h3>
      <div style="font-size:13px; color:#555; margin-bottom:8px;">Mode: <strong>${enrollmentMode}</strong> · Used: ${displayUsed} · Remaining: ${remainingTopic}</div>`;
    renderContainer.appendChild(header);

    // status checks
    if ((topic.status || "active") !== "active") { showMessage("This topic is inactive.", "error"); submitBtn.disabled = true; setLoadingState(false); return; }
    if (remainingTopic <= 0) { showMessage("This topic is full. Enrollment not available.", "error"); submitBtn.disabled = true; setLoadingState(false); return; }

    // remove topicSelect (we rely on URL)
    const ts = document.getElementById("topicSelect");
    if (ts && ts.parentNode) ts.parentNode.removeChild(ts);

    // render appropriate UI
    if (enrollmentMode === "individual") {
      renderIndividualUI(topicId, topic, course, enrollObj);
    } else {
      renderGroupUI(topicId, topic, course, enrollObj, groupsObj);
    }

    setLoadingState(false, "");
  } catch (err) {
    console.error(err);
    setLoadingState(false, "Error loading data. Try again.", true);
  }
}

// -------------------------------
// Individual UI
function renderIndividualUI(topicId, topic, course, enrollObj) {
  const info = document.createElement("div");
  info.innerHTML = `<div style="margin-bottom:8px; color:#333;">Fill your details and click <strong>Enroll Now</strong>.</div>`;
  renderContainer.appendChild(info);

  enrollForm.dataset.enrollmentMode = "individual";
  enrollForm.dataset.topicId = topicId;
  submitBtn.disabled = false;
}

// -------------------------------
// Group UI: Create or Join (wrapper id 'groupEnrollmentSection')
// dynamic append/remove extra rows preserves inputs
function renderGroupUI(topicId, topic, course, enrollObj, groupsForTopic) {
  enrollForm.dataset.enrollmentMode = "group";
  enrollForm.dataset.topicId = topicId;

  const wrapper = document.createElement("div");
  wrapper.id = "groupEnrollmentSection";
  wrapper.style.padding = "8px";
  wrapper.style.borderRadius = "6px";
  wrapper.style.background = "#f7f7f7";

  const groupMin = topic.groupMinMembers || 1;
  const groupMax = topic.groupMaxMembers || 1;
  const maxGroupsAllowed = topic.maxPeople || 1;
  const usedGroupsCount = Object.keys(groupsForTopic || {}).length;

  wrapper.innerHTML = `
    <div style="margin-bottom:6px;"><strong>Group Enrollment</strong></div>
    <div style="font-size:13px; color:#555; margin-bottom:8px;">
      Group size: min ${groupMin} · max ${groupMax} · groups allowed: ${maxGroupsAllowed} · existing groups: ${usedGroupsCount}
    </div>
    <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
      <label style="display:flex; gap:6px; align-items:center;"><input type="radio" name="groupAction" value="create" checked /> Create new group</label>
      <label style="display:flex; gap:6px; align-items:center;"><input type="radio" name="groupAction" value="join" /> Join existing group</label>
    </div>
    <div id="groupCreateArea">
      <label style="display:block; font-size:13px; margin-bottom:6px;">Group name (optional)</label>
      <input type="text" id="createGroupName" placeholder="e.g. Delta" style="width:100%; padding:8px; box-sizing:border-box; margin-bottom:8px;" />
      <div id="membersArea">
        <div style="font-size:13px; margin-bottom:6px;"><strong>Members to add</strong> (you + others). You must add at least ${groupMin} member(s) total.</div>
      </div>
      <div style="font-size:12px; color:#666; margin-top:6px;">You can add up to ${Math.max(0, groupMax - 1)} additional members (creator counts as 1).</div>
    </div>
    <div id="groupJoinArea" style="display:none;">
      <label style="display:block; font-size:13px; margin-bottom:6px;">Select a group to join</label>
      <select id="existingGroupSelect" style="width:100%; padding:8px; box-sizing:border-box;"></select>
    </div>
  `;

  renderContainer.appendChild(wrapper);

  // populate existing groups (groupsForTopic is groups under this topic)
  const existingSelect = wrapper.querySelector("#existingGroupSelect");
  const groupsList = Object.entries(groupsForTopic || {}); // [ [groupId, groupObj], ... ]
  if (!groupsList.length) {
    existingSelect.innerHTML = `<option value="">No groups yet</option>`;
    existingSelect.disabled = true;
  } else {
    existingSelect.innerHTML = "";
    groupsList.forEach(([gid, gdata]) => {
      const count = gdata.members ? Object.keys(gdata.members).length : 0;
      const name = gdata.groupName || `Group ${gid.slice(0,6)}`;
      const disabled = (groupMax && count >= groupMax) ? "disabled" : "";
      const opt = document.createElement("option");
      opt.value = gid;
      opt.textContent = `${name} (${count} members)${disabled ? " - Full" : ""}`;
      if (disabled) opt.disabled = true;
      existingSelect.appendChild(opt);
    });
  }

  // Members area (creator row + appendable extras)
  const membersArea = wrapper.querySelector("#membersArea");

  // Creator row (editable)
  const creatorRow = document.createElement("div");
  creatorRow.style.marginBottom = "8px";
  creatorRow.innerHTML = `
    <div style="font-size:13px;"><strong>You (creator)</strong></div>
    <div style="display:flex; gap:8px; margin-top:6px;">
      <input type="text" id="creatorName" placeholder="Your name" style="flex:1; padding:8px;" value="${escapeHtml(studentNameInput.value || '')}" />
      <input type="email" id="creatorEmail" placeholder="Your email" style="flex:1; padding:8px;" value="${escapeHtml(studentEmailInput.value || '')}" />
      <select id="creatorRole" style="width:120px; padding:8px;">
        <option value="Member">Member</option>
        <option value="Lead">Lead</option>
      </select>
    </div>`;
  membersArea.appendChild(creatorRow);

  // extras wrapper
  const extrasWrapper = document.createElement("div");
  extrasWrapper.id = "extrasWrapper";
  extrasWrapper.style.marginTop = "8px";
  membersArea.appendChild(extrasWrapper);

  // controls to add extra member rows (append only)
  const controls = document.createElement("div");
  controls.style.marginTop = "8px";
  controls.innerHTML = `<button type="button" id="addMemberBtn" class="btn btn-secondary">Add member</button>
    <span style="margin-left:10px; font-size:12px; color:#555;">You can add up to ${Math.max(0, groupMax - 1)} more member(s).</span>`;
  membersArea.appendChild(controls);

  function createExtraRow(prefill = {}) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginBottom = "6px";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "extraName";
    nameInput.placeholder = "Member name";
    nameInput.style.flex = "1";
    nameInput.style.padding = "8px";
    nameInput.value = prefill.name || "";

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.className = "extraEmail";
    emailInput.placeholder = "Member email";
    emailInput.style.flex = "1";
    emailInput.style.padding = "8px";
    emailInput.value = prefill.email || "";

    const roleSelect = document.createElement("select");
    roleSelect.className = "extraRole";
    roleSelect.style.width = "110px";
    roleSelect.style.padding = "8px";
    const o1 = document.createElement("option"); o1.value = "Member"; o1.text = "Member";
    const o2 = document.createElement("option"); o2.value = "Lead"; o2.text = "Lead";
    roleSelect.add(o1); roleSelect.add(o2);
    roleSelect.value = prefill.role || "Member";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.className = "removeExtraBtn";
    removeBtn.style.padding = "8px";
    removeBtn.addEventListener("click", () => {
      extrasWrapper.removeChild(row);
      controls.querySelector("#addMemberBtn").disabled = extrasWrapper.children.length >= Math.max(0, groupMax - 1);
    });

    row.appendChild(nameInput);
    row.appendChild(emailInput);
    row.appendChild(roleSelect);
    row.appendChild(removeBtn);
    return row;
  }

  controls.querySelector("#addMemberBtn").addEventListener("click", () => {
    if (extrasWrapper.children.length >= Math.max(0, groupMax - 1)) return;
    const r = createExtraRow();
    extrasWrapper.appendChild(r);
    controls.querySelector("#addMemberBtn").disabled = extrasWrapper.children.length >= Math.max(0, groupMax - 1);
  });

  // toggle create/join areas
  const rCreate = wrapper.querySelector('input[name="groupAction"][value="create"]');
  const rJoin = wrapper.querySelector('input[name="groupAction"][value="join"]');
  rCreate.addEventListener("change", () => {
    wrapper.querySelector("#groupCreateArea").style.display = "block";
    wrapper.querySelector("#groupJoinArea").style.display = "none";
  });
  rJoin.addEventListener("change", () => {
    wrapper.querySelector("#groupCreateArea").style.display = "none";
    wrapper.querySelector("#groupJoinArea").style.display = "block";
  });

  // sync creator inputs to main form inputs for convenience
  wrapper.querySelector("#creatorName").addEventListener("input", (e) => { studentNameInput.value = e.target.value; });
  wrapper.querySelector("#creatorEmail").addEventListener("input", (e) => { studentEmailInput.value = e.target.value; });

  submitBtn.disabled = false;
}

// -------------------------------
// Main submit handler (individual / group join / group create)
enrollForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  clearMessage();

  if (!courseId) { showMessage("Course not specified.", "error"); return; }
  if (!topicIdFromUrl) { showMessage("Topic not specified.", "error"); return; }

  const name = (studentNameInput.value || "").trim();
  const email = (studentEmailInput.value || "").trim().toLowerCase();
  if (!name || !email) { showMessage("Please enter your name and email.", "error"); return; }

  const enrollmentMode = enrollForm.dataset.enrollmentMode || "individual";
  const topicId = enrollForm.dataset.topicId || topicIdFromUrl;

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking availability...";

  try {
    // fetch latest snapshots
    const [topicSnap, courseSnap, enrollSnap, groupsSnap] = await Promise.all([
      db.ref("courses/" + courseId + "/topics/" + topicId).get(),
      db.ref("courses/" + courseId).get(),
      db.ref("enrollments/" + courseId).get(),
      db.ref("groups/" + courseId + "/" + topicId).get() // only groups for this topic
    ]);

    if (!topicSnap.exists() || !courseSnap.exists()) {
      showMessage("Course or topic no longer exists.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      await loadCourseTopicAndRender(courseId, topicId);
      return;
    }

    const topic = topicSnap.val();
    const course = courseSnap.val();
    const enrollAll = enrollSnap.exists() ? enrollSnap.val() : {};
    const groupsForTopic = groupsSnap.exists() ? groupsSnap.val() : {};

    // one-email-per-course check
    const alreadyEnrolledForEmail = Object.values(enrollAll || {}).some(en => en && en.email && en.email.trim().toLowerCase() === email);
    if (alreadyEnrolledForEmail) {
      showMessage("This email is already enrolled in this course. One user cannot enroll multiple times.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      return;
    }

    // INDIVIDUAL flow
    if (enrollmentMode === "individual") {
      const maxPeople = topic.maxPeople || 1;
      // count topic members
      let membersUsed = 0;
      Object.values(enrollAll || {}).forEach(en => { if (en && en.topicId === topicId) membersUsed++; });
      if (membersUsed >= maxPeople) {
        showMessage("Topic is full. Choose another topic.", "error");
        submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
        await loadCourseTopicAndRender(courseId, topicId);
        return;
      }

      // increment course filledSeats by 1
      const ok = await incrementCourseFilledSeatsBy(courseId, course, 1, enrollAll);
      if (!ok) {
        showMessage("Course seats got filled while enrolling. Try again.", "error");
        submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
        await loadCourseTopicAndRender(courseId, topicId);
        return;
      }

      // write enrollment
      submitBtn.textContent = "Enrolling...";
      const newRef = db.ref("enrollments/" + courseId).push();
      const eid = newRef.key;
      const payload = { name, email, topicId, topicTitle: topic.title || null, timestamp: Date.now() };
      await newRef.set(payload);
      try { await db.ref("students/" + emailKey(email)).update({ name, email, lastEnrolledAt: Date.now() }); } catch(_) {}
      showMessage("Enrolled successfully!", "success");
      submitBtn.textContent = "Enrolled";
      setTimeout(()=>{ loadCourseTopicAndRender(courseId, topicId); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; studentNameInput.value=""; },700);
      return;
    }

    // GROUP flow
    const groupWrapper = document.getElementById("groupEnrollmentSection");
    if (!groupWrapper) {
      showMessage("Group UI not found. Refresh and try again.", "error");
      submitBtn.disabled = false; submitBtn.textContent = "Enroll Now";
      return;
    }

    const actionEl = groupWrapper.querySelector('input[name="groupAction"]:checked');
    if (!actionEl) { showMessage("Group action not selected.", "error"); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; return; }
    const action = actionEl.value; // "create" or "join"

    const groupMax = topic.groupMaxMembers || 1;
    const groupMin = topic.groupMinMembers || 1;
    const maxGroupsAllowed = topic.maxPeople || 1;

    // JOIN existing group
    if (action === "join") {
      const select = groupWrapper.querySelector("#existingGroupSelect");
      if (!select || !select.value) { showMessage("Select a group to join.", "error"); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; return; }
      const groupId = select.value;

      // check group capacity from DB
      const membersSnap = await db.ref(`groups/${courseId}/${topicId}/${groupId}/members`).get();
      const currentCount = membersSnap.exists() ? Object.keys(membersSnap.val() || {}).length : 0;
      if (groupMax && currentCount >= groupMax) {
        showMessage("Selected group is full. Choose another group or create a new one.", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      // reserve 1 course seat
      const ok = await incrementCourseFilledSeatsBy(courseId, course, 1, enrollAll);
      if (!ok) {
        showMessage("Course seats got filled while enrolling. Try again.", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      submitBtn.textContent = "Joining group...";
      const newRef = db.ref("enrollments/" + courseId).push();
      const eid = newRef.key;
      const payload = {
        name, email, topicId, topicTitle: topic.title || null,
        groupId, groupName: (groupsForTopic[groupId] && groupsForTopic[groupId].groupName) || null,
        role: "Member", // default for join
        timestamp: Date.now()
      };

      try {
        await newRef.set(payload);
        const memberObj = {
          name: payload.name,
          email: payload.email,
          role: payload.role,
          timestamp: payload.timestamp,
          topicId: payload.topicId,
          topicTitle: payload.topicTitle || null
        };
        await db.ref(`groups/${courseId}/${topicId}/${groupId}/members/${eid}`).set(memberObj);
      } catch (err) {
        console.error("join error", err);
        // rollback enrollment entry if needed
        try { await db.ref(`enrollments/${courseId}/${eid}`).remove(); } catch(_) {}
        showMessage("Error joining group. Try again.", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      // profile update
      try { await db.ref("students/" + emailKey(email)).update({ name, email, lastEnrolledAt: Date.now() }); } catch(_) {}
      showMessage("Joined group successfully!", "success");
      submitBtn.textContent = "Enrolled";
      setTimeout(()=>{ loadCourseTopicAndRender(courseId, topicId); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; studentNameInput.value=""; },700);
      return;
    }

    // CREATE new group
    if (action === "create") {
      // build members list from DOM (creator + extras)
      const creatorName = (groupWrapper.querySelector("#creatorName")?.value || name).trim();
      const creatorEmail = (groupWrapper.querySelector("#creatorEmail")?.value || email).trim().toLowerCase();
      const creatorRole = (groupWrapper.querySelector("#creatorRole")?.value || "Member");

      const extraRows = Array.from(groupWrapper.querySelectorAll("#extrasWrapper > div"));
      const members = [];
      members.push({ name: creatorName, email: creatorEmail, role: creatorRole });

      for (const row of extraRows) {
        const nm = (row.querySelector(".extraName")?.value || "").trim();
        const em = (row.querySelector(".extraEmail")?.value || "").trim().toLowerCase();
        const rl = (row.querySelector(".extraRole")?.value || "Member");
        if (!nm || !em) { showMessage("Please fill name and email for all additional members.", "error"); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; return; }
        members.push({ name: nm, email: em, role: rl });
      }

      if (members.length < groupMin) { showMessage(`At least ${groupMin} member(s) required to create this group.`, "error"); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; return; }
      if (members.length > groupMax) { showMessage(`No more than ${groupMax} members allowed in a group.`, "error"); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; return; }

      // ensure none of these emails already enrolled in this course
      const enrolledEmails = new Set(Object.values(enrollAll || {}).map(en => (en && en.email && en.email.trim().toLowerCase()) || null).filter(Boolean));
      for (const m of members) {
        if (enrolledEmails.has(m.email)) {
          showMessage(`Email ${m.email} is already enrolled in this course. One user cannot enroll multiple times.`, "error");
          submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; return;
        }
      }

      // check group-slot availability (topic.maxPeople is group slots in group mode)
      const existingGroupsCount = Object.keys(groupsForTopic || {}).length;
      if (existingGroupsCount >= maxGroupsAllowed) {
        showMessage("No more groups can be created for this topic (group slots full).", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      // reserve course seats atomically (nMembers)
      const nMembers = members.length;
      const ok = await incrementCourseFilledSeatsBy(courseId, course, nMembers, enrollAll);
      if (!ok) {
        showMessage("Course seats got filled while creating the group. Try again.", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      // create group under topic path: groups/{courseId}/{topicId}
      const groupRef = db.ref(`groups/${courseId}/${topicId}`).push();
      const newGroupId = groupRef.key;
      const groupName = (groupWrapper.querySelector("#createGroupName")?.value || "").trim() || null;
      const createdAt = Date.now();

      try {
        await groupRef.set({
          groupName: groupName,
          description: null,
          createdAt,
          topicId: topicId,
          topicTitle: topic.title || null
        });
      } catch (err) {
        console.error("group create err", err);
        // rollback course seats best-effort
        try { await db.ref(`courses/${courseId}/filledSeats`).transaction(cur => (typeof cur === "number" ? cur - nMembers : null), false); } catch(_) {}
        showMessage("Failed to create group. Try again.", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      // write enrollment entries and member objects under group.members/{enrollId}
      const createdEnrollIds = [];
      try {
        for (const m of members) {
          const newEnrollRef = db.ref("enrollments/" + courseId).push();
          const eid = newEnrollRef.key;
          const payload = {
            name: m.name,
            email: m.email,
            topicId,
            topicTitle: topic.title || null,
            groupId: newGroupId,
            groupName: groupName || null,
            role: m.role || "Member",
            timestamp: Date.now()
          };
          await newEnrollRef.set(payload);

          // store full member object under the group's members node
          const memberObj = {
            name: payload.name,
            email: payload.email,
            role: payload.role,
            timestamp: payload.timestamp,
            topicId: payload.topicId,
            topicTitle: payload.topicTitle || null
          };
          await db.ref(`groups/${courseId}/${topicId}/${newGroupId}/members/${eid}`).set(memberObj);

          createdEnrollIds.push(eid);
          // update student profile non-blocking
          try { await db.ref("students/" + emailKey(m.email)).update({ name: m.name, email: m.email, lastEnrolledAt: Date.now() }); } catch(_) {}
        }
      } catch (err) {
        console.error("error writing enrollments for group creation", err);
        // rollback created enrollments, group, and decrement filledSeats by created count (best-effort)
        for (const id of createdEnrollIds) { try { await db.ref(`enrollments/${courseId}/${id}`).remove(); } catch(_) {} }
        try { await db.ref(`groups/${courseId}/${topicId}/${newGroupId}`).remove(); } catch(_) {}
        try { await db.ref(`courses/${courseId}/filledSeats`).transaction(cur => (typeof cur === "number" ? cur - createdEnrollIds.length : null), false); } catch(_) {}
        showMessage("Failed to complete enrollment for group. Please try again.", "error");
        submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; await loadCourseTopicAndRender(courseId, topicId); return;
      }

      showMessage("Group created and members enrolled successfully!", "success");
      submitBtn.textContent = "Enrolled";
      setTimeout(()=>{ loadCourseTopicAndRender(courseId, topicId); submitBtn.disabled=false; submitBtn.textContent="Enroll Now"; studentNameInput.value=""; },700);
      return;
    }

    // fallback
    showMessage("Invalid action. Refresh and try again.", "error");
    submitBtn.disabled=false; submitBtn.textContent="Enroll Now";
  } catch (err) {
    console.error("submit error", err);
    showMessage("Error during enrollment. Try again.", "error");
    submitBtn.disabled=false; submitBtn.textContent="Enroll Now";
  }
});

// -------------------------------
// Transaction: increment courses/{courseId}/filledSeats by n safely
async function incrementCourseFilledSeatsBy(courseId, courseData, n, enrollAllFallback) {
  try {
    const courseRef = db.ref("courses/" + courseId + "/filledSeats");
    const maxSeats = courseData.maxSeats || 0;
    const fallback = Object.keys(enrollAllFallback || {}).length;
    const tr = await courseRef.transaction(function (current) {
      const cur = (typeof current === "number") ? current : (typeof courseData.filledSeats === "number" ? courseData.filledSeats : fallback);
      if (maxSeats > 0 && cur + n > maxSeats) return; // abort transaction
      return cur + n;
    }, /*applyLocally=*/ false);
    return !!tr.committed;
  } catch (err) {
    console.error("transaction error", err);
    return false;
  }
}

// -------------------------------
// UI helpers
function setLoadingState(isLoading, message, isError) {
  if (isLoading) {
    showMessage(message || "Loading...", isError ? "error" : "");
    submitBtn.disabled = true;
  } else {
    if (!message) clearMessage();
    else showMessage(message, isError ? "error" : "");
  }
}
function showMessage(msg, type) {
  enrollMsg.textContent = msg || "";
  enrollMsg.className = "message";
  if (type === "success") enrollMsg.classList.add("success");
  else if (type === "error") enrollMsg.classList.add("error");
}
function clearMessage() { enrollMsg.textContent = ""; enrollMsg.className = "message"; }
