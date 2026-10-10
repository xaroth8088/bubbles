import confetti from 'canvas-confetti';
import {animate,spring,stagger} from 'animejs';

// The reef, currents and drag trails are always behind the word bubbles.
// Bursts have their own non-interactive canvas and short, bounded lifetimes.
export function createExperience(board,reduced){
  const ocean=board.parentElement.querySelector('.ocean');
  const water=document.createElement('canvas');water.className='water-canvas';water.setAttribute('aria-hidden','true');ocean.append(water);
  const particles=document.createElement('canvas');particles.className='particle-canvas';particles.setAttribute('aria-hidden','true');board.parentElement.append(particles);
  const burst=confetti.create(particles,{resize:true,useWorker:false});
  const ctx=water.getContext('2d'),motes=Array.from({length:24},(_,i)=>({x:((i*137.508)%360)/360,y:(i*47.71%480)/480,r:i%4===0?2.1:.8,speed:3+i%5}));
  let w=360,h=550,frame=0,last=0,phase=0,wave=0,link=null,lastTrail=null;
  const trails=[],rings=[];
  const motions=new Set();
  function motion(target,properties){const item=animate(target,properties);motions.add(item);item.then(()=>motions.delete(item));return item;}
  function stopMotion(){for(const item of motions)item.revert();motions.clear();}
  const bubbleShape=confetti.shapeFromPath({path:'M10 0A10 10 0 1 1 10 20A10 10 0 1 1 10 0ZM10 2A8 8 0 1 0 10 18A8 8 0 1 0 10 2Z',matrix:[.5,0,0,.5,-5,-5]});
  const diamond=confetti.shapeFromPath({path:'M5 0 10 5 5 10 0 5Z',matrix:[1,0,0,1,-5,-5]});
  function resize(){w=board.clientWidth;h=board.clientHeight;const dpr=Math.min(1.5,devicePixelRatio||1);water.width=Math.round(w*dpr);water.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw(0);}
  function draw(dt){
    phase+=dt;wave*=Math.exp(-dt*.5);ctx.clearRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<3;i++){
      const x=w*(.18+i*.31)+Math.sin(phase*.16+i)*w*.07;
      const g=ctx.createLinearGradient(x,0,x+80,h*.8);g.addColorStop(0,'#d4ffee16');g.addColorStop(1,'#a7ffec00');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-18,0);ctx.lineTo(x+23,0);ctx.lineTo(x+130,h*.85);ctx.lineTo(x+35,h*.85);ctx.closePath();ctx.fill();
    }
    for(const m of motes){
      const x=m.x*w+Math.sin(phase*.18+m.y*10)*(5+wave*6),y=((m.y*h-phase*m.speed)%h+h)%h;
      ctx.globalAlpha=.25+.18*Math.sin(phase*.8+m.x*8);ctx.fillStyle='#caffec';ctx.beginPath();ctx.arc(x,y,m.r,0,Math.PI*2);ctx.fill();
      if(m.r>2){ctx.globalAlpha=.16;ctx.strokeStyle='#d9fff7';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.stroke();}
    }
    ctx.restore();
    for(let i=trails.length-1;i>=0;i--){const t=trails[i];t.life-=dt;if(t.life<=0){trails.splice(i,1);continue;}const a=t.life/t.total;ctx.strokeStyle=`rgba(204,255,247,${a*.5})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(t.x,t.y,t.r+(1-a)*7,0,Math.PI*2);ctx.stroke();}
    for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.life-=dt;if(r.life<=0){rings.splice(i,1);continue;}const t=1-r.life/r.total;ctx.strokeStyle=r.color;ctx.globalAlpha=(1-t)*.65;ctx.lineWidth=1.5*(1-t);ctx.beginPath();ctx.ellipse(r.x,r.y,r.size+t*r.spread,(r.size+t*r.spread)*.74,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    if(link){const{a,b}=link,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d*9,ny=dx/d*9;
      ctx.fillStyle='#a6fff044';ctx.strokeStyle='#e0fffbaa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x+nx,a.y+ny);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-8,b.x+nx,b.y+ny);ctx.lineTo(b.x-nx,b.y-ny);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+8,a.x-nx,a.y-ny);ctx.closePath();ctx.fill();ctx.stroke();}
    water.dataset.motes=String(motes.length);water.dataset.trails=String(trails.length);water.dataset.rings=String(rings.length);
  }
  function tick(now){frame=0;if(document.hidden||reduced())return;const dt=Math.min(.06,(now-last)/1000)||1/30;if(now-last>=32){last=now;draw(dt);}frame=requestAnimationFrame(tick);}
  function sync(){if(frame)cancelAnimationFrame(frame);frame=0;burst.reset();water.dataset.motion=reduced()?'still':'moving';if(reduced()){stopMotion();trails.length=rings.length=0;link=null;draw(0);}else if(!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}}
  function ripple(x,y,size=8,color='#d4fff4',spread=35){if(reduced())return;rings.push({x,y,size,color,spread,total:.7,life:.7});if(rings.length>24)rings.shift();}
  function emit(type,x,y,size=37){
    if(reduced()||document.hidden)return;
    const presets={join:{count:9,speed:5,scale:.5,colors:['#d5fff2','#92dfd5']},pop:{count:46,speed:12,scale:.8,colors:['#bffff0','#f6df9c','#e1fcff']},ice:{count:9,speed:6,scale:.6,colors:['#c2f2ff','#ffffff']},unlock:{count:12,speed:7,scale:.6,colors:['#f3cd7f','#b0eac8']},letter:{count:5,speed:4,scale:.4,colors:['#dfc7ff','#dbf7ff']},hit:{count:3,speed:3,scale:.3,colors:['#cef8ee']},win:{count:88,speed:17,scale:.9,colors:['#baf7e3','#f6df9c','#e6d5f8']}};
    const p=presets[type]||presets.join;
    particles.dataset.lastEffect=type;particles.dataset.emissions=String(Number(particles.dataset.emissions||0)+1);
    particles.dataset[type+'Count']=String(Number(particles.dataset[type+'Count']||0)+1);
    burst({particleCount:p.count,angle:90,spread:360,startVelocity:p.speed,decay:.94,gravity:-.06,drift:.15,ticks:type==='win'?125:65,origin:{x:Math.max(0,Math.min(1,x/w)),y:Math.max(0,Math.min(1,y/h))},colors:p.colors,shapes:type==='ice'?[diamond]:[bubbleShape,'circle'],flat:true,scalar:p.scale,disableForReducedMotion:true});
    if(type!=='hit')ripple(x,y,size*.5,type==='ice'?'#d2f6ff':'#d2fff0',type==='pop'?70:28);
    if(type==='pop'||type==='win'){wave=1;ocean.classList.remove('ocean-awake');void ocean.offsetWidth;ocean.classList.add('ocean-awake');}
  }
  function trail(point,target){if(reduced())return;if(!lastTrail||Math.hypot(point.x-lastTrail.x,point.y-lastTrail.y)>7){trails.push({...point,r:1.5+Math.random()*2,total:.5,life:.5});if(trails.length>70)trails.shift();lastTrail={...point};}link=target?{a:{...point},b:{x:target.x,y:target.y}}:null;}
  function release(){lastTrail=null;link=null;}
  function press(el){if(!el||reduced())return;motion(el,{'--press':[.94,1],ease:spring({bounce:.28,duration:250})});}
  function arrive(el){if(!el||reduced())return;motion(el,{'--arrival':[.78,1],ease:spring({bounce:.32,duration:330})});}
  function panel(el){if(!el||reduced())return;motion(el,{opacity:[.2,1],translateY:[14,0],duration:260,ease:'outCubic'});}
  function progress(el){if(reduced())return;motion(el.querySelectorAll('.done'),{scaleY:[1,2.2,1],duration:420,delay:stagger(14,{from:'last'}),ease:'outCubic'});}
  function reset(){stopMotion();burst.reset();trails.length=rings.length=0;link=null;lastTrail=null;}
  new ResizeObserver(resize).observe(board);document.addEventListener('visibilitychange',sync);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',sync);
  resize();sync();
  return{emit,trail,release,ripple,press,arrive,panel,progress,reset,sync};
}
