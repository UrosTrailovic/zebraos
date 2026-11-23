/* Pages d'aide de Bienvenue — programmes présents dans les captures du studio.
 * Une page = une application. Aucun lien ne lance le programme.
 */
(function(){
"use strict";
window.ZebraManualContent=[
{
 id:"amp",name:"ZebraAMP",intro:"Le lecteur musical de ZebraOS. Il permet d'écouter les albums, d'importer ses morceaux et de modifier le son pendant la lecture.",
 sections:[
  {title:"Le lecteur",image:"amp.webp",description:"L'écran affiche le morceau chargé, sa durée et le spectre audio. La barre de progression permet de se déplacer dans le titre.",items:[
   ["Ⅰ◀ / ▶ / ■ / ▶Ⅰ","Titre précédent, lecture/pause, arrêt, titre suivant."],
   ["⇄","Lecture aléatoire."],
   ["↻","Répéter le morceau en cours. En l'absence de répétition, le lecteur s'arrête à la fin de la playlist."],
   ["VOL.","Régler le volume du lecteur."],
   ["VIS","Ouvrir ZebraVIS, le visualiseur relié au signal de ZebraAMP."]
  ]},
  {title:"Les commandes et l'égaliseur",image:"amp-controls.webp",description:"Les boutons de transport, le volume et l'égaliseur sont de vrais réglages sonores, pas des animations.",items:[
   ["ÉGALISEUR · 5 BANDES","Modifier les graves, les bas-médiums, les médiums, la présence et les aigus."],
   ["Préréglages","Neutre, Basses, Clair, Vintage, Nuit et Voix. Le bouton de remise à zéro rétablit l'équilibre neutre."],
   ["Lecture","Cliquer sur un titre dans la playlist pour le charger, puis utiliser les boutons de transport."]
  ]},
  {title:"Playlists et morceaux",image:"amp-playlists.webp",description:"Les collections Zebra Tape 2 et Zebralogy reprennent les fichiers de ZebraOS. Les playlists personnelles se créent à part.",items:[
   ["PLAYLIST","Choisir l'album ou la liste que l'on veut écouter."],
   ["＋ NOUVELLE","Créer une playlist personnelle et lui donner un nom."],
   ["＋ IMPORTER DES SONS","Ajouter un ou plusieurs fichiers audio depuis l'appareil."],
   ["✎","Modifier le nom et la pochette d'une playlist personnelle."],
   ["ACTUALISER","Rechercher de nouveau les morceaux disponibles."]
  ]},
  {title:"Vitesse de lecture",image:"amp-speed.webp",description:"Le curseur passe de 50 à 150 %. À 100 %, la lecture est normale. Comme sur un vinyle, modifier la vitesse modifie aussi la hauteur du son.",items:[
   ["50–150 %","Ralentir ou accélérer la lecture par étapes de 5 %."],
   ["↺ 1×","Revenir immédiatement à 100 %."]
  ]},
  {title:"Réverbération",image:"amp-reverb.webp",description:"La réverbération ajoute une impression d'espace au morceau sans modifier le fichier d'origine.",items:[
   ["0–100 %","Dosage de l'effet."],
   ["SEC / DOUX / RÊVE / IMMENSE","Préréglages : 0 %, 30 %, 65 % et 100 %."]
  ]},
  {title:"ZebraVIS",image:"zebravis.webp",description:"La fenêtre VIS représente le vrai signal lu par ZebraAMP. Elle ne joue pas un morceau indépendamment.",items:[
   ["Spectre 2000","Colonnes indiquant l'énergie des fréquences."],
   ["Oscilloscope","Courbe qui suit le signal audio."],
   ["Tunnel néon","Mouvements réactifs au rythme et aux basses."],
   ["Hypervitesse","Traînées phosphorescentes synchronisées à la musique."],
   ["Réglages","Modifier l'effet choisi ou réinitialiser ses paramètres. Sans audio en lecture, le visualiseur peut indiquer qu'il n'y a pas de signal."]
  ]}
 ]
},
{
 id:"tetris",name:"ZebraTetris",intro:"Empiler les pièces qui descendent, compléter des lignes horizontales et éviter de remplir le haut du plateau.",
 sections:[
  {title:"Le plateau et les contrôles",image:"tetris.webp",description:"Le panneau de gauche affiche le score, le niveau et les lignes. À droite se trouvent la pièce suivante et la pièce mise en réserve.",items:[
   ["A / D ou ← / →","Déplacer la pièce à gauche ou à droite."],
   ["W ou ↑","Tourner la pièce."],
   ["S ou ↓","Accélérer sa descente."],
   ["ESPACE","Poser immédiatement la pièce."],
   ["Q","Conserver une pièce en réserve ou l'échanger."],
   ["P","Mettre en pause ou reprendre."],
   ["Manette tactile","Croix directionnelle pour se déplacer, A pour tourner, B pour poser et SELECT pour la réserve."],
   ["MUSIC ON/OFF","Activer ou couper la musique du jeu."]
  ]},
  {title:"Comment marquer des points",description:"Une ligne remplie sur toute la largeur disparaît. Plusieurs lignes complétées d'un coup rapportent davantage. La vitesse augmente avec le niveau.",items:[
   ["SUIVANT","Observer la prochaine pièce pour préparer la place."],
   ["RÉSERVE","Garder une pièce utile pour une autre situation."],
   ["RESTART","Relancer une nouvelle partie."],
   ["MENU","Revenir à l'accueil du jeu."]
  ]}
 ]
},
{
 id:"znake",name:"Znake",intro:"Le jeu du serpent, en solo ou en duel. Manger une pomme agrandit le serpent et augmente le score ; heurter un mur ou un corps met fin à la partie.",
 sections:[
  {title:"Choisir un mode",image:"znake-menu.webp",description:"Le menu de départ permet de choisir le mode de jeu puis l'un des quatre niveaux.",items:[
   ["SOLO","Un seul serpent. Ramasser les pommes sans se cogner."],
   ["CONTRE ROBOT","Affronter ZnakeBot, qui cherche les pommes, analyse les chemins et évite les obstacles."],
   ["VS LOCAL","Jouer à deux sur le même ordinateur ou téléphone, avec un serpent par joueur."],
   ["NIVEAUX 1 À 4","La vitesse augmente ; le robot devient plus habile dans les niveaux élevés."],
   ["SCOREBOARD","Consulter les meilleurs scores enregistrés pour chaque mode et niveau."]
  ]},
  {title:"Commandes et duel",image:"znake-versus.webp",description:"Les serpents avancent automatiquement. Il faut leur indiquer la direction. Un demi-tour instantané est impossible.",items:[
   ["Joueur 1","W ou Z : haut · A ou Q : gauche · S : bas · D : droite."],
   ["Joueur 2 (VS LOCAL)","Touches fléchées sur ordinateur."],
   ["Sur téléphone","Croix et bouton OK. En VS LOCAL, une deuxième croix apparaît au-dessus du terrain pour jouer face à face."],
   ["ESPACE / ENTRÉE","Valider, lancer, mettre en pause ou reprendre."],
   ["ÉCHAP","Revenir au menu ou ouvrir la pause."],
   ["Menu PAUSE","Reprendre, recommencer, couper la musique ou revenir au menu."]
  ]}
 ]
},
{
 id:"paint",name:"ZebraPaint",intro:"L'atelier de dessin de ZebraOS. Sa toile de 640 × 400 pixels accueille des traits, des formes et des photos sur plusieurs calques.",
 sections:[
  {title:"La surface de dessin",image:"paint.webp",description:"Les outils sont à gauche, la toile au centre, les calques et leurs réglages dans les autres panneaux.",items:[
   ["Pinceau","Tracer librement avec la couleur et la taille choisies."],
   ["Gomme","Effacer sur le calque de dessin sélectionné."],
   ["Remplissage / Pipette","Remplir une zone ou prélever une couleur."],
   ["Ligne / Rectangle / Ellipse","Tracer des formes."],
   ["Couleurs / TAILLE","Choisir une teinte et l'épaisseur du trait."],
   ["ANNULER / RÉTABLIR","Revenir en arrière ou réappliquer une action."]
  ]},
  {title:"Images et calques",description:"Chaque calque est indépendant. Une photo peut rester derrière un dessin transparent sans cacher les traits.",items:[
   ["＋ IMPORTER PHOTO","Ajouter une image sur son propre calque."],
   ["＋ CALQUE DESSIN","Créer une couche transparente pour dessiner sans modifier la photo."],
   ["↑ / ↓","Faire passer le calque devant ou derrière les autres. Le Fond reste au bas de la pile."],
   ["Afficher / Verrouiller","Cacher temporairement un calque ou empêcher sa modification."],
   ["TRANSFORMER","Déplacer, redimensionner, tourner, incliner, changer l'opacité ou retourner l'image."],
   ["Dupliquer / Supprimer","Copier un calque ou l'enlever du projet."]
  ]},
  {title:"Sauvegarder et reprendre",description:"Un brouillon est enregistré automatiquement dans le navigateur pour chaque session. Fermer la fenêtre n'efface normalement pas le travail.",items:[
   ["PROJET .ZPAINT","Télécharger une copie complète qui conserve les calques modifiables."],
   ["OUVRIR PROJET","Recharger un fichier .zpaint enregistré."],
   ["ENREGISTRER PNG","Exporter l'image finale sans les calques."],
   ["NOUVEAU","Créer une toile vierge, après confirmation."]
  ]},
  {title:"À savoir",description:"Les brouillons restent sur cet appareil et dans ce navigateur ; ils ne sont pas synchronisés. Pour conserver un dessin indépendamment du navigateur, exporter un fichier .zpaint.",items:[]}
 ]
},
{
 id:"sticky",name:"ZebraSticky",intro:"Des post-it que l'on peut poser librement sur le bureau et retrouver après la fermeture de la fenêtre de gestion.",
 sections:[
  {title:"Créer et déplacer ses notes",image:"sticky.webp",description:"ZebraSticky gère des notes indépendantes, colorées et visibles sur le bureau.",items:[
   ["＋ NOUVEAU POST-IT","Créer une nouvelle note."],
   ["Zone de texte","Rédiger une idée, un rappel ou des paroles. Le texte est conservé localement."],
   ["Bande supérieure","Glisser le post-it pour le déplacer sur le bureau."],
   ["Pastilles de couleur","Choisir jaune, rose, bleu ou vert pour distinguer les notes."],
   ["×","Supprimer une note après confirmation."],
   ["Fenêtre de gestion","Retrouver et modifier les notes existantes. Limite : 40 post-it par session."]
  ]}
 ]
},
{
 id:"planner",name:"ZebraPlanner",intro:"Un agenda local pour organiser les événements et les tâches quotidiennes, avec dates, heures et suivi de réalisation.",
 sections:[
  {title:"Utiliser le calendrier",image:"planner.webp",description:"Le mois est affiché en grille. Choisir un jour pour voir ses tâches et en ajouter.",items:[
   ["‹ / ›","Passer au mois précédent ou suivant."],
   ["AUJOURD'HUI","Revenir au jour actuel."],
   ["Cliquer sur une date","Afficher les tâches enregistrées pour cette journée."],
   ["Nouvelle tâche","Écrire son intitulé, choisir éventuellement une heure, puis AJOUTER."],
   ["Case à cocher","Marquer une tâche terminée ou la remettre à faire."],
   ["×","Supprimer une tâche."]
  ]},
  {title:"Conservation",description:"Les tâches sont enregistrées sur l'appareil, dans la session ZebraOS actuelle. Elles ne sont pas synchronisées avec le calendrier du téléphone. Le calendrier accepte jusqu'à 600 tâches.",items:[]}
 ]
}
];
}());