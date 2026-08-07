/* ============================================================
   HUNGRY HOLE — Biome Renderer (100% pixel art)
   ============================================================ */
import { mulberry32 } from "./save";
import type { BiomeDef } from "./biomes";
export const W = 640;
export const H = 360;
export const GROUND_Y = 210;
const PX = 2;
const snap = (v:number)=>Math.round(v/PX)*PX;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const lerpC=(c1:string,c2:string,t:number)=>{const p=(c:string)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];const[r1,g1,b1]=p(c1);const[r2,g2,b2]=p(c2);return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;}
function pr(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,col:string){ctx.fillStyle=col;ctx.fillRect(snap(x),snap(y),Math.max(PX,snap(w)),Math.max(PX,snap(h)));}
function pxHill(ctx:CanvasRenderingContext2D,cx:number,baseY:number,r:number,col:string){ctx.fillStyle=col;for(let y=0;y<r;y+=PX){const w=Math.sqrt(Math.max(0,r*r-y*y));ctx.fillRect(snap(cx-w),snap(baseY-y-PX),Math.max(PX,snap(w*2)),PX);}}
function pxEll(ctx:CanvasRenderingContext2D,cx:number,cy:number,rx:number,ry:number,col:string,topHalf=false){ctx.fillStyle=col;for(let y=-ry;y<=(topHalf?0:ry);y+=PX){const w=rx*Math.sqrt(Math.max(0,1-(y*y)/(ry*ry)));if(w<0.5)continue;ctx.fillRect(snap(cx-w),snap(cy+y),Math.max(PX,snap(w*2)),PX);}}
function pxTri(ctx:CanvasRenderingContext2D,cx:number,apexY:number,halfW:number,baseY:number,col:string){ctx.fillStyle=col;const h=Math.max(PX,baseY-apexY);for(let y=0;y<h;y+=PX){const w=halfW*(y/h);ctx.fillRect(snap(cx-w),snap(apexY+y),Math.max(PX,snap(w*2)),PX);}}
function pxPath(ctx:CanvasRenderingContext2D,f:(t:number)=>[number,number],thick:number,col:string,steps=40){ctx.fillStyle=col;const t2=Math.max(PX,snap(thick));for(let i=0;i<=steps;i++){const[x,y]=f(i/steps);ctx.fillRect(snap(x-thick/2),snap(y-thick/2),t2,t2);}}
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,col:string,a:number){const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,col+Math.round(Math.min(1,a)*255).toString(16).padStart(2,"0"));g.addColorStop(1,col+"00");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
interface Mote{x:number;y:number;ph:number;s:number}
interface Deco{x:number;y:number;k:number;ph:number}
interface Cloud{x:number;y:number;s:number;v:number;a:number}
interface Critter{x:number;y:number;baseY:number;ph:number;v:number;c:string;dir:number}
export class WorldEnv{
biome:BiomeDef;private rng:()=>number;private clouds:Cloud[]=[];private motes:Mote[]=[];private decos:Deco[]=[];private critters:Critter[]=[];private shoot={x:-100,y:0,t:0,active:false};
constructor(seed=1,biome:BiomeDef){this.rng=mulberry32(seed);this.biome=biome;this.rebuild();}
setBiome(b:BiomeDef){this.biome=b;this.rebuild();}
private rebuild(){const r=this.rng;this.clouds=[];this.motes=[];this.decos=[];this.critters=[];if(this.biome.kind==="meadow"){for(let i=0;i<7;i++)this.clouds.push({x:r()*W,y:14+r()*66,s:0.6+r()*0.9,v:4+r()*8,a:0.55+r()*0.4});const cols=["#ff9ec8","#9adcff","#ffe066"];for(let i=0;i<4;i++)this.critters.push({x:r()*W,y:0,baseY:96+r()*130,ph:r()*6.28,v:11+r()*13,c:cols[i%3],dir:r()>0.5?1:-1});}for(let i=0;i<46;i++)this.motes.push({x:r()*W,y:r()*H,ph:r()*6.28,s:r()>0.6?PX:1});for(let i=0;i<26;i++)this.decos.push({x:14+r()*(W-28),y:GROUND_Y+14+r()*(H-GROUND_Y-26),k:Math.floor(r()*4),ph:r()*6.28});}
update(dt:number){const mode=this.biome.particle.mode;for(const m of this.motes){m.ph+=dt;if(mode==="rise"){m.y-=(14+m.s*6)*dt;if(m.y<-4){m.y=H+4;m.x=this.rng()*W;}}else if(mode==="fall"){m.y+=(16+m.s*8)*dt;if(m.y>H+4){m.y=-4;m.x=this.rng()*W;}}else{m.x+=Math.sin(m.ph*0.5)*10*dt+4*dt;m.y+=Math.cos(m.ph*0.4)*7*dt;}if(m.x>W+4)m.x=-4;if(m.x<-4)m.x=W+4;if(m.y>H+4)m.y=-4;if(m.y<-4)m.y=H+4;}for(const c of this.clouds){c.x+=c.v*dt;if(c.x>W+90)c.x=-90;}for(const b of this.critters){b.x+=b.v*b.dir*dt;b.y=b.baseY+Math.sin(b.ph+performance.now()/700)*16;if(b.x>W+16)b.x=-16;if(b.x<-16)b.x=W+16;}if((this.biome.kind==="star"||this.biome.kind==="cosmic")&&!this.shoot.active&&this.rng()<dt*0.15){this.shoot={x:60+this.rng()*400,y:12+this.rng()*60,t:0,active:true};}if(this.shoot.active){this.shoot.t+=dt;this.shoot.x+=260*dt;this.shoot.y+=60*dt;if(this.shoot.t>0.7)this.shoot.active=false;}}
draw(ctx:CanvasRenderingContext2D,t:number,night:number,holeX:number,holeR:number,mystery=0,menuScene=false){const b=this.biome;const dark=Math.max(night,b.kind==="meadow"?0:0.15);const sky=ctx.createLinearGradient(0,0,0,GROUND_Y+20);sky.addColorStop(0,lerpC(b.sky[0],"#02030a",dark*0.4));sky.addColorStop(0.6,b.sky[1]);sky.addColorStop(1,b.sky[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,W,GROUND_Y+4);this.drawSky(ctx,t);this.drawHorizon(ctx,t);const gg=ctx.createLinearGradient(0,GROUND_Y,0,H);gg.addColorStop(0,b.ground[0]);gg.addColorStop(1,b.ground[1]);ctx.fillStyle=gg;ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);pr(ctx,0,GROUND_Y,W,PX,b.groundLine);pr(ctx,0,GROUND_Y+PX,W,PX,"rgba(0,0,0,0.25)");this.drawSignature(ctx,t,holeX,holeR);if(b.id==="dragon")this.drawDragonRoom(ctx,t,holeX,holeR);this.drawDecos(ctx,t,holeX,holeR);if(menuScene&&this.biome.kind==="meadow")this.drawMenuExtras(ctx,t,holeX,holeR);this.drawCritters(ctx,t);this.drawMotes(ctx,t);if(mystery>0.01)this.drawMystery(ctx,t,mystery);ctx.fillStyle=b.tint;ctx.fillRect(0,0,W,H);if(night>0){ctx.fillStyle=`rgba(6,8,28,${night*0.3})`;ctx.fillRect(0,0,W,H);}const vg=ctx.createRadialGradient(W/2,H/2,H*0.5,W/2,H/2,H*0.98);vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,b.vignette);ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);}
private drawSky(ctx:CanvasRenderingContext2D,t:number){const k=this.biome.kind;if(k==="meadow"){glow(ctx,528,56,74,"#ffe8a0",0.5);pxEll(ctx,528,56,16,16,"#fff3c0");pxEll(ctx,528,56,11,11,"#fffdf0");for(const c of this.clouds){const s=c.s;ctx.globalAlpha=c.a;pr(ctx,c.x,c.y,40*s,8*s,"#ffffff");pr(ctx,c.x+8*s,c.y-6*s,22*s,8*s,"#ffffff");pr(ctx,c.x+20*s,c.y-10*s,14*s,10*s,"#ffffff");pr(ctx,c.x+4*s,c.y+6*s,30*s,4*s,"#dceaf6");ctx.globalAlpha=1;}}if(k==="star"||k==="cosmic"||k==="void"||k==="abyss"){for(let i=0;i<60;i++){const sx=snap((i*97+13)%W);const sy=snap((i*53+7)%(GROUND_Y-10));const tw=0.4+0.6*Math.abs(Math.sin(t*1.3+i));ctx.globalAlpha=tw*(k==="abyss"?0.35:0.85);ctx.fillStyle=i%7===0?this.biome.accent:"#ffffff";const s=i%5===0?PX:1;ctx.fillRect(sx,sy,s,s);}ctx.globalAlpha=1;if(this.shoot.active){ctx.globalAlpha=1-this.shoot.t/0.7;pr(ctx,this.shoot.x,this.shoot.y,10,PX,"#ffffff");pr(ctx,this.shoot.x-8,this.shoot.y+PX,6,PX,"#b8c8ff");ctx.globalAlpha=1;}}if(k==="cosmic"){["rgba(255,120,220,0.10)","rgba(120,120,255,0.10)","rgba(120,255,220,0.07)"].forEach((c,i)=>{const cx=140+i*190+Math.sin(t*0.2+i*2)*16;const cy=60+i*26;const g=ctx.createRadialGradient(cx,cy,4,cx,cy,90);g.addColorStop(0,c);g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(cx-90,cy-90,180,180);});}}
private pxTree(ctx:CanvasRenderingContext2D,x:number,baseY:number,s:number){const trunk="#7a4c24",trunkD="#5a3416";const leafD="#2e6a1c",leaf="#4a8f2c",leafL="#6ab83a";pr(ctx,x-3*s,baseY-30*s,6*s,30*s,trunk);pr(ctx,x+1*s,baseY-30*s,2*s,30*s,trunkD);pxEll(ctx,x,baseY-40*s,17*s,12*s,leafD);pxEll(ctx,x-10*s,baseY-33*s,10*s,8*s,leafD);pxEll(ctx,x+10*s,baseY-33*s,10*s,8*s,leafD);pxEll(ctx,x,baseY-42*s,14*s,10*s,leaf);pxEll(ctx,x-7*s,baseY-36*s,8*s,6*s,leaf);pxEll(ctx,x+7*s,baseY-36*s,8*s,6*s,leaf);pxEll(ctx,x-4*s,baseY-48*s,7*s,5*s,leafL);pxEll(ctx,x+5*s,baseY-46*s,5*s,4*s,leafL);}
private drawHorizon(ctx:CanvasRenderingContext2D,t:number){const k=this.biome.kind;if(k==="meadow"){for(let i=0;i<9;i++)pxHill(ctx,-40+i*86,GROUND_Y+2,76,"#a8d68a");for(let i=0;i<8;i++)pxHill(ctx,-30+i*98,GROUND_Y+2,58,"#7ab85c");for(let i=0;i<4;i++)this.pxTree(ctx,44+i*178,GROUND_Y+2,1);this.pxTree(ctx,300,GROUND_Y+2,0.7);return;}if(k==="cave"||k==="crystal"||k==="frozen"||k==="library"||k==="void"){const c=lerpC(this.biome.sky[2],"#000000",0.4);for(let i=0;i<16;i++){const x=i*44+((i*29)%18);pxTri(ctx,x,24+((i*37)%26),8,0,c);pr(ctx,x-8,0,16,6,c);}pr(ctx,0,0,W,4,c);}if(k==="ruins"){for(let i=0;i<7;i++){const x=30+i*95;const hgt=34+((i*41)%30);pr(ctx,x,GROUND_Y-hgt,12,hgt,"#241808");pr(ctx,x-4,GROUND_Y-hgt-4,20,4,"#2e2010");pr(ctx,x+2,GROUND_Y-hgt+10,8,4,"#150e04");}}if(k==="jungle"){const col="#1a3a18";for(let i=0;i<8;i++){const x=30+i*84;const bend=Math.sin(t*0.4+i)*8;pxPath(ctx,(u)=>[x+bend*u,u*(60+(i%3)*22)],6,col,18);}}if(k==="lake")pr(ctx,0,GROUND_Y-PX,W,PX,"rgba(122,240,224,0.28)");}
private drawSignature(ctx:CanvasRenderingContext2D,t:number,holeX:number,holeR:number){const k=this.biome.kind;const a=this.biome.accent;if(k==="cave"){for(const[mx,ms]of[[60,1.3],[580,1.1],[150,0.7]]as const){glow(ctx,mx,GROUND_Y+14,62*ms,a,0.18+0.05*Math.sin(t*1.4+mx));pr(ctx,mx-4*ms,GROUND_Y+4,8*ms,26*ms,"#cfeef6");pr(ctx,mx-4*ms,GROUND_Y+4,3*ms,26*ms,"#eafcff");pxEll(ctx,mx,GROUND_Y+8,22*ms,12*ms,"#3fb4cc",true);pxEll(ctx,mx,GROUND_Y+6,18*ms,9*ms,"#5ad0e8",true);pr(ctx,mx-10*ms,GROUND_Y-2*ms,4,4,"#d8fbff");pr(ctx,mx+5*ms,GROUND_Y-5*ms,4,4,"#d8fbff");}}if(k==="crystal"){for(const[cx,cs]of[[70,1.4],[570,1.2],[200,0.8]]as const){glow(ctx,cx,GROUND_Y+6,72*cs,a,0.15+0.06*Math.sin(t*2+cx));pxTri(ctx,cx,GROUND_Y-46*cs,13*cs,GROUND_Y+28,"#6a5ab8");pxTri(ctx,cx-2,GROUND_Y-42*cs,7*cs,GROUND_Y+26,"#a894f0");pxTri(ctx,cx-4,GROUND_Y-34*cs,3*cs,GROUND_Y+20,"#e0d8ff");pxTri(ctx,cx+14*cs,GROUND_Y-18*cs,6*cs,GROUND_Y+26,"#8a7ad8");}}if(k==="lake"){pr(ctx,0,GROUND_Y+4,W,46,"rgba(10,60,72,0.55)");for(let i=0;i<10;i++){const rx=((t*24+i*83)%(W+80))-40;ctx.globalAlpha=0.12+0.1*Math.sin(t*2+i);pr(ctx,rx,GROUND_Y+10+(i%4)*9,24+(i%3)*10,PX,"#aef8f0");ctx.globalAlpha=1;}for(let i=0;i<4;i++)glow(ctx,((t*8+i*180)%(W+200))-100,GROUND_Y+8,70,"#aef8f0",0.05);}if(k==="ruins"){for(const tx of[110,530]){const fl=0.7+0.3*Math.sin(t*11+tx)*Math.sin(t*7);glow(ctx,tx,GROUND_Y-28,46,"#ffb84d",0.2*fl);pr(ctx,tx-2,GROUND_Y-22,4,24,"#3a2a14");pr(ctx,tx-4,GROUND_Y-30,8,8,"#ff9a3a");pr(ctx,tx-2,GROUND_Y-34,4,6,"#ffd75e");}}if(k==="magma"){
// The whole chamber floor is a molten lava sea.
const lg=ctx.createLinearGradient(0,GROUND_Y,0,H);
lg.addColorStop(0,"#8a2408");lg.addColorStop(0.35,"#c2400c");lg.addColorStop(0.7,"#e85c10");lg.addColorStop(1,"#ff8c28");
ctx.fillStyle=lg;ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
// darker cooled crust islands drifting on the surface
for(let i=0;i<16;i++){const cx=snap((i*97+Math.sin(t*0.25+i)*14)%W);const cy=GROUND_Y+12+((i*37)%(H-GROUND_Y-24));
pxEll(ctx,cx,cy,10+(i%3)*7,4+(i%2)*2,"#4a1204");pxEll(ctx,cx,cy-1,7+(i%3)*5,2+(i%2),"#2e0a02");}
// bright flowing lava veins between the crust
for(let i=0;i<22;i++){const lx=snap((i*53+Math.sin(t*0.8+i)*10)%W);const ly=GROUND_Y+8+((i*61)%(H-GROUND_Y-16));
const bub=0.5+0.5*Math.sin(t*3+i*1.7);ctx.globalAlpha=0.45+bub*0.5;
pr(ctx,lx,ly,14+(i%3)*10,PX+1,"#ffb03a");pr(ctx,lx+3,ly+PX+1,8+(i%2)*6,PX,"#fff0a0");ctx.globalAlpha=1;
if(bub>0.9)glow(ctx,lx+8,ly,20,"#ff7a2a",0.2);}
// rising heat glow over the whole sea
const hg=ctx.createLinearGradient(0,GROUND_Y,0,H);
hg.addColorStop(0,"rgba(255,120,40,0.18)");hg.addColorStop(1,"rgba(255,60,10,0.05)");
ctx.fillStyle=hg;ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);}if(k==="heaven"){
// ── The Heavens · golden light above the clouds ──
// radiant sun with a slowly rotating halo of rays
const sunX=320,sunY=64;
glow(ctx,sunX,sunY,120,"#fff2c0",0.5);
glow(ctx,sunX,sunY,60,"#ffe9a0",0.55);
for(let i=0;i<10;i++){const ra=t*0.12+(i/10)*Math.PI*2;const inner=34,outer=52+((i%2)*10)+Math.sin(t*0.8+i)*3;ctx.globalAlpha=0.35+0.2*Math.sin(t*1.3+i);pxPath(ctx,(u)=>[sunX+Math.cos(ra)*lerp(inner,outer,u),sunY+Math.sin(ra)*lerp(inner,outer,u)*0.9],3,"#ffedb0",7);}
ctx.globalAlpha=1;
pxEll(ctx,sunX,sunY,22,20,"#fff8dc");pxEll(ctx,sunX,sunY,15,14,"#fffdf4");
// distant floating cloud islands with golden undersides
const isles=[{x:96,y:126,s:1.15},{x:520,y:104,s:0.95},{x:236,y:88,s:0.6},{x:436,y:146,s:0.72}];
for(const il of isles){const bob=Math.sin(t*0.5+il.x)*3;const ix=il.x,iy=il.y+bob,s=il.s;
pxEll(ctx,ix,iy+7*s,34*s,8*s,"#d9c9a8");
pxEll(ctx,ix,iy+3*s,38*s,9*s,"#efe6cf");
pxEll(ctx,ix-9*s,iy-3*s,20*s,8*s,"#ffffff");pxEll(ctx,ix+12*s,iy-2*s,17*s,7*s,"#fdfaf2");pxEll(ctx,ix,iy-7*s,14*s,6*s,"#ffffff");
glow(ctx,ix,iy+10*s,26*s,"#ffd75e",0.16+0.05*Math.sin(t+ix));
if(s>0.9){for(let p=0;p<3;p++)pr(ctx,ix-14*s+p*12*s,iy-9*s,PX,4,"#e8f4d8");}}
// slow drifting foreground clouds
for(let i=0;i<5;i++){const cx=((t*7+i*150)%(W+180))-90;const cy=36+(i%3)*46;ctx.globalAlpha=0.7;pr(ctx,cx,cy,52,9,"#ffffff");pr(ctx,cx+10,cy-6,30,8,"#ffffff");pr(ctx,cx+26,cy-10,18,9,"#fdfaf0");pr(ctx,cx+6,cy+7,40,5,"#e6ecf6");ctx.globalAlpha=1;}
// shimmering light pillars falling from above
for(let i=0;i<3;i++){const cx=120+i*200+Math.sin(t*0.2+i*2)*10;const g=ctx.createLinearGradient(cx,0,cx,GROUND_Y+40);g.addColorStop(0,"rgba(255,244,200,0.20)");g.addColorStop(0.6,"rgba(255,236,170,0.08)");g.addColorStop(1,"rgba(255,236,170,0)");ctx.fillStyle=g;ctx.fillRect(cx-24,0,48,GROUND_Y+40);}
// golden sparkles floating everywhere
for(let i=0;i<14;i++){const sx=snap((i*47+t*9)%W);const sy=snap((i*71+Math.sin(t*0.7+i)*14)%GROUND_Y);ctx.globalAlpha=0.4+0.5*Math.abs(Math.sin(t*1.6+i));pr(ctx,sx,sy,PX,PX,i%3===0?"#ffd75e":"#fffbe8");if(i%4===0){pr(ctx,sx-2,sy,PX,1,"#fff2c0");pr(ctx,sx+2,sy,PX,1,"#fff2c0");}}
ctx.globalAlpha=1;
// tiny white doves gliding across
for(let i=0;i<3;i++){const dx=((t*22+i*230)%(W+60))-30;const dy=70+i*38+Math.sin(t*2+i)*5;const flap=Math.abs(Math.sin(t*7+i*2));pr(ctx,dx,dy,4,2,"#ffffff");pr(ctx,dx-3,dy-flap*3,3,2,"#f4f8ff");pr(ctx,dx+4,dy-flap*3,3,2,"#f4f8ff");}
// cloud-sea meets the field: soft golden mist above the ground line
const mist=ctx.createLinearGradient(0,GROUND_Y-26,0,GROUND_Y+8);mist.addColorStop(0,"rgba(255,248,224,0)");mist.addColorStop(1,"rgba(255,248,224,0.5)");ctx.fillStyle=mist;ctx.fillRect(0,GROUND_Y-26,W,34);
}if(k==="abyss"){for(let i=0;i<7;i++){const px=40+i*92;const ph=0.4+0.6*Math.abs(Math.sin(t*1.6+i*1.3));ctx.globalAlpha=ph;pr(ctx,px,GROUND_Y+8+(i%3)*14,PX,6,a);glow(ctx,px+1,GROUND_Y+6+(i%3)*14,14,a,0.28*ph);ctx.globalAlpha=1;}}if(k==="frozen"){for(const[ix,is]of[[80,1.2],[560,1],[240,0.7]]as const){pxTri(ctx,ix,GROUND_Y-40*is,15*is,GROUND_Y+24,"#8ac8e8");pxTri(ctx,ix-2,GROUND_Y-34*is,8*is,GROUND_Y+22,"#c8ecff");pr(ctx,ix-3,GROUND_Y-28*is,PX,26*is,"#f0fbff");}}if(k==="jungle"){for(let i=0;i<10;i++){const lx=20+i*66;const sway=Math.sin(t*1.2+i)*4;pxEll(ctx,lx+sway,26+(i%3)*14,16,7,i%2?"#2a8a3a":"#1e6a2c");pr(ctx,lx+sway-1,20+(i%3)*14,PX,10,"#164a20");}}if(k==="library"){for(const sx of[20,520]){pr(ctx,sx,20,100,GROUND_Y-10,"#1e1206");for(let r=0;r<5;r++){for(let cB=0;cB<8;cB++){pr(ctx,sx+6+cB*11,30+r*34,8,24,["#7a3a2a","#3a5a7a","#6a5a2a","#4a3a6a"][(r+cB)%4]);}pr(ctx,sx,56+r*34,100,4,"#120a04");} }glow(ctx,320,90,120,"#ffd080",0.08+0.02*Math.sin(t*5));}if(k==="void"){for(let i=0;i<8;i++){const px=snap((i*89+t*6)%W);const py=snap(40+Math.sin(t*0.6+i*2)*20+(i%3)*40);ctx.globalAlpha=0.5+0.3*Math.sin(t+i);pr(ctx,px,py,PX+1,5,"#e0a0ff");pr(ctx,px+3,py+2,PX+1,PX+1,"#c08aff");ctx.globalAlpha=1;}}if(k==="cosmic"){glow(ctx,W/2,GROUND_Y+60,220,"#ff8ae0",0.16+0.05*Math.sin(t*1.2));for(let i=0;i<5;i++){const ang=t*0.5+(i/5)*Math.PI*2;pr(ctx,W/2+Math.cos(ang)*(90+i*14),GROUND_Y+30+Math.sin(ang)*24,PX+1,PX+1,"#ffb8f0");}}
if(k==="meadow"){for(let x=2;x<W;x+=6){if(Math.abs(x-holeX)<holeR*1.5)continue;const sway=Math.sin(t*2.3+x*0.3)*1.4;const h=4+((x*13)%5);pr(ctx,x+sway,GROUND_Y-h+6,PX,h,x%12<6?"#5aa83a":"#6ab83a");}}}
/** Secret-room set piece: a huge sleeping dragon curled behind the mouth. */
private drawDragonRoom(ctx:CanvasRenderingContext2D,t:number,_holeX:number,_holeR:number){
  const breathe=Math.round(Math.sin(t*1.15)*2);
  // warm chamber light behind the dragon
  glow(ctx,350,185,155,"#ff4a24",0.14+0.025*Math.sin(t*2));
  // ground shadow
  pxEll(ctx,338,207,196,31,"rgba(10,2,0,0.58)");

  // curled tail, drawn back-to-front as chunky scaled body segments
  const tail:[number,number,number][]=[[175,201,28],[202,187,31],[238,177,35],[279,171,39],[322,169,42],[365,171,40]];
  for(let i=0;i<tail.length;i++){
    const[tx,ty,tr]=tail[i];
    pxEll(ctx,tx,ty+breathe*(i/10),tr,tr*0.55,"#571b12");
    pxEll(ctx,tx-2,ty-4+breathe*(i/10),tr*0.82,tr*0.38,"#8f2d1c");
    // amber scales along the spine
    for(let s=-1;s<=1;s++)pr(ctx,tx+s*9,ty-tr*0.32+breathe*(i/10),5,4,s===0?"#e06b28":"#b84720");
  }
  // pointed tail tip
  pxTri(ctx,144,184,18,209,"#571b12");

  // massive shoulder / chest rising and falling
  pxEll(ctx,397,174+breathe,61,40,"#631d14");
  pxEll(ctx,391,166+breathe,50,29,"#a13720");
  pxEll(ctx,380,160+breathe,32,15,"#c04b24");
  // belly plates
  for(let i=0;i<5;i++)pr(ctx,372+i*12,181+breathe+(i%2)*2,9,5,i%2?"#d87a32":"#ee9a48");

  // folded rear wing: dark membrane with bright bony fingers
  const wingY=145+breathe;
  pxTri(ctx,335,91+breathe,72,wingY+38,"#3a1012");
  pxTri(ctx,338,103+breathe,57,wingY+29,"#681b20");
  for(let i=0;i<4;i++){
    ctx.strokeStyle="#9b3526";ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(338,111+breathe);ctx.lineTo(296+i*27,170+breathe);ctx.stroke();
  }

  // neck and resting head
  pxEll(ctx,447,173+breathe,42,25,"#731f16");
  pxEll(ctx,480,184+breathe,48,24,"#8f2d1c");
  pxEll(ctx,505,191+breathe,29,17,"#a93b20");
  // squared snout and lower jaw
  pr(ctx,500,183+breathe,42,19,"#a93b20");
  pr(ctx,507,198+breathe,34,7,"#641a14");
  pr(ctx,514,185+breathe,8,4,"#df7540");
  // horns
  pxTri(ctx,461,133+breathe,8,166+breathe,"#e4c28a");
  pxTri(ctx,484,139+breathe,7,171+breathe,"#c9a46e");
  // ear
  pxTri(ctx,448,148+breathe,10,170+breathe,"#b84720");
  // sleeping eye: lid + tiny glowing slit during an occasional dream twitch
  pr(ctx,484,178+breathe,13,4,"#35100d");
  pr(ctx,486,178+breathe,8,2,"#ffbb55");
  // nostrils
  pr(ctx,528,190+breathe,3,3,"#2a0907");pr(ctx,517,190+breathe,3,3,"#2a0907");

  // slow pixel smoke puffs breathe out of the nostrils
  for(let i=0;i<5;i++){
    const age=(t*0.32+i*0.2)%1;
    const sx=529+age*54;
    const sy=187+breathe-Math.sin(age*Math.PI)*20-i*2;
    ctx.globalAlpha=(1-age)*0.42;
    pxEll(ctx,sx,sy,5+age*7,3+age*4,i%2?"#8a6a68":"#b89a90");
  }
  ctx.globalAlpha=1;

  // treasure piles at the room edges
  for(const baseX of[54,575])for(let i=0;i<18;i++){
    const gx=baseX+((i*13)%58)-28;
    const gy=GROUND_Y+80-((i*17)%22);
    pr(ctx,gx,gy,6+(i%3)*2,4,i%4===0?"#fff0a0":i%2?"#ffd75e":"#c98a18");
    if(i%5===0)pr(ctx,gx+2,gy-2,2,2,"#ffffff");
  }
}

private drawDecos(ctx:CanvasRenderingContext2D,t:number,holeX:number,holeR:number){const k=this.biome.kind;for(const d of this.decos){if(Math.hypot(d.x-holeX,d.y-270)<holeR*1.6)continue;const sway=Math.round(Math.sin(t*1.6+d.ph)*1)*PX*0.5;if(k==="meadow"){if(d.k===0){const c=["#ff9ec8","#ffd75e","#c99aef","#ff8a7a"][Math.floor(d.x)%4];pr(ctx,d.x,d.y-8,PX,8,"#4a8f2c");pr(ctx,d.x-3+sway,d.y-12,PX,PX,c);pr(ctx,d.x+3+sway,d.y-12,PX,PX,c);pr(ctx,d.x+sway,d.y-14,PX,PX,c);pr(ctx,d.x+sway,d.y-10,PX,PX,c);pr(ctx,d.x+sway,d.y-12,PX,PX,"#fff3c0");}else if(d.k===1){pr(ctx,d.x+1,d.y-5,3,5,"#e8dcc0");pxEll(ctx,d.x+2,d.y-6,5,4,"#d85040",true);pr(ctx,d.x+1,d.y-8,PX,PX,"#ffffff");}else{pr(ctx,d.x,d.y-2,5,3,"#9a9a8a");pr(ctx,d.x+1,d.y-3,PX,1,"#b8b8a4");}}else if(k==="cave"||k==="jungle"){if(d.k%2===0){ctx.globalAlpha=0.5+0.5*Math.sin(t*2+d.ph);const c=k==="cave"?"#5ad0e8":"#6aff9a";pr(ctx,d.x-3,d.y-5,6,3,c);pr(ctx,d.x-1,d.y-2,PX,3,k==="cave"?"#cfeef6":"#2e6a2a");ctx.globalAlpha=1;}}else if(k==="crystal"||k==="frozen"){if(d.k%2===0)pxTri(ctx,d.x,d.y-9-d.k,4,d.y,k==="frozen"?"#d8f4ff":"#b8a0ff");}else if(k==="ruins"||k==="library"){if(d.k%3===0){pr(ctx,d.x,d.y-4,6,4,"#8a7a5a");pr(ctx,d.x,d.y-5,6,1,"#a89878");}else if(d.k%3===1){pr(ctx,d.x,d.y-5,5,5,"#6a4a2a");pr(ctx,d.x+1,d.y-4,3,3,"#e8d8b0");}}else if(k==="magma"){if(d.k%2===0){ctx.globalAlpha=0.4+0.6*Math.abs(Math.sin(t*2.4+d.ph));pr(ctx,d.x-2,d.y-2,4,3,"#ff7828");ctx.globalAlpha=1;}}else if(k==="lake"){if(d.k%2===0)pr(ctx,d.x,d.y-1,3,PX,"rgba(174,248,240,0.5)");}else if(k==="heaven"){if(d.k%2===0){const puff=Math.sin(t*0.8+d.ph)*1;pxEll(ctx,d.x,d.y-2+puff,9,3,"#ffffff");pxEll(ctx,d.x+5,d.y-4+puff,6,2,"#fdfaf0");pxEll(ctx,d.x-4,d.y+puff,5,2,"#e8eefa");}else if(d.k===1){ctx.globalAlpha=0.5+0.4*Math.sin(t*1.9+d.ph);pr(ctx,d.x,d.y-3,PX,PX,"#ffd75e");pr(ctx,d.x-2,d.y-3,PX,1,"#fff2c0");pr(ctx,d.x+2,d.y-3,PX,1,"#fff2c0");ctx.globalAlpha=1;}}else if(k==="abyss"||k==="void"||k==="star"||k==="cosmic"){if(d.k%3===0){ctx.globalAlpha=0.35+0.35*Math.sin(t*1.7+d.ph);pr(ctx,d.x,d.y-2,PX,PX,this.biome.accent);ctx.globalAlpha=1;}}}}
private drawMenuExtras(ctx:CanvasRenderingContext2D,t:number,holeX:number,holeR:number){const g=ctx.createRadialGradient(holeX,270,12,holeX,270,165);g.addColorStop(0,"rgba(178,224,96,0.30)");g.addColorStop(0.5,"rgba(132,190,67,0.15)");g.addColorStop(1,"rgba(80,130,42,0)");ctx.fillStyle=g;ctx.fillRect(holeX-180,190,360,170);const petals=["#ffd75e","#ff9ec8","#c99aef","#ff8a7a","#9adcff"];for(let i=0;i<26;i++){const side=i%2===0?-1:1;const fx=snap(holeX+side*(92+((i*17)%92)));const fy=snap(238+((i*31)%104));if(Math.hypot(fx-holeX,fy-270)<holeR*1.5)continue;const sway=Math.round(Math.sin(t*1.8+i))*PX;const c=petals[i%petals.length];pr(ctx,fx,fy-6,PX,6,"#3d8a29");pr(ctx,fx-2+sway,fy-9,PX,PX,c);pr(ctx,fx+2+sway,fy-9,PX,PX,c);pr(ctx,fx+sway,fy-11,PX,PX,c);pr(ctx,fx+sway,fy-9,PX,PX,"#fff3c0");}for(const side of[-1,1]){const bx=side<0?26:W-26;pxEll(ctx,bx,H-6,40,22,"#2c6b22");pxEll(ctx,bx-side*16,H-2,26,15,"#357f28");pxEll(ctx,bx+side*8,H-14,22,13,"#3f9430");for(let i=0;i<5;i++){pr(ctx,bx-20+i*9,H-26-(i%2)*5,PX,8,"#2c6b22");}}}
private drawCritters(ctx:CanvasRenderingContext2D,t:number){for(const b of this.critters){const flap=Math.abs(Math.sin(t*9+b.ph));const w=Math.max(PX,snap(4*flap));pr(ctx,b.x-1,b.y,PX,PX,"#3a2a14");pr(ctx,b.x-1-w,b.y-w*0.5,w,PX,b.c);pr(ctx,b.x+1,b.y-w*0.5,w,PX,b.c);pr(ctx,b.x-1,b.y-PX,PX,1,"#ffffff");}}
private drawMotes(ctx:CanvasRenderingContext2D,t:number){const p=this.biome.particle;for(const m of this.motes){ctx.globalAlpha=Math.max(0.08,0.25+0.3*Math.sin(t*2+m.ph));if(p.glow)ctx.globalCompositeOperation="lighter";ctx.fillStyle=p.color;ctx.fillRect(snap(m.x),snap(m.y),m.s,m.s);ctx.globalCompositeOperation="source-over";}ctx.globalAlpha=1;}
private drawMystery(ctx:CanvasRenderingContext2D,t:number,mystery:number){const cycle=(t*0.11)%1;const open=cycle>0.82?Math.sin(((cycle-0.82)/0.18)*Math.PI):0;if(open<=0.02)return;const a=open*Math.min(0.5,mystery*1.6);const ex=W/2,ey=96;ctx.globalAlpha=a;ctx.globalCompositeOperation="lighter";glow(ctx,ex,ey,130,this.biome.accent,0.35);pxEll(ctx,ex,ey,74,Math.max(PX,30*open),this.biome.accent);ctx.globalCompositeOperation="source-over";pxEll(ctx,ex+Math.round(Math.sin(t*0.5)*5)*PX,ey,12,Math.max(PX,26*open),"#050308");ctx.globalAlpha=1;}
}
