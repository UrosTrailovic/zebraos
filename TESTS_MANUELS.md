# ZebraOS — Tests manuels avant publication

## Testé automatiquement dans un navigateur Chromium (environnement de rendu)

- [x] Écran éteint → POWER → quatre sessions
- [x] Session Daniel → bureau → explorateur → ZEBRA TAPE 2 → AUDIO → neuf entrées
- [x] Ouverture de ZebraAMP
- [x] Notes personnelles : saisie + bouton de sauvegarde
- [x] Control Panel : changement de fond
- [x] Menu Start + logout
- [x] Session Admin : demande de confirmation avant ZebraAMP
- [x] Interface mobile 390×844 : ouverture du lecteur et pas de débordement global
- [x] Vérification syntaxique de app.js et absence d'erreurs JavaScript sur les parcours testés

## À tester toi-même

- [ ] Sur hébergement HTTP/HTTPS, pas seulement en aperçu : téléchargements et chemin des assets
- [ ] Lire les 9 MP3 réels, volume, scrubbing, pistes suivantes, lecture en arrière-plan
- [ ] Mettre le site dans Firefox, Chrome, Edge, Safari iOS, Chrome Android
- [ ] Rotation téléphone / petit écran / zoom navigateur
- [ ] États d'erreur réseau / morceaux manquants / images absentes
- [ ] Notes et fonds après fermeture/réouverture, navigation privée, stockage plein
- [ ] Archive de la map `.zip` avec `.bsp`, `.wad`, sons éventuels, test sur CS 1.6 propre
- [ ] Vérification de l'absence d'informations personnelles dans les fichiers de studio fictifs
- [ ] Décider d'une solution réelle d'accès anticipé si restriction souhaitée

## Important
Le prototype est une **preuve de concept** : fichiers musicaux et visuels définitifs absents, pas encore de vrai EQ ni de bibliothèque partagée. Les comptes n'impliquent aucune autorisation réelle. Les tests navigateur ne remplacent pas des tests de déploiement chez l'hébergeur.