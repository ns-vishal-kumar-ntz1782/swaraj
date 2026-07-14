// ==========================================================
//  PROJECT DETAIL WORKSPACE BRIDGE — the outer app's Deliverables tab (a plain classic-script
//  page, no ES modules, no localStorage writes of its own) gets real persistence by importing
//  the Admin Console's existing store layer directly, rather than duplicating it. Those store
//  modules are pure data (verified: no window/document/location coupling), so importing them
//  from an unrelated page is safe.
//
//  ES module scripts are deferred by spec — this file finishes executing before DOMContentLoaded
//  fires, which is what project-detail.js's own init() waits for. So by the time init() runs,
//  window.PDWorkspace below is guaranteed to exist — no extra synchronization needed.
// ==========================================================
import {
  ensureSeeded, listAssignments, getAssignment, updateAssignmentStatus, updateAssignmentFields,
  assignResponsibleMembers, uploadDocument, listAddableDeliverables, addDeliverableToGate,
  topLevelAssignmentOptionsFor, setAssignmentParent,
} from "../../../pages/admin/js/store/projectExecution.js";
import { getProjectTeam, displayFor } from "../../../pages/admin/js/store/orgDirectory.js";
import { notify } from "../../../pages/admin/js/store/notifications.js";
import { addAuditEntry, listAuditEntries, listEnterpriseAuditEntries } from "../../../pages/admin/js/store/audit.js";

ensureSeeded(); // idempotent — Project Detail may be opened before the Admin Console ever seeds localStorage

// One deliverable's full history = its live console-audit trail (new edits made through this
// workspace) merged with the pre-existing enterprise seed trail (data/projectAuditLog.json,
// keyed the same way by assignmentId), newest first. Normalized to one common row shape
// ({timestamp, action, summary, actorName}) since the two sources use different field names.
function assignmentHistory(assignmentId, projectCode) {
  const live = listAuditEntries({ entityType: "ProjectDeliverableAssignment" })
    .filter((e) => e.entityId === assignmentId)
    .map((e) => ({ timestamp: e.timestamp, action: e.action, summary: e.summary, actorName: e.actor }));
  const seed = listEnterpriseAuditEntries({ entityType: "DeliverableAssignment", projectCode })
    .filter((e) => e.entityId === assignmentId)
    .map((e) => ({ timestamp: e.timestamp, action: e.action, summary: e.summary, actorName: displayFor(e.actorUserId).name }));
  return [...live, ...seed].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

window.PDWorkspace = {
  listAssignments, getAssignment, updateAssignmentStatus, updateAssignmentFields,
  assignResponsibleMembers, uploadDocument, getProjectTeam, displayFor, notify, addAuditEntry,
  assignmentHistory, listAddableDeliverables, addDeliverableToGate,
  topLevelAssignmentOptionsFor, setAssignmentParent,
};
