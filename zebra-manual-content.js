/* ZebraOS — notice de la machine, édition studio 2026.
 * Contenu rédigé d'après les applications et commandes réellement présentes.
 * Une page correspond à une feuille du manuel ; aucune feuille ne lance un programme.
 */
(function(){
"use strict";
const pages=[
{
 id:"accueil",group:"LE POSTE",label:"Couverture",title:"L'ORDINATEUR DU STUDIO",
 subtitle:"ZEBRAOS · Manuel d'utilisation · Édition 2026",
 lead:"Bienvenue devant la machine. Ce livret explique ce qu'elle contient, comment la mettre en route, et comment utiliser chaque instrument sans devoir l'ouvrir pour apprendre ses commandes.",
 illustration:"machine",
 sections:[
  {kind:"prose",title:"Avant de commencer",text:["ZebraOS représente un ordinateur de studio : écran, alimentation, sessions, bureau, programmes et fichiers. Il fonctionne dans le navigateur, mais son interface se manipule comme celle d'une vieille machine de bureau.","Le présent livret est une notice de fonctionnement, pas un menu de lancement. Choisis un chapitre dans le sommaire ou tourne les pages avec les boutons du bas."]},
  {kind:"index",title:"Inventaire de la machine",items:["01–02 · Mise en route, bureau et fichiers","03–06 · ZebraAMP et ZebraVIS, le circuit audio","07–09 · Tetris, Znake et Echo Racer","10–14 · ZebraPaint, ZebraSticky, ZebraPlanner","15 · Réglages, données et entretien"]},
  {kind:"note",title:"CONSIGNE",text:"Les captures fournies servent de référence pour les fonctions et commandes décrites. Les vues de repérage de ce livret sont des schémas simplifiés, pas des copies de l'interface."}
 ]
},
{
 id:"machine",group:"LE POSTE",label:"01 · Machine",title:"MISE SOUS TENSION",
 subtitle:"Alimentation · écran · sessions · extinction",
 lead:"La façade donne accès au système. Les éléments visuels imitent une machine physique, mais aucun processeur, disque ou circuit électronique n'est émulé.",
 illustration:"machine",
 sections:[
  {kind:"steps",title:"Procédure de démarrage",items:["Actionner le bouton d'alimentation de la façade.","Laisser passer la séquence de démarrage et l'identification ZebraOS.","Choisir la session Zebra ou Admin à l'écran de connexion.","Attendre l'ouverture du bureau avant de lancer un programme."]},
  {kind:"fields",title:"Repérage des organes",items:[["POWER","Commande l'allumage de la machine simulée."],["ÉCRAN","Affiche successivement démarrage, connexion et bureau."],["SESSION","Zebra : espace d'utilisation ; Admin : outils de gestion et modes techniques."],["ÉTEINDRE","Utiliser la commande système pour quitter proprement l'environnement."]]},
  {kind:"note",title:"À RETENIR",text:"Une session ZebraOS n'est pas un compte utilisateur sécurisé au sens informatique : les données sensibles ne doivent pas être publiées dans le dépôt du studio."}
 ]
},
{
 id:"bureau",group:"LE POSTE",label:"02 · Bureau",title:"BUREAU & FICHIERS",
 subtitle:"Souris · fenêtres · Poste de travail · Corbeille",
 lead:"Le bureau se comporte comme celui d'un ancien ordinateur : icônes libres, dossiers, fenêtres superposées, barre des tâches et menu Démarrer.",
 illustration:"desktop",
 sections:[
  {kind:"commands",title:"Commandes du bureau",items:[["DOUBLE-CLIC","Ouvrir un dossier, un fichier ou un programme sur ordinateur."],["1 PRESSION","Ouvrir une icône sur écran tactile."],["GLISSER","Déplacer un raccourci sur le bureau."],["CLIC DROIT","Ouvrir les commandes de l'icône, dont la mise à la Corbeille."],["_ / □ / ×","Réduire, agrandir ou fermer une fenêtre depuis sa barre de titre."]]},
  {kind:"prose",title:"Poste de travail",text:["Le dossier visible sur le bureau correspond aux fichiers publics du studio. Les sous-dossiers s'ouvrent dans l'explorateur ; les icônes, documents et médias appartiennent à la même arborescence.","Le bouton Démarrer donne accès aux programmes, aux dossiers Jeux et Outils, aux réglages et à la fermeture de session."]},
  {kind:"prose",title:"La Corbeille",text:["Placer un raccourci dans la Corbeille le retire du bureau ou des dossiers visibles de cette session sur l'appareil. Ce n'est pas une suppression du fichier GitHub.","Ouvrir la Corbeille puis appuyer sur RESTAURER pour le remettre en place. Echo Racer se trouve initialement dans la Corbeille de Zebra ; il reste directement présent dans Jeux pour Admin."]},
  {kind:"note",title:"MÉMOIRE",text:"Les positions des icônes et les objets de la Corbeille sont conservés localement, par session et sur l'appareil utilisé."}
 ]
},
{
 id:"amp",group:"AUDIO",label:"03 · ZebraAMP",title:"ZEBRAAMP · LECTEUR",
 subtitle:"Transport · façade · vumètre · écoute",
 lead:"ZebraAMP est le lecteur audio du studio. Il regroupe la lecture, la liste des morceaux, les réglages du signal et l'accès à ZebraVIS dans une seule façade.",
 illustration:"amp",
 sections:[
  {kind:"fields",title:"Panneau avant",items:[["ÉCRAN / CH 01","État de lecture, titre du morceau et durée écoulée / totale."],["MINI SPECTRE","Affichage des bandes d'énergie du morceau lorsqu'il est lu."],["BARRE DE PROGRESSION","Déplace la tête de lecture dans le morceau chargé."],["VOL.","Règle le volume de sortie du lecteur."],["PLAYLIST","Sélectionne la collection qui fournit les morceaux."]]},
  {kind:"commands",title:"Transport",items:[["Ⅰ◀","Morceau précédent."],["▶ / Ⅱ","Lecture et pause."],["■","Arrêt et retour au début du titre."],["▶Ⅰ","Morceau suivant."],["⇄","Active ou désactive l'ordre aléatoire."],["↻ ×","Active ou désactive la répétition du morceau actuel."],["VIS","Ouvre la fenêtre ZebraVIS, reliée au son du lecteur."]]},
  {kind:"note",title:"FIN DE LISTE",text:"Une fois le dernier titre terminé, le lecteur s'arrête. Le mode aléatoire ne force pas une répétition infinie : seule la répétition volontaire d'un morceau le rejoue."}
 ]
},
{
 id:"amp-playlists",group:"AUDIO",label:"04 · Bibliothèque",title:"BIBLIOTHÈQUE & PLAYLISTS",
 subtitle:"Albums officiels · fichiers personnels · actualisation",
 lead:"Le sélecteur PLAYLIST choisit la source des titres. Zebra Tape 2 et Zebralogy sont des albums indexés dans les fichiers publics du studio.",
 illustration:"playlist",
 sections:[
  {kind:"steps",title:"Écouter un album",items:["Ouvrir ZebraAMP et choisir Zebra Tape 2 ou Zebralogy dans PLAYLIST.","Repérer un morceau dans la liste ; le bouton ▶ de sa ligne le charge.","Employer les commandes de transport, puis la barre de progression pour naviguer dans le titre.","Si de nouveaux fichiers ont été publiés, utiliser ACTUALISER pour recharger l'index."]},
  {kind:"prose",title:"Créer une liste personnelle",text:["＋ NOUVELLE crée une playlist dont tu choisis le nom. ＋ IMPORTER DES SONS ajoute des fichiers audio depuis ton appareil.","Tu peux modifier une playlist personnelle et sa pochette avec ✎ ; les albums officiels restent des collections en lecture seule. Les fichiers audio ouverts depuis le bureau peuvent être regroupés dans une liste temporaire Fichiers ouverts."]},
  {kind:"fields",title:"Stockage des listes",items:[["ALBUMS","Leurs titres viennent des fichiers visibles dans le répertoire public du studio."],["PLAYLISTS PERSO","Noms et ordre conservés sur cet appareil ; fichiers audio locaux conservés dans le stockage du navigateur."],["POCHETTE","Cliquer sur l'image de couverture permet de l'agrandir."]]},
  {kind:"note",title:"IMPORTANT",text:"Les musiques ajoutées localement ne sont pas synchronisées vers un autre téléphone ou ordinateur. Les limites de stockage du navigateur s'appliquent."}
 ]
},
{
 id:"amp-son",group:"AUDIO",label:"05 · Circuit sonore",title:"LE CIRCUIT SONORE",
 subtitle:"Vitesse · réverbération · égaliseur cinq bandes",
 lead:"ZebraAMP agit sur le signal audio lu. Les réglages sont distincts : volume, vitesse de lecture, ambiance de réverbération et équilibre fréquentiel.",
 illustration:"equalizer",
 sections:[
  {kind:"fields",title:"Vitesse de lecture",items:[["50 à 150 %","Le curseur va de la demi-vitesse à une vitesse une fois et demie plus rapide, par pas de 5 %."],["100 %","Lecture normale ; ↺ 1× rétablit cette valeur."],["EFFET VINYLE","Quand la vitesse change, la hauteur sonore change naturellement avec elle."]]},
  {kind:"fields",title:"Réverbération",items:[["0 à 100 %","Le pourcentage dose l'effet d'espace."],["SEC","Aucune réverbération."],["DOUX / RÊVE / IMMENSE","Préréglages de 30 %, 65 % et 100 %."]]},
  {kind:"prose",title:"Égaliseur",text:["Ouvre ÉGALISEUR · 5 BANDES. Chaque curseur agit sur une zone du spectre : graves, bas-médiums, médiums, présence ou aigus.","Les profils Neutre, Basses, Clair, Vintage, Nuit et Voix fournissent des points de départ. REMETTRE À ZÉRO revient à la courbe neutre."]},
  {kind:"note",title:"CONSEIL D'ÉCOUTE",text:"Commence par le profil Neutre et une réverbération faible ; change une famille de réglages à la fois pour comprendre son effet sur le morceau."}
 ]
},
{
 id:"zebravis",group:"AUDIO",label:"06 · ZebraVIS",title:"ZEBRAVIS · INSTRUMENT VISUEL",
 subtitle:"Fréquences · oscilloscope · mouvement synchronisé",
 lead:"ZebraVIS observe l'audio de ZebraAMP et dessine une représentation animée du signal. Il ne produit pas de musique : il réagit au morceau en cours.",
 illustration:"vis",
 sections:[
  {kind:"fields",title:"Quatre instruments",items:[["SPECTRE 2000","Colonnes de fréquences : leur hauteur répond à l'énergie des bandes."],["OSCILLOSCOPE","Courbe qui suit la forme du signal ; un réglage de zoom est disponible."],["TUNNEL NÉON","Profondeur et mouvement réactifs au rythme, notamment aux basses."],["HYPERVITESSE","Traînées phosphorescentes liées aux variations du son."]]},
  {kind:"steps",title:"Utilisation",items:["Démarrer un morceau dans ZebraAMP.","Appuyer sur VIS dans le panneau de transport.","Parcourir les effets du visualiseur avec les commandes de la fenêtre.","Employer RÉGLAGES pour modifier l'effet actif, puis RÉINITIALISER si nécessaire."]},
  {kind:"note",title:"SIGNAL ABSENT",text:"Sans morceau en lecture, le visualiseur peut indiquer l'absence de signal. Ce n'est pas un défaut d'affichage : il ne simule pas un signal inexistant."}
 ]
},
{
 id:"tetris",group:"JEUX",label:"07 · Tetris",title:"TETRIS · CHUTE DES BLOCS",
 subtitle:"Empilement · lignes · réserve · vitesse",
 lead:"Dans Tetris, des pièces composées de quatre carrés descendent dans un puits. L'objectif est de compléter des lignes horizontales sans laisser la pile atteindre le haut.",
 illustration:"tetris",
 sections:[
  {kind:"fields",title:"Instruments de jeu",items:[["PLATEAU","Puits de dix colonnes et vingt lignes ; les blocs s'y empilent."],["SCORE / LIGNES / NIVEAU","Affichent les résultats et l'avancement de la partie."],["SUIVANT","Montre la prochaine pièce une fois la partie commencée."],["RÉSERVE","Garde une pièce à échanger ultérieurement."]]},
  {kind:"commands",title:"Commandes clavier",items:[["A / ←","Déplacer à gauche."],["D / →","Déplacer à droite."],["W / ↑","Tourner la pièce."],["S / ↓","Accélérer la descente."],["ESPACE","Poser instantanément la pièce."],["Q","Mettre en réserve / échanger."],["P","Mettre en pause."]]},
  {kind:"prose",title:"Manette tactile",text:["La croix directionnelle remplace les touches de mouvement. A tourne la pièce, B la pose, et SELECT commande la réserve.","Les boutons de la partie permettent la pause, le redémarrage, la musique et le retour au menu."]},
  {kind:"note",title:"RÈGLE DE BASE",text:"Observe SUIVANT pour anticiper un emplacement. Une ligne entièrement occupée disparaît et libère de la place pour la suite."}
 ]
},
{
 id:"znake-modes",group:"JEUX",label:"08 · Znake : modes",title:"ZNAKE · TROIS FAÇONS DE JOUER",
 subtitle:"Solo · contre robot · face-à-face local",
 lead:"Znake reprend le principe du serpent : il grandit en mangeant, mais ne peut pas traverser les murs ni son corps. Le menu propose trois modes distincts, chacun disponible sur quatre niveaux.",
 illustration:"snake",
 sections:[
  {kind:"fields",title:"Modes",items:[["SOLO","Un seul serpent. Ramasse les pommes pour rallonger le corps et monter le score ; évite les collisions."],["CONTRE ROBOT","Duel contre ZnakeBot. L'adversaire choisit des trajectoires, cherche la nourriture et tente d'éviter les pièges."],["VS LOCAL","Deux joueurs sur le même appareil. Chacun guide son serpent dans une arène commune."]]},
  {kind:"prose",title:"Le robot",text:["ZnakeBot ne suit pas un tracé figé. Il évalue l'espace accessible, les obstacles, la position de l'autre serpent et la nourriture.","Sa prise de décision devient progressivement plus précise entre le niveau 1 et le niveau 4 : il commet moins de choix sous-optimaux et privilégie davantage les routes sûres."]},
  {kind:"fields",title:"Quatre niveaux",items:[["NIVEAU 1","Rythme accessible, découverte des commandes."],["NIVEAU 2","Déplacements plus rapides et anticipation accrue."],["NIVEAU 3","Terrain plus nerveux avec un habillage spécifique."],["NIVEAU 4","Cadence la plus élevée et difficulté maximale."]]},
  {kind:"note",title:"TABLEAU DES SCORES",text:"SCOREBOARD rassemble les meilleurs scores enregistrés localement, séparément pour chaque mode et chaque niveau."}
 ]
},
{
 id:"znake-controls",group:"JEUX",label:"09 · Znake : commandes",title:"ZNAKE · PILOTAGE & DUEL",
 subtitle:"Croix directionnelle · OK · pause · deux joueurs",
 lead:"Les deux serpents avancent automatiquement. Tu leur indiques une direction ; un demi-tour instantané sur leur propre corps n'est pas autorisé.",
 illustration:"snake-duel",
 sections:[
  {kind:"commands",title:"Sur ordinateur",items:[["W / Z","Joueur 1 : haut."],["A / Q","Joueur 1 : gauche."],["S / D","Joueur 1 : bas / droite."],["FLÈCHES","En VS LOCAL, directions du joueur 2 ; dans les autres modes, contrôle du joueur 1."],["ESPACE / ENTRÉE","Valider le menu, démarrer, reprendre ou ouvrir la pause."],["ÉCHAP","Revenir dans le menu ou les réglages."]]},
  {kind:"prose",title:"Sur téléphone",text:["Le bloc directionnel inférieur sert au joueur 1 ; son centre OK confirme les choix. Le plateau accepte aussi les glissements directionnels pendant la partie.","En VS LOCAL, un second bloc de direction apparaît au-dessus de l'arène, tourné vers le joueur 2 installé face au premier. Les deux disposent de commandes séparées."]},
  {kind:"steps",title:"Préparer un duel",items:["Dans le menu, choisir CONTRE ROBOT ou VS LOCAL.","Sélectionner un niveau de 1 à 4.","Valider avec ESPACE ou le bouton OK de la manette.","En cours de partie, utiliser les commandes de pause pour reprendre, recommencer, régler la musique ou retourner au menu."]},
  {kind:"note",title:"COLLISIONS",text:"Une collision contre le mur, soi-même ou l'autre serpent termine le duel. Une rencontre frontale simultanée peut aboutir à une égalité."}
 ]
},
{
 id:"echo",group:"JEUX",label:"10 · Echo Racer",title:"ECHO RACER 2 BETA",
 subtitle:"Tunnel phosphore · quatre niveaux · nitro · impulsion",
 lead:"Le pilote évolue autour de la paroi d'un tunnel lumineux. Le but est de traverser les passages, éviter les obstacles et terminer quatre parcours sur leur bande musicale respective.",
 illustration:"racer",
 sections:[
  {kind:"fields",title:"Le circuit",items:[["QUATRE NIVEAUX","Sélection par images, avec déblocage progressif après les parcours réussis."],["TROIS VIES","Les collisions réduisent les chances de terminer la course."],["TURBO / NITRO","Accélération temporaire ; les pads permettent d'entretenir une chaîne de boost."],["PULSE","Action de destruction, disponible via la commande Q ou le bouton A."]]},
  {kind:"commands",title:"Pilotage",items:[["← / → ou A / D","Tourner autour du tunnel."],["↑ / ↓ ou W / S","Agir sur la vitesse."],["ESPACE / B","Maintenir le nitro."],["Q / A","Déclencher l'impulsion."],["P / SELECT","Mettre en pause."]]},
  {kind:"prose",title:"Mode TEST",text:["Le mode TEST et son atelier de paramètres sont réservés à la session Admin. Le joueur Zebra dispose des commandes normales JOUER et QUITTER.","En Zebra, le raccourci est initialement dans la Corbeille locale. Il est restaurable dans le dossier Jeux."]},
  {kind:"note",title:"COURSE ET MUSIQUE",text:"La fin d'un niveau suit la bande sonore du parcours, avec une courte sortie cinématique. Les obstacles, la vitesse et le mouvement deviennent plus exigeants avec la progression."}
 ]
},
{
 id:"paint",group:"OUTILS",label:"11 · ZebraPaint",title:"ZEBRAPAINT · PLAN DE TRAVAIL",
 subtitle:"640 × 400 · outils · palette · précision",
 lead:"ZebraPaint est un atelier de dessin à calques. Une surface de 640 × 400 pixels reçoit les traits, les aplats, les formes et les photos importées.",
 illustration:"paint",
 sections:[
  {kind:"fields",title:"Zones de l'éditeur",items:[["BANDEAU SUPÉRIEUR","Nouveau projet, importer une photo, ajouter un calque, exporter PNG et projet .zpaint."],["OUTILS","Sélection, crayon, pinceau, gomme, remplir, pipette, ligne, rectangle, ellipse."],["PLAN DE TRAVAIL","Toile centrale, où les calques se composent dans l'ordre choisi."],["CALQUES","Vignettes, visibilité, position, verrouillage, duplication et suppression."],["PALETTE","Couleurs prédéfinies, couleur libre et taille du trait."]]},
  {kind:"commands",title:"Raccourcis clavier",items:[["CTRL / CMD + Z","Annuler la dernière modification."],["CTRL / CMD + Y","Rétablir une modification annulée."],["CTRL / CMD + MAJ + Z","Autre commande de rétablissement."],["CTRL / CMD + S","Exporter une image PNG."]]},
  {kind:"note",title:"CONSEIL",text:"Avant de dessiner sur une photo, ajoute un Calque dessin placé au-dessus de l'image : tu pourras modifier le trait sans toucher aux pixels de la photo."}
 ]
},
{
 id:"paint-layers",group:"OUTILS",label:"12 · Calques",title:"ZEBRAPAINT · CALQUES & IMAGES",
 subtitle:"Ordre · transparence · transformations",
 lead:"Chaque calque est une feuille indépendante. Le sommet de la pile apparaît devant ; les calques du dessous restent visibles là où ceux du dessus sont transparents.",
 illustration:"layers",
 sections:[
  {kind:"steps",title:"Placer une image sous un dessin",items:["Importer la photo avec ＋ IMPORTER PHOTO : elle crée un calque image.","Ajouter ＋ CALQUE DESSIN, puis tracer sur cette feuille transparente.","Dans CALQUES, utiliser les flèches ↑ et ↓ pour ordonner les feuilles.","Laisser la photo sous le dessin et le Fond tout en bas. Le Fond blanc ne peut pas être remonté devant l'image."]},
  {kind:"fields",title:"Commandes d'un calque",items:[["◉ / ○","Afficher ou masquer la feuille."],["↑ / ↓","Monter ou descendre dans la pile, devant ou derrière."],["CADENAS","Bloquer / débloquer les modifications."],["⧉","Dupliquer le calque."],["✎ / ×","Renommer ou supprimer."]]},
  {kind:"prose",title:"Transformer une image",text:["Avec Sélection, glisser la photo pour la déplacer ; utiliser ses poignées pour changer la taille ou faire tourner l'image.","Le panneau TRANSFORMER offre la rotation, l'inclinaison, l'opacité, les miroirs horizontal/vertical, le centrage et la remise à zéro. L'échelle va de 10 à 500 %."]},
  {kind:"note",title:"À NE PAS CONFONDRE",text:"Déplacer un calque dans la pile change son ordre d'affichage, pas sa position dans l'image. Déplacer la photo sur la toile change sa position, pas son rang."}
 ]
},
{
 id:"paint-save",group:"OUTILS",label:"13 · Enregistrer",title:"ZEBRAPAINT · CONSERVATION",
 subtitle:"Brouillon local · .zpaint · PNG · annuler",
 lead:"Fermer la fenêtre ne doit plus effacer le dessin : ZebraPaint garde un brouillon avec les calques, les images et leurs transformations dans le navigateur de la session.",
 illustration:"archive",
 sections:[
  {kind:"fields",title:"Trois formes de sauvegarde",items:[["BROUILLON","Sauvegarde automatique locale ; rouvre ZebraPaint sur le même appareil et dans la même session pour retrouver le projet."],["PROJET .ZPAINT","Fichier que tu télécharges. Il conserve les calques éditables et permet de réouvrir le travail plus tard."],["PNG","Image finale aplatie : pratique pour partager, mais sans calques modifiables."]]},
  {kind:"steps",title:"Sauvegarder une copie indépendante",items:["Terminer ou interrompre le travail sur la toile.","Cliquer sur 💾 PROJET .ZPAINT dans le bandeau supérieur.","Conserver le fichier téléchargé dans un dossier de ton appareil.","Pour le rouvrir, utiliser 📂 OUVRIR PROJET et sélectionner ce fichier."]},
  {kind:"prose",title:"Annuler et recommencer",text:["Le bouton ANNULER revient sur les modifications précédentes. RÉTABLIR revient en avant si tu as annulé.","NOUVEAU lance une nouvelle toile après confirmation. Pour une conservation durable hors du navigateur, garde aussi un export .zpaint."]},
  {kind:"note",title:"STOCKAGE LOCAL",text:"Le brouillon automatique n'est pas partagé entre appareils. Effacer les données du navigateur peut le faire disparaître ; un fichier .zpaint téléchargé offre une copie séparée."}
 ]
},
{
 id:"sticky",group:"OUTILS",label:"14 · ZebraSticky",title:"ZEBRASTICKY · POST-IT",
 subtitle:"Notes visibles sur le bureau · couleurs · déplacement",
 lead:"ZebraSticky transforme le bureau en panneau de notes. Les post-it restent visibles lorsque la fenêtre de gestion est fermée, et leur contenu est gardé sur l'appareil.",
 illustration:"sticky",
 sections:[
  {kind:"steps",title:"Créer une note",items:["Ouvrir ZebraSticky depuis le dossier Outils.","Appuyer sur ＋ NOUVEAU POST-IT.","Écrire dans la zone de texte du post-it ou dans la fenêtre de gestion.","Choisir jaune, rose, bleu ou vert pour repérer les notes."]},
  {kind:"fields",title:"Manipuler un post-it",items:[["BANDE SUPÉRIEURE","Cliquer et glisser pour déplacer la note sur le bureau."],["ZONE DE TEXTE","Éditer le contenu ; les changements sont conservés localement."],["POINTS DE COULEUR","Changer rapidement la teinte du papier."],["×","Supprimer la note, après confirmation."]]},
  {kind:"prose",title:"Fenêtre de gestion",text:["Elle affiche toutes les notes, leur couleur et leur texte. Tu peux modifier une note sans la retrouver visuellement sur le bureau.","Jusqu'à quarante post-it sont pris en charge par session."]},
  {kind:"note",title:"SUR LE BUREAU",text:"Fermer la fenêtre ZebraSticky ne supprime pas les post-it. Les supprimer est une action distincte."}
 ]
},
{
 id:"planner",group:"OUTILS",label:"15 · ZebraPlanner",title:"ZEBRAPLANNER · AGENDA",
 subtitle:"Mois · jours · tâches · rappels personnels",
 lead:"ZebraPlanner est un calendrier local. Il sert à organiser des notes datées et des tâches, avec une heure facultative et une case à cocher pour suivre l'avancement.",
 illustration:"planner",
 sections:[
  {kind:"steps",title:"Inscrire une tâche",items:["Ouvrir ZebraPlanner et choisir un jour dans le calendrier.","Saisir l'intitulé de la tâche dans le champ inférieur.","Ajouter une heure si nécessaire ; elle reste facultative.","Appuyer sur AJOUTER. La tâche apparaît pour la date sélectionnée."]},
  {kind:"fields",title:"Commandes du calendrier",items:[["‹ / ›","Passer au mois précédent ou suivant."],["AUJOURD'HUI","Revenir au mois et au jour actuels."],["CHIFFRE D'UN JOUR","Ouvrir le programme de cette date."],["CASE À COCHER","Marquer une tâche comme terminée."],["×","Supprimer un événement ou une tâche."]]},
  {kind:"prose",title:"Lecture de l'agenda",text:["Les jours portant des tâches sont signalés dans la grille. Sous le calendrier, la liste sélectionnée est triée par heure lorsqu'elle est renseignée.","Les informations sont gardées sur l'appareil et associées à la session ZebraOS ; ce n'est pas une synchronisation avec le calendrier du téléphone."]},
  {kind:"note",title:"LIMITE DU REGISTRE",text:"Le calendrier conserve jusqu'à 600 tâches dans la session locale. Évite d'y placer des informations confidentielles si l'appareil est partagé."}
 ]
},
{
 id:"reglages",group:"RÉFÉRENCE",label:"16 · Réglages",title:"RÉGLAGE DE L'ORDINATEUR",
 subtitle:"Fond · sons · heure · système · performances",
 lead:"Le panneau de configuration regroupe les réglages de la machine. Bienvenue / Guide des programmes ouvre ce manuel, sans lancer les programmes décrits.",
 illustration:"desktop",
 sections:[
  {kind:"fields",title:"Les instruments de configuration",items:[["FOND D'ÉCRAN","Choisir ou importer l'apparence du bureau."],["SONS","Activer ou désactiver les sons de l'interface, tester les clics."],["DATE ET HEURE","Changer l'horloge et le fuseau affichés uniquement dans ZebraOS."],["SYSTÈME / À PROPOS","Lire les informations de l'environnement simulé."],["PERFORMANCES","Observer les images par seconde de l'onglet ; ce n'est pas le compteur interne des jeux."]]},
  {kind:"prose",title:"Entretien des données",text:["Les notes, tâches, dispositions du bureau et certains réglages sont enregistrés dans le navigateur et ne sont pas automatiquement recopiés ailleurs.","Les morceaux officiels sont des fichiers publics du studio ; les morceaux personnels importés dans ZebraAMP et les brouillons ZebraPaint sont spécifiques à l'appareil."]},
  {kind:"steps",title:"Si un programme paraît vide",items:["Vérifier d'abord la session active et le dossier où se trouve le programme.","Pour ZebraAMP, actualiser la bibliothèque et vérifier si des morceaux sont présents.","Pour ZebraPaint, rouvrir dans la même session ou importer une copie .zpaint.","Pour un raccourci absent, inspecter la Corbeille locale et utiliser RESTAURER si nécessaire."]},
  {kind:"note",title:"FIN DE NOTICE",text:"Tu peux revenir au sommaire ou fermer cette fenêtre. Le manuel ne démarre aucune application à ta place."}
 ]
}
];
window.ZebraManualContent=Object.freeze(pages);
}());