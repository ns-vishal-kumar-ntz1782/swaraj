// ==========================================================
//  AI CHAT WIDGET — sticky, draggable assistant mounted on every page (loaded after
//  app-config.js/auth.js, alongside shared.js). Answers are computed live from the same real
//  seed data every other screen reads (_projects/_deliverables/_projectRisks/_actionRegister
//  from app-config.js) — a local intent-matcher, never fabricated/canned text, since this static
//  site has no backend to safely hold an LLM API key.
// ==========================================================
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ── Real data helpers — every one of these globals comes from app-config.js, loaded on every
  // page before this file, so the assistant behaves identically regardless of which page it's
  // opened from. ──
  const projects     = () => (typeof _projects !== "undefined" ? _projects : []);
  const deliverables = () => (typeof _deliverables !== "undefined" ? _deliverables : []);
  const risks        = () => (typeof _projectRisks !== "undefined" ? _projectRisks : []);
  const issues       = () => (typeof _projectIssues !== "undefined" ? _projectIssues : []);
  const actions      = () => (typeof _actionRegister !== "undefined" ? _actionRegister : []);

  function classificationOf(p) { return p.projectTypeCode === "M6" ? "BB" : "N-BB"; }
  function delayDaysOf(p) { return Math.max(0, p.sopVarianceDays || 0); }
  function statusBandOf(p) {
    const d = delayDaysOf(p);
    if (d <= 15) return "On Track";
    if (d <= 60) return "Delayed";
    return "At Risk";
  }
  function deliverableStats(code) {
    const deliv = deliverables().filter(d => d.projectCode === code);
    const actual = deliv.filter(d => d.status === "Completed").length;
    const planned = deliv.length;
    const delayedCount = deliv.filter(d => (d.delayDays || 0) > 15).length;
    return { actual, planned, delayedCount };
  }
  function findProject(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return projects().find(p => p.code.toLowerCase() === q || p.name.toLowerCase() === q)
        || projects().find(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
        || null;
  }
  function projectLink(p) {
    const href = (typeof appUrl === "function") ? appUrl("pages/project-detail/index.html?id=" + encodeURIComponent(p.code)) : "#";
    return `<a class="aichat-link" href="${esc(href)}">${esc(p.name)}</a>`;
  }
  function statusDotCls(band) { return band === "On Track" ? "aichat-dot-green" : band === "Delayed" ? "aichat-dot-amber" : "aichat-dot-red"; }

  function projectListHtml(list, opts) {
    opts = opts || {};
    if (!list.length) return `<p>${esc(opts.emptyMsg || "No projects match that.")}</p>`;
    const rows = list.slice(0, 10).map(p => {
      const band = statusBandOf(p);
      const stats = deliverableStats(p.code);
      return `<li>
        <span class="aichat-dot ${statusDotCls(band)}"></span>
        ${projectLink(p)}
        <span class="aichat-meta">${esc(p.currentGate || "-")} · ${delayDaysOf(p)}d delay · ${stats.actual}/${stats.planned} deliverables</span>
      </li>`;
    }).join("");
    const more = list.length > 10 ? `<p class="aichat-more">+${list.length - 10} more — ask by name for details.</p>` : "";
    return `<ul class="aichat-plist">${rows}</ul>${more}`;
  }

  // ── Intent engine ──
  function answer(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return { text: "Ask me something — try “help” to see what I can look up." };

    if (/^(hi|hello|hey|yo)\b/.test(q)) {
      return { text: "Hello! I can look up real project status, deliverables, risk, and compliance from this workspace. Try “help” for examples." };
    }
    if (/thank/.test(q)) {
      return { text: "You're welcome! Anything else you'd like to check?" };
    }
    if (/^help\b|what can you do|examples?/.test(q)) {
      return {
        text: "Here's what I can look up (all real, live data):",
        html: `<ul class="aichat-help">
          <li>"critical projects" / "at risk projects"</li>
          <li>"delayed projects" / "on track projects"</li>
          <li>"BB projects" / "N-BB projects"</li>
          <li>"status of Tractor 2" / "PJ01003"</li>
          <li>"deliverables for Tractor 5"</li>
          <li>"open risks for Tractor 1"</li>
          <li>"compliance" — portfolio-wide summary</li>
          <li>"how many projects"</li>
        </ul>`,
      };
    }

    if (/how many project|total project|project count/.test(q)) {
      const all = projects();
      const bb = all.filter(p => classificationOf(p) === "BB").length;
      return { text: `There are ${all.length} projects in total — ${bb} BlockBuster (BB) and ${all.length - bb} Non-BlockBuster (N-BB).` };
    }

    if (/\b(bb|blockbuster)\b/.test(q) && !/n-?bb|non-?blockbuster/.test(q)) {
      const list = projects().filter(p => classificationOf(p) === "BB");
      return { text: `${list.length} BlockBuster (BB) project(s):`, html: projectListHtml(list) };
    }
    if (/n-?bb|non-?blockbuster/.test(q)) {
      const list = projects().filter(p => classificationOf(p) === "N-BB");
      return { text: `${list.length} Non-BlockBuster (N-BB) project(s):`, html: projectListHtml(list) };
    }

    if (/critical|at risk/.test(q)) {
      const list = projects().filter(p => statusBandOf(p) === "At Risk");
      return { text: list.length ? `${list.length} project(s) are Critical / At Risk (>60 days behind plan):` : "No projects are currently At Risk — everything is within 60 days of plan.", html: list.length ? projectListHtml(list) : undefined };
    }
    if (/delayed/.test(q)) {
      const list = projects().filter(p => statusBandOf(p) === "Delayed");
      return { text: list.length ? `${list.length} project(s) are Delayed (15–60 days behind plan):` : "No projects are in the Delayed band right now.", html: list.length ? projectListHtml(list) : undefined };
    }
    if (/on\s*track/.test(q)) {
      const list = projects().filter(p => statusBandOf(p) === "On Track");
      return { text: `${list.length} project(s) are On Track (0–15 days of plan):`, html: projectListHtml(list) };
    }

    if (/compliance/.test(q)) {
      const all = projects();
      const avgProgress = all.length ? Math.round(all.reduce((s, p) => s + (p.overallProgress || 0), 0) / all.length) : 0;
      const onTrack = all.filter(p => statusBandOf(p) === "On Track").length;
      const delayed = all.filter(p => statusBandOf(p) === "Delayed").length;
      const atRisk = all.filter(p => statusBandOf(p) === "At Risk").length;
      return { text: `Portfolio average progress is ${avgProgress}% across ${all.length} projects — ${onTrack} On Track, ${delayed} Delayed, ${atRisk} At Risk.` };
    }

    if (/deliverable/.test(q)) {
      const p = findProject(q.replace(/deliverables?\s*(for|of|in)?/, ""));
      if (p) {
        const stats = deliverableStats(p.code);
        return { text: `${p.name} (${p.code}): ${stats.actual}/${stats.planned} deliverables completed, ${stats.delayedCount} currently delayed (>15 days).` };
      }
      return { text: "Which project? e.g. “deliverables for Tractor 2”." };
    }

    if (/risk/.test(q)) {
      const p = findProject(q.replace(/(open\s*)?risks?\s*(for|of|in)?/, ""));
      if (p) {
        const open = risks().filter(r => r.projectCode === p.code && r.status !== "Closed");
        if (!open.length) return { text: `${p.name} has no open risks right now.` };
        const rows = open.slice(0, 6).map(r => `<li><strong>${esc(r.severity)}</strong> — ${esc(r.title)}</li>`).join("");
        return { text: `${p.name} (${p.code}) has ${open.length} open risk(s):`, html: `<ul class="aichat-help">${rows}</ul>` };
      }
      return { text: "Which project's risks? e.g. “open risks for Tractor 1”." };
    }

    // Direct project lookup by name/code — checked last so keywords above take priority.
    const p = findProject(raw.replace(/status of|tell me about|how is|doing\??/gi, ""));
    if (p) {
      const band = statusBandOf(p);
      const stats = deliverableStats(p.code);
      const openRisks = risks().filter(r => r.projectCode === p.code && r.status !== "Closed").length;
      const openActions = actions().filter(a => a.projectCode === p.code && a.status !== "Closed" && a.status !== "Completed").length;
      return {
        text: `${p.name} (${p.code}) — ${classificationOf(p)}, ${esc(p.platform || "")} platform, gate ${p.currentGate}.`,
        html: `<ul class="aichat-help">
          <li><span class="aichat-dot ${statusDotCls(band)}"></span> ${band} — ${delayDaysOf(p)} day(s) behind plan</li>
          <li>${stats.actual}/${stats.planned} deliverables complete (${stats.delayedCount} delayed)</li>
          <li>${openRisks} open risk(s) · ${openActions} open action item(s)</li>
          <li>${projectLink(p)} for full detail</li>
        </ul>`,
      };
    }

    return { text: "I couldn't match that to a project or a known question. Try a project name/code, or ask “help” for examples." };
  }

  // ── Persisted state (survives page navigation within the same browser session) ──
  const STATE_KEY = "spd.aiChat.v1";
  function loadState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveState(patch) {
    const cur = loadState();
    sessionStorage.setItem(STATE_KEY, JSON.stringify(Object.assign(cur, patch)));
  }

  // ── Icons (same stroke style as the header's AI button — a 4-point sparkle) ──
  const ICON_SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ICON_SEND  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg>';
  const ICON_DRAG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';

  function mount() {
    if (document.getElementById("aichatDock")) return; // never double-mount

    const state = loadState();
    const dock = el("div", "aichat-dock");
    dock.id = "aichatDock";
    if (state.pos) {
      dock.style.left = state.pos.left + "px";
      dock.style.top = state.pos.top + "px";
      dock.style.right = "auto";
      dock.style.bottom = "auto";
    }
    document.body.appendChild(dock);

    const toggleBtn = el("button", "aichat-toggle", `<span class="aichat-toggle-icon">${ICON_SPARK}</span><span class="aichat-toggle-icon aichat-toggle-close">${ICON_CLOSE}</span>`);
    toggleBtn.type = "button";
    toggleBtn.setAttribute("aria-label", "AI Assistant");
    dock.appendChild(toggleBtn);

    const panel = el("div", "aichat-panel");
    panel.hidden = true;
    panel.innerHTML = `
      <div class="aichat-head" id="aichatHead">
        <span class="aichat-drag-handle" title="Drag to move">${ICON_DRAG}</span>
        <div class="aichat-head-title">
          <strong>AI Assistant</strong>
          <span>Live project insights</span>
        </div>
        <button type="button" class="aichat-head-close" id="aichatHeadClose" aria-label="Close">${ICON_CLOSE}</button>
      </div>
      <div class="aichat-messages" id="aichatMessages"></div>
      <div class="aichat-suggestions" id="aichatSuggestions"></div>
      <form class="aichat-inputrow" id="aichatForm">
        <input type="text" id="aichatInput" placeholder="Ask about a project, risk, delay…" autocomplete="off" />
        <button type="submit" class="aichat-send" aria-label="Send">${ICON_SEND}</button>
      </form>`;
    dock.appendChild(panel);

    const messagesEl = panel.querySelector("#aichatMessages");
    const suggestEl  = panel.querySelector("#aichatSuggestions");
    const formEl     = panel.querySelector("#aichatForm");
    const inputEl    = panel.querySelector("#aichatInput");

    function addMessage(role, text, html) {
      const row = el("div", "aichat-msg aichat-msg-" + role);
      row.innerHTML = `<div class="aichat-bubble">${esc(text)}${html ? html : ""}</div>`;
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      const hist = loadState().history || [];
      hist.push({ role, text, html: html || "" });
      saveState({ history: hist.slice(-40) });
    }

    const SUGGESTIONS = ["Critical projects", "BB projects", "Compliance", "Help"];
    function renderSuggestions() {
      suggestEl.innerHTML = "";
      SUGGESTIONS.forEach(s => {
        const chip = el("button", "aichat-chip", esc(s));
        chip.type = "button";
        chip.addEventListener("click", () => { inputEl.value = s; formEl.dispatchEvent(new Event("submit", { cancelable: true })); });
        suggestEl.appendChild(chip);
      });
    }

    function respondTo(text) {
      addMessage("user", text);
      const typing = el("div", "aichat-msg aichat-msg-bot aichat-typing", `<div class="aichat-bubble"><span></span><span></span><span></span></div>`);
      messagesEl.appendChild(typing);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      setTimeout(() => {
        typing.remove();
        const r = answer(text);
        addMessage("bot", r.text, r.html);
      }, 350 + Math.min(400, text.length * 8));
    }

    formEl.addEventListener("submit", e => {
      e.preventDefault();
      const v = inputEl.value.trim();
      if (!v) return;
      inputEl.value = "";
      respondTo(v);
    });

    // ── Restore history, or greet for the first time this session ──
    const savedHistory = state.history || [];
    if (savedHistory.length) {
      savedHistory.forEach(m => {
        const row = el("div", "aichat-msg aichat-msg-" + m.role);
        row.innerHTML = `<div class="aichat-bubble">${esc(m.text)}${m.html || ""}</div>`;
        messagesEl.appendChild(row);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      addMessage("bot", "Hi, I'm your project assistant. I can answer real questions about status, delay, deliverables, and risk across this workspace.");
    }
    renderSuggestions();

    // ── Open / close — always starts closed on a fresh page load (never auto-restored), so the
    // widget is only ever open because the user just clicked it open in this page view. ──
    function setOpen(open) {
      panel.hidden = !open;
      dock.classList.toggle("aichat-open", open);
      if (open) setTimeout(() => inputEl.focus(), 150);
    }
    toggleBtn.addEventListener("click", () => setOpen(panel.hidden));
    panel.querySelector("#aichatHeadClose").addEventListener("click", () => setOpen(false));

    // ── Dragging — mousedown on the toggle icon (closed) or the panel header (open) repositions
    // the whole dock anywhere on screen; position is clamped to stay fully on-screen and persisted. ──
    function startDrag(source, downEvt) {
      downEvt.preventDefault();
      const rect = dock.getBoundingClientRect();
      const startX = downEvt.clientX, startY = downEvt.clientY;
      const startLeft = rect.left, startTop = rect.top;
      let moved = false;
      dock.classList.add("aichat-dragging");

      function onMove(e) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        const maxLeft = window.innerWidth - rect.width - 4;
        const maxTop = window.innerHeight - rect.height - 4;
        const left = Math.min(Math.max(4, startLeft + dx), Math.max(4, maxLeft));
        const top  = Math.min(Math.max(4, startTop + dy), Math.max(4, maxTop));
        dock.style.left = left + "px";
        dock.style.top = top + "px";
        dock.style.right = "auto";
        dock.style.bottom = "auto";
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        dock.classList.remove("aichat-dragging");
        const r = dock.getBoundingClientRect();
        saveState({ pos: { left: r.left, top: r.top } });
        // Only a drag started FROM the toggle button itself produces a spurious trailing click
        // on that same button (mousedown → drag → mouseup all target it) — swallow just that
        // one. A drag started from the header targets a different element on mousedown, so it
        // never generates a stray click on the toggle button; scoping this to `source ===
        // toggleBtn` avoids eating the next *unrelated, legitimate* icon click after a header
        // drag, which was silently no-oping the icon's open/close on the first press.
        if (moved && source === toggleBtn) {
          const stop = ev => { ev.stopPropagation(); toggleBtn.removeEventListener("click", stop, true); };
          toggleBtn.addEventListener("click", stop, true);
        }
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
    toggleBtn.addEventListener("mousedown", e => startDrag(toggleBtn, e));
    panel.querySelector("#aichatHead").addEventListener("mousedown", e => {
      if (e.target.closest(".aichat-head-close")) return;
      startDrag(panel, e);
    });

    // Keep the dock fully on-screen if the window is resized after a drag.
    window.addEventListener("resize", () => {
      if (!dock.style.left) return;
      const r = dock.getBoundingClientRect();
      const left = Math.min(parseFloat(dock.style.left), Math.max(4, window.innerWidth - r.width - 4));
      const top  = Math.min(parseFloat(dock.style.top), Math.max(4, window.innerHeight - r.height - 4));
      dock.style.left = Math.max(4, left) + "px";
      dock.style.top = Math.max(4, top) + "px";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
