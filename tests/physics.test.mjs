import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePhysics,stepPhysics,bubbleDiameter,BUBBLE_DIAMETERS,radialImpulse,resetPhysics,membranePath,membraneContains,normalizePhysics} from '../src/physics.js';
test.beforeEach(resetPhysics);test.after(resetPhysics);
const bounds={width:342,height:330,top:0};
const surface=p=>p.surface.map(q=>({x:p.x+q.x,y:p.y+q.y}));
function contained(p,b){assert.ok([p.x,p.y,p.vx,p.vy,p.areaRatio,p.deformation].every(Number.isFinite));assert.ok(p.areaRatio>.9&&p.areaRatio<1.08,'The membrane lost its enclosed area');for(const q of surface(p)){assert.ok(q.x>=-1&&q.x<=b.width+1&&q.y>=(b.top||0)-1&&q.y<=b.height+1,`A surface escaped the board: ${JSON.stringify(q)}`);}}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function edgeDistance(p,poly){return Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));}
function separate(bodies){for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=surface(bodies[i]),b=surface(bodies[j]);for(const[p,poly]of[...a.map(p=>[p,b]),...b.map(p=>[p,a])])assert.ok(!inside(p,poly)||edgeDistance(p,poly)<1,'Simulated membranes penetrate each other');}}

test('each content count keeps its fixed nominal diameter, including half words',()=>{
  assert.deepEqual(BUBBLE_DIAMETERS,{'.5':54,1:74,2:108,3:134,4:158});assert.equal(bubbleDiameter({atoms:[{part:0}]}),54);
  for(let count=1;count<=4;count++)assert.equal(bubbleDiameter({atoms:Array.from({length:count},()=>({word:'Word'}))}),BUBBLE_DIAMETERS[count]);
});
test('a released membrane falls, contacts the floor, and retains its area',()=>{
  const p={id:'a',x:170,y:50,r:35,vx:0,vy:0};simulatePhysics([p],bounds,.2);assert.ok(p.y>65);
  simulatePhysics([p],bounds,4);contained(p,bounds);assert.ok(Math.abs(Math.max(...surface(p).map(q=>q.y))-(bounds.height-3))<1);assert.ok(Math.abs(p.vy)<1);
});
test('incoming membranes settle without penetrating or losing their words to the ceiling',()=>{
  const bodies=Array.from({length:12},(_,i)=>({id:String(i),x:43+(i%4)*85,y:-40-Math.floor(i/4)*85,r:34,vx:(i%3-1)*9,vy:0,entering:true}));
  simulatePhysics(bodies,bounds,8);for(const p of bodies){contained(p,bounds);assert.ok(!p.entering);}separate(bodies);
});
test('larger clusters collide through their deformed surfaces alongside small bubbles',()=>{
  const b={width:358,height:500},bodies=[{id:'two',x:100,y:60,r:54,vx:0,vy:0},{id:'three',x:230,y:40,r:67,vx:0,vy:0},...Array.from({length:7},(_,i)=>({id:String(i),x:40+(i%4)*85,y:-40-i*50,r:37,vx:0,vy:0,entering:true}))];
  simulatePhysics(bodies,b,8);for(const p of bodies)contained(p,b);separate(bodies);
});
test('holding a bubble keeps its center under the finger while other bubbles fall',()=>{
  const held={id:'held',x:100,y:90,r:35,vx:0,vy:0},falling={id:'falling',x:220,y:50,r:35,vx:0,vy:0};
  simulatePhysics([held,falling],{...bounds,held:new Set(['held'])},.5);assert.equal(held.x,100);assert.equal(held.y,90);assert.ok(falling.y>150);
});
test('26 soft bubbles form a stable S23 pile with actual, non-circular contact surfaces',()=>{
  const b={width:358,height:454},bodies=Array.from({length:26},(_,i)=>({id:String(i),x:179+(i%5-2)*76*Math.sqrt(3)/2,y:-47-Math.floor(i/5)*76-(i%5%2?38:0),r:37,vx:0,vy:0,entering:true}));
  simulatePhysics(bodies,b,5);for(const p of bodies){contained(p,b);assert.ok(!p.entering);}separate(bodies);
  assert.ok(bodies.some(p=>p.deformation>.1));assert.ok(bodies.some(p=>p.surface.some(q=>Math.abs(Math.hypot(q.x,q.y)-p.r)>4)));
});
test('a returned membrane displaces an occupant while its center stays fixed',()=>{
  const returned={id:'returned',x:100,y:260,r:37,vx:0,vy:0},occupant={id:'occupant',x:105,y:260,r:37,vx:0,vy:0};
  simulatePhysics([returned,occupant],{...bounds,held:new Set(['returned']),solidHeld:new Set(['returned'])},.4);
  assert.equal(returned.x,100);assert.equal(returned.y,260);assert.ok(occupant.x>150);separate([returned,occupant]);
});
test('loaded bubbles flatten locally and spring back to round when released from contact',()=>{
  const b={width:358,height:454},bodies=Array.from({length:3},(_,i)=>({id:String(i),x:179,y:415-i*76,r:37,vx:0,vy:0}));simulatePhysics(bodies,b,5);
  assert.ok(bodies[0].deformation>bodies[2].deformation+.04);assert.ok(bodies[0].squashY<.97,'Weight did not flatten the loaded membrane');
  const freed=bodies[0];freed.x=179;freed.y=150;freed.vx=freed.vy=0;simulatePhysics([freed],{...b,gravity:0},3);
  assert.ok(freed.deformation<.01,'A free membrane did not recover its circular rest shape');assert.ok(Math.abs(freed.areaRatio-1)<.02);
});
test('impacts create changing vertex contours and retain an intact inflated membrane',()=>{
  const b={width:358,height:594},a={id:'a',x:100,y:140,r:37,vx:200,vy:200},c={id:'b',x:200,y:240,r:37,vx:-200,vy:-200};let peak=0;
  for(let i=0;i<45;i++){stepPhysics([a,c],b);peak=Math.max(peak,a.deformation);}assert.ok(peak>.04);assert.ok(membranePath(a).includes('C'));
  simulatePhysics([a,c],b,5);contained(a,b);contained(c,b);separate([a,c]);
});

test('touch hit testing follows a deformed membrane rather than its nominal circle or box',()=>{
  const b={width:358,height:454},bodies=Array.from({length:3},(_,i)=>({id:String(i),x:179,y:415-i*76,r:37,vx:0,vy:0}));simulatePhysics(bodies,b,5);
  const p=bodies[0],bulge=p.surface.reduce((a,b)=>Math.hypot(a.x,a.y)>Math.hypot(b.x,b.y)?a:b);
  const point={x:p.x+bulge.x*.98,y:p.y+bulge.y*.98};assert.ok(Math.hypot(point.x-p.x,point.y-p.y)>p.r);assert.ok(membraneContains(p,point));
  assert.ok(membraneContains(p,{x:p.x,y:p.y}));assert.ok(!membraneContains(p,{x:p.x+p.r,y:p.y+p.r}));
});
test('pop impulses push nearby bubbles, exclude held ones, and survive resize and cluster growth',()=>{
  const bodies=[{id:'near',x:150,y:100,r:37,vx:0,vy:0},{id:'held',x:100,y:150,r:37,vx:0,vy:0},{id:'far',x:300,y:300,r:37,vx:0,vy:0},{id:'center',x:100,y:100,r:37,vx:0,vy:0}];
  radialImpulse(bodies,{x:100,y:100,radius:140,strength:65,held:new Set(['held'])});assert.ok(bodies[0].vx>0&&bodies[0].vx<65);for(const p of bodies.slice(1))assert.equal(p.vx,0);
  simulatePhysics(bodies,{width:358,height:594},4);bodies[0].r=54;bodies[0].stiff=true;simulatePhysics(bodies,{width:320,height:454},4);for(const p of bodies)contained(p,{width:320,height:454});separate(bodies);
});

test('live gravity changes accelerate an existing membrane without resetting it',()=>{
  const p={id:'live',x:150,y:80,r:37,vx:0,vy:0},b={width:358,height:700};
  simulatePhysics([p],{...b,physics:{gravity:0}},3);assert.ok(Math.abs(p.y-80)<.001);
  simulatePhysics([p],{...b,physics:{gravity:2}},.2);assert.ok(p.y>115);assert.ok(p.vy>300);
  const velocity=p.vy;stepPhysics([p],{...b,physics:{gravity:0}});assert.ok(p.vy>velocity*.9,'Changing settings reset the body velocity');
});

test('lower pressure makes loaded membranes squash more while keeping their fixed rest size',()=>{
  const squash=pressure=>{
    resetPhysics();const bodies=Array.from({length:3},(_,i)=>({id:String(i),x:179,y:415-i*76,r:37,vx:0,vy:0}));
    simulatePhysics(bodies,{width:358,height:454,physics:{pressure}},5);for(const p of bodies)assert.equal(p.r,37);
    return bodies.reduce((sum,p)=>sum+p.deformation,0);
  };
  assert.ok(squash(.25)>squash(2)*1.5,'The pressure control does not change compression');
});

test('pressure updates the same loaded membranes in place',()=>{
  const b={width:358,height:454},bodies=Array.from({length:3},(_,i)=>({id:String(i),x:179,y:415-i*76,r:37,vx:0,vy:0}));
  simulatePhysics(bodies,{...b,physics:{pressure:2}},5);const firm=bodies.reduce((n,p)=>n+p.deformation,0);
  simulatePhysics(bodies,{...b,physics:{pressure:.25}},5);assert.ok(bodies.reduce((n,p)=>n+p.deformation,0)>firm*1.5,'Existing membranes kept their old material');
});

test('damping controls how long collision jiggles persist',()=>{
  const jiggle=damping=>{
    resetPhysics();const bodies=[{id:'a',x:100,y:150,r:37,vx:250,vy:0},{id:'b',x:250,y:150,r:37,vx:-250,vy:0}];let wobble=0;
    for(let i=0;i<90;i++){stepPhysics(bodies,{width:358,height:454,physics:{gravity:0,damping}});if(i>30)wobble+=bodies.reduce((n,p)=>n+p.deformation,0);}
    return wobble;
  };
  assert.ok(jiggle(0)>jiggle(2)*10,'Damping does not shorten the oscillations');
});

test('saved physics values normalize safely and a heavy, squishy pile stays intact',()=>{
  assert.deepEqual(normalizePhysics(),{gravity:1,pressure:1,damping:1});
  assert.deepEqual(normalizePhysics({gravity:-1,pressure:20,damping:'2'}),{gravity:0,pressure:2,damping:1});
  assert.deepEqual(normalizePhysics({gravity:NaN,pressure:Infinity,damping:null}),{gravity:1,pressure:1,damping:1});
  const b={width:358,height:454,physics:{gravity:2,pressure:.25,damping:0}},bodies=Array.from({length:26},(_,i)=>({id:String(i),x:179+(i%5-2)*76*Math.sqrt(3)/2,y:-47-Math.floor(i/5)*76-(i%5%2?38:0),r:37,vx:0,vy:0,entering:true}));
  simulatePhysics(bodies,b,6);
  for(const p of bodies){assert.ok([p.x,p.y,p.vx,p.vy,p.areaRatio].every(Number.isFinite));assert.ok(p.areaRatio>.7,'A tuned bubble collapsed');assert.equal(p.surface.length,16);for(const q of surface(p))assert.ok(q.x>-2&&q.x<360&&q.y>-2&&q.y<456,'A tuned membrane escaped the board');}
});

test('new bubbles enter a zero-gravity board and then stop receiving entry flow',()=>{
  const b={width:358,height:550,physics:{gravity:0}},bodies=Array.from({length:24},(_,i)=>({id:String(i),x:40+(i%4)*85,y:-45-Math.floor(i/4)*76,r:37,vx:0,vy:0,entering:true}));
  simulatePhysics(bodies,b,12);for(const p of bodies){assert.ok(!p.entering,'A zero-gravity arrival remained above the water');contained(p,b);}separate(bodies);
  simulatePhysics(bodies,b,4);assert.ok(bodies.every(p=>Math.abs(p.vy)<5),'The entry flow kept pushing bubbles after arrival');
});
