const http = require("http");
const fs = require("fs");
const path = require("path");

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const port = 8791;

http.createServer((req, res) => {
  const filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "text/plain" });
    res.end(data);
  });
}).listen(port, () => console.log(`Serving at http://localhost:${port}`));
