# LDVELH3

[🇫🇷 FR](README.md) · [🇬🇧 EN](README_en.md)

Bibliothèque web interactive pour les livres dont vous êtes le héros.
Lecteur intégré avec arbre décisionnel, synthèse vocale, mode édition, et sauvegarde/restauration des parties.

## Fonctionnalités

### Bibliothèque (`index.html`)
- Navigation par séries, univers et catégories.
- Recherche plein texte.
- Tri par défaut, année, note ou titre.
- Fiche détaillée avec couverture, métadonnées et toutes les parutions.
- Lien direct vers le lecteur interactif.

### Lecteur (`reader.html`)
- Lecture interactive avec arbre décisionnel SVG.
- Synthèse vocale (TTS) en français avec choix de la voix et de la vitesse.
- Mode édition : modification du texte et des choix, sauvegarde en base.
- Header sticky (numéro de paragraphe, TTS, éditer) toujours visible au scroll.
- Support des retours à la ligne dans les paragraphes.
- Graphique des sessions (tentatives multiples, branches, fusions, boucles).
- Breadcrumb de navigation et retour arrière.
- Notes générales et notes par paragraphe.
- Export/import de sauvegarde de partie (JSON).
- Bouton d'ouverture directe du PDF du livre.
- Bouton retour vers la bibliothèque.

### Serveur (`server/`)
- Serveur Node.js avec SQLite intégré (`node:sqlite`, zéro dépendance).
- Données originales et modifiées conservées séparément.
- API REST pour le CRUD des sections.

## Déploiement statique (FTP)

L'application fonctionne entièrement en statique. Pour déployer sur un FTP :

1. Uploader `index.html`, `reader.html` et le dossier `src/`.
2. Le lecteur charge les livres directement depuis les fichiers JSON (pas besoin du serveur).

Le serveur Node.js est uniquement nécessaire pour l'édition en local.

## Lancement (développement)

```bash
node server/server.js
```

Puis ouvrir `http://localhost:5432`.

## API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/books` | Liste de tous les livres |
| GET | `/api/books/:bookId` | Livre complet (texte modifié si existe, sinon original) |
| PUT | `/api/books/:bookId/sections/:id` | Sauvegarder une section modifiée |
| PUT | `/api/books/:bookId/reset-section/:id` | Restaurer une section originale |
| POST | `/api/books/:bookId/reset` | Restaurer tout le livre |
| GET | `/api/books/:bookId/export` | Exporter le livre modifié en JSON |

## Structure

```
index.html              Bibliothèque (point d'entrée)
reader.html             Lecteur interactif
server/
  server.js             Serveur Node.js + SQLite
  ldvelh.db             Base de données (auto-créée)
  package.json
src/
  assets/
    covers/             Couvertures
    pdf/                PDF des livres
  data/
    library.json        Catalogue des livres
    readers/            JSON par livre (identifié par bookId)
      astre-d-or-le-sorcier-majdar.json
```

## Ajouter un livre

1. Créer un JSON dans `src/data/readers/` nommé par l'ID du livre (ex: `astre-d-or-le-sorcier-majdar.json`).
2. Format : `{ "bookId": "astre-d-or-le-sorcier-majdar", "title": "...", "pdf": "/src/assets/pdf/chemin/vers/fichier.pdf", "sections": [{ "id": 1, "text": "...", "choices": [{ "to": 2, "label": "..." }] }] }`. Le champ `pdf` est optionnel.
3. Ajouter le livre dans `src/data/library.json` avec le champ `"hasReader": true`.
4. Relancer le serveur : il importe automatiquement les nouveaux JSON.
5. Le livre est accessible via `reader.html?book=astre-d-or-le-sorcier-majdar`.

## Changelog

- [0.25] - Migration ISBN→bookId, HTML à la racine, déploiement statique FTP
- [0.24] - Fix promote (sections mises à jour dans la DB), compteur de sections modifiées uniquement
- [0.23] - Bouton Soumettre (promouvoir avec password admin ou demande par email), compteur de modifications, graphe overlay sans doublons
- [0.22] - Fix graphe overlay (boucles ne coupaient plus le parcours), drawer PDF avec pageMap, réordonnancement des choix en édition
- [0.21] - Header sticky, bouton PDF, retours à la ligne dans les paragraphes, import DB mis à jour
- [0.20] - Lecteur interactif générique, serveur SQLite, édition en base, export/import de sauvegardes
- [0.11] - Arbre décisionnel fusionné
- [0.10] - 2026-06-09 : Initial project scaffold
