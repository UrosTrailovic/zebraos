# ZebraOS — Prototype jouable v0.1

Ce dossier est **un premier prototype** pour éprouver l'idée, pas le site final. Il contient un écran PC éteint, une sélection de session, un bureau avec fenêtres, un explorateur de dossiers imbriqués, un lecteur MP3, une galerie, un bloc-notes, les réglages de fonds et quelques clins d'œil à Daniel.

## Pour l'ouvrir

Ouvrir `index.html` dans Chrome, Firefox ou Edge. Pour un test fidèle aux conditions d'un vrai site (notamment téléchargement ZIP), utiliser un serveur HTTP statique local ou déposer ces fichiers sur un hébergement de test. Aucune compilation, aucun `npm`, aucun framework.

Sur PC : **double-cliquer** les icônes. Sur téléphone : **toucher** une icône. Cliquer le bouton POWER pour commencer.

## Ajouter du contenu réel

- Musique : renommer tes MP3 `track-01.mp3` à `track-09.mp3` et les placer dans `assets/music/`. Ou ouvrir ZebraAMP puis utiliser **Load MP3(s) from device** pour tester avec tes propres fichiers (import temporaire, sans envoi).
- Visuels : `assets/screenshots/cover.jpg`, `poster.jpg` et `sadate-01.jpg` à `sadate-04.jpg`.
- Map : mettre l'archive compilée et testée dans `assets/maps/sadate-map.zip`.
- Fonds du bureau : dans cette maquette ils sont générés en CSS. Les vrais fonds seront des captures travaillées de ta map et remplaceront ces fonds provisoires.
- Fichier éditable : `STUDIO/MY_NOTES.TXT` dans l'explorateur. Sauvegarde **locale uniquement**, pas partagée.

## Délimitations

- **Pas de musique réelle incluse** : aucun titre, fichier ou cover n'a été inventé pour l'album. Le lecteur fonctionnera avec des MP3 fournis.
- Les comptes sont des **profils fictifs** : ils n'imposent aucune permission serveur.
- **Pas de protection fiable d'écoute anticipée** dans ce prototype statique.
- Sur le faux bureau, les dossiers ne sont pas des vrais dossiers de votre machine.
- L'interface est volontairement provisoire : pas encore d'icônes originales, de vrai art ZebraOS, de fichiers de session approfondis, d'égaliseur audio paramétrique ou de vraie vue galerie finale.
- La fenêtre Notepad utilise le stockage local du navigateur. Les changements ne sont pas partagés entre visiteurs.

## Statut

Prototype P0-A / P0-B + aperçu P0-C / P0-D. Avant publication, effectuer tests PC/mobile, finaliser les assets et séparer `app.js` en modules (voir `CAHIER_DES_CHARGES.md`).

## Son système (v0.3)

Les bruitages de ZebraOS proviennent de **Kenney — Interface Sounds (2020)**, sous licence **Creative Commons CC0 1.0** : https://kenney.nl/assets/interface-sounds

Les neuf fichiers OGG sélectionnés sont embarqués dans `sfx.js` pour fonctionner sans CDN ni compte externe. Sons prévus : clic, sélection, ouverture, fermeture, réduction, restauration, confirmation, erreur et interrupteur.

- Ouvrir une session, un dossier, ZebraAMP, puis réduire/restaurer/fermer une fenêtre pour tester.
- Panneau de configuration → **Sound Properties** : activer/désactiver les sons ou lancer un test.
- Les sons démarrent seulement après une action de l'utilisateur, conformément aux restrictions habituelles d'autoplay des navigateurs.
- La musique de Zebra Tape 2 est séparée des bruitages. Aucun master inédit n'est publié ici.

Merci à Kenney pour les assets CC0. Aucune ressource audio Windows/Microsoft n'a été copiée.


## Clic de souris mécanique (v0.4)

- À chaque pression puis relâchement sur le site (souris **ou** écran tactile), un son physique distinct est joué.
- Le son d'ouverture des fenêtres reste séparé et démarre légèrement après le clic pour que les deux soient perceptibles.
- Les anciens clics électroniques sur certaines commandes ont été supprimés afin d'éviter les doublons.
- **Control Panel → Sound Properties → Test mouse click** permet d'écouter le nouveau bruitage. L'option « System sounds » coupe tous les effets, comme auparavant.
- Sources audio supplémentaires : **Kenney — UI Audio**, `mouseclick1.ogg` et `mouserelease1.ogg`, licence CC0 : https://kenney.nl/assets/ui-audio

Le fichier `sfx.js` contient les deux sons en OGG intégrés, sans serveur ou CDN tiers.


## Fonds d’écran (v0.8)

Dans **Control Panel → Personnaliser votre arrière-plan**, chaque session sélectionne son propre fond d’écran et le mode d’affichage : Remplir, Ajuster, Étirer, Vignette, Centrer ou Étendre.

- **Parcourir les photos** accepte PNG, JPG, WEBP et BMP (30 Mo maximum). Les GIF sont convertis en image fixe.
- Les imports sont redimensionnés à 1920 pixels maximum, puis gardés localement dans IndexedDB.
- Les images récentes sont partagées entre les sessions **du même navigateur**, mais chaque session conserve son propre fond.
- Le choix du fond et son mode sont sauvegardés dans localStorage.
- Supprimer une image de la galerie la supprime de cet appareil et rétablit le fond d'origine des sessions qui l'utilisaient.
- Aucune image importée n’est envoyée sur GitHub. Elles ne sont pas synchronisées entre appareils.
- « Étendre » correspond ici à « Remplir » puisqu’il n’y a qu’un seul écran virtuel.

Tests : importer une image dans Visitor ; choisir Vignette, Ajuster et Remplir ; changer de session ; revenir ; recharger le navigateur.

## Idées de la prochaine phase

- **Paintbrush** : outil de dessin style Windows 95 avec import/export d’images et effets simples.
- **System Settings** : date, heure, format, fuseau horaire simulé et horloge plus complète.
- **File explorer** : dossier du dépôt synchronisé en lecture pour afficher automatiquement les fichiers publics.
- **Desktop** : redimensionnement des fenêtres sur ordinateur, anti-sélection accidentelle du texte.
- **Login** : refonte du sélecteur de session.
- **ZebraAMP** : égaliseur et fonctions audio supplémentaires.
