// Zero-dependency static file server for local development.
// ES modules (used by the Admin Console) cannot be loaded over file://, so this whole project
// must be served over http — this script is the simplest way to do that with nothing to install.
// Usage: node server.js [port]   (defaults to 5173)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  let filePath = path.normalize(path.join(ROOT, urlPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // A folder requested without a trailing slash (e.g. /pages/admin) still resolves to
      // its index.html, matching how every relative link in this project is written.
      if (err.code === "ENOENT" && !path.extname(filePath)) {
        const withIndex = path.join(filePath, "index.html");
        fs.readFile(withIndex, (err2, data2) => {
          if (err2) return notFound(res, urlPath);
          send(res, withIndex, data2);
        });
        return;
      }
      notFound(res, urlPath);
      return;
    }
    send(res, filePath, data);
  });
});

function send(res, filePath, data) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(data);
}

function notFound(res, urlPath) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found: " + urlPath);
}

server.listen(PORT, () => {
  console.log(`SNPD running at http://localhost:${PORT}/login.html`);
  console.log("Press Ctrl+C to stop.");
});
