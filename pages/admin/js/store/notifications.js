// One notification schema shared by role-broadcast and user-targeted notifications.
import { load, save, ENTITY_KEYS } from "./db.js";
import { uid, nowIso } from "../utils.js";

function all() {
  return load(ENTITY_KEYS.NOTIFICATIONS, []);
}

// toUserId XOR toRole should be set. route is a hash-router path e.g. "#/gates/G-100-G3".
export function notify({ toUserId = null, toRole = null, title, message, entityType, entityId, route }) {
  const list = all();
  const n = {
    id: uid("ntf"),
    toUserId,
    toRole,
    title,
    message,
    entityType,
    entityId: entityId || "",
    route: route || "",
    createdAt: nowIso(),
    read: false,
  };
  list.unshift(n);
  save(ENTITY_KEYS.NOTIFICATIONS, list);
  return n;
}

export function notificationsFor(user) {
  if (!user) return [];
  return all().filter((n) => n.toUserId === user.id || (n.toRole && n.toRole === user.businessRole));
}

export function unreadCountFor(user) {
  return notificationsFor(user).filter((n) => !n.read).length;
}

export function markRead(id) {
  const list = all();
  const n = list.find((x) => x.id === id);
  if (n) { n.read = true; save(ENTITY_KEYS.NOTIFICATIONS, list); }
}

export function markAllRead(user) {
  const list = all();
  let changed = false;
  list.forEach((n) => {
    if ((n.toUserId === user.id || (n.toRole && n.toRole === user.businessRole)) && !n.read) {
      n.read = true; changed = true;
    }
  });
  if (changed) save(ENTITY_KEYS.NOTIFICATIONS, list);
}
