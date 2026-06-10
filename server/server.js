const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  DatabaseSync,
} = require("node:sqlite");

const PORT = 5432;
const ADMIN_PASSWORD = process.env.LDVELH_ADMIN || "ldvelh";
const ADMIN_EMAIL = process.env.LDVELH_EMAIL || "";
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(__dirname, "ldvelh.db");
const READERS_DIR = path.join(ROOT, "src", "data", "readers");
const PENDING_DIR = path.join(__dirname, "pending");

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".json": "application/json",
  ".js": "application/javascript",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
};

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA foreign_keys=ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    book_id TEXT PRIMARY KEY,
    isbn TEXT,
    title TEXT,
    subtitle TEXT,
    metadata TEXT
  );
  CREATE TABLE IF NOT EXISTS sections (
    book_id TEXT NOT NULL,
    section_id INTEGER NOT NULL,
    text_original TEXT,
    text_modified TEXT,
    choices_original TEXT,
    choices_modified TEXT,
    PRIMARY KEY (book_id, section_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id)
  );
`);

function importJsonFiles() {
  const insertBook = db.prepare(
    "INSERT OR IGNORE INTO books (book_id, isbn, title, subtitle, metadata) VALUES (?, ?, ?, ?, ?)"
  );
  const insertSection = db.prepare(
    "INSERT OR REPLACE INTO sections (book_id, section_id, text_original, choices_original) VALUES (?, ?, ?, ?)"
  );
  const updateBook = db.prepare(
    "UPDATE books SET isbn=?, title=?, subtitle=?, metadata=? WHERE book_id=? AND (isbn IS DISTINCT FROM ? OR title IS DISTINCT FROM ? OR subtitle IS DISTINCT FROM ? OR metadata IS DISTINCT FROM ?)"
  );

  let imported = 0;
  const files = fs.readdirSync(READERS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const bookId = file.replace(".json", "");
    const raw = fs.readFileSync(path.join(READERS_DIR, file), "utf-8");
    const data = JSON.parse(raw);
    const meta = { ...data };
    delete meta.sections;

    const isbn = data.isbn || bookId;
    const title = data.title || bookId;
    const subtitle = data.subtitle || "";

    insertBook.run(bookId, isbn, title, subtitle, JSON.stringify(meta));
    updateBook.run(isbn, title, subtitle, JSON.stringify(meta), bookId, isbn, title, subtitle);

    if (data.sections) {
      for (const s of data.sections) {
        insertSection.run(bookId, s.id, s.text || "", JSON.stringify(s.choices || []));
      }
    }
    imported++;
  }
  return imported;
}

const count = importJsonFiles();
console.log(`Import\u00e9/mis \u00e0 jour : ${count} livre(s)`);

if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });

function getBook(id) {
  let row = db.prepare("SELECT * FROM books WHERE book_id = ?").get(id);
  if (!row) row = db.prepare("SELECT * FROM books WHERE isbn = ?").get(id);
  if (!row) row = db.prepare("SELECT * FROM books WHERE title = ?").get(id);
  if (!row) return null;
  const meta = JSON.parse(row.metadata || "{}");
  const sections = db
    .prepare("SELECT * FROM sections WHERE book_id = ? ORDER BY section_id")
    .all(row.book_id);
  return {
    bookId: row.book_id,
    isbn: row.isbn,
    title: row.title,
    subtitle: row.subtitle,
    ...meta,
    metadata: undefined,
    sections: sections.map((s) => ({
      id: s.section_id,
      text_original: s.text_original,
      text: s.text_modified || s.text_original,
      choices_original: JSON.parse(s.choices_original || "[]"),
      choices: s.choices_modified
        ? JSON.parse(s.choices_modified)
        : JSON.parse(s.choices_original || "[]"),
      modified: !!s.text_modified || !!s.choices_modified,
    })),
  };
}

function saveSection(bookId, sectionId, text, choices) {
  const existing = db
    .prepare("SELECT text_original, choices_original FROM sections WHERE book_id = ? AND section_id = ?")
    .get(bookId, sectionId);
  if (!existing) {
    db.prepare(
      "INSERT INTO sections (book_id, section_id, text_original, text_modified, choices_original, choices_modified) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(bookId, sectionId, text, text, JSON.stringify(choices), JSON.stringify(choices));
  } else {
    db.prepare(
      "UPDATE sections SET text_modified = ?, choices_modified = ? WHERE book_id = ? AND section_id = ?"
    ).run(text, JSON.stringify(choices), bookId, sectionId);
  }
}

function resetSection(bookId, sectionId) {
  db.prepare(
    "UPDATE sections SET text_modified = NULL, choices_modified = NULL WHERE book_id = ? AND section_id = ?"
  ).run(bookId, sectionId);
}

function resetBook(bookId) {
  db.prepare(
    "UPDATE sections SET text_modified = NULL, choices_modified = NULL WHERE book_id = ?"
  ).run(bookId);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);
  fp = path.resolve(fp);
  if (!fp.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

function json(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "api" && parts[1] === "books") {
      if (!parts[2] && req.method === "GET") {
        const rows = db.prepare("SELECT book_id, isbn, title, subtitle FROM books ORDER BY title").all();
        return json(res, 200, rows);
      }
      if (parts[2]) {
        const id = decodeURIComponent(parts[2]);

        if (req.method === "GET" && !parts[3]) {
          const book = getBook(id);
          if (!book) return json(res, 404, { error: "Livre non trouv\u00e9" });
          return json(res, 200, book);
        }

        if (req.method === "GET" && parts[3] === "export") {
          const book = getBook(id);
          if (!book) return json(res, 404, { error: "Livre non trouv\u00e9" });
          const exportData = {
            bookId: book.bookId,
            title: book.title,
            subtitle: book.subtitle,
            sections: book.sections.map((s) => ({ id: s.id, text: s.text, choices: s.choices })),
          };
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${book.bookId}.json"`,
          });
          res.end(JSON.stringify(exportData, null, 2));
          return;
        }

        if (req.method === "PUT" && parts[3] === "sections" && parts[4]) {
          const body = JSON.parse(readBody(req));
          body.then((b) => {
            saveSection(id, parseInt(parts[4]), b.text, b.choices);
            json(res, 200, { ok: true });
          });
          return;
        }

        if (req.method === "PUT" && parts[3] === "reset-section" && parts[4]) {
          resetSection(id, parseInt(parts[4]));
          return json(res, 200, { ok: true });
        }

        if (req.method === "POST" && parts[3] === "reset") {
          resetBook(id);
          return json(res, 200, { ok: true });
        }

        if (req.method === "POST" && parts[3] === "promote") {
          readBody(req).then((raw) => {
            const body = JSON.parse(raw);
            if (body.password !== ADMIN_PASSWORD) return json(res, 403, { error: "Mot de passe incorrect" });
            const book = getBook(id);
            if (!book) return json(res, 404, { error: "Livre non trouv\u00e9" });
            const exportData = { bookId: book.bookId, title: book.title, subtitle: book.subtitle };
            const meta = JSON.parse(
              db.prepare("SELECT metadata FROM books WHERE book_id = ?").get(id).metadata || "{}"
            );
            if (meta.pdf) exportData.pdf = meta.pdf;
            if (meta.intro) exportData.intro = meta.intro;
            exportData.sections = book.sections.map((s) => ({ id: s.id, text: s.text, choices: s.choices }));
            fs.writeFileSync(path.join(READERS_DIR, book.bookId + ".json"), JSON.stringify(exportData, null, 2), "utf-8");
            resetBook(id);
            importJsonFiles();
            const modified = book.sections.filter((s) => s.modified).length;
            json(res, 200, { ok: true, modified });
          });
          return;
        }

        return json(res, 404, { error: "Route inconnue" });
      }
    }

    serveStatic(req, res);
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`Serveur lanc\u00e9 sur http://localhost:${PORT}`);
});
