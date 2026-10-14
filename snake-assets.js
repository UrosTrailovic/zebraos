/* Atlas Zebra Snake. Tous les éléments sont des sprites découpés de la planche du studio.
   Chaque nom pointe sur sa propre zone ; PNG palettisé transparent de 5,6 Ko. */
(function(){
"use strict";
const image=new Image();image.src="/assets/games/zebra-snake-atlas.png?v=1";
const sprites={"logo":[2,2,105,54],"head_n":[114,2,12,21],"head_s":[136,2,14,21],"head_w":[154,4,21,16],"head_e":[176,5,21,15],"body_h":[108,24,22,16],"body_v":[133,24,16,20],"bend_ne":[152,27,21,16],"bend_nw":[175,26,21,17],"apple":[202,2,20,23],"berries":[224,2,22,23],"tree":[2,62,42,30],"bush":[48,66,32,28],"rocks":[85,66,26,25],"dry_grass":[116,65,30,26],"grass":[152,64,26,27],"stump":[182,66,32,23],"skull":[216,68,27,18],"grass_tile":[2,103,26,26],"sand_tile":[30,103,24,26],"dirt_tile":[57,104,26,24],"dry_tile":[85,103,25,26],"dark_tile":[112,104,26,25],"play":[144,104,21,20],"pause":[168,104,21,21],"restart":[190,104,21,20],"trophy":[212,104,21,20],"frame_corner":[146,127,17,19],"frame_h":[168,128,28,15],"frame_v":[201,127,13,30]};
function draw(ctx,name,dx,dy,w,h){
  const r=sprites[name];if(!r||!image.complete||!image.naturalWidth)return false;
  ctx.drawImage(image,r[0],r[1],r[2],r[3],Math.round(dx),Math.round(dy),Math.round(w),Math.round(h));
  return true;
}
window.ZebraSnakeArt={image,sprites,draw};
}());
