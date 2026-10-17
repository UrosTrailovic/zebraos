# Musiques de Znak

Dans `audio.json`, remplacer `null` par le chemin du fichier audio souhaité :

```json
{
  "music": "/assets/games/snake/music.ogg",
  "lose": "/assets/games/snake/lose.ogg"
}
```

MP3, OGG ou WAV selon le navigateur. `music` boucle pendant la partie et s’arrête en pause. `lose` démarre dès l’impact : prévoir 3 secondes, le titre GAME OVER apparaît après 2 secondes et laisse la dernière seconde jouer. Relancer coupe immédiatement le son de défaite. Les sons synthétisés servent de remplacement tant qu’aucun fichier n’est défini ou si son chargement échoue. Les sons respectent le réglage muet du système. Le manifeste est chargé à chaque ouverture du jeu.
