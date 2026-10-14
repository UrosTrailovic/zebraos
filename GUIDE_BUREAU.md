# Construire le bureau ZebraOS

Le bureau public n'utilise **qu'un seul dossier GitHub** :
[`STUDIO/BUREAU`](https://github.com/UrosTrailovic/zebraos/tree/main/STUDIO/BUREAU).

## Ajouter un dossier au bureau

Sur GitHub : `Add file` → `Create new file`, puis saisis :

```
STUDIO/BUREAU/MON DOSSIER/.gitkeep
```

Valide avec `Commit changes`. Les dossiers vides sont conservés par `.gitkeep`, que ZebraOS masque.

La même règle fonctionne pour des sous-dossiers :

```
STUDIO/BUREAU/MON DOSSIER/SOUS DOSSIER/.gitkeep
```

Chaque dossier ajouté **directement dans BUREAU** apparaît en icône sur le bureau de ZebraOS. Les sous-dossiers sont visibles en ouvrant leurs dossiers parents.

## Mettre une icône personnalisée à un dossier

Glisse dans ce dossier un PNG nommé exactement `icone.png` :

```
STUDIO/BUREAU/MON DOSSIER/icone.png
```

ZebraOS affichera ce PNG comme icône du dossier, et le cachera dans l'explorateur.

Formats acceptés aussi : `icone.webp` et `icone.jpg` (PNG prioritaire).
Une image **carrée, avec fond transparent, de 128 × 128 ou 256 × 256 pixels** est un bon choix.

## Mettre une icône personnalisée à un fichier

Ajoute dans **le même dossier** une image qui reprend **le nom complet du fichier**, suivi de `.icone.png`. Exemple :

```
STUDIO/BUREAU/MON DOSSIER/ma-map.bsp
STUDIO/BUREAU/MON DOSSIER/ma-map.bsp.icone.png
```

L'icône ne sera pas listée comme un deuxième fichier. Les sous-dossiers peuvent contenir des images, des MP3, des archives ZIP, des cartes BSP, des fichiers texte, etc.

## Publication

1. Ajoute tes fichiers avec GitHub puis valide l'enregistrement (`Commit changes`).
2. Attends la réussite de l'action `Actualiser le bureau ZebraOS` dans l'onglet Actions.
3. Ouvre ZebraOS, sélectionne la session voulue et utilise `Actualiser` dans le Poste de travail si le bureau affiche encore l'ancienne version.

GitHub Pages est public : **ne mets aucun fichier confidentiel dans BUREAU**.
Le mot de passe de la session Admin n'est pas un vrai contrôle d'accès aux fichiers publics.

Les icônes et dossiers des applications système (Poste de travail, ZebraAMP, Panneau de configuration, etc.) restent indépendants du contenu de BUREAU.

## Où sont passés les anciens dossiers ?

Les anciens dossiers de démonstration `AUDIO`, `ARTWORK`, `ARCHIVES` et `MAPS` ont été retirés à la demande du créateur. Les sons de démarrage restent intégrés dans le fichier d'assets du site et continuent de fonctionner.

