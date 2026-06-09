# LDVELH3 📚

[🇫🇷 FR](README.md) · [🇬🇧 EN](README_en.md)

Bibliothèque web statique pour les livres dont vous êtes le héros.
La version actuelle met en avant un arbre décisionnel fusionné pour naviguer plus proprement entre les branches.
Le site est servi depuis `src/`.

## ✅ Fonctionnalités
- Navigation par séries, univers et catégories.
- Recherche plein texte.
- Tri par défaut, année, note ou titre.
- Vue `formats séparés` et vue `éditions regroupées`.
- Arbre décisionnel fusionné pour une navigation plus lisible.
- Fiche détaillée avec couverture, métadonnées et toutes les parutions.

## 🧠 Utilisation
- Ouvrir `src/index.html` dans un navigateur via un serveur local.
- Ou lancer un serveur local simple depuis `src/`.

```bash
cd src
python3 -m http.server 8000
```

Puis ouvrir `http://127.0.0.1:8000/`.

## ⚙️ Réglages
- `src/data/library.json` contient le catalogue des livres, séries et éditions.
- `src/assets/covers/` contient les couvertures du catalogue.
- Les couvertures sont chargées depuis `src/assets/covers/small/` et `src/assets/covers/medium/`.
- En vue regroupée, les cartes récupèrent la première parution disponible pour afficher une image.

## 🧾 Fichiers
- `src/index.html` : interface et logique de rendu.
- `src/data/library.json` : catalogue de livres, séries et éditions.
- `src/assets/covers/` : couvertures du catalogue.

## 📦 Build & Package
- Aucun build n'est requis pour l'utilisation locale.

## 🧪 Installation (Antigravity)
- Ouvrir le projet dans l'environnement de travail.
- Vérifier que `src/index.html` s'affiche correctement.
- Contrôler que les couvertures et les métadonnées se chargent depuis `src/data/library.json`.

## 🧾 Changelog
- [0.10] - 2026-06-09 : initial project scaffold.
- [0.11] - arbre décisionnel fusionné.

## 🔗 Liens
- EN README : [README_en.md](README_en.md)
