const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('physical token state snapshots hiding cover and posture without mixing world knowledge', async () => {
  const previous = global.LuminousVttTokenState;
  global.LuminousVttTokenState = Object.freeze({
    PLAYER_ROOT:'campaña/jugadores', WORLD_ROOT:'campaña/estado_mundo/vttTokens',
    firebaseKey:(value)=>String(value), hostFirebase:()=>null,
    createBridge:()=>Object.freeze({mapId:'map',start(){},stop(){},async saveToken(){return{scope:'player',key:'p'};}}),
  });
  delete require.cache[require.resolve('../js/vtt/physical-state-patch.js')];
  require('../js/vtt/physical-state-patch.js');
  const patched=global.LuminousVttTokenState;
  const token={
    id:'p', posture:'sitting', activeMovementMode:'climb',
    stealthState:{hidden:true,hiddenInObjectId:'locker',concealment:'full'},
    coverState:{active:true,objectId:'barrier'},
  };
  const snapshot=patched.physicalSnapshot(token);
  expect(snapshot).toMatchObject({posture:'sitting',activeMovementMode:'climb'});
  expect(snapshot.stealthState).toMatchObject({hidden:true,hiddenInObjectId:'locker'});
  expect(snapshot.coverState).toMatchObject({active:true,objectId:'barrier'});
  expect(snapshot).not.toHaveProperty('npcKnowledge');
  const restored={id:'q'};
  patched.applyPhysicalSnapshot(restored,snapshot);
  expect(restored.stealthState.hiddenInObjectId).toBe('locker');
  expect(restored.coverState.objectId).toBe('barrier');
  expect(restored.posture).toBe('sitting');
  if (previous === undefined) delete global.LuminousVttTokenState; else global.LuminousVttTokenState=previous;
});

test('VTT loads physical persistence after canonical token state and shared executor saves through tokenStateBridge', async () => {
  const html=fs.readFileSync(path.join(__dirname,'..','vtt.html'),'utf8');
  const intent=fs.readFileSync(path.join(__dirname,'..','js','vtt','interaction-intent.js'),'utf8');
  const tokenIndex=html.indexOf('js/vtt/token-state.js');
  const physicalIndex=html.indexOf('js/vtt/physical-state-patch.js');
  const mainIndex=html.indexOf('js/vtt/main.js');
  expect(tokenIndex).toBeGreaterThan(-1);
  expect(physicalIndex).toBeGreaterThan(tokenIndex);
  expect(mainIndex).toBeGreaterThan(physicalIndex);
  expect(intent).toContain('runtime.tokenStateBridge?.saveToken');
});
