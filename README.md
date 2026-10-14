# ZebraOS — Zebra Tape 2

Un faux système d'exploitation rétro, développé en HTML, CSS et JavaScript, publié avec GitHub Pages sur **zebratape2.net**.

## Le seul dossier de contenu

Tous les fichiers visibles sur le bureau viennent de **`STUDIO/BUREAU`**.

- Le bureau démarre vide, sauf les applications système (Poste de travail, ZebraAMP, Panneau de configuration, Gestionnaire Studio en Admin).
- Un dossier ajouté dans `STUDIO/BUREAU` devient une icône sur le bureau.
- Les sous-dossiers et fichiers se consultent dans les fenêtres de l'explorateur.
- Les icônes personnalisées sont lues depuis `icone.png` placé dans chaque dossier, ou `nom.ext.icone.png` à côté d'un fichier.
- Les fichiers `.gitkeep` et les images d'icônes sont masqués.
- À chaque publication sur GitHub, une action régénère **`assets/bureau-index.json`**. ZebraOS récupère cet index sans utiliser l'API GitHub dans le navigateur.

➡️ **[Guide pratique : créer des dossiers et choisir leurs icônes](GUIDE_BUREAU.md)**

## Organisation

- `STUDIO/BUREAU/` : **tout ton contenu public**, géré sur GitHub.
- `assets/bureau-index.json` : index technique généré automatiquement.
- `app.js` : bureau, fenêtres, sessions et applications.
- `github-files.js` : explorateur du bureau public.
- `style.css` : style rétro ZebraOS.
- `wallpaper.js` : fonds d'écran du navigateur.
- `assets/boot-assets-v07.js` : logo et sons de démarrage intégrés.

**Les brouillons stockés autrefois en IndexedDB ne sont pas publiés et ne sont pas effacés par cette mise à jour.** Le nouveau contenu du bureau est géré par GitHub.

## Attention

Le dépôt est public. Le mot de passe de la session Admin est un élément de l'expérience rétro et ne constitue pas une vraie protection serveur. N'y dépose aucun document confidentiel.
