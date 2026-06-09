# LDVELH3 📚

[🇫🇷 FR](README.md) · [🇬🇧 EN](README_en.md)

Bibliothèque web statique pour les livres dont vous êtes le héros.

## ✅ Fonctionnalités
- Navigation par séries, univers et catégories.
- Recherche plein texte.
- Tri par défaut, année, note ou titre.
- Vue `formats séparés` et vue `éditions regroupées`.
- Fiche détaillée avec couverture, métadonnées et toutes les parutions.

## 🧠 Utilisation
- Ouvrir `index.html` dans un navigateur.
- Ou lancer un serveur local simple.

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://127.0.0.1:8000`.

## ⚙️ Réglages
- `library.json` contient le catalogue des livres, séries et éditions.
- `assets/covers/` contient les couvertures du catalogue.
- Les couvertures sont chargées depuis `assets/covers/small/` et `assets/covers/medium/`.
- En vue regroupée, les cartes récupèrent la première parution disponible pour afficher une image.

## 🧾 Fichiers
- `index.html` : interface et logique de rendu.
- `library.json` : catalogue de livres, séries et éditions.
- `assets/covers/` : couvertures du catalogue.

## 📦 Build & Package
- Aucun build n'est requis pour l'utilisation locale.

## 🧪 Installation (Antigravity)
- Ouvrir le projet dans l'environnement de travail.
- Vérifier que `index.html` s'affiche correctement.
- Contrôler que les couvertures et les métadonnées se chargent depuis `library.json`.

## 🧾 Changelog
- [0.10] - 2026-06-09 : initial project scaffold.

## 🔗 Liens
- EN README : [README_en.md](README_en.md)
