import { ensureSeeded as seedRoles } from "./store/roles.js";
import { ensureSeeded as seedUsers } from "./store/users.js";
import { ensureSeeded as seedRbac } from "./rbac.js";
import { ensureSeeded as seedGateMaster } from "./store/gateMasterAdmin.js";
import { ensureSeeded as seedProjectTemplateAdmin } from "./store/projectTemplateAdmin.js";
import { ensureSeeded as seedDeliverables } from "./store/deliverables.js";
import { ensureSeeded as seedForms } from "./store/forms.js";
import { ensureSeeded as seedFormSubmissions } from "./store/formSubmissions.js";
import { ensureSeeded as seedActions } from "./store/actions.js";
import { ensureSeeded as seedAudit } from "./store/audit.js";
import { ensureSeeded as seedProjectExecution } from "./store/projectExecution.js";
import { ensureSeeded as seedOrgUsersAdmin } from "./store/orgUsersAdmin.js";
import { ensureSeeded as seedOrgRolesAdmin } from "./store/orgRolesAdmin.js";
import { ensureSeeded as seedGateChecklistTemplates } from "./store/gateChecklistTemplates.js";

import { registerRoute, startRouter } from "./router.js";

import { renderForbidden } from "./views/forbidden.js";
import { renderGateMaster } from "./views/gateMasterAdmin.js";
import { renderGateChecklistTemplates } from "./views/gateChecklistTemplates.js";
import { renderDeliverableLibrary } from "./views/deliverables.js";
import { renderFormsLibrary, renderFormBuilder, renderFormFill, renderSubmissionDetail } from "./views/forms.js";
import { renderProjectTemplates } from "./views/projectTemplateAdmin.js";
import { renderProjectsList } from "./views/projects.js";
import { renderOrgUsersList } from "./views/orgUsersAdmin.js";
import { renderRbacAdmin } from "./views/rbacAdmin.js";
import { renderAudit } from "./views/audit.js";
import { renderActions } from "./views/actions.js";

function seedAll() {
  // Order matters: roles must exist before users (which assign a businessRole) and RBAC (whose
  // matrix is keyed by role name); deliverables/gate master must exist before project templates
  // and the gate checklist (which reference them); org users must exist before org roles (people
  // counts join against them) and before project execution (userId references).
  seedRoles();
  seedUsers();
  seedRbac();
  seedOrgUsersAdmin();
  seedOrgRolesAdmin();
  seedGateMaster();
  seedGateChecklistTemplates();
  seedDeliverables();
  seedForms();
  seedProjectTemplateAdmin();
  seedFormSubmissions();
  seedActions();
  seedAudit();
  seedProjectExecution();
}

// Registration order mirrors the tab order (data/roles.json's allMenus) purely for readability —
// actual tab order is driven entirely by that config, not by this list.
function registerRoutes() {
  registerRoute("/forbidden", null, renderForbidden);
  registerRoute("/gate-master", "gate-master", renderGateMaster);
  registerRoute("/gates", "gates", renderGateChecklistTemplates);
  registerRoute("/deliverables", "deliverables", renderDeliverableLibrary);
  registerRoute("/forms", "forms", renderFormsLibrary);
  registerRoute("/form-builder", "form-builder", renderFormBuilder);
  registerRoute("/forms/fill/:code", "forms", renderFormFill);
  registerRoute("/forms/submission/:id", "forms", renderSubmissionDetail);
  registerRoute("/project-templates", "project-templates", renderProjectTemplates);
  registerRoute("/projects", "projects", renderProjectsList);
  registerRoute("/users", "users", renderOrgUsersList);
  registerRoute("/rbac-admin", "rbac-admin", renderRbacAdmin);
  registerRoute("/audit", "audit", renderAudit);
  registerRoute("/actions", "actions", renderActions);
}

function bootstrap() {
  seedAll();
  registerRoutes();
  startRouter();
}

// Guard against DOMContentLoaded already having fired by the time this module executes
// (e.g. if the script is ever injected dynamically instead of parsed statically).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
