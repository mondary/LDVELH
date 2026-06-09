# LDVELH3

[🇬🇧 EN](README_en.md) · [🇫🇷 FR](README.md)

Interactive web library for gamebooks (LDVELH).
Built-in reader with decision tree, text-to-speech, edit mode, and save/restore.

## Features

### Library (`src/index.html`)
- Browse by series, universe, and category.
- Full-text search.
- Sort by default order, year, rating, or title.
- Detailed item view with cover, metadata, and all editions.
- Direct link to the interactive reader.

### Reader (`src/reader.html`)
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

## Usage

```bash
node server/server.js
```

Then open `http://localhost:5432`.

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/books/:isbn` | Full book (modified text if exists, else original) |
| PUT | `/api/books/:isbn/sections/:id` | Save a modified section |
| PUT | `/api/books/:isbn/reset-section/:id` | Restore original section |
| POST | `/api/books/:isbn/reset` | Restore entire book |
| GET | `/api/books/:isbn/export` | Export modified book as JSON |

## Structure

```
server/
  server.js          Node.js server + SQLite
  ldvelh.db          Database (auto-created)
  package.json
src/
  index.html          Library
  reader.html         Interactive reader
  data/
    library.json      Book catalog
    readers/          Per-book JSON (imported on first launch)
      9782070333707.json
  assets/
    covers/           Covers
    pdf/              Book PDFs
```

## Adding a book

1. Create a JSON file in `src/data/readers/` named by ISBN (e.g. `9782070333707.json`).
2. Format: `{ "bookId": "...", "title": "...", "pdf": "/assets/pdf/path/to/file.pdf", "sections": [{ "id": 1, "text": "...", "choices": [{ "to": 2, "label": "..." }] }] }`. The `pdf` field is optional and enables the PDF button in the reader.
3. Restart the server: it auto-imports new JSON files.
4. The book is accessible via `reader.html?book=ISBN`.

## Changelog

- [0.22] - Fix overlay graph (loops no longer truncate path), PDF drawer with pageMap, choice reordering in edit mode
- [0.21] - Sticky header, PDF button, line breaks in paragraphs, DB import update
- [0.20] - Generic interactive reader, SQLite server, in-db editing, save export/import
- [0.11] - Merged decision tree
- [0.10] - 2026-06-09 : Initial project scaffold
