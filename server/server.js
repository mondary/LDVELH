const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  DatabaseSync,
} = require("node:sqlite");

const PORT = 5432;
const ADMIN_PASSWORD = process.env.LDVELH_ADMIN || "ldvelh";
const ADMIN_EMAIL = process.env.LDVELH_EMAIL || "";
const SRC = path.join(__dirname, "..", "src");
const DB_PATH = path.join(__dirname, "ldvelh.db");
const READERS_DIR = path.join(SRC, "data", "readers");
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
    isbn TEXT PRIMARY KEY,
    book_id TEXT,
    title TEXT,
    subtitle TEXT,
    metadata TEXT
  );
  CREATE TABLE IF NOT EXISTS sections (
    isbn TEXT NOT NULL,
    section_id INTEGER NOT NULL,
    text_original TEXT,
    text_modified TEXT,
    choices_original TEXT,
    choices_modified TEXT,
    PRIMARY KEY (isbn, section_id),
    FOREIGN KEY (isbn) REFERENCES books(isbn)
  );
`);

function importJsonFiles() {
  const stmtBook = db.prepare(
    "INSERT OR IGNORE INTO books (isbn, book_id, title, subtitle, metadata) VALUES (?, ?, ?, ?, ?)"
  );
  const stmtSection = db.prepare(
    "INSERT OR REPLACE INTO sections (isbn, section_id, text_original, choices_original) VALUES (?, ?, ?, ?)"
  );

  let imported = 0;
  const files = fs.readdirSync(READERS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const isbn = file.replace(".json", "");
    const raw = fs.readFileSync(path.join(READERS_DIR, file), "utf-8");
    const json = JSON.parse(raw);

    const meta = { ...json };
    delete meta.sections;

    stmtBook.run(
      isbn,
      json.bookId || isbn,
      json.title || isbn,
      json.subtitle || "",
      JSON.stringify(meta)
    );

    db.prepare(
      "UPDATE books SET book_id=?, title=?, subtitle=?, metadata=? WHERE isbn=? AND (book_id IS DISTINCT FROM ? OR title IS DISTINCT FROM ? OR subtitle IS DISTINCT FROM ? OR metadata IS DISTINCT FROM ?)"
    ).run(
      json.bookId || isbn,
      json.title || isbn,
      json.subtitle || "",
      JSON.stringify(meta),
      isbn,
      json.bookId || isbn,
      json.title || isbn,
      json.subtitle || ""
    );

    if (json.sections) {
      for (const s of json.sections) {
        stmtSection.run(
          isbn,
          s.id,
          s.text || "",
          JSON.stringify(s.choices || [])
        );
      }
    }
    imported++;
  }
  return imported;
}

const count = importJsonFiles();
console.log(`Importé/mis à jour : ${count} livre(s)`);

if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });

function getBook(isbn) {
  const row = db.prepare("SELECT * FROM books WHERE isbn = ?").get(isbn);
  if (!row) return null;
  const meta = JSON.parse(row.metadata || "{}");
  const sections = db
    .prepare("SELECT * FROM sections WHERE isbn = ? ORDER BY section_id")
    .all(isbn);
  return {
    isbn: row.isbn,
    bookId: row.book_id,
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

function saveSection(isbn, sectionId, text, choices) {
  const existing = db
    .prepare("SELECT text_original, choices_original FROM sections WHERE isbn = ? AND section_id = ?")
    .get(isbn, sectionId);

  if (!existing) {
    db.prepare(
      "INSERT INTO sections (isbn, section_id, text_original, text_modified, choices_original, choices_modified) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(isbn, sectionId, text, text, JSON.stringify(choices), JSON.stringify(choices));
  } else {
    db.prepare(
      "UPDATE sections SET text_modified = ?, choices_modified = ? WHERE isbn = ? AND section_id = ?"
    ).run(text, JSON.stringify(choices), isbn, sectionId);
  }
}

function resetSection(isbn, sectionId) {
  db.prepare(
    "UPDATE sections SET text_modified = NULL, choices_modified = NULL WHERE isbn = ? AND section_id = ?"
  ).run(isbn, sectionId);
}

function resetBook(isbn) {
  db.prepare(
    "UPDATE sections SET text_modified = NULL, choices_modified = NULL WHERE isbn = ?"
  ).run(isbn);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(SRC, urlPath === "/" ? "/index.html" : urlPath);
  fp = path.resolve(fp);
  if (!fp.startsWith(SRC)) {
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] === "api" && parts[1] === "books" && parts[2]) {
    const isbn = parts[2];

    if (req.method === "GET" && !parts[3]) {
      const book = getBook(isbn);
      if (!book) return json(res, 404, { error: "Livre non trouvé" });
      return json(res, 200, book);
    }

    if (req.method === "GET" && parts[3] === "export") {
      const book = getBook(isbn);
      if (!book) return json(res, 404, { error: "Livre non trouvé" });
      const exportData = {
        bookId: book.bookId,
        title: book.title,
        subtitle: book.subtitle,
        sections: book.sections.map((s) => ({
          id: s.id,
          text: s.text,
          choices: s.choices,
        })),
      };
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${isbn}.json"`,
      });
      res.end(JSON.stringify(exportData, null, 2));
      return;
    }

    if (req.method === "PUT" && parts[3] === "sections" && parts[4]) {
      const sectionId = parseInt(parts[4]);
      const body = JSON.parse(await readBody(req));
      saveSection(isbn, sectionId, body.text, body.choices);
      return json(res, 200, { ok: true });
    }

    if (req.method === "PUT" && parts[3] === "reset-section" && parts[4]) {
      resetSection(isbn, parseInt(parts[4]));
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && parts[3] === "reset") {
      resetBook(isbn);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && parts[3] === "promote") {
      const body = JSON.parse(await readBody(req));
      if (body.password !== ADMIN_PASSWORD) return json(res, 403, { error: "Mot de passe incorrect" });
      const book = getBook(isbn);
      if (!book) return json(res, 404, { error: "Livre non trouvé" });
      const exportData = {
        bookId: book.bookId,
        title: book.title,
        subtitle: book.subtitle,
      };
      const meta = JSON.parse(
        db.prepare("SELECT metadata FROM books WHERE isbn = ?").get(isbn).metadata || "{}"
      );
      if (meta.pdf) exportData.pdf = meta.pdf;
      if (meta.intro) exportData.intro = meta.intro;
      exportData.sections = book.sections.map((s) => ({
        id: s.id,
        text: s.text,
        choices: s.choices,
      }));
      const filePath = path.join(READERS_DIR, isbn + ".json");
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), "utf-8");
      resetBook(isbn);
      importJsonFiles();
      const modified = book.sections.filter((s) => s.modified).length;
      return json(res, 200, { ok: true, modified: modified });
    }

    if (req.method === "POST" && parts[3] === "request-mod") {
      const book = getBook(isbn);
      if (!book) return json(res, 404, { error: "Livre non trouvé" });
      const modified = book.sections.filter((s) => s.modified);
      if (modified.length === 0) return json(res, 200, { ok: true, message: "Aucune modification en attente" });
      const exportData = {
        bookId: book.bookId,
        title: book.title,
        subtitle: book.subtitle,
        requested: new Date().toISOString(),
        sections: book.sections.map((s) => ({
          id: s.id,
          text: s.text,
          choices: s.choices,
        })),
      };
      const meta = JSON.parse(
        db.prepare("SELECT metadata FROM books WHERE isbn = ?").get(isbn).metadata || "{}"
      );
      if (meta.pdf) exportData.pdf = meta.pdf;
      if (meta.intro) exportData.intro = meta.intro;
      const reqFile = path.join(PENDING_DIR, isbn + "-" + Date.now() + ".json");
      fs.writeFileSync(reqFile, JSON.stringify(exportData, null, 2), "utf-8");
      return json(res, 200, { ok: true, file: path.basename(reqFile), sections: modified.length, adminEmail: ADMIN_EMAIL });
    }

    return json(res, 404, { error: "Route inconnue" });
  }

  serveStatic(req, res);
  } catch(err) {
    console.error("Server error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
  console.log("API :");
  console.log(`  GET    /api/books/:isbn           → livre complet`);
  console.log(`  PUT    /api/books/:isbn/sections/:id → sauvegarder section`);
  console.log(`  PUT    /api/books/:isbn/reset-section/:id → restaurer section`);
  console.log(`  POST   /api/books/:isbn/reset     → restaurer tout le livre`);
  console.log(`  GET    /api/books/:isbn/export     → export JSON modifié`);
});
