# LDVELH3

Bibliothèque web statique pour les livres dont vous êtes le héros.

## Fonctionnalités

- Navigation par séries, univers et catégories.
- Recherche plein texte.
- Tri par défaut, année, note, ou titre.
- Vue `formats séparés` et vue `éditions regroupées`.
- Fiche détaillée avec couverture, métadonnées et toutes les parutions.

## Fichiers

- `index.html` : interface et logique de rendu.
- `library.json` : catalogue de livres, séries et éditions.
- `assets/covers/` : couvertures du catalogue.

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://127.0.0.1:8000`.

## Notes

- Les couvertures sont chargées depuis `assets/covers/small/` et `assets/covers/medium/`.
- En vue regroupée, les cartes récupèrent la première parution disponible pour afficher une image.
- Le dossier `pdf/` est un artefact local généré; il peut rester hors versionnage.
