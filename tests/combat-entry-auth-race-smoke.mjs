import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const nodes=new Map(),subscriptions=new Set();let observer,created=0;
const node=id=>{
 if(!nodes.has(id))nodes.set(id,{id,hidden:true,dataset:{},value:'',textContent:'',
  querySelector(){return node('submit');},appendChild(child){nodes.set(child.id,child);},
  remove(){nodes.delete(this.id);},close(){},showModal(){}});
 return nodes.get(id);
};
const user={uid:'dm'},values={
 'campaña/config/dm_uid':'dm','.info/connected':true,
 'campaña/jugadores':{},'campaña/combate/combatants':{enemy:{id:'enemy',battleActive:true}},
 'campaña/combate/estado':{active:true,phase:'PRE_COMBAT_PLANNING',encounterId:'encounter',round:1},
 'campaña/estado_mundo/instancia_activa':'combate',
};
const db={ref:path=>({once:async()=>({val:()=>values[path]}),on(_event,handler){subscriptions.add(handler);handler({val:()=>values[path]});},off(_event,handler){subscriptions.delete(handler);}})};
const auth={currentUser:null,onAuthStateChanged(handler){observer=handler;},
 // Reproduce the observed race: successful sign-in updates currentUser while
 // the observer still has an old signed-out notification queued.
 async signInWithEmailAndPassword(){this.currentUser=user;return {user};},
 async signOut(){this.currentUser=null;}};
const context=vm.createContext({console,document:{
 getElementById:id=>id==='combat-entry-view'?(nodes.get(id)||null):node(id),
 createElement(){created++;return {dataset:{},remove(){nodes.delete(this.id);}};},
},addEventListener(){},firebase:{apps:[{}],auth:()=>auth,database:()=>db},
 LuminousCombatSession:{ROOT:'campaña/combate',INSTANCE:'campaña/estado_mundo/instancia_activa',blocked:()=>false},
 LuminousCombatParticipants:{includes:()=>false}});
context.window=context;
vm.runInContext(fs.readFileSync('js/combat-entry.js','utf8'),context);
await observer(null);assert.equal(node('combat-entry-login').hidden,false);
const login=()=>node('combat-entry-login').onsubmit({preventDefault(){},currentTarget:node('combat-entry-login')});
await login();
assert.ok(nodes.get('combat-entry-view'),'successful login must enter combat even before the observer delivers its user');
assert.equal(node('combat-entry-login').hidden,true);
assert.equal(node('combat-entry-identity').textContent,'Director');
const frame=nodes.get('combat-entry-view'),bound=subscriptions.size;
await observer(null);
assert.equal(nodes.get('combat-entry-view'),frame,'stale signed-out notification cannot remove the field');
await observer(user);await login();
assert.equal(nodes.get('combat-entry-view'),frame,'duplicate notifications/results must reuse the existing field');
assert.equal(subscriptions.size,bound,'duplicate notifications must not multiply subscriptions');
assert.equal(created,1);
await node('combat-entry-signout').onclick();
assert.equal(nodes.has('combat-entry-view'),false);assert.equal(subscriptions.size,0);
assert.equal(node('combat-entry-login').hidden,false);
await observer(user);
assert.equal(nodes.has('combat-entry-view'),false,'stale signed-in notification cannot undo a sign-out');
auth.currentUser=user;await observer(user);
assert.ok(nodes.get('combat-entry-view'),'restoring a real session must still mount the field');
console.log('Combat entry Auth: explicit login, delayed/duplicate observer notifications, sign-out and restored sessions passed.');
