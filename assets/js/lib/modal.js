// ==========================================================
//  MODAL — common modal component, pairs with styles/components.css.
//  New/additive: no existing page calls this yet, so loading this script changes
//  nothing about current behavior. Mirrors the same openModal()/closeModal() shape
//  already proven in pages/admin/js/utils.js, adapted to a plain classic script
//  (no ES modules) so any root-app page can load it with a normal <script> tag.
//
//  Usage:
//    openModal({
//      title: "Confirm",
//      bodyHtml: "<p>Are you sure?</p>",
//      footerHtml: '<button class="btn btn-ghost" data-act="cancel">Cancel</button>' +
//                  '<button class="btn btn-primary" data-act="ok">Confirm</button>',
//      onMount: function (backdrop, close) {
//        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
//        backdrop.querySelector('[data-act="ok"]').addEventListener("click", function () {
//          close();
//        });
//      }
//    });
// ==========================================================

function openModal(opts) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML =
    '<div class="modal ' + (opts.size === "lg" ? "modal-lg" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal-header">' +
        "<h3>" + (opts.title || "") + "</h3>" +
        '<button class="modal-close" type="button" aria-label="Close">✕</button>' +
      "</div>" +
      '<div class="modal-body">' + (opts.bodyHtml || "") + "</div>" +
      (opts.footerHtml ? '<div class="modal-footer">' + opts.footerHtml + "</div>" : "") +
    "</div>";
  document.body.appendChild(backdrop);

  function close() { backdrop.remove(); document.removeEventListener("keydown", onKeydown); }
  function onKeydown(e) { if (e.key === "Escape") close(); }

  backdrop.querySelector(".modal-close").addEventListener("click", close);
  backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", onKeydown);

  if (typeof opts.onMount === "function") opts.onMount(backdrop, close);
  return { backdrop: backdrop, close: close };
}

function confirmModal(message) {
  return new Promise(function (resolve) {
    openModal({
      title: "Please confirm",
      bodyHtml: "<p>" + message + "</p>",
      footerHtml:
        '<button class="btn btn-ghost" data-act="cancel">Cancel</button>' +
        '<button class="btn btn-danger" data-act="ok">Confirm</button>',
      onMount: function (backdrop, close) {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", function () { close(); resolve(false); });
        backdrop.querySelector('[data-act="ok"]').addEventListener("click", function () { close(); resolve(true); });
      },
    });
  });
}
