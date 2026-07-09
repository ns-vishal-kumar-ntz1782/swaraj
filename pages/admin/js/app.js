import { ensureSeeded as seedUsers } from "./store/users.js";
import { ensureSeeded as seedRbac } from "./rbac.js";
import { ensureSeeded as seedGateTemplates } from "./store/gateTemplates.js";
import { ensureSeeded as seedGates } from "./store/gates.js";
import { ensureSeeded as seedDeliverables } from "./store/deliverables.js";
import { ensureSeeded as seedForms } from "./store/forms.js";
import { ensureSeeded as seedFormSubmissions } from "./store/formSubmissions.js";
import { ensureSeeded as seedActions } from "./store/actions.js";

import { registerRoute, startRouter } from "./router.js";

import { renderForbidden } from "./views/forbidden.js";
import { renderGateList, renderGateWorkspace } from "./views/gates.js";
import { renderGateTemplates } from "./views/gateTemplates.js";
import { renderDeliverableLibrary, renderDeliverableDetail } from "./views/deliverables.js";
import { renderFormsLibrary, renderFormBuilder, renderFormFill, renderSubmissionDetail } from "./views/forms.js";
import { renderUsersAdmin } from "./views/users.js";
import { renderRbacAdmin } from "./views/rbacAdmin.js";
import { renderActions } from "./views/actions.js";
import { renderAudit } from "./views/audit.js";
import { refreshNotifBadge } from "./views/shell.js";

function seedAll() {
  seedUsers();
  seedRbac();
  seedGateTemplates();
  seedGates();
  seedDeliverables();
  seedForms();
  seedFormSubmissions();
  seedActions();
}

function registerRoutes() {
  registerRoute("/forbidden", null, renderForbidden);
  registerRoute("/gates", "gates", renderGateList);
  registerRoute("/gates/:id", "gates", renderGateWorkspace);
  registerRoute("/gate-templates", "gate-templates", renderGateTemplates);
  registerRoute("/deliverables", "deliverables", renderDeliverableLibrary);
  registerRoute("/deliverables/:no", "deliverables", renderDeliverableDetail);
  registerRoute("/forms", "forms", renderFormsLibrary);
  registerRoute("/form-builder", "form-builder", renderFormBuilder);
  registerRoute("/forms/fill/:code", "forms", renderFormFill);
  registerRoute("/forms/submission/:id", "forms", renderSubmissionDetail);
  registerRoute("/users", "users", renderUsersAdmin);
  registerRoute("/rbac-admin", "rbac-admin", renderRbacAdmin);
  registerRoute("/actions", "actions", renderActions);
  registerRoute("/audit", "audit", renderAudit);
}

function bootstrap() {
  seedAll();
  registerRoutes();
  startRouter();
  setInterval(refreshNotifBadge, 5000);
}

// Guard against DOMContentLoaded already having fired by the time this module executes
// (e.g. if the script is ever injected dynamically instead of parsed statically).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
