/* admin-users.js - Final consolidated version
   - Client-only user management (no server)
   - Features: View, Edit, Add (register), Suspend/Reactivate, Reset password,
     Delete (move to /deletedUsers + suspend), Search, Export CSV/PDF (current view)
   - Shows Sn., Created On columns; treats addRole "staff" => saved as "admin"
*/

/* -------------------------
   Firebase initialization
   ------------------------- */
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

/* -------------------------
   DOM references
   ------------------------- */
const tbody = document.getElementById('users-tbody');
const totalUsersEl = document.getElementById('total-users');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');

const btnAdd = document.getElementById('btn-add');
const btnExportCSV = document.getElementById('btn-export-csv');
const btnExportPDF = document.getElementById('btn-export-pdf');

const viewModal = document.getElementById('view-modal');
const editModal = document.getElementById('edit-modal');
const addModal = document.getElementById('add-modal');

const viewBox = document.getElementById('view-box');
const editForm = document.getElementById('edit-form');
const editUid = document.getElementById('edit-uid');
const editName = document.getElementById('edit-name');
const editEmail = document.getElementById('edit-email');
const editRole = document.getElementById('edit-role');
const editStatus = document.getElementById('edit-status');

const addForm = document.getElementById('add-form');
const addName = document.getElementById('add-name');
const addEmail = document.getElementById('add-email');
const addPassword = document.getElementById('add-password');
const addRole = document.getElementById('add-role');

const messageBox = document.getElementById('message-box');

let allUsers = [];
let displayedUsers = []; // currently rendered (after search/filter)

/* -------------------------
   Helpers
   ------------------------- */
function showMessage(text, timeout = 3500) {
  if (!messageBox) return console.log(text);
  messageBox.textContent = text;
  messageBox.style.display = 'block';
  setTimeout(() => messageBox.style.display = 'none', timeout);
}
function escapeHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatCreatedAt(raw) {
  if (raw === undefined || raw === null || raw === '') return '-';
  // If it's a number (timestamp), convert it
  if (typeof raw === 'number') {
    try { return new Date(raw).toLocaleString(); } catch { return String(raw); }
  }
  // If it's numeric string
  if (!isNaN(raw) && String(raw).length >= 10) {
    const n = Number(raw);
    if (!isNaN(n)) return new Date(n).toLocaleString();
  }
  // otherwise assume readable string
  return String(raw);
}

/* -------------------------
   Fetch & render
   ------------------------- */
function fetchUsers() {
  db.ref('users').once('value').then(snap => {
    allUsers = [];
    tbody.innerHTML = '';
    snap.forEach(child => {
      const uid = child.key;
      const u = child.val() || {};
      allUsers.push({
        uid,
        name: u.name || '',
        email: u.email || '',
        role: u.role || 'student',
        suspended: !!u.suspended,
        createdAtRaw: u.createdAt || u.registeredOn || '',
        createdAt: formatCreatedAt(u.createdAt || u.registeredOn || '')
      });
    });
    totalUsersEl.textContent = allUsers.length;
    renderTable(allUsers);
  }).catch(err => {
    console.error('fetchUsers error', err);
    showMessage('Error reading users: ' + (err.message || err));
  });
}

function renderTable(users) {
  displayedUsers = users.slice(); // copy for export
  tbody.innerHTML = '';
  users.forEach((u, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="width:48px">${index + 1}</td>
      <td style="word-break:break-all">${escapeHtml(u.uid)}</td>
      <td>${escapeHtml(u.name || '-')}</td>
      <td>${escapeHtml(u.email || '-')}</td>
      <td>${escapeHtml(u.role)}</td>
      <td>${u.suspended ? '<span class="status-suspended">Suspended</span>' : '<span class="status-active">Active</span>'}</td>
      <td>${escapeHtml(u.createdAt || '-')}</td>
      <td>
        <button class="action-btn view-btn" onclick="viewUser('${u.uid}')">View</button>
        <button class="action-btn edit-btn" onclick="startEdit('${u.uid}')">Edit</button>
        <button class="action-btn reset-btn" onclick="sendReset('${u.email}')">Reset</button>
        <button class="action-btn suspend-btn" onclick="toggleSuspend('${u.uid}', ${u.suspended})">${u.suspended ? 'Reactivate' : 'Suspend'}</button>
        <button class="action-btn delete-btn" onclick="deleteUser('${u.uid}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* -------------------------
   View / Edit / Add / Suspend / Reset / Delete
   ------------------------- */
window.viewUser = function(uid) {
  db.ref('users/' + uid).once('value').then(snap => {
    const u = snap.val() || {};
    let html = '';
    const order = ['name','email','role','suspended','createdAt','registeredOn','uid'];
    order.forEach(k => { if (u[k] !== undefined) html += `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(u[k]))}</p>`; });
    Object.keys(u).forEach(k => { if (!order.includes(k)) html += `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(u[k]))}</p>`; });
    viewBox.innerHTML = html || '<p>-</p>';
    openModal('view-modal');
  }).catch(err => { console.error(err); showMessage('Error fetching user.'); });
};

window.startEdit = function(uid) {
  db.ref('users/' + uid).once('value').then(snap => {
    const u = snap.val() || {};
    editUid.value = uid;
    editName.value = u.name || '';
    editEmail.value = u.email || '';
    editRole.value = u.role || 'student';
    editStatus.value = u.suspended ? 'suspended' : 'active';
    openModal('edit-modal');
  }).catch(err => { console.error(err); showMessage('Error preparing edit.'); });
};

if (editForm) {
  editForm.addEventListener('submit', e => {
    e.preventDefault();
    const uid = editUid.value;
    const update = {
      name: editName.value.trim(),
      email: editEmail.value.trim(),
      role: editRole.value,
      suspended: editStatus.value === 'suspended'
    };
    db.ref('users/' + uid).update(update).then(() => {
      showMessage('Profile updated.');
      closeModal('edit-modal');
      fetchUsers();
    }).catch(err => { console.error(err); showMessage('Error updating profile: ' + err.message); });
  });
}

/* Add (Register) user — uses createUserWithEmailAndPassword client-side */
if (btnAdd) btnAdd.addEventListener('click', () => openModal('add-modal'));

if (addForm) {
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = (addName.value || '').trim();
    const email = (addEmail.value || '').trim();
    const password = addPassword.value;
    // convert staff -> admin
    const role = (addRole.value === "staff") ? "admin" : (addRole.value || 'student');

    if (!name || !email || !password) return showMessage('Fill required fields.');

    auth.createUserWithEmailAndPassword(email, password)
      .then(cred => {
        const uid = cred.user.uid;
        const now = new Date();
        const createdReadable = now.toLocaleDateString() + " " + now.toLocaleTimeString();
        return db.ref('users/' + uid).set({
          uid,
          name,
          email,
          role,
          suspended: false,
          createdAt: createdReadable   // store readable createdAt
        });
      })
      .then(() => {
        showMessage('User created.');
        closeModal('add-modal');
        addForm.reset();
        fetchUsers();
      })
      .catch(err => {
        console.error(err);
        showMessage('Error creating user: ' + (err.message || err));
      });
  });
}

window.toggleSuspend = function(uid, currentlySuspended) {
  const newStatus = !currentlySuspended;
  const msg = newStatus ? 'Suspend this user? They will not be able to log in.' : 'Reactivate this user?';
  if (!confirm(msg)) return;
  db.ref('users/' + uid).update({ suspended: newStatus }).then(() => {
    showMessage('Status updated.');
    fetchUsers();
  }).catch(err => { console.error(err); showMessage('Error updating status: ' + err.message); });
};

window.sendReset = function(email) {
  if (!email) return showMessage('No email to reset.');
  auth.sendPasswordResetEmail(email).then(() => showMessage('Reset email sent to ' + email))
  .catch(err => { console.error(err); showMessage('Error: ' + err.message); });
};

window.deleteUser = function(uid) {
  if (!confirm('Delete user — this will move the user record to /deletedUsers and suspend them. Proceed?')) return;
  db.ref('users/' + uid).once('value').then(snap => {
    const u = snap.val();
    if (!u) throw new Error('User record not found');
    u.deletedOn = Date.now();
    u.suspended = true;
    return db.ref('deletedUsers/' + uid).set(u);
  }).then(() => db.ref('users/' + uid).remove())
  .then(() => { showMessage('User moved to deletedUsers and suspended.'); fetchUsers(); })
  .catch(err => { console.error('deleteUser error', err); showMessage('Error deleting user: ' + (err.message || err)); });
};

/* -------------------------
   Live search
   ------------------------- */
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    if (!q) return renderTable(allUsers);
    const filtered = allUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.uid && u.uid.toLowerCase().includes(q))
    );
    renderTable(filtered);
  });
}

/* -------------------------
   Modal helpers
   ------------------------- */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

/* -------------------------
   EXPORT: CSV (Excel) & PDF
   ------------------------- */
function exportToCSV(filename = 'users_export.csv') {
  const rows = [
    ['Sn.', 'UID', 'Name', 'Email', 'Role', 'Status', 'Created On']
  ];
  displayedUsers.forEach((u, i) => {
    rows.push([
      i + 1,
      u.uid || '',
      u.name || '',
      u.email || '',
      u.role || '',
      u.suspended ? 'Suspended' : 'Active',
      u.createdAt || ''
    ]);
  });

  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
if (btnExportCSV) btnExportCSV.addEventListener('click', () => exportToCSV('users_export.csv'));

function exportToPDF(filename = 'users_export.pdf') {
  const columns = ['Sn.', 'UID', 'Name', 'Email', 'Role', 'Status', 'Created On'];
  const rows = displayedUsers.map((u, i) => [
    i + 1,
    u.uid || '',
    u.name || '',
    u.email || '',
    u.role || '',
    u.suspended ? 'Suspended' : 'Active',
    u.createdAt || ''
  ]);

  // Use jsPDF autoTable (global jspdf object is available via UMD)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape', 'pt', 'a4');
  doc.setFontSize(14);
  doc.text('User List', 40, 40);
  doc.autoTable({
    startY: 60,
    head: [columns],
    body: rows,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [46,125,50], textColor: 255 }
  });
  doc.save(filename);
}
if (btnExportPDF) btnExportPDF.addEventListener('click', () => exportToPDF('users_export.pdf'));

/* -------------------------
   Init
   ------------------------- */
if (refreshBtn) refreshBtn.addEventListener('click', fetchUsers);
fetchUsers();
