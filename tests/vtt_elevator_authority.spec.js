const { test, expect } = require('@playwright/test');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

function fresh(file){const resolved=require.resolve(path.join(ROOT,file));delete require.cache[resolved];return require(resolved);}

test('direct DM elevator actions are explicitly local and do not impersonate a player', async()=>{
  const previousState=global.LuminousVttVerticalPortalState;
  const previousRuntime=global.LuminousVttElevatorRuntime;
  const previousPatch=global.LuminousVttElevatorStatePatch;
  let captured=null;
  try{
    global.LuminousVttVerticalPortalState={
      ROOT:'vtt_topology',
      createBridge:()=>({mapId:'authority_map',start:()=>false,stop:()=>true}),
    };
    global.LuminousVttElevatorRuntime={api:{handleRequest:async request=>{captured=request;return{valid:true};}}};
    const patch=fresh('js/vtt/elevator-state-patch.js');
    patch.install();
    const bridge=global.LuminousVttVerticalPortalState.createBridge({mapData:{id:'authority_map'},isDm:true});
    const result=await bridge.requestElevatorAction('lift_alpha',2,'go');
    expect(result.valid).toBe(true);
    expect(captured).toMatchObject({elevatorId:'lift_alpha',targetZ:2,action:'go',dmDirect:true,requesterUid:null,playerId:null,actorId:null});
  }finally{
    if(previousState===undefined)delete global.LuminousVttVerticalPortalState;else global.LuminousVttVerticalPortalState=previousState;
    if(previousRuntime===undefined)delete global.LuminousVttElevatorRuntime;else global.LuminousVttElevatorRuntime=previousRuntime;
    if(previousPatch===undefined)delete global.LuminousVttElevatorStatePatch;else global.LuminousVttElevatorStatePatch=previousPatch;
  }
});

test('Firebase elevator requests cannot opt into direct-DM mode',()=>{
  const source=require('node:fs').readFileSync(path.join(ROOT,'js/vtt/elevator-state-patch.js'),'utf8');
  expect(source).toContain('dmDirect:false');
  expect(source).toContain('requesterUid:null,playerId:null,actorId:null,dmDirect:true');
});
