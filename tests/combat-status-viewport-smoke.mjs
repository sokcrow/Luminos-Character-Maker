import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/combat-v073-hud-motion.js','utf8');
for(const [width,height]of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]])for(const count of [1,2,3,8]){
  const values=new Map(),style={gridTemplateColumns:'',maxHeight:'',getPropertyValue:key=>values.get(key)||'',setProperty:(key,value)=>values.set(key,value)};
  const scale=1.5,columns=()=>Number(style.gridTemplateColumns.match(/repeat\((\d+)/)?.[1]||4);
  const unit={id:'hero'},strip={style,children:Array(count).fill({}),
    get offsetWidth(){return columns()*58+(columns()-1)*5},
    get offsetHeight(){const rows=Math.ceil(count/columns());return rows*34+(rows-1)*7},
    getBoundingClientRect(){const x=(parseFloat(values.get('--status-viewport-x'))||0)*scale,y=(parseFloat(values.get('--status-viewport-y'))||0)*scale;
      const w=this.offsetWidth*scale,h=this.offsetHeight*scale,left=width*.1-w/2+x,bottom=height+40+y;
      return {left,right:left+w,top:bottom-h,bottom,width:w,height:h};}
  };
  const nodes={'statuses-hero':strip,'game-container':{classList:{contains:()=>false},getBoundingClientRect:()=>({left:0,top:0,right:width,bottom:height})},'token-hero':{classList:{contains:()=>false}}};
  // Mount is intentionally skipped; this exercises the production layout using
  // scaled geometry, independently of requestAnimationFrame/camera timing.
  let mounted=false;
  const c=vm.createContext({window:null,document:{getElementById:id=>id==='game-container'&&!mounted?null:nodes[id]},LuminousCombat073:{playerId:()=>unit.id,combatants:()=>({hero:unit})}});c.window=c;
  vm.runInContext(source,c);mounted=true;
  const api=c.LuminousCombatHudMotion073;
  for(let i=0;i<3;i++)api.layoutStatusHud();
  const box=strip.getBoundingClientRect();
  assert.ok(box.left>=7.99&&box.top>=7.99&&box.right<=width-7.99&&box.bottom<=height-7.99,`${width}x${height}/${count}: strip ${JSON.stringify(box)}`);
  const settled=JSON.stringify([...values]);api.layoutStatusHud();assert.equal(JSON.stringify([...values]),settled,'Repeated render does not oscillate correction');
}
console.log('Status viewport: transformed strips with 1/2/3/8 entries fit all six sizes without moving the Unit; repeated layout is stable.');
