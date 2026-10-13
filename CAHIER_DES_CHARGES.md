# ZEBRAOS — Cahier des charges créatif & technique (v0.1)

**Projet :** Zebra Tape 2 · **Domaine :** www.zebratape2.net · **Direction :** ordinateur partagé du studio Zebra Record · **Sortie publique visée :** 25 décembre 2026.

> Ce document contient des décisions de conception proposées, pas des éléments déjà validés par l'artiste. La maquette fournie est un prototype de comportement, pas une direction artistique définitive.

## 1. Idée directrice

Le visiteur n'atterrit pas sur un « site d'album ». Il allume un vieux PC du studio Zebra Record : **ZebraOS**. Il choisit une session, arrive sur un bureau fixe, puis ouvre librement de faux programmes, des dossiers et des fichiers. **ZebraAMP.exe** est le centre musical de l'expérience. Tout doit être un peu vivant, curieux, accessible, jamais une parodie surchargée de GIF et de fausses alertes.

**Ambiance :** Windows 2000 / Windows XP classique + sites de clans Counter-Strike 1.6 + froideur hivernale de la map créée pour la pochette. L'ancien doit être dans l'architecture de l'interface, dans le rendu et dans la façon de coder, pas juste dans une texture vintage.

**Principes :**
1. **La musique en priorité :** quelques gestes pour écouter, même sur mobile.
2. **Explorer récompense :** dossiers crédibles, archives, petits secrets, quelques blagues.
3. **Pas de scroll de page :** le bureau occupe l'écran; le contenu *à l'intérieur des fenêtres* peut défiler.
4. **Proche d'un vrai OS, sans mentir :** c'est une simulation dans le navigateur; aucun accès aux fichiers réels de l'ordinateur.
5. **Zéro usine à gaz :** peu d'applications, mais chacune soignée.
6. **Facile à faire évoluer :** toutes les données (profils, dossiers, morceaux) sont centralisées et configurables.

## 2. Parcours du visiteur

1. **Écran noir « PC éteint » :** moniteur sombre, petit bouton physique « POWER ». Aucun son automatique.
2. **Écran de sessions :** Visitor / Zebra / Admin / Daniel, avatars et petite description. Clic pour entrer. Pas d'authentification réelle.
3. **Bureau :** fond différent selon session, icônes et barre des tâches. Pas de fenêtre ouverte par défaut (option : petite notification non intrusive « DOUBLE CLICK AN ICON TO OPEN »).
4. **Interaction :** double-clic sur PC pour ouvrir l'explorateur; double-clic sur ZebraAMP pour écouter; démarrer pour autres programmes; fenêtres empilables/déplaçables/réductibles.
5. **Découverte :** lire README, trouver les captures de la map, télécharger un ZIP, explorer les dossiers de studio, découvrir les particularités des profils.
6. **Retour :** paramètres locaux sauvegardés quand possible; musique jamais lancée sans commande utilisateur.

## 3. Sessions / profils simulés

| Profil | Intention | Bureau | Dossiers / comportement |
|---|---|---|---|
| **Visitor** | Accueil évident | neutre, map enneigée | `ZEBRA TAPE 2`, `SCREENSHOTS`, `DOWNLOADS`, `README.TXT` |
| **Zebra** | PC de création | capture alternative | `PROJECTS`, notes de studio, morceaux et documents de travail *fictifs* |
| **Admin** | Humour système | contraste / bleu nuit | confirmation humoristique « Run as administrator » sur ZebraAMP; n'accorde aucun privilège réel |
| **Daniel** | Blague inexpliquée | wallpaper improbable mais cohérent | `DANIEL.TXT`, un dossier étrange; quelques petits easter eggs, jamais bloquant |

Tous les profils ont accès à la musique, la map, la galerie et les informations essentielles. Les noms/notes peuvent être changés sans réécrire le code.

## 4. Composants de base de ZebraOS

### 4.1 Bureau
- 100 % de la fenêtre du navigateur, fond fixe ou image choisie.
- Icônes bureau avec libellés, focus/sélection, double-clic sur ordinateur; simple toucher sur mobile.
- Barre des tâches : bouton Z, boutons des fenêtres ouvertes, horloge, volume indicatif; menu « Démarrer ».
- Clic droit (phase 2) : menu contextuel classique; comportement natif préservé si échec.
- Aucun scrolling de la *page*; défilement à l'intérieur des fenêtres.

### 4.2 Gestionnaire de fenêtres
- Une fenêtre a `id`, `title`, `app`, `position`, `size`, `minimized`, `zIndex`.
- Ouverture au premier plan; clic = mise au premier plan.
- Drag souris / pointer dans la barre de titre; pas de drag depuis les boutons.
- Réduction/restauration depuis la taskbar; fermeture depuis `X`.
- Ajuster les positions pour rester accessibles après redimensionnement.
- Pas besoin de vrai multitâche système; les fenêtres sont des panneaux DOM.
- À terme : maximiser, redimensionnement, clavier accessible, focus, sauvegarde de position.

### 4.3 Système de fichiers VIRTUEL
- Arborescence définie dans un unique objet JavaScript; chaque nœud a `id`, `name`, `kind`, `children?`, `action?`, `asset?`, `profiles?`.
- `folder` -> ouvre un dossier; `audio` -> lecteur et plage; `image` -> visionneuse; `text` -> bloc-notes; `download` -> téléchargement; `shortcut` -> programme.
- Navigation « Up », breadcrumb, retour, doubles clics, extensions visibles.
- Déplacement réel de fichiers / création de sous-dossiers *non nécessaire en v1*. Les faux fichiers restent prédéfinis; seules les notes locales sont éditables.
- Corbeille mise en scène avec 2–3 fichiers humoristiques; éviter une vraie suppression en v1.

**Arborescence initiale proposée :**

```text
C:\
├── DESKTOP\
│   ├── ZebraAMP.exe
│   ├── My Computer.lnk
│   ├── README.TXT
│   └── Recycle Bin.lnk
├── ZEBRA TAPE 2\
│   ├── AUDIO\
│   │   ├── 01 - UNTITLED.MP3
│   │   ├── ... jusqu'à 09
│   ├── ARTWORK\
│   │   ├── COVER.JPG
│   │   └── POSTER.JPG
│   └── INFO.TXT
├── MAPS\
│   ├── SADATE\
│   │   ├── README_INSTALL.TXT
│   │   ├── SCREENSHOTS\
│   │   └── SADATE_MAP.ZIP
├── STUDIO\
│   ├── NOTES.TXT
│   ├── ARCHIVE\
│   └── DANIEL.TXT (session Daniel seulement)
└── RECYCLE BIN\
    ├── mix_final_FINAL_v17.wav (faux)
    └── cover_old_final_2.jpg (faux)
```

Les noms ci-dessus sont **provisoires**. Ne jamais inventer la tracklist définitive, les morceaux ni les assets de la map.

## 5. Logiciels

### ZebraAMP.exe — P0 (indispensable)
- Un moteur `<audio>` unique; playlist 9 pistes lues depuis le dossier `assets/music/`.
- Play / Pause / Previous / Next / sélection de morceau / seek / affichage durée / volume.
- Affichage pochettes et métadonnées issues d'un seul `tracks.js` ou `data.js`.
- Visualiseur barres spectrales : Web Audio API / `AnalyserNode`; affichage rétro, aucun mouvement quand la musique ne joue pas.
- Égaliseur : **P1** pour ne pas confondre des curseurs décoratifs avec un vrai traitement audio. Si implémenté, 3 ou 5 bandes `BiquadFilterNode`, contrôles réels et reset.
- Gestion des fichiers absents : message clair; commandes désactivées si piste inaccessible.
- **Aucune lecture automatique** en entrant sur le bureau. La lecture doit résulter d'un geste explicite (politiques des navigateurs).
- Sur mobile, fenêtre adaptée et contrôles tactiles.

### My Computer / Explorer.exe — P0
- Parcours des répertoires imbriqués du faux `C:\`.
- Différents types de fichiers avec leurs extensions.
- Bouton retour/monter, chemin actuel, double-clic et tap.
- Les fichiers ouvrent la bonne application.

### Notepad.exe — P0
- `README.TXT` / notes de studio lisibles.
- Un fichier `MY_NOTES.TXT` personnel modifiable et sauvegardé dans `localStorage` (local uniquement, par navigateur).
- « Livre d'or commun » exclu de v1 : exigerait un backend / service partagé + anti-spam / modération.

### Image Viewer.exe — P0
- Galerie des screenshots de la vraie map, cover, poster.
- Précédent/suivant et éventuellement zoom en P1.

### Control Panel — P0
- Choix de fonds prédéfinis.
- Import local temporaire d'image via `<input type=file>`; ne jamais envoyer l'image au serveur.
- Préférences simples en `localStorage` par profil, avec bouton réinitialiser.

### System / About — P0
- Informations fictives sur ZebraOS 2.0, version et crédits.
- Humour discret; pas de fausses alertes de sécurité réalistes ou de demandes de mot de passe.

### Secrets — P2 (à doser)
- Double fond dans un fichier texte, son perdu, fichiers inutiles de Daniel, faux historique de versions, un mini panneau de propriétés absurdes.
- Idéalement 3–5 trouvailles, pas 40 mini-jeux.

## 6. Direction artistique / assets

**Règle :** l'esthétique Windows 2000 doit être **interprétée**, non copiée au pixel près (logos Windows et assets système propriétaires à éviter). Logo ZebraOS original, rayures zèbre abstraites, icônes créées pour la tape.

- Palette de départ *proposée* : `#c0c0c0` (chrome fenêtre), `#000080` (barres de titre), `#008080` (bureau secours), charbon / gris / bleu froid dans les fonds. À ajuster sur les vraies captures CS.
- Typo système : Arial / Tahoma / Verdana ; tailles compactes mais lisibles sur téléphone.
- Fausses ombres, relief CSS `outset/inset`, bordures 1–2px; très peu d'animations, jamais de gradient « startup 2026 ».
- **Assets à préparer en priorité :** 4 fonds de bureau (1920x1080 ou plus, JPG/WebP), 1 logo ZebraOS (PNG transparent), 8–12 icônes (PNG transparent, idéalement 32x32 / 48x48), couverture, poster, 5–10 screenshots de map, avatar x4 (facultatifs), fichiers MP3 et ZIP map.
- Les fichiers `.BSP` / textures `.WAD` / sons complémentaires doivent être empaquetés selon l'arborescence correcte dans un ZIP (vérifier les dépendances).
- **Ne pas découper toutes les fenêtres en PNG** : interface native HTML/CSS plus légère et flexible.

## 7. Architecture technique — souhaitée pour Claude

**Stack visée :** HTML + CSS « classique » + JavaScript natif, PHP absent, pas de React/Vue/Tailwind/npm, pas de compilation, pas de dépendance externe requise. Les APIs `audio`, File et Web Audio sont modernes mais nécessaires à une expérience fiable dans le navigateur.

```text
index.html
/css/
  system.css        // fenêtres, barre des tâches, menu, boutons
  apps.css          // ZebraAMP, Explorer, bloc-notes, réglages
  responsive.css    // adaptation tactile
/js/
  data.js           // sessions, fonds, fichiers, tracklist, textes
  os.js             // boot, login, taskbar, menu, gestion fenêtres
  explorer.js       // navigation et ouverture des fichiers
  apps.js           // notes, galerie, configuration
  zebraamp.js       // moteur audio, playlist, visualiseur, EQ futur
/assets/
  /icons/
  /wallpapers/
  /music/
  /screenshots/
  /maps/
README.md
```

**Découpage souhaité :** modules organisés par espaces de noms sans bundler (IIFE ou objets globaux `ZebraOS`); pas d'énorme JS monolithique en production; les événements doivent être enregistrés une fois, pas recollés à chaque ouverture; protéger les données affichées contre l'injection HTML (texte utilisateur via `textContent`, pas via `innerHTML`).

**Services :**
- `SessionManager` — profil courant, login/logout fictifs.
- `WindowManager` — ouvrir, focaliser, réduire, fermer, maximiser.
- `FileSystem` — arbre en lecture seule, routes d'ouverture par type.
- `AppRegistry` — identifiant logiciel -> fonction d'ouverture.
- `AudioManager` — audio persistant lorsque la fenêtre est minimisée.
- `Preferences` — localStorage, noms de clés préfixés `zebraos.v1.`.

## 8. Contraintes à ne pas manquer

### Accès anticipé
Une page statique avec un « mot de passe » vérifié par JavaScript **n'est pas privée** : les MP3 téléchargés restent accessibles à quiconque connaît leurs URL, et le code frontend peut être lu. Pour une vraie distribution anticipée limitée, utiliser un service d'accès contrôlé, un hébergement authentifié, ou les CD audio physiques. Une URL « secrète »/non indexée peut faire une expérience collector **mais n'est pas une sécurité**.

### Formats et poids
- Prévoir fichiers MP3 web (par exemple 192–256 kbit/s) distincts des masters WAV; tester qualité selon besoins.
- Ne pas charger les 9 MP3 à la fois; `preload=metadata` ou `none`, une piste à la fois.
- Les captures compressées, wallpapers adaptés selon écran; une map ZIP, pas un `.BSP` isolé sans les ressources nécessaires.

### Persistance
- Paramètres et notes peuvent rester en `localStorage` par navigateur, sans synchronisation entre appareils et avec risque d'effacement par utilisateur/navigateur.
- Photos importées : objets URL locaux temporaires; stockage persistant des images à étudier séparément (quota du stockage et IndexedDB).

### UX / accessibilité
- Double-clic PC; simple tap mobile; clic simple sélection PC.
- Ouvrir le lecteur en un ou deux gestes depuis le bureau une fois la session choisie.
- Boutons nommés, focus clavier, Escape ferme le menu, pas d'animation clignotante excessive.
- Tester sur Chrome/Firefox/Edge desktop, Safari iOS, Chrome Android.

## 9. Priorités de développement (avec critères de réussite)

### P0-A : shell
- Écran éteint -> sélection de session -> bureau.
- Barre des tâches, icônes, menu démarrer, horloge.
- Deux fenêtres ouvertes simultanément : drag, focus, minimize, close.
- **Validation :** Visitor/Zebra/Daniel/Admin ont chacun un fond, retour login fonctionne.

### P0-B : explorateur
- Naviguer `C:\ > ZEBRA TAPE 2 > AUDIO` et revenir en arrière.
- Double-clic fichier = application adaptée; corbeille et docs existent.
- **Validation :** chemins stables; aucune fenêtre orpheline après fermeture.

### P0-C : ZebraAMP
- Une piste test fournie localement; play/pause/skip/seek/volume/temps; lecture continue quand fenêtre minimisée.
- Playlist extensible à neuf vrais MP3; rendu visuel crédible.
- **Validation :** aucun autoplay, pas de double lecture, erreur lisible si fichier manquant.

### P0-D : éléments réels
- Voir captures, lire README, télécharger ZIP de la map, régler fond d'écran.
- Tester parcours mobile.
- **Validation :** un visiteur sur téléphone peut lancer la musique sans difficulté.

### P1 : qualité & finition
- Vrai EQ, max/resize fenêtres, raccourcis clavier, sauvegarde positions, mini-sounds UI opt-in, détails CSS/pixel, bugs mobile, compression assets.

### P2 : extras artistiques
- Secrets, profil Daniel enrichi, faux programmes supplémentaires, livre d'or externe si envie plus tard.

## 10. Checklist d'assets fournis par l'artiste

- [ ] Logo original ZebraOS et petite icône `Z`.
- [ ] Fond Visitor (vraie map CS1.6).
- [ ] Fond Zebra (autre vue / studio).
- [ ] Fond Admin (variante froide).
- [ ] Fond Daniel (la vanne à décider).
- [ ] Cover définitive / poster.
- [ ] 5–10 screenshots de la map.
- [ ] Liste des 9 morceaux (ordre et noms définitifs).
- [ ] MP3 prêts à diffuser (9), masters archivés à part.
- [ ] ZIP de la map GoldSrc correctement empaqueté et testé sur une installation propre.
- [ ] Texte README / crédits, éventuels fichiers fictifs et blagues.
- [ ] Icônes originales (peuvent être créées une par une).

## 11. Décisions à prendre en testant

1. Style exact : Windows 2000 strict, XP classique, ou un ZebraOS hybride ?
2. Premier écran : écran noir puis session, ou session directe si le visiteur revient ?
3. Galerie : combien de screenshots et avec quels textes ?
4. Daniel : drôle subtil ou carrément absurde ?
5. Accès anticipé : CD physique seulement, ou véritable solution d'accès privé externe ?
6. Télécharger la map : ZIP + notice FR/EN, lien Steam optionnel ?

## 12. Prompt de travail pour Claude (copier-coller)

Tu es développeur frontend spécialisé dans les interfaces de logiciels historiques. Nous allons construire **ZebraOS**, une simulation HTML/CSS/JavaScript d'un ordinateur partagé du studio Zebra Record, accessible sur www.zebratape2.net. Elle sert d'univers interactif pour l'album Zebra Tape 2.

Lis entièrement le cahier des charges joint. Ne fais **pas** un site marketing classique, une landing page ou une imitation moderne à grosses cartes. **Aucune dépendance** : pas de React, Vue, Tailwind, npm, bundler ou assets CDN. Utilise un HTML/CSS/JS natif organisé en petits fichiers, avec une esthétique crédible Windows 2000 / anciens sites gaming. Les APIs audio modernes sont autorisées uniquement pour la compatibilité réelle. Le CSS doit créer l'interface, pas des images de fenêtres.

**Processus obligatoire :**
1. Réalise uniquement P0-A (écran éteint, login Visitor/Zebra/Admin/Daniel, bureau, tâches, menu, fenêtres). Fournis tous les fichiers complets et une liste simple de tests manuels. Ne passe pas à P0-B avant validation.
2. Ensuite, P0-B (système de fichiers fictif imbriqué). Toutes les données fichiers et profils sont configurables, pas hardcodées dans le DOM.
3. Ensuite, P0-C (ZebraAMP) avec 9 fichiers MP3 de remplacement, clairement identifiés comme placeholders; ne pas inventer les titres finaux ni les durées.
4. Ensuite, P0-D (images, notes, ZIP de map, réglages, mobile).

**Invariants :** le bureau ne scrolle pas, les fenêtres peuvent scroller, un visiteur peut écouter facilement, aucune lecture automatique, profils fictifs ≠ droits serveur, pas de fausse confidentialité d'un mot de passe frontend, un seul audio engine, import wallpaper local uniquement, aucune ressource externe obligatoire.

Pose des questions seulement pour ce qui est indispensable à l'étape en cours. Utilise des placeholders explicites pour les assets manquants. Privilégie des solutions robustes et maintenables, même dans une esthétique ancienne. Quand un détail est un choix créatif, propose 2 variantes raisonnables plutôt que de décider à la place de l'artiste.