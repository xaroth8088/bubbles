import RAPIER from '@dimforge/rapier2d-compat';
await RAPIER.init();

// Closed elastic membranes collide through their real surfaces. Pressure and
// shape-matching springs keep the bubbles inflated and bring them back to round.
export const PHYSICS_STEP=1/60;
export const PHYSICS_DEFAULTS=Object.freeze({gravity:1,pressure:1,damping:1});
export const PHYSICS_LIMITS=Object.freeze({gravity:[0,2],pressure:[.25,2],damping:[0,2]});
export function normalizePhysics(value){
  return Object.fromEntries(Object.entries(PHYSICS_DEFAULTS).map(([key,fallback])=>{
    const n=value?.[key],[min,max]=PHYSICS_LIMITS[key];
    return [key,typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback];
  }));
}
const STEP=PHYSICS_STEP,SCALE=100,NODES=16;
const NORMAL=0x0001ffff,ENTERING=0x0001fffd,SOLID_HELD=0x00010001;
export const BUBBLE_DIAMETERS=Object.freeze({'.5':54,1:74,2:108,3:134,4:158});
export function bubbleDiameter(bubble){return BUBBLE_DIAMETERS[bubble.atoms.some(a=>a.part!==undefined)?'.5':Math.max(1,bubble.atoms.length)];}
let world,walls=[],dimensions='',entries=new Map();
export function resetPhysics(){world?.free();world=null;walls=[];dimensions='';entries.clear();}
function setup({width,height,top=0,gravity=1050}){
  if(!world){world=new RAPIER.World({x:0,y:10.5});world.numSolverIterations=6;}
  world.gravity.y=gravity/SCALE;
  const key=`${width}/${height}/${top}`;if(dimensions===key)return false;
  for(const wall of walls)world.removeCollider(wall,true);walls=[];dimensions=key;
  for(const [x,y,hx,hy,groups] of[
    [-8,height/2,10,height+1000,NORMAL],[width+8,height/2,10,height+1000,NORMAL],
    [width/2,height+8,width+1000,10,NORMAL],[width/2,top-8,width+1000,10,0x0002ffff]
  ])walls.push(world.createCollider(RAPIER.ColliderDesc.cuboid(hx/SCALE,hy/SCALE).setTranslation(x/SCALE,y/SCALE).setFriction(.1).setRestitution(.2).setCollisionGroups(groups)));
  return true;
}
function material(stiff=false,physics=PHYSICS_DEFAULTS){
  const m=new RAPIER.SoftBodyMaterial();
  const pressure=Math.sqrt(physics.pressure),damping=physics.damping;
  // Change resistance to compression while retaining the fixed rest area/size.
  m.edgeSoftness={naturalFrequency:(stiff?35:15)*pressure,dampingRatio:.4*damping};
  m.bendSoftness={naturalFrequency:(stiff?22:7)*pressure,dampingRatio:.45*damping};
  m.volumeSoftness={naturalFrequency:(stiff?65:30)*pressure,dampingRatio:.7*damping};
  m.shapeMatchingSoftness={naturalFrequency:(stiff?18:8)*pressure,dampingRatio:.55*damping};
  m.tearStrain=null;m.tearForce=null;return m;
}
function create(p,physics,key){
  const soft=world.createSoftBody(RAPIER.SoftBodyDesc.disk({x:p.x/SCALE,y:p.y/SCALE},p.r/SCALE,NODES)
    .setMaterial(material(p.stiff,physics)).setShapeMatching(true).setVolumePreservation(true)
    .setSelfContacts(true).setMass((p.r/37)**2).setParticleRadius(.008)
    .setLinearDamping(.7).setCanSleep(true)
    .setSurfaceCollider(RAPIER.ColliderDesc.ball(.008).setFriction(.1).setRestitution(.2)));
  for(let i=0;i<NODES;i++)soft.setParticleVelocity(i,{x:(p.vx||0)/SCALE,y:(p.vy||0)/SCALE});
  const entry={soft,r:p.r,stiff:p.stiff,key,x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,held:false,groups:null,points:soft.particlePositions()};
  entries.set(p,entry);return entry;
}
function control(p,e,held,solid,dt){
  const soft=e.soft,points=soft.particlePositions(),dx=(p.x-e.x)/SCALE,dy=(p.y-e.y)/SCALE;
  const dvx=((p.vx||0)-e.vx)/SCALE,dvy=((p.vy||0)-e.vy)/SCALE;
  const moved=Math.hypot(dx,dy)>.00001,velocityChanged=Math.hypot(dvx,dvy)>.00001;
  const groups=held?(solid?SOLID_HELD:0):p.entering?ENTERING:NORMAL;
  if(groups!==e.groups){for(let i=0;i<soft.numMeshes();i++)soft.meshCollider(i)?.setCollisionGroups(groups);e.groups=groups;}
  if(held!==e.held){for(let i=0;i<NODES;i++)soft.setParticlePinned(i,held);soft.wakeUp();}
  if(moved||velocityChanged||held){
    const velocities=soft.particleVelocities(),rounding=1-Math.exp(-dt*12);
    for(let i=0;i<NODES;i++){
      let x=points[i*2]+dx,y=points[i*2+1]+dy;
      if(held){const angle=i*Math.PI*2/NODES;x+=(p.x/SCALE+p.r/SCALE*Math.cos(angle)-x)*rounding;y+=(p.y/SCALE+p.r/SCALE*Math.sin(angle)-y)*rounding;}
      if(moved||held)soft.setParticlePosition(i,{x,y});
      soft.setParticleVelocity(i,held?{x:0,y:0}:{x:velocities[i*2]+dvx,y:velocities[i*2+1]+dvy});
    }
    soft.wakeUp();
  }
  e.held=held;
}
function read(p,e,held,top){
  const points=e.soft.particlePositions(),velocities=e.soft.particleVelocities();
  let x=0,y=0,vx=0,vy=0;for(let i=0;i<NODES;i++){x+=points[i*2];y+=points[i*2+1];vx+=velocities[i*2];vy+=velocities[i*2+1];}
  x*=SCALE/NODES;y*=SCALE/NODES;vx*=SCALE/NODES;vy*=SCALE/NODES;
  const previousSpeed=Math.hypot(e.vx,e.vy),change=Math.hypot(vx-e.vx,vy-e.vy);
  if(!held&&change>40)p.impact=Math.max(p.impact||0,previousSpeed);
  if(!held){p.x=x;p.y=y;p.vx=vx;p.vy=vy;}else{p.vx=0;p.vy=0;}
  let area=0,motion=0,xx=0,yy=0,xy=0;const surface=[];
  for(let i=0;i<NODES;i++){
    const px=points[i*2]*SCALE,py=points[i*2+1]*SCALE,j=(i+1)%NODES;
    const q={x:px-p.x,y:py-p.y};surface.push(q);xx+=q.x*q.x;yy+=q.y*q.y;xy+=q.x*q.y;
    area+=points[i*2]*points[j*2+1]-points[j*2]*points[i*2+1];
    motion=Math.max(motion,Math.hypot(points[i*2]-e.points[i*2],points[i*2+1]-e.points[i*2+1])*SCALE);
  }
  p.surface=surface;p.areaRatio=Math.abs(area)/2/(NODES*Math.sin(2*Math.PI/NODES)*.5*(p.r/SCALE)**2);
  p.shapeMotion=Math.max(p.shapeMotion||0,motion);
  p.deformation=Math.max(...surface.map(q=>Math.abs(Math.hypot(q.x,q.y)/p.r-1)));
  // Diagnostics derive from the simulated vertices. Rendering uses the full contour.
  p.squashX=Math.sqrt(xx/NODES*2)/p.r;p.squashY=Math.sqrt(yy/NODES*2)/p.r;p.squashShear=xy/NODES/(p.r*p.r);
  p.wobbleX=p.squashX-1;p.wobbleY=p.squashY-1;p.wobbleShear=p.squashShear;
  if(p.entering&&Math.min(...surface.map(q=>q.y+p.y))>=top+1)p.entering=false;
  Object.assign(e,{x:p.x,y:p.y,vx:p.vx,vy:p.vy,points});
}
export function stepPhysics(bodies,bounds={},dt=STEP){
  const physics=normalizePhysics(bounds.physics),gravity=(bounds.gravity??1050)*physics.gravity,key=`${gravity}/${physics.pressure}/${physics.damping}`;
  const resized=setup({...bounds,gravity});dt=Math.min(dt,1/30);world.timestep=dt;
  const current=new Set(bodies);for(const[p,e]of entries)if(!current.has(p)){world.removeSoftBody(e.soft);entries.delete(p);}
  const held=bounds.held||new Set(),solid=bounds.solidHeld||new Set();
  for(const p of bodies){
    if(held.has(p.id)){
      p.x=Math.max(p.r+2,Math.min(bounds.width-p.r-2,p.x));
      p.y=Math.max((bounds.top||0)+p.r+2,Math.min(bounds.height-p.r-2,p.y));
    }
    // Feed new bubbles into the water even with gravity off. The entry flow
    // stops as soon as the whole membrane has crossed the top boundary.
    if(p.entering&&!held.has(p.id)&&physics.gravity<.15)p.vy=Math.max(p.vy||0,90*(1-physics.gravity/.15));
    let e=entries.get(p);if(e&&(e.r!==p.r||e.stiff!==p.stiff)){world.removeSoftBody(e.soft);entries.delete(p);e=null;}
    const fresh=!e;e??=create(p,physics,key);
    if(e.key!==key){e.soft.setMaterial(material(p.stiff,physics));e.soft.wakeUp();e.key=key;}
    // Resizes and growing clusters can put the whole surface beyond a wall.
    // Translate it back before contact solving, preserving its existing deformation.
    if((fresh||resized)&&!held.has(p.id)){
      const points=e.soft.particlePositions(),xs=[],ys=[];for(let i=0;i<NODES;i++){xs.push(points[i*2]*SCALE+p.x-e.x);ys.push(points[i*2+1]*SCALE+p.y-e.y);}
      p.x+=Math.max(0,2-Math.min(...xs))-Math.max(0,Math.max(...xs)-bounds.width+2);
      p.y+=(!p.entering?Math.max(0,(bounds.top||0)+2-Math.min(...ys)):0)-Math.max(0,Math.max(...ys)-bounds.height+2);
    }
    control(p,e,held.has(p.id),solid.has(p.id),dt);
  }
  world.step();for(const p of bodies)read(p,entries.get(p),held.has(p.id),bounds.top||0);
}
// The held body follows the pointer; its linked partner follows as far as its
// own walls allow. A wall can shorten the link, never pin the held body.
export function translateBoundedGroup(bodies,delta,{width,height,top=0}){
  let applied={x:0,y:0};
  for(const [index,p] of bodies.entries()){
    const surface=p.surface||[],left=Math.min(-p.r,...surface.map(q=>q.x)),right=Math.max(p.r,...surface.map(q=>q.x));
    const upper=Math.min(-p.r,...surface.map(q=>q.y)),lower=Math.max(p.r,...surface.map(q=>q.y));
    const wanted=index===0?delta:applied;
    const dx=Math.max(2-p.x-left,Math.min(width-2-p.x-right,wanted.x));
    const dy=Math.max(top+2-p.y-upper,Math.min(height-2-p.y-lower,wanted.y));
    p.x+=dx;p.y+=dy;
    if(index===0)applied={x:dx,y:dy};
  }
  return applied;
}
export function simulatePhysics(bodies,bounds,seconds){for(let time=0;time<seconds;time+=STEP)stepPhysics(bodies,bounds,STEP);return bodies;}
export function radialImpulse(bodies,{x,y,radius=160,strength=65,held=new Set()}){
  for(const p of bodies){if(held.has(p.id))continue;const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy);if(d<1||d>radius)continue;
    const force=strength*(1-d/radius);p.vx=(p.vx||0)+dx/d*force;p.vy=(p.vy||0)+dy/d*force;
  }
}
export function membraneContains(p,point,padding=1){
  const x=point.x-p.x,y=point.y-p.y,poly=p.surface;
  if(!poly)return Math.hypot(x,y)<=p.r+padding;
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[j],b=poly[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
    if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<=padding)return true;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function membranePath(p){
  const points=p.surface||Array.from({length:NODES},(_,i)=>({x:p.r*Math.cos(i*Math.PI*2/NODES),y:p.r*Math.sin(i*Math.PI*2/NODES)}));
  const n=points.length,s=50/p.r,at=i=>points[(i+n)%n],f=v=>(50+v*s).toFixed(2);
  let path=`M${f(points[0].x)} ${f(points[0].y)}`;
  for(let i=0;i<n;i++){const a=at(i-1),b=at(i),c=at(i+1),d=at(i+2);path+=`C${f(b.x+(c.x-a.x)/6)} ${f(b.y+(c.y-a.y)/6)} ${f(c.x-(d.x-b.x)/6)} ${f(c.y-(d.y-b.y)/6)} ${f(c.x)} ${f(c.y)}`;}
  return path+'Z';
}
