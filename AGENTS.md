# AGENTS.md — ZebraOS (instructions permanentes pour les assistants de développement)

## Mission et collaboration
- Projet artistique interactif **ZebraOS / Zebra Tape 2**. Dépôt : `UrosTrailovic/zebraos`, branche de référence `main`. Domaine public : `www.zebratape2.net` (GitHub Pages, vérifier son état avant toute affirmation).
- Le propriétaire **ne modifie pas le code lui-même** : prendre en charge l'analyse, les éditions, les commits/pushs disponibles et les tests. Ne pas demander à l'utilisateur de corriger des fichiers ou d'exécuter des manipulations techniques évitables.
- Communiquer en français, simplement et directement. Distinguer rigoureusement **proposé**, **codé**, **commité**, **publié**, **testé en production**. Ne jamais dire « c'est en ligne » uniquement parce qu'un commit existe.
- Avant chaque intervention : lire ce fichier, inspecter les fichiers concernés et les derniers commits ; les anciennes conversations et les documents anciens ne garantissent pas l'état actuel du code.
- Éviter de réinventer une interface validée ou de toucher à d'autres applications sans raison. Respecter les textures fournies et les noms exacts, accents, casse et chemins des ressources.

## Règle absolue : responsabilité du code et des pushs
- **Le propriétaire ne touche JAMAIS au code.** Il ne doit jamais être invité à ouvrir un éditeur, modifier une ligne, copier-coller un patch, lancer une commande Git, commiter, pousser un fichier, corriger un chemin ou résoudre manuellement une erreur technique. Lui demander cela constitue un **échec grave de l'agent**.
- **Par défaut, supposer que le travail de lecture/édition/commit/push est faisable par l'agent avec les outils disponibles**, même si une première approche échoue ou si un environnement semble limité. Ne pas déclarer « je ne peux pas pousser » sans avoir vérifié la bonne connexion, le dépôt, la branche, les permissions et les autres outils disponibles.
- **Chercher activement une autre voie d'exécution** : connecteur GitHub, écriture via API de fichiers ou commits, création de branche/PR, autres outils d'édition autorisés. Une interface ou un outil indisponible ne prouve pas l'impossibilité globale.
- **Exécuter plutôt que déléguer** : inspecter, modifier, tester, commiter et vérifier directement dans la mesure des droits réellement accordés. Ne pas demander au propriétaire de faire un push ou un correctif « à la place » de l'agent.
- **En cas de blocage réel**, diagnostiquer précisément les tentatives et le message d'erreur, essayer les voies autorisées, puis être transparent sur ce qui n'a pas pu être accompli. Ne jamais inventer un commit ou une publication. Si une autorisation explicite ou une connexion est réellement indispensable, demander uniquement cette action d'autorisation, jamais un travail de code.
- **Pour chaque demande technique**, la fin attendue est une livraison effective et vérifiée quand les outils et permissions le permettent, pas une simple explication ou un extrait de code à recopier.

## Architecture vérifiée dans le dépôt (novembre 2026)
- Application Web statique en HTML/CSS/JavaScript natifs, sans chaîne de build obligatoire.
- `index.html` : entrée, feuilles de style et scripts chargés avec versions de ressources.
- `app.js` : orchestration du bureau, fenêtres, sessions et applications ; `style.css` : styles principaux.
- `filesystem.js`, `github-files.js`, `desktop-layout.js`, `desktop-layout.css` : fichiers et présentation du bureau.
- `STUDIO/BUREAU/` : source du contenu visible sur le bureau ; `assets/bureau-index.json` : index généré ; `.github/workflows/index-studio.yml` : automatisation de l'index.
- `zebraamp.js`, `zebraamp-*.css`, `visualizer.js`, `visualizer-reactive.js`, `zebravis-controls.css` : lecteur musical, traitements, visualiseurs et habillages.
- `echo-racer.js`, `echo-racer.css` : jeu Echo Racer.
- `snake.js`, `snake.css`, `snake-assets.js` : Znake ; `tetris.js` et `tetris-artwork.js` : Tetris ; `paint.js`, `paint-responsive.css` : ZebraPaint.
- `power-panel-v3.js/css`, `power-facade-v2.css`, `zebra-hardware.css`, `assets/boot-assets*.js` : démarrage et façade ; `control-panel.js`, `wallpaper.js` : personnalisation.
- Nombreuses vérifications GitHub Actions dans `.github/workflows/`, notamment `verify-echo-racer.yml`, `verify-zebraamp-*.yml`, `verify-paint-mobile.yml`, `verify-snake-assets.yml`, `verify-tetris-*.yml`.
- `README.md`, `CAHIER_DES_CHARGES.md`, `GUIDE_BUREAU.md`, `TESTS_MANUELS.md` : documentation historique. **Le cahier des charges v0.1 comporte des propositions obsolètes : le code actuel fait foi.**

## Intentions artistiques établies avec l'utilisateur (à préserver, à confronter au code)
- Interface matérielle et crédible de vieux PC, boutons et reliefs physiques, style Windows 2000 / XP classique, pas de design SaaS moderne, néons exagérés ni textures artificiellement salies.
- ZebraOS reste en français, y compris sur mobile. Bureau immersif, fenêtres et fichiers manipulables, interactions PC et mobile.
- ZebraAMP : playlist Zebra Tape 2 et Zebralogy, musique réelle, visualiseurs réactifs, traitements audio réels ; ne pas remplacer les ressources officielles par des placeholders.
- Echo Racer : vue FPV basse dans un tunnel phosphore/CRT réactif à la musique ; vitesse nerveuse et inertie latérale ; longues sections droites, courbes et dénivelés augmentant avec la progression ; obstacles variés, boost/nitro, bouclier et 3 vies. Respecter les commandes et textures retenues. Contrôles mobiles de type manette avec navigation directionnelle ; ne pas considérer qu'un menu est tactile simplement parce qu'il est affiché sur mobile.
- Echo Racer HUD : chiffres de type LCD/CRT ; vitesse en haut, boost en bas ; barre de boost fine et continue ; contrôler l'alignement mobile ET desktop, titres et chiffres. Des positions JSON ont été communiquées dans les conversations de début novembre : **ne les réappliquer qu'après inspection de leur pertinence dans le code récent**.
- Préférence majeure : les modifications graphiques doivent utiliser les assets réellement fournis, et être comparées visuellement à la demande, sans substitutions non demandées.

## Processus obligatoire pour toute modification
1. Inspecter l'état de `main`, les fichiers concernés, leurs imports/références, et les assets existants. Vérifier les dépendances avec les styles/scripts adjacents, pas seulement le fichier cible.
2. Décrire brièvement ce qui change et conserver le comportement déjà validé. Protéger les autres programmes et les commandes PC/mobile.
3. Implémenter une modification cohérente, sans doublons d'assets, noms cassés, règles CSS contradictoires ou cache-busting fictif.
4. Tester au minimum la syntaxe JavaScript modifiée, les ressources référencées et les parcours concernés. Pour un changement visuel, effectuer un vrai test navigateur/screenshot aux résolutions desktop et mobile **si l'environnement le permet**. Dire explicitement si le test navigateur n'a pas été exécuté.
5. Consulter les GitHub Actions liées. Un workflow présent dans le dépôt n'est pas une preuve qu'il a réussi pour ce commit.
6. Après édition GitHub, communiquer le **SHA exact**, la branche, les fichiers modifiés et le statut réel de publication. Vérifier le dernier commit de `main` et, si possible, que la version publique sert bien les ressources attendues (URL, HTTP, contenu/version, résultats visuels).
7. Si une version n'apparaît pas, diagnostiquer successivement : commit sur la mauvaise branche, workflow Pages non terminé/échoué, artefacts non indexés, mauvais chemin/casse, référence CSS/JS non mise à jour, cache HTTP/CDN/navigateur, données locales persistantes. Ne jamais invoquer le cache comme explication universelle.
8. Tant que la publication n'est pas prouvée, dire « commit poussé, publication non vérifiée » et ne pas demander systématiquement à l'utilisateur de vider le cache ou d'essayer en navigation privée.

## GitHub Pages, caches et sécurité
- `CNAME` configure le domaine ; inspecter Pages/Actions avant d'affirmer un déploiement. **Ne pas confondre ZebraOS (GitHub Pages) avec l'atelier éditorial, qui est un autre dépôt/site Vercel.**
- `sw.js` est actuellement prévu pour se désinstaller ; `index.html` contient une logique de nettoyage d'anciens caches `zebraos-code-*`. Vérifier le code courant avant toute modification de stratégie Service Worker.
- `index.html` utilise des query strings de version sur des CSS/JS : vérifier leur mise à jour si nécessaire et ne pas masquer un mauvais déploiement derrière des versions arbitraires.
- Le dépôt GitHub est public ; les profils Visiteur/Zebra/Admin sont une simulation et le contrôle d'accès client n'est **pas** une protection des données sensibles. Ne jamais y placer de token, secret ou contenu confidentiel.
- Musique et médias doivent respecter les fichiers et crédits du projet ; ne pas effacer ni remplacer des morceaux sans instruction explicite.

## Protocole obligatoire d'auto-maintenance de ce guide
**Tout agent qui intervient sur ZebraOS doit maintenir ce fichier vivant.** Cette règle vaut aussi pour les interventions courtes, les reprises après une nouvelle conversation et les interventions d'autres assistants.

1. **Au démarrage :** lire `AGENTS.md` en entier, vérifier `main`, les fichiers concernés et les dernières modifications. Repérer les informations périmées ou contradictoires. Ne jamais présumer que le guide est plus récent que le code.
2. **Pendant l'intervention :** noter les découvertes techniques vérifiées (fichiers, responsabilités, dépendances, commandes, flux d'assets, contraintes de navigateur), les décisions réellement validées par l'utilisateur, les bugs reproduits et leur cause, ainsi que les tests exécutés et leurs résultats.
3. **À la fin de chaque intervention qui apporte une connaissance durable :** **modifier et commiter `AGENTS.md` dans la même branche / livraison que le travail**, idéalement dans le même commit, même si l'utilisateur n'a pas demandé de mise à jour de documentation. Ne jamais laisser ces informations uniquement dans le chat.
4. **Avant de terminer :** vérifier que la mise à jour est bien sur GitHub ; indiquer dans le compte rendu si `AGENTS.md` a été mis à jour et avec quel commit. Si l'accès en écriture est bloqué, le signaler explicitement et fournir le texte à intégrer : ne pas prétendre à une mise à jour.
5. **Aucun changement artificiel :** si la tâche n'apprend rien de durable, ne pas modifier le guide juste pour créer un commit. En revanche, toute correction d'une information devenue fausse est prioritaire.

### Structure de connaissance à entretenir
- **Architecture / points d'entrée :** maintenir la carte réelle des modules, chemins et dépendances après refactorisation.
- **Conventions et décisions validées :** remplacer les règles dépassées, dater les choix susceptibles de changer, expliquer la portée (mobile, desktop, une seule application).
- **Journal des apprentissages durables :** inscrire ci-dessous des entrées courtes `AAAA-MM-JJ — sujet — constat vérifié — fichiers concernés — test/preuve`. Privilégier les informations qui éviteront à un prochain agent de reproduire une erreur.
- **Problèmes ouverts :** distinguer anomalie reproductible, hypothèse et correction confirmée ; retirer ou archiver un problème une fois résolu.
- **État de publication :** lorsque c'est utile, indiquer le commit et le résultat de vérification production, sans transformer un état temporaire en vérité permanente.

### Règles de qualité pour cette auto-évolution
- **Vérifier avant d'écrire.** Une intuition, un ancien message ou une intention artistique n'est pas une preuve du comportement actuel. Étiqueter les hypothèses et ne jamais annoncer « testé » sans test réel.
- **Mettre à jour au lieu d'empiler.** Corriger les phrases anciennes, fusionner les doublons, supprimer les conseils obsolètes, garder un document consultable. Le journal n'est pas une copie exhaustive des commits.
- **Ne pas écraser les préférences validées.** Une nouvelle demande de l'utilisateur prévaut sur les règles précédentes ; documenter le changement et sa portée.
- **Ne pas inventer d'autonomie.** Le guide ne s'exécute pas tout seul : son actualisation est une obligation pour l'agent lorsqu'il travaille dans le dépôt et dispose des accès nécessaires.
- **Ne pas exposer de données privées.** Le dépôt est public : exclure identifiants, tokens, données personnelles, conversations privées et liens de partage sensibles.

### Journal des apprentissages durables
- 2026-11-06 — Sessions et clic souris — Daniel retiré de la sélection des utilisateurs ; les profils actifs sont Visiteur, Zebra et Admin. Dans `app.js`, le son mécanique du clic (Web Audio et secours Audio) est divisé par deux seulement lorsque la cible du pointeur est dans une fenêtre `amp`, `tetris`, `snake` ou `racer`, y compris sur mobile ; outils, autres fenêtres et bureau conservent le volume normal. Identifiant d'application stocké dans `data-app-id` sur la fenêtre. `wallpaper.js` ne liste plus la session Daniel. Vérifier les deux plateformes après modification des fenêtres ou du moteur audio.
- 2026-11-06 — Transmission inter-conversations — l'utilisateur souhaite que chaque agent maintienne le guide après les découvertes et changements vérifiés — `AGENTS.md` — règle de projet.

- 2026-11-06 — Contrôles Echo Racer mobile — CSS historique `echo-racer.css` contient des fonds tactiles concurrents ; surcouche isolée `echo-racer-mobile-zebra.css` avec `::after` au-dessus du fond et sous les touches ; test Chromium local 390 px (fond visible, A cliquable) et 1100 px (masqué). Production à confirmer.

### Problèmes ouverts à vérifier, sans présumer de leur cause
- Différences répétées entre modifications annoncées et rendu visible sur le domaine public ; identifier précisément commit, version servie, mécanisme de déploiement et résultat navigateur à chaque occurrence.

## Reprise d'une nouvelle conversation
Lire d'abord `AGENTS.md`, puis `README.md` et les fichiers du module demandé ; consulter les derniers commits et workflows avant de modifier. Dans le premier état des lieux, séparer **faits vérifiés dans GitHub**, **intentions issues des échanges** et **points non vérifiés**. Maintenir ce document si des règles durables changent, au lieu d'obliger l'utilisateur à réexpliquer les mêmes décisions.
