# LDVELH3

[🇬🇧 EN](README_en.md) · [🇫🇷 FR](README.md)

Static web library for gamebook titles.
The current version highlights a merged decision tree for cleaner navigation across branches.
The site is served from `src/`.

## ✅ Features
- Browse by series, universe, and category.
- Full-text search.
- Sort by default order, year, rating, or title.
- Separate formats view and grouped editions view.
- Merged decision tree for clearer navigation.
- Detailed item view with cover, metadata, and all editions.

## 🧠 Usage
- Open `src/index.html` in a browser through a local server.
- Or run a simple local server from `src/`.

```bash
cd src
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## ⚙️ Settings
- `src/data/library.json` contains the book, series, and edition catalog.
- `src/assets/covers/` contains the catalog covers.
- Covers are loaded from `src/assets/covers/small/` and `src/assets/covers/medium/`.
- In grouped view, cards use the first available edition to display an image.

## 🧾 Files
- `src/index.html` : rendering interface and logic.
- `src/data/library.json` : book, series, and edition catalog.
- `src/assets/covers/` : catalog covers.

## 📦 Build & Package
- No build step is required for local use.

## 🧪 Install (Antigravity)
- Open the project in the workspace environment.
- Check that `src/index.html` renders correctly.
- Verify that covers and metadata load from `src/data/library.json`.

## 🧾 Changelog
- [0.10] - 2026-06-09 : initial project scaffold.
- [0.11] - merged decision tree.

## 🔗 Links
- FR README : [README.md](README.md)
