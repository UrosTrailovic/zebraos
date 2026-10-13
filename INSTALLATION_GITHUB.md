# ZebraOS — Mise en ligne via GitHub Pages

## Étape 1 — Créer le dépôt
1. Se connecter au compte GitHub `UrosTrailovic`.
2. Ouvrir https://github.com/new.
3. Nom du dépôt : `zebraos` ; visibilité : **Public** (pour GitHub Pages avec GitHub Free).
4. Ne pas cocher « Add a README file », « .gitignore » ni « license » : laisser le dépôt vide.
5. Créer le dépôt, puis revenir dans ChatGPT. L'assistant pourra alors travailler avec les fichiers via le connecteur GitHub, si l'accès au nouveau dépôt lui est accordé.

## Étape 2 — Publier la base
À ce stade, ne pas ajouter de MP3 ni d'autres contenus privés. Le site et les fichiers d'un dépôt public sont accessibles à tous.

Une fois les fichiers de ce dossier ajoutés à la racine du dépôt :
- GitHub > dépôt `zebraos` > **Settings** > **Pages**.
- Dans **Build and deployment**, choisir **Deploy from a branch**.
- Branche `main`, répertoire `/(root)`, puis **Save**.
- Un lien temporaire du type `https://urostrailovic.github.io/zebraos/` sera disponible après publication.

Pas besoin de pipeline de compilation, d'Actions ni de dépendances. Le fichier `.nojekyll` force le service statique direct.

## Étape 3 — Configurer le domaine plus tard
**Ne pas changer les DNS immédiatement.** Vérifier d'abord que le prototype fonctionne à l'adresse GitHub Pages.

Quand le site est prêt :
1. Dans GitHub Settings > Pages, indiquer **www.zebratape2.net** comme custom domain.
2. Chez Infomaniak, configurer le CNAME de `www` vers `urostrailovic.github.io` (sans `/zebraos/`). Ne pas toucher aux MX/TXT du service mail.
3. Tester le certificat HTTPS puis activer « Enforce HTTPS » si proposé.
4. Le domaine racine `zebratape2.net` pourra ensuite être redirigé de manière appropriée si souhaité ; sa configuration nécessite un contrôle séparé de ses enregistrements DNS.

Documentation officielle :
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Musique et confidentialité
- Les MP3 seront ajoutés uniquement quand l'accès avant-sortie aura été décidé.
- Un faux écran de login en JavaScript ne protège pas réellement des fichiers mis en ligne publiquement.
- Pour tester ZebraAMP sans publier les morceaux : utiliser « Load MP3(s) from device ».
- MP3 192–256 kb/s : compromis possible pour une écoute Web ; vérifier les fichiers et leurs tailles réelles.