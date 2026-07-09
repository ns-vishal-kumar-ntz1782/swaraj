import { getActiveUser } from "../store/users.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { escapeHtml } from "../utils.js";

export async function renderForbidden() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Access restricted");
  setActiveMenu(null);
  contentEl().innerHTML = `
    <div class="sg-empty-state sg-forbidden">
      <div class="sg-forbidden-code">403</div>
      <h2>You don't have access to this page</h2>
      <p>Your role (<strong>${escapeHtml(user.businessRole)}</strong>) is not permitted to open this route.
      Ask a System Administrator to update the RBAC matrix if you believe this is incorrect.</p>
      <a class="btn btn-primary" href="#/gates">Back to Gate Master</a>
    </div>
  `;
}
