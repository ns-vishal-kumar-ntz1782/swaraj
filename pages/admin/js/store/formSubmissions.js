// FormSubmission: real entity backing Save Draft / Submit / Review / Approve flows.
import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { uid, nowIso } from "../utils.js";
import { addAuditEntry } from "./audit.js";
import { notify } from "./notifications.js";
import { can } from "../rbac.js";
import { listRoleNames } from "./roles.js";
import { listUsers } from "./users.js";

function userIdByName(name) {
  const u = listUsers().find((x) => x.name === name);
  return u ? u.id : null;
}

function all() { return load(ENTITY_KEYS.FORM_SUBMISSIONS, []); }
function persist(list) { save(ENTITY_KEYS.FORM_SUBMISSIONS, list); }

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.FORM_SUBMISSIONS, () => []);
}

export function listSubmissions(filters = {}) {
  let list = all();
  const { formCode, projectCode, deliverableNo, filledBy, status } = filters;
  if (formCode) list = list.filter((s) => s.formCode === formCode);
  if (projectCode) list = list.filter((s) => s.projectCode === projectCode);
  if (deliverableNo) list = list.filter((s) => s.deliverableNo === deliverableNo);
  if (filledBy) list = list.filter((s) => s.filledBy === filledBy);
  if (status) list = list.filter((s) => s.status === status);
  return list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
}

export function getSubmission(id) {
  return all().find((s) => s.id === id) || null;
}

function rolesWithButton(buttonId) {
  return listRoleNames().filter((role) => can(role, buttonId));
}

export function saveDraft(data, actor, actorRole) {
  const list = all();
  if (data.id) {
    const idx = list.findIndex((s) => s.id === data.id);
    if (idx === -1) throw new Error("Submission not found.");
    if (list[idx].status !== "Draft") throw new Error("Only a Draft submission can be edited.");
    const before = { ...list[idx] };
    list[idx] = { ...list[idx], values: data.values, projectCode: data.projectCode, deliverableNo: data.deliverableNo };
    persist(list);
    addAuditEntry({ actor, actorRole, action: "SaveDraft", entityType: "FormSubmission", entityId: list[idx].id, projectCode: list[idx].projectCode, summary: `Draft saved for form ${list[idx].formCode}`, before, after: list[idx] });
    return list[idx];
  }
  const submission = {
    id: uid("sub"), formCode: data.formCode, projectCode: data.projectCode || "", deliverableNo: data.deliverableNo || "",
    filledBy: actor, values: data.values || {}, status: "Draft", submittedAt: "", approvals: [],
  };
  list.push(submission);
  persist(list);
  addAuditEntry({ actor, actorRole, action: "SaveDraft", entityType: "FormSubmission", entityId: submission.id, projectCode: submission.projectCode, summary: `Draft created for form ${submission.formCode}`, before: null, after: submission });
  return submission;
}

export function submitSubmission(id, actor, actorRole, comments) {
  const list = all();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Submission not found.");
  if (!["Draft", "Rejected"].includes(list[idx].status)) throw new Error("Only a Draft or Rejected submission can be submitted.");
  const before = { ...list[idx] };
  list[idx].status = "Submitted";
  list[idx].submittedAt = nowIso();
  list[idx].approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Submitted", timestamp: nowIso(), comments: comments || "" });
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Submit", entityType: "FormSubmission", entityId: id, projectCode: list[idx].projectCode, summary: `Form ${list[idx].formCode} submission submitted by ${actor}`, before, after: list[idx] });
  rolesWithButton("form.submission.approve").forEach((role) => {
    notify({ toRole: role, title: "Form submission awaiting review", message: `${list[idx].formCode} submitted by ${actor} needs review.`, entityType: "FormSubmission", entityId: id, route: `#/forms/submission/${id}` });
  });
  return list[idx];
}

export function startReview(id, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Submission not found.");
  if (list[idx].status !== "Submitted") throw new Error("Only a Submitted submission can move to review.");
  const before = { ...list[idx] };
  list[idx].status = "UnderReview";
  persist(list);
  addAuditEntry({ actor, actorRole, action: "StartReview", entityType: "FormSubmission", entityId: id, projectCode: list[idx].projectCode, summary: `Form ${list[idx].formCode} submission moved to review by ${actor}`, before, after: list[idx] });
  return list[idx];
}

export function approveSubmission(id, actor, actorRole, comments) {
  const list = all();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Submission not found.");
  if (!["Submitted", "UnderReview"].includes(list[idx].status)) throw new Error("Only a Submitted or UnderReview submission can be approved.");
  const before = { ...list[idx] };
  list[idx].status = "Approved";
  list[idx].approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Approved", timestamp: nowIso(), comments: comments || "" });
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Approve", entityType: "FormSubmission", entityId: id, projectCode: list[idx].projectCode, summary: `Form ${list[idx].formCode} submission approved by ${actor}`, before, after: list[idx] });
  const fillerId = userIdByName(list[idx].filledBy);
  if (fillerId) notify({ toUserId: fillerId, title: "Submission approved", message: `Your ${list[idx].formCode} submission was approved.`, entityType: "FormSubmission", entityId: id, route: `#/forms/submission/${id}` });
  return list[idx];
}

export function rejectSubmission(id, actor, actorRole, comments) {
  const list = all();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Submission not found.");
  if (!["Submitted", "UnderReview"].includes(list[idx].status)) throw new Error("Only a Submitted or UnderReview submission can be rejected.");
  const before = { ...list[idx] };
  list[idx].status = "Rejected";
  list[idx].approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Rejected", timestamp: nowIso(), comments: comments || "" });
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Reject", entityType: "FormSubmission", entityId: id, projectCode: list[idx].projectCode, summary: `Form ${list[idx].formCode} submission rejected by ${actor}`, before, after: list[idx] });
  const fillerId = userIdByName(list[idx].filledBy);
  if (fillerId) notify({ toUserId: fillerId, title: "Submission rejected", message: `Your ${list[idx].formCode} submission was rejected — please review comments.`, entityType: "FormSubmission", entityId: id, route: `#/forms/submission/${id}` });
  return list[idx];
}
