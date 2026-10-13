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