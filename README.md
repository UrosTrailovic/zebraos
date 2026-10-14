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

## ZebraAMP 3.0 — musique et playlists

- Au lancement, ZebraAMP sélectionne **Zebra Tape 2**. Les morceaux de cette playlist sont lus automatiquement depuis `STUDIO/BUREAU/Zebra Tape 2/`, y compris ses sous-dossiers. Il n'y a plus de neuf emplacements fictifs.
- Pour l'ordre officiel des titres, nomme tes fichiers `01 - Titre.mp3`, `02 - Titre.mp3`, etc. L'ordre est calculé à partir des noms.
- Pour créer une **playlist personnelle**, clique sur `+ Nouvelle`, donne-lui un nom, puis `+ Importer des sons`. La sélection de plusieurs fichiers en un seul import est possible, et chaque import ajoute des lignes supplémentaires.
- La **playlist Fichiers ouverts** est créée automatiquement lorsqu'un fichier audio du bureau ou d'un dossier est ouvert. Elle ne remplace pas Zebra Tape 2.
- Une playlist personnelle peut être réorganisée avec les flèches haut/bas ou par glisser-déposer sur ordinateur. Il est également possible de la renommer ou de retirer un titre.
- La liste des playlists est mémorisée dans **localStorage**, les fichiers audio importés sont sauvegardés dans **IndexedDB** pour ce navigateur. Les données ne sont pas synchronisées entre appareils. Les limites d'espace du navigateur s'appliquent.
- L'**égaliseur cinq bandes** traite le signal audio réel avec les filtres Web Audio. Préréglages : neutre, basses, clair, vintage, nuit et voix.
- Effets supplémentaires : aléatoire, répétition d'un titre/de la playlist, vitesse variable, spectre animé, et **ZebraVIS.exe** (cinq styles).
- Les fichiers de la tape ne sont pas encore publiés par défaut : ZebraAMP affiche une playlist officielle vide tant que tu n'as pas ajouté de MP3 sur GitHub.

Pour éviter tout problème de sécurité, on ne place aucun mot de passe GitHub dans le lecteur.
