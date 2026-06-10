# Changelog

## [0.25]
### Changed
- **Migration ISBN → bookId** : les livres sont identifiés par leur ID canonique (ex: `astre-d-or-le-sorcier-majdar`) au lieu de l'ISBN, ce qui permet de gérer plusieurs éditions d'un même livre sans conflit.
- Les fichiers reader sont renommés de `{isbn}.json` vers `{bookId}.json`.
- `index.html` et `reader.html` déplacés à la racine du projet.
- Le lecteur charge les livres directement depuis les fichiers JSON statiques (pas d'API requise).
- Le serveur utilise `bookId` comme clé primaire en base de données.
- `library.json` inclut un champ `hasReader` pour chaque livre.

### Added
- Support du déploiement statique (FTP) : l'application fonctionne sans serveur Node.js.
- Fonction `getReaderBookId()` pour résoudre le bon livre dans un groupe d'éditions.

## [0.20]
### Added
- Lecteur interactif générique (`reader.html`) chargeant les livres via ISBN
- Serveur Node.js avec SQLite (`node:sqlite`, zéro dépendance)
- Mode édition : modification du texte et des choix sauvegardée en base
- Séparation original/modifié dans la base de données
- Synthèse vocale (TTS) en français
- Graphique SVG des sessions (tentatives, branches, fusions, boucles)
- Export/import de sauvegarde de partie
- Notes générales et notes par paragraphe
- API REST pour le CRUD des sections
- Import automatique des JSON au premier lancement du serveur

## [0.11]
### Added
- Arbre décisionnel fusionné

## [0.10] - 2026-06-09
### Added
- Initial project scaffold
