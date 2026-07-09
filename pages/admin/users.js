// ==========================================================
//  SUPER ADMIN — User Management
//  Edits persist to localStorage (this is the one dataset in the app that's actually meant to
//  be interactively edited, unlike the read-only project/compliance demo data). mockUsers from
//  mockData.js is only the first-run seed.
// ==========================================================
const USERS_STORAGE_KEY = "snpdMockUsers";

function loadUsers() {
  const stored = localStorage.getItem(USERS_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through to reseed */ }
  }
  return mockUsers.map(u => ({ ...u }));
}
function saveUsers() { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users)); }

let users  = loadUsers();
let nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;

function roleLabel(key) {
  const role = rolesCatalog.find(r => r.key === key);
  return role ? role.label : key;
}

function renderUsersTable() {
  const tbody = document.getElementById("usersTbody");
  if (!users.length) {
    tbody.innerHTML = "<tr><td colspan='6' class='users-empty'>No users yet — click “+ Add User” to create one.</td></tr>";
    return;
  }
  const roleOptionsFor = selected => rolesCatalog.map(r =>
    "<option value='" + r.key + "'" + (r.key === selected ? " selected" : "") + ">" + esc(r.label) + "</option>"
  ).join("");

  tbody.innerHTML = users.map(u =>
    "<tr data-id='" + u.id + "'>" +
      "<td>" + esc(u.name) + "</td>" +
      "<td>" + esc(u.email) + "</td>" +
      "<td><select class='user-role-select' aria-label='Role for " + esc(u.name) + "'>" + roleOptionsFor(u.role) + "</select></td>" +
      "<td><button type='button' class='status-toggle " + (u.status === "Active" ? "status-active" : "status-inactive") + "'>" + esc(u.status) + "</button></td>" +
      "<td>" + esc(u.lastLogin || "—") + "</td>" +
      "<td><button type='button' class='user-remove-btn' title='Remove user' aria-label='Remove " + esc(u.name) + "'>✕</button></td>" +
    "</tr>"
  ).join("");
}

function wireTableEvents() {
  const tbody = document.getElementById("usersTbody");
  tbody.addEventListener("change", e => {
    const select = e.target.closest(".user-role-select");
    if (!select) return;
    const id = Number(select.closest("tr").dataset.id);
    const user = users.find(u => u.id === id);
    if (user) { user.role = select.value; saveUsers(); }
  });
  tbody.addEventListener("click", e => {
    const id = Number(e.target.closest("tr")?.dataset.id);
    const user = users.find(u => u.id === id);
    if (!user) return;

    if (e.target.closest(".status-toggle")) {
      user.status = user.status === "Active" ? "Inactive" : "Active";
      saveUsers();
      renderUsersTable();
    } else if (e.target.closest(".user-remove-btn")) {
      if (!confirm("Remove " + user.name + "?")) return;
      users = users.filter(u => u.id !== id);
      saveUsers();
      renderUsersTable();
    }
  });
}

function wireAddUserForm() {
  const toggleBtn = document.getElementById("addUserToggle");
  const panel     = document.getElementById("addUserPanel");
  const nameInput = document.getElementById("newUserName");
  const emailInput= document.getElementById("newUserEmail");
  const roleSelect= document.getElementById("newUserRole");

  roleSelect.innerHTML = rolesCatalog.map(r => "<option value='" + r.key + "'>" + esc(r.label) + "</option>").join("");

  function openPanel()  { panel.hidden = false; panel.classList.remove("error"); nameInput.focus(); }
  function closePanel() { panel.hidden = true; nameInput.value = ""; emailInput.value = ""; roleSelect.selectedIndex = 0; panel.classList.remove("error"); }

  toggleBtn.addEventListener("click", () => panel.hidden ? openPanel() : closePanel());
  document.getElementById("addUserCancel").addEventListener("click", closePanel);

  document.getElementById("addUserSubmit").addEventListener("click", () => {
    const name  = nameInput.value.trim();
    const email = emailInput.value.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !validEmail) { panel.classList.add("error"); return; }

    users.push({ id: nextId++, name, email, role: roleSelect.value, status: "Active", lastLogin: "—" });
    saveUsers();
    renderUsersTable();
    closePanel();
  });
}

renderTopNav("admin-users");
renderUsersTable();
wireTableEvents();
wireAddUserForm();
