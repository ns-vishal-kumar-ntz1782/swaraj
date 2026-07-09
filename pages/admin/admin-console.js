// ==========================================================
//  ADMIN CONSOLE — main controller
//  Renders all 9 admin tabs; all data stored in localStorage.
// ==========================================================

// ── Storage keys ────────────────────────────────────────────
const SK = {
  users:       "snpd_admin_users",
  checklists:  "snpd_admin_checklists",
  deliverables:"snpd_admin_deliverables",
  forms:       "snpd_admin_forms",
  formMappings:"snpd_admin_form_mappings",
  projConfigs: "snpd_admin_proj_configs",
  workflows:   "snpd_admin_workflows",
  notifications:"snpd_admin_notifications",
  auditLogs:   "snpd_admin_audit_logs",
  masterData:  "snpd_admin_master_data",
};

// ── Load / seed from localStorage ───────────────────────────
function loadStore(key, seed) {
  try {
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
  } catch(e) {}
  return seed.map ? seed.map(x => ({...x})) : {...seed};
}
function saveStore(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

let users         = loadStore(SK.users,        adminMockUsers);
let checklists    = loadStore(SK.checklists,   adminChecklistItems());
let deliverables  = loadStore(SK.deliverables, adminDeliverables);
let forms         = loadStore(SK.forms,        adminForms);
let formMappings  = loadStore(SK.formMappings, adminDeliverableFormMappings);
let projConfigs   = loadStore(SK.projConfigs,  adminProjectConfigs);
let workflows     = loadStore(SK.workflows,    adminWorkflowConfig);
let notifications = loadStore(SK.notifications,adminNotificationConfig);
let auditLogs     = loadStore(SK.auditLogs,    adminAuditLogs);
let masterData    = loadStore(SK.masterData, {
  roles: adminRoles,
  departments: adminDepartments,
  businessUnits: adminBusinessUnits,
  locations: adminLocations,
  gates: adminGateTemplates,
});

// ── Unique ID generators ─────────────────────────────────────
function nextId(arr, field) { return arr.length ? Math.max(...arr.map(x => +x[field] || 0)) + 1 : 1; }
function nextStrId(arr, field, prefix) {
  const nums = arr.map(x => parseInt(x[field]?.replace(prefix,"")) || 0);
  return prefix + String(Math.max(0,...nums) + 1).padStart(3,"0");
}

// ── Utility ──────────────────────────────────────────────────
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function now(){ const d=new Date(); return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) + ", " + d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); }
function addAudit(action, module_, entity, prev, next_) {
  const role = sessionStorage.getItem("snpdRole") || "SA";
  const user = users.find(u=>u.role===role) || {name:"Super Admin"};
  auditLogs.unshift({ id: nextId(auditLogs,"id"), action, module:module_, entity, performedBy:user.name, role, timestamp:now(), ip:"10.0.1."+Math.floor(Math.random()*100+1), prevValue:prev, newValue:next_ });
  if(auditLogs.length>500) auditLogs = auditLogs.slice(0,500);
  saveStore(SK.auditLogs, auditLogs);
}

// ── Modal helper ─────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml, cls) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalFooter").innerHTML = footerHtml || "";
  const box = document.getElementById("modalBox");
  box.className = "modal-box" + (cls ? " " + cls : "");
  document.getElementById("modalOverlay").hidden = false;
}
function closeModal() { document.getElementById("modalOverlay").hidden = true; }

// ── Tab routing ──────────────────────────────────────────────
const TAB_RENDERERS = {
  "user-mgmt":    renderUserMgmt,
  "gate-checklist": renderGateChecklist,
  "deliverables": renderDeliverables,
  "forms-library":renderFormsLibrary,
  "project-config":renderProjectConfig,
  "master-data":  renderMasterData,
  "workflow":     renderWorkflow,
  "notifications":renderNotifications,
  "audit-logs":   renderAuditLogs,
};

let activeTab = "user-mgmt";

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".snav-item").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const renderer = TAB_RENDERERS[tab];
  if (renderer) renderer();
}

// ══════════════════════════════════════════════════════════════
//  1. USER MANAGEMENT
// ══════════════════════════════════════════════════════════════
function renderUserMgmt() {
  const active   = users.filter(u=>u.status==="Active").length;
  const inactive = users.filter(u=>u.status==="Inactive").length;
  const el = document.getElementById("adminContent");
  el.innerHTML = `
    <div class="ac-header">
      <div class="ac-header-left"><h1>User Management</h1><p>Create, edit, and manage platform users and their roles.</p></div>
      <div class="ac-header-right">
        <button class="btn-secondary" onclick="exportUsersCSV()">↗ Export</button>
        <button class="btn-primary" onclick="openUserModal(null)">+ Add User</button>
      </div>
    </div>
    <div class="ac-stats">
      <div class="ac-stat-card"><div class="stat-val">${users.length}</div><div class="stat-lbl">Total Users</div></div>
      <div class="ac-stat-card stat-green"><div class="stat-val">${active}</div><div class="stat-lbl">Active</div></div>
      <div class="ac-stat-card stat-amber"><div class="stat-val">${inactive}</div><div class="stat-lbl">Inactive</div></div>
      <div class="ac-stat-card"><div class="stat-val">${[...new Set(users.map(u=>u.role))].length}</div><div class="stat-lbl">Roles Assigned</div></div>
    </div>
    <div class="ac-toolbar">
      <div class="ac-search"><svg class="ac-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="userSearch" placeholder="Search name, email, role…" oninput="filterUsersTable()" /></div>
      <select class="ac-filter-select" id="userRoleFilter" onchange="filterUsersTable()"><option value="">All Roles</option>${adminRoles.map(r=>`<option value="${r.key}">${esc(r.label)}</option>`).join("")}</select>
      <select class="ac-filter-select" id="userStatusFilter" onchange="filterUsersTable()"><option value="">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
    </div>
    <div class="ac-card">
      <div class="ac-table-wrap">
        <table class="ac-table" id="usersTable">
          <thead><tr>
            <th>EMP ID</th><th>NAME</th><th>EMAIL</th><th>DESIGNATION</th>
            <th>DEPARTMENT</th><th>ROLE</th><th>STATUS</th><th>LAST LOGIN</th><th>ACTIONS</th>
          </tr></thead>
          <tbody id="usersTbody"></tbody>
        </table>
      </div>
    </div>`;
  renderUsersTable(users);
}

function renderUsersTable(list) {
  const tb = document.getElementById("usersTbody");
  if(!tb) return;
  if(!list.length){ tb.innerHTML = `<tr><td colspan="9"><div class="ac-empty"><p>No users found.</p></div></td></tr>`; return; }
  tb.innerHTML = list.map(u => `
    <tr>
      <td><span style="font-size:11px;color:#94a3b8;">${esc(u.empId)}</span></td>
      <td><strong>${esc(u.name)}</strong></td>
      <td style="color:#0369a1;">${esc(u.email)}</td>
      <td>${esc(u.designation)}</td>
      <td>${esc(u.department)}</td>
      <td><span class="role-pill">${esc(roleLbl(u.role))}</span></td>
      <td><span class="status-pill ${u.status==="Active"?"pill-active":"pill-inactive"}"><span class="pill-dot"></span>${esc(u.status)}</span></td>
      <td style="font-size:12px;color:#64748b;">${esc(u.lastLogin||"—")}</td>
      <td><div class="td-actions">
        <button class="btn-icon" title="Edit" onclick="openUserModal(${u.id})">✏</button>
        <button class="btn-icon" title="Reset Password" onclick="resetPassword(${u.id})">🔑</button>
        <button class="btn-icon" title="${u.status==="Active"?"Deactivate":"Activate"}" onclick="toggleUserStatus(${u.id})">${u.status==="Active"?"🚫":"✅"}</button>
        <button class="btn-icon" title="Delete" style="color:#dc2626" onclick="deleteUser(${u.id})">🗑</button>
      </div></td>
    </tr>`).join("");
}

function filterUsersTable() {
  const q = (document.getElementById("userSearch")?.value||"").toLowerCase();
  const r = document.getElementById("userRoleFilter")?.value||"";
  const s = document.getElementById("userStatusFilter")?.value||"";
  renderUsersTable(users.filter(u=>
    (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || roleLbl(u.role).toLowerCase().includes(q)) &&
    (!r || u.role===r) &&
    (!s || u.status===s)
  ));
}

function roleLbl(key){ return (adminRoles.find(r=>r.key===key)||{label:key}).label; }

function openUserModal(uid) {
  const u = uid ? users.find(x=>x.id===uid) : null;
  const title = u ? "Edit User — " + u.name : "Add New User";
  const projectOptions = (typeof listProjectDetails === "function" ? listProjectDetails().map(p=>p.projectName) : ["Tractor 1","Tractor 2","Tractor 3","Tractor 4","Tractor 5"]).map(p=>`<option value="${esc(p)}" ${u&&u.assignedProjects?.includes(p)?"selected":""}>${esc(p)}</option>`).join("");
  const gateOptions = adminGateTemplates.map(g=>`<option value="${esc(g)}" ${u&&u.assignedGates?.includes(g)?"selected":""}>${esc(g)}</option>`).join("");
  const body = `
    <div class="form-grid">
      <div class="form-field"><label>Employee ID *</label><input id="f_empId" value="${esc(u?.empId||"")}" placeholder="EMP0XX" /></div>
      <div class="form-field"><label>Full Name *</label><input id="f_name" value="${esc(u?.name||"")}" /></div>
      <div class="form-field"><label>Email *</label><input id="f_email" type="email" value="${esc(u?.email||"")}" /></div>
      <div class="form-field"><label>Phone</label><input id="f_phone" value="${esc(u?.phone||"")}" /></div>
      <div class="form-field"><label>Designation</label><input id="f_designation" value="${esc(u?.designation||"")}" /></div>
      <div class="form-field"><label>Role *</label><select id="f_role">${adminRoles.map(r=>`<option value="${r.key}"${u?.role===r.key?" selected":""}>${r.label}</option>`).join("")}</select></div>
      <div class="form-field"><label>Department</label><select id="f_dept">${adminDepartments.map(d=>`<option${u?.department===d?" selected":""}>${esc(d)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Business Unit</label><select id="f_bu">${adminBusinessUnits.map(b=>`<option${u?.businessUnit===b?" selected":""}>${esc(b)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Location</label><select id="f_loc">${adminLocations.map(l=>`<option${u?.location===l?" selected":""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Approval Role</label><input id="f_aprole" value="${esc(u?.approvalRole||"—")}" /></div>
      <div class="form-field span-2"><label>Assigned Projects (hold Ctrl/Cmd for multi-select)</label>
        <select id="f_projects" multiple style="height:90px">${projectOptions}</select></div>
      <div class="form-field span-2"><label>Assigned Gates</label>
        <select id="f_gates" multiple style="height:72px">${gateOptions}</select></div>
    </div>`;
  const footer = `
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="saveUser(${uid||"null"})">${u?"Save Changes":"Create User"}</button>`;
  openModal(title, body, footer, "modal-lg");
}

function saveUser(uid) {
  const empId = document.getElementById("f_empId").value.trim();
  const name  = document.getElementById("f_name").value.trim();
  const email = document.getElementById("f_email").value.trim();
  const role  = document.getElementById("f_role").value;
  if(!empId||!name||!email){ alert("Employee ID, Name and Email are required."); return; }
  const projects = [...document.getElementById("f_projects").selectedOptions].map(o=>o.value);
  const gates    = [...document.getElementById("f_gates").selectedOptions].map(o=>o.value);
  if(uid) {
    const u = users.find(x=>x.id===uid); if(!u) return;
    const prev = `${u.name} / ${u.role}`;
    Object.assign(u, { empId, name, email, phone:document.getElementById("f_phone").value.trim(), designation:document.getElementById("f_designation").value.trim(), role, department:document.getElementById("f_dept").value, businessUnit:document.getElementById("f_bu").value, location:document.getElementById("f_loc").value, approvalRole:document.getElementById("f_aprole").value.trim(), assignedProjects:projects, assignedGates:gates });
    addAudit("USER_UPDATED","User Management",`${name} (${empId})`,prev,`${name} / ${role}`);
  } else {
    const newU = { id:nextId(users,"id"), empId, name, email, phone:document.getElementById("f_phone").value.trim(), designation:document.getElementById("f_designation").value.trim(), department:document.getElementById("f_dept").value, businessUnit:document.getElementById("f_bu").value, location:document.getElementById("f_loc").value, role, status:"Active", assignedProjects:projects, assignedGates:gates, approvalRole:document.getElementById("f_aprole").value.trim(), lastLogin:"—" };
    users.push(newU);
    addAudit("USER_CREATED","User Management",`${name} (${empId})`,null,`Active / ${roleLbl(role)}`);
  }
  saveStore(SK.users, users);
  closeModal();
  renderUserMgmt();
}

function toggleUserStatus(uid) {
  const u = users.find(x=>x.id===uid); if(!u) return;
  const prev = u.status;
  u.status = u.status==="Active" ? "Inactive" : "Active";
  addAudit(u.status==="Inactive"?"USER_DEACTIVATED":"USER_ACTIVATED","User Management",u.name,prev,u.status);
  saveStore(SK.users, users);
  renderUserMgmt();
}

function deleteUser(uid) {
  const u = users.find(x=>x.id===uid); if(!u) return;
  if(!confirm(`Remove ${u.name}? This cannot be undone.`)) return;
  addAudit("USER_DELETED","User Management",u.name,"Active",null);
  users = users.filter(x=>x.id!==uid);
  saveStore(SK.users, users);
  renderUserMgmt();
}

function resetPassword(uid) {
  const u = users.find(x=>x.id===uid); if(!u) return;
  addAudit("USER_PASSWORD_RESET","User Management",`${u.name} (${u.empId})`,"—","Temp password sent");
  saveStore(SK.auditLogs, auditLogs);
  openModal("Password Reset", `<p style="font-size:14px;color:#374151;">A temporary password has been sent to <strong>${esc(u.email)}</strong>.<br><br><span style="font-size:12px;color:#64748b;">In production, this would trigger an email via the authentication service.</span></p>`,`<button class="btn-primary" onclick="closeModal()">OK</button>`,"modal-sm");
}

function exportUsersCSV() {
  const keys = ["empId","name","email","designation","department","role","status","location","lastLogin"];
  const csv = [keys.join(","), ...users.map(u=>keys.map(k=>`"${u[k]||""}"`).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"),{href:"data:text/csv;charset=utf-8,"+encodeURIComponent(csv),download:"users-export.csv"});
  a.click();
}

// ══════════════════════════════════════════════════════════════
//  2. GATE CHECKLIST MANAGEMENT
// ══════════════════════════════════════════════════════════════
let activeGateTab = "G1 Pre-KO";

function renderGateChecklist() {
  const el = document.getElementById("adminContent");
  el.innerHTML = `
    <div class="ac-header">
      <div class="ac-header-left"><h1>Gate Checklist Management</h1><p>Manage checklist templates for each gate. Items are reusable across projects.</p></div>
      <div class="ac-header-right">
        <button class="btn-primary" onclick="openChecklistModal(null)">+ Add Item</button>
      </div>
    </div>
    <div class="gate-tabs" id="gateTabsRow">
      ${adminGateTemplates.map(g=>`<button class="gate-tab-btn${g===activeGateTab?" active":""}" onclick="switchGateTab('${g}')" type="button">${esc(g)}</button>`).join("")}
    </div>
    <div id="checklistContent"></div>`;
  renderChecklistItems();
}

function switchGateTab(gate) {
  activeGateTab = gate;
  document.querySelectorAll(".gate-tab-btn").forEach(b=>b.classList.toggle("active", b.textContent.trim()===gate));
  renderChecklistItems();
}

function renderChecklistItems() {
  const items = checklists.filter(c=>c.gate===activeGateTab);
  const el = document.getElementById("checklistContent");
  if(!el) return;
  if(!items.length) {
    el.innerHTML = `<div class="ac-card"><div class="ac-card-body"><div class="ac-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>No checklist items for ${esc(activeGateTab)}.</p><button class="btn-primary" style="margin-top:8px" onclick="openChecklistModal(null)">+ Add First Item</button></div></div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="ac-card">
      <div class="ac-card-header">
        <span class="ac-card-header-title">${esc(activeGateTab)} — ${items.length} items</span>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" onclick="duplicateGateTemplate()">⧉ Duplicate Gate</button>
          <button class="btn-secondary" onclick="archiveGateTemplate()">Archive Gate</button>
        </div>
      </div>
      ${items.map(item=>`
        <div class="cl-item" id="cl-${item.id}">
          <span class="cl-item-drag">⠿</span>
          <div class="cl-item-body">
            <div class="cl-item-name">${esc(item.name)}</div>
            <div class="cl-item-meta">
              <span>Seq: ${item.seq}</span>
              <span>•</span>
              <span>${esc(item.department)}</span>
              <span>•</span>
              <span>Owner: ${esc(item.owner)}</span>
              ${item.mandatory?`<span class="status-pill pill-mandatory" style="padding:1px 6px;font-size:10px">Mandatory</span>`:`<span class="status-pill pill-optional" style="padding:1px 6px;font-size:10px">Optional</span>`}
              ${item.approvalRequired?`<span style="font-size:10px;color:#7c3aed;background:#f5f3ff;border-radius:3px;padding:1px 6px;">Approval</span>`:""}
              ${item.docRequired?`<span style="font-size:10px;color:#0369a1;background:#f0f9ff;border-radius:3px;padding:1px 6px;">Doc Required</span>`:""}
              ${item.linkedForm?`<span style="font-size:10px;color:#059669;background:#ecfdf5;border-radius:3px;padding:1px 6px;">📋 ${esc(item.linkedForm)}</span>`:""}
            </div>
          </div>
          <div class="cl-item-actions">
            <button class="btn-icon" title="Edit" onclick="openChecklistModal(${item.id})">✏</button>
            <button class="btn-icon" title="Move Up" onclick="reorderChecklist(${item.id},-1)">↑</button>
            <button class="btn-icon" title="Move Down" onclick="reorderChecklist(${item.id},1)">↓</button>
            <button class="btn-icon" title="Duplicate" onclick="duplicateChecklistItem(${item.id})">⧉</button>
            <button class="btn-icon" title="Archive" onclick="archiveChecklistItem(${item.id})">📦</button>
            <button class="btn-icon" style="color:#dc2626" title="Delete" onclick="deleteChecklistItem(${item.id})">🗑</button>
          </div>
        </div>`).join("")}
    </div>`;
}

function openChecklistModal(id) {
  const item = id ? checklists.find(c=>c.id===id) : null;
  const formOptions = adminForms.filter(f=>f.status==="Active").map(f=>`<option value="${esc(f.name)}"${item?.linkedForm===f.name?" selected":""}>${esc(f.name)}</option>`).join("");
  const delivOptions = adminDeliverables.map(d=>`<option value="${esc(d.name)}"${item?.linkedDeliverable===d.name?" selected":""}>${esc(d.name)}</option>`).join("");
  const body = `
    <div class="form-grid">
      <div class="form-field"><label>Gate *</label><select id="cl_gate">${adminGateTemplates.map(g=>`<option${(item?.gate||activeGateTab)===g?" selected":""}>${esc(g)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Sequence</label><input id="cl_seq" type="number" value="${item?.seq||1}" /></div>
      <div class="form-field span-2"><label>Checklist Name *</label><input id="cl_name" value="${esc(item?.name||"")}" /></div>
      <div class="form-field span-2"><label>Description</label><textarea id="cl_desc">${esc(item?.description||"")}</textarea></div>
      <div class="form-field"><label>Department</label><select id="cl_dept">${adminDepartments.map(d=>`<option${item?.department===d?" selected":""}>${esc(d)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Owner</label><input id="cl_owner" value="${esc(item?.owner||"")}" /></div>
      <div class="form-field"><label>Linked Form</label><select id="cl_form"><option value="">— None —</option>${formOptions}</select></div>
      <div class="form-field"><label>Linked Deliverable</label><select id="cl_deliv"><option value="">— None —</option>${delivOptions}</select></div>
      <div class="form-field"><label style="cursor:pointer;display:flex;align-items:center;gap:8px"><input type="checkbox" id="cl_mandatory" ${item?.mandatory?"checked":""}> Mandatory</label></div>
      <div class="form-field"><label style="cursor:pointer;display:flex;align-items:center;gap:8px"><input type="checkbox" id="cl_docreq" ${item?.docRequired?"checked":""}> Document Required</label></div>
      <div class="form-field"><label style="cursor:pointer;display:flex;align-items:center;gap:8px"><input type="checkbox" id="cl_appreq" ${item?.approvalRequired?"checked":""}> Approval Required</label></div>
    </div>`;
  const footer = `<button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveChecklistItem(${id||"null"})">${item?"Save Changes":"Add Item"}</button>`;
  openModal(item?"Edit Checklist Item":"New Checklist Item", body, footer);
}

function saveChecklistItem(id) {
  const name = document.getElementById("cl_name").value.trim();
  if(!name){ alert("Name is required."); return; }
  const payload = {
    gate: document.getElementById("cl_gate").value,
    seq: +document.getElementById("cl_seq").value,
    name, description: document.getElementById("cl_desc").value.trim(),
    department: document.getElementById("cl_dept").value,
    owner: document.getElementById("cl_owner").value.trim(),
    linkedForm: document.getElementById("cl_form").value||null,
    linkedDeliverable: document.getElementById("cl_deliv").value||null,
    mandatory: document.getElementById("cl_mandatory").checked,
    docRequired: document.getElementById("cl_docreq").checked,
    approvalRequired: document.getElementById("cl_appreq").checked,
    status:"Active",
  };
  if(id){ Object.assign(checklists.find(c=>c.id===id), payload); addAudit("CHECKLIST_UPDATED","Gate Checklist",name,"Updated",null); }
  else { checklists.push({id:nextId(checklists,"id"), ...payload}); addAudit("CHECKLIST_CREATED","Gate Checklist",name,null,"Active"); }
  saveStore(SK.checklists, checklists);
  closeModal();
  renderChecklistItems();
}

function deleteChecklistItem(id) {
  const item = checklists.find(c=>c.id===id); if(!item) return;
  if(!confirm("Delete this checklist item?")) return;
  addAudit("CHECKLIST_DELETED","Gate Checklist",item.name,"Active",null);
  checklists = checklists.filter(c=>c.id!==id);
  saveStore(SK.checklists, checklists);
  renderChecklistItems();
}

function duplicateChecklistItem(id) {
  const item = checklists.find(c=>c.id===id); if(!item) return;
  const copy = {...item, id:nextId(checklists,"id"), name:item.name+" (Copy)", seq:item.seq+0.5};
  checklists.push(copy);
  addAudit("CHECKLIST_DUPLICATED","Gate Checklist",item.name,null,copy.name);
  saveStore(SK.checklists, checklists);
  renderChecklistItems();
}

function reorderChecklist(id, dir) {
  const gateItems = checklists.filter(c=>c.gate===activeGateTab).sort((a,b)=>a.seq-b.seq);
  const idx = gateItems.findIndex(c=>c.id===id);
  const swapIdx = idx + dir;
  if(swapIdx<0 || swapIdx>=gateItems.length) return;
  [gateItems[idx].seq, gateItems[swapIdx].seq] = [gateItems[swapIdx].seq, gateItems[idx].seq];
  addAudit("CHECKLIST_REORDERED","Gate Checklist",`${activeGateTab} reorder`,null,null);
  saveStore(SK.checklists, checklists);
  renderChecklistItems();
}

function archiveChecklistItem(id) {
  const item = checklists.find(c=>c.id===id); if(!item) return;
  item.status = "Archived";
  addAudit("CHECKLIST_ARCHIVED","Gate Checklist",item.name,"Active","Archived");
  saveStore(SK.checklists, checklists);
  renderChecklistItems();
}

function duplicateGateTemplate() {
  const items = checklists.filter(c=>c.gate===activeGateTab);
  const target = prompt("Duplicate " + activeGateTab + " template to gate:", "");
  if(!target || !adminGateTemplates.includes(target)) { alert("Enter a valid gate name: " + adminGateTemplates.join(", ")); return; }
  items.forEach(item=>{ checklists.push({...item, id:nextId(checklists,"id"), gate:target}); });
  addAudit("GATE_TEMPLATE_DUPLICATED","Gate Checklist",activeGateTab,null,target);
  saveStore(SK.checklists, checklists);
  alert("Duplicated to " + target);
}

function archiveGateTemplate() {
  if(!confirm("Archive all active items in " + activeGateTab + "?")) return;
  checklists.filter(c=>c.gate===activeGateTab).forEach(c=>c.status="Archived");
  addAudit("GATE_ARCHIVED","Gate Checklist",activeGateTab,"Active","Archived");
  saveStore(SK.checklists, checklists);
  renderChecklistItems();
}

// ══════════════════════════════════════════════════════════════
//  3. DELIVERABLE MANAGEMENT
// ══════════════════════════════════════════════════════════════
let activeDelivGate = "All";

function renderDeliverables() {
  const el = document.getElementById("adminContent");
  const gates = ["All", ...adminGateTemplates];
  const counts = { All: deliverables.length };
  adminGateTemplates.forEach(g=>{ counts[g]=deliverables.filter(d=>d.gate===g).length; });
  el.innerHTML = `
    <div class="ac-header">
      <div class="ac-header-left"><h1>Deliverable Management</h1><p>Manage master deliverables. Project Managers pick from this library.</p></div>
      <div class="ac-header-right">
        <button class="btn-secondary" onclick="exportDeliverablesCSV()">↗ Export</button>
        <button class="btn-primary" onclick="openDeliverableModal(null)">+ New Deliverable</button>
      </div>
    </div>
    <div class="ac-stats">
      <div class="ac-stat-card"><div class="stat-val">${deliverables.length}</div><div class="stat-lbl">Total Deliverables</div></div>
      <div class="ac-stat-card stat-green"><div class="stat-val">${deliverables.filter(d=>d.status==="Active").length}</div><div class="stat-lbl">Active</div></div>
      <div class="ac-stat-card stat-amber"><div class="stat-val">${deliverables.filter(d=>d.status==="Archived").length}</div><div class="stat-lbl">Archived</div></div>
      <div class="ac-stat-card"><div class="stat-val">${deliverables.filter(d=>d.approvalReq).length}</div><div class="stat-lbl">Require Approval</div></div>
    </div>
    <div class="gate-tabs">
      ${gates.map(g=>`<button class="gate-tab-btn${g===activeDelivGate?" active":""}" onclick="switchDelivGate('${g}')" type="button">${esc(g)} <span style="font-size:10px;opacity:.7">(${counts[g]||0})</span></button>`).join("")}
    </div>
    <div class="ac-toolbar">
      <div class="ac-search"><svg class="ac-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="delivSearch" placeholder="Search deliverables…" oninput="renderDelivTable()" /></div>
      <select class="ac-filter-select" id="delivStatusFilter" onchange="renderDelivTable()"><option value="">All Status</option><option value="Active">Active</option><option value="Archived">Archived</option></select>
    </div>
    <div class="ac-card"><div class="ac-table-wrap">
      <table class="ac-table"><thead><tr>
        <th>ID</th><th>NAME</th><th>GATE</th><th>DEPT</th><th>OWNER</th><th>PRIORITY</th><th>EST. DAYS</th><th>APPROVAL</th><th>STATUS</th><th>ACTIONS</th>
      </tr></thead><tbody id="delivTbody"></tbody></table>
    </div></div>`;
  renderDelivTable();
}

function switchDelivGate(g) {
  activeDelivGate = g;
  document.querySelectorAll(".gate-tab-btn").forEach(b=>b.classList.toggle("active", b.textContent.trim().startsWith(g)));
  renderDelivTable();
}

function renderDelivTable() {
  const q = (document.getElementById("delivSearch")?.value||"").toLowerCase();
  const s = document.getElementById("delivStatusFilter")?.value||"";
  let list = deliverables.filter(d=>
    (activeDelivGate==="All"||d.gate===activeDelivGate) &&
    (!q||d.name.toLowerCase().includes(q)||d.id.toLowerCase().includes(q)) &&
    (!s||d.status===s)
  );
  const tb = document.getElementById("delivTbody");
  if(!tb) return;
  if(!list.length){ tb.innerHTML=`<tr><td colspan="10"><div class="ac-empty"><p>No deliverables found.</p></div></td></tr>`; return; }
  tb.innerHTML = list.map(d=>`
    <tr>
      <td style="font-size:11px;color:#64748b;">${esc(d.id)}</td>
      <td><strong>${esc(d.name)}</strong><br><span style="font-size:11px;color:#94a3b8;">${esc(d.projectType)}</span></td>
      <td><span class="gate-pill">${esc(d.gate)}</span></td>
      <td>${esc(d.dept)}</td>
      <td>${esc(d.owner)}</td>
      <td><span class="prio-${d.priority?.toLowerCase()||"medium"}">${esc(d.priority)}</span></td>
      <td style="text-align:center;">${d.estDuration}d</td>
      <td style="text-align:center;">${d.approvalReq?`<span style="color:#7c3aed;font-weight:700;">Yes</span>`:`<span style="color:#94a3b8;">No</span>`}</td>
      <td><span class="status-pill ${d.status==="Active"?"pill-active":"pill-archived"}"><span class="pill-dot"></span>${esc(d.status)}</span></td>
      <td><div class="td-actions">
        <button class="btn-icon" title="Edit" onclick="openDeliverableModal('${d.id}')">✏</button>
        <button class="btn-icon" title="Clone" onclick="cloneDeliverable('${d.id}')">⧉</button>
        <button class="btn-icon" title="Assign Form" onclick="openFormAssignModal('${d.id}')">📋</button>
        <button class="btn-icon" title="${d.status==="Active"?"Archive":"Restore"}" onclick="toggleDeliverableStatus('${d.id}')">${d.status==="Active"?"📦":"♻"}</button>
        <button class="btn-icon" style="color:#dc2626" title="Delete" onclick="deleteDeliverable('${d.id}')">🗑</button>
      </div></td>
    </tr>`).join("");
}

function openDeliverableModal(did) {
  const d = did ? deliverables.find(x=>x.id===did) : null;
  const formOptions = adminForms.filter(f=>f.status==="Active").map(f=>`<option value="${esc(f.name)}"${d?.linkedForm===f.name?" selected":""}>${esc(f.name)}</option>`).join("");
  const body = `
    <div class="form-grid">
      <div class="form-field"><label>Deliverable ID *</label><input id="dv_id" value="${esc(d?.id||nextStrId(deliverables,"id","DLV"))}" ${d?"readonly":""} /></div>
      <div class="form-field"><label>Name *</label><input id="dv_name" value="${esc(d?.name||"")}" /></div>
      <div class="form-field span-2"><label>Description</label><textarea id="dv_desc">${esc(d?.description||"")}</textarea></div>
      <div class="form-field"><label>Project Type</label><select id="dv_type"><option${d?.projectType==="All"?" selected":""}>All</option><option${d?.projectType==="BB"?" selected":""}>BB</option><option${d?.projectType==="N-BB"?" selected":""}>N-BB</option></select></div>
      <div class="form-field"><label>Applicable Gate *</label><select id="dv_gate">${adminGateTemplates.map(g=>`<option${d?.gate===g?" selected":""}>${esc(g)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Department</label><select id="dv_dept">${adminDepartments.map(x=>`<option${d?.dept===x?" selected":""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Owner</label><input id="dv_owner" value="${esc(d?.owner||"")}" /></div>
      <div class="form-field"><label>Priority</label><select id="dv_prio"><option${d?.priority==="High"?" selected":""}>High</option><option${d?.priority==="Medium"?" selected":""}>Medium</option><option${d?.priority==="Low"?" selected":""}>Low</option></select></div>
      <div class="form-field"><label>Est. Duration (days)</label><input id="dv_dur" type="number" value="${d?.estDuration||7}" /></div>
      <div class="form-field span-2"><label>Linked Form</label><select id="dv_form"><option value="">— None —</option>${formOptions}</select></div>
      <div class="form-field span-2"><label>Mandatory Documents (comma-separated)</label><input id="dv_docs" value="${(d?.mandatoryDocs||[]).join(", ")}" /></div>
      <div class="form-field"><label style="cursor:pointer;display:flex;align-items:center;gap:8px"><input type="checkbox" id="dv_appr" ${d?.approvalReq?"checked":""}> Approval Required</label></div>
    </div>`;
  const footer = `<button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveDeliverable('${did||""}')">${d?"Save Changes":"Create Deliverable"}</button>`;
  openModal(d?"Edit Deliverable":"New Deliverable", body, footer, "modal-lg");
}

function saveDeliverable(did) {
  const id   = document.getElementById("dv_id").value.trim();
  const name = document.getElementById("dv_name").value.trim();
  if(!id||!name){ alert("ID and Name are required."); return; }
  const payload = {
    id, name, description:document.getElementById("dv_desc").value.trim(),
    projectType:document.getElementById("dv_type").value,
    gate:document.getElementById("dv_gate").value,
    dept:document.getElementById("dv_dept").value,
    owner:document.getElementById("dv_owner").value.trim(),
    priority:document.getElementById("dv_prio").value,
    estDuration:+document.getElementById("dv_dur").value,
    linkedForm:document.getElementById("dv_form").value||null,
    mandatoryDocs:document.getElementById("dv_docs").value.split(",").map(s=>s.trim()).filter(Boolean),
    approvalReq:document.getElementById("dv_appr").checked,
    status:"Active",
  };
  if(did){ const idx=deliverables.findIndex(x=>x.id===did); if(idx>-1){ deliverables[idx]={...deliverables[idx],...payload}; } addAudit("DELIVERABLE_EDITED","Deliverable Management",name,did,null); }
  else { deliverables.push(payload); addAudit("DELIVERABLE_CREATED","Deliverable Management",name,null,"Active"); }
  saveStore(SK.deliverables, deliverables);
  closeModal();
  renderDeliverables();
}

function cloneDeliverable(did) {
  const d = deliverables.find(x=>x.id===did); if(!d) return;
  const copy = {...d, id:nextStrId(deliverables,"id","DLV"), name:d.name+" (Copy)"};
  deliverables.push(copy);
  addAudit("DELIVERABLE_CLONED","Deliverable Management",d.name,null,copy.id);
  saveStore(SK.deliverables, deliverables);
  renderDeliverables();
}

function toggleDeliverableStatus(did) {
  const d = deliverables.find(x=>x.id===did); if(!d) return;
  d.status = d.status==="Active"?"Archived":"Active";
  addAudit(d.status==="Archived"?"DELIVERABLE_ARCHIVED":"DELIVERABLE_RESTORED","Deliverable Management",d.name,d.status==="Archived"?"Active":"Archived",d.status);
  saveStore(SK.deliverables, deliverables);
  renderDeliverables();
}

function deleteDeliverable(did) {
  const d = deliverables.find(x=>x.id===did); if(!d) return;
  if(!confirm("Delete deliverable "+d.name+"?")) return;
  deliverables = deliverables.filter(x=>x.id!==did);
  addAudit("DELIVERABLE_DELETED","Deliverable Management",d.name,"Active",null);
  saveStore(SK.deliverables, deliverables);
  renderDeliverables();
}

function openFormAssignModal(did) {
  const d = deliverables.find(x=>x.id===did); if(!d) return;
  const assigned = formMappings.filter(m=>m.deliverableId===did).map(m=>m.formId);
  const formOptions = adminForms.filter(f=>f.status==="Active").map(f=>`
    <label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;">
      <input type="checkbox" value="${esc(f.id)}" ${assigned.includes(f.id)?"checked":""}>
      <div><div style="font-size:13px;font-weight:600">${esc(f.name)}</div><div style="font-size:11px;color:#94a3b8">${esc(f.category)}</div></div>
    </label>`).join("");
  const body = `<p style="font-size:13px;color:#374151;margin:0 0 16px">Select forms to link with <strong>${esc(d.name)}</strong>. Forms are reusable — the same form can link to multiple deliverables.</p>${formOptions}`;
  const footer = `<button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveFormAssignments('${did}')">Save Assignments</button>`;
  openModal("Assign Forms — " + d.name, body, footer, "modal-lg");
}

function saveFormAssignments(did) {
  const checked = [...document.querySelectorAll("#modalBody input[type=checkbox]:checked")].map(c=>c.value);
  formMappings = formMappings.filter(m=>m.deliverableId!==did);
  checked.forEach(fid=>formMappings.push({deliverableId:did, formId:fid}));
  addAudit("FORM_MAPPING_UPDATED","Deliverable Management",did,null,checked.length+" forms");
  saveStore(SK.formMappings, formMappings);
  closeModal();
}

function exportDeliverablesCSV() {
  const keys=["id","name","gate","dept","owner","priority","estDuration","status"];
  const csv=[keys.join(","),...deliverables.map(d=>keys.map(k=>`"${d[k]||""}"`).join(","))].join("\n");
  const a=Object.assign(document.createElement("a"),{href:"data:text/csv;charset=utf-8,"+encodeURIComponent(csv),download:"deliverables-export.csv"});
  a.click();
}
