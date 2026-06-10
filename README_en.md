# LDVELH3

[🇬🇧 EN](README_en.md) · [🇫🇷 FR](README.md)

Interactive web library for gamebooks (LDVELH).
Built-in reader with decision tree, text-to-speech, edit mode, and save/restore.

## Features

### Library (`index.html`)
- Browse by series, universe, and category.
- Full-text search.
- Sort by default order, year, rating, or title.
- Detailed item view with cover, metadata, and all editions.
- Direct link to the interactive reader.

### Reader (`reader.html`)
- Interactive reading with SVG decision tree.
- Text-to-speech (TTS) in French with voice and speed controls.
- Edit mode: modify text and choices, saved to database.
- Sticky header (paragraph number, TTS, edit) always visible on scroll.
- Line breaks supported in paragraphs.
- Session graph (multiple attempts, branches, merges, loops).
- Breadcrumb navigation and back button.
- General notes and per-paragraph notes.
- Save/export and import game state (JSON).
- Direct PDF opening button.
- Back to library button.

### Server (`server/`)
- Node.js server with built-in SQLite (`node:sqlite`, zero dependencies).
- Original and modified data stored separately.
- REST API for section CRUD.

## Static Deployment (FTP)

The app works entirely as static files. To deploy on FTP:

1. Upload `index.html`, `reader.html` and the `src/` directory.
2. The reader loads books directly from JSON files (no server needed).

The Node.js server is only needed for local editing.

## Usage (development)

```bash
node server/server.js
```

Then open `http://localhost:5432`.

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/books` | List all books |
| GET | `/api/books/:bookId` | Full book (modified text if exists, else original) |
| PUT | `/api/books/:bookId/sections/:id` | Save a modified section |
| PUT | `/api/books/:bookId/reset-section/:id` | Restore original section |
| POST | `/api/books/:bookId/reset` | Restore entire book |
| GET | `/api/books/:bookId/export` | Export modified book as JSON |

## Structure

```
index.html              Library (entry point)
reader.html             Interactive reader
server/
  server.js             Node.js server + SQLite
  ldvelh.db             Database (auto-created)
  package.json
src/
  assets/
    covers/             Covers
    pdf/                Book PDFs
  data/
    library.json        Book catalog
    readers/            Per-book JSON (identified by bookId)
      astre-d-or-le-sorcier-majdar.json
```

## Adding a book

1. Create a JSON file in `src/data/readers/` named by book ID (e.g. `astre-d-or-le-sorcier-majdar.json`).
2. Format: `{ "bookId": "astre-d-or-le-sorcier-majdar", "title": "...", "pdf": "/src/assets/pdf/path/to/file.pdf", "sections": [{ "id": 1, "text": "...", "choices": [{ "to": 2, "label": "..." }] }] }`. The `pdf` field is optional.
3. Add the book to `src/data/library.json` with `"hasReader": true`.
4. Restart the server: it auto-imports new JSON files.
5. The book is accessible via `reader.html?book=astre-d-or-le-sorcier-majdar`.

## Changelog

- [0.25] - ISBN→bookId migration, HTML at root, static FTP deployment
- [0.24] - Fix promote (sections updated in DB), show only modified section count
- [0.23] - Submit button (promote with admin password or email request), modification counter, overlay graph without duplicates
- [0.22] - Fix overlay graph (loops no longer truncate path), PDF drawer with pageMap, choice reordering in edit mode
- [0.21] - Sticky header, PDF button, line breaks in paragraphs, DB import update
- [0.20] - Generic interactive reader, SQLite server, in-db editing, save export/import
- [0.11] - Merged decision tree
- [0.10] - 2026-06-09 : Initial project scaffold
