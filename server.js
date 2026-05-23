const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const target = path.join(root, cleanPath || "index.html");

  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(target, (statError, stats) => {
    const filePath = !statError && stats.isDirectory() ? path.join(target, "index.html") : target;
    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Local preview: http://localhost:${port}`);
});
