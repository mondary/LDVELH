# LDVELH3

[🇬🇧 EN](README_en.md) · [🇫🇷 FR](README.md)

Static web library for gamebook titles.

## ✅ Features
- Browse by series, universe, and category.
- Full-text search.
- Sort by default order, year, rating, or title.
- Separate formats view and grouped editions view.
- Detailed item view with cover, metadata, and all editions.

## 🧠 Usage
- Open `index.html` in a browser.
- Or run a simple local server.

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000`.

## ⚙️ Settings
- `library.json` contains the book, series, and edition catalog.
- `assets/covers/` contains the catalog covers.
- Covers are loaded from `assets/covers/small/` and `assets/covers/medium/`.
- In grouped view, cards use the first available edition to display an image.

## 🧾 Files
- `index.html` : rendering interface and logic.
- `library.json` : book, series, and edition catalog.
- `assets/covers/` : catalog covers.

## 📦 Build & Package
- No build step is required for local use.

## 🧪 Install (Antigravity)
- Open the project in the workspace environment.
- Check that `index.html` renders correctly.
- Verify that covers and metadata load from `library.json`.

## 🧾 Changelog
- [0.10] - 2026-06-09 : initial project scaffold.

## 🔗 Links
- FR README : [README.md](README.md)
