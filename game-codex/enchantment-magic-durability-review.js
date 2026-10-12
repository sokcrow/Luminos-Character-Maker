(function (global) {
"use strict";
// DESIGN PREVIEW ONLY. Part A-D of PR #931 are authoritative; this rank formula disagrees with existing direct/gem ratios. See docs/enchanters-update-proposals-reconciliation.md. No writes to live inventory, rest, spells, Firebase.
// IMPORTANT: Recovery rounding, level interpretation, use granularity, and 0-point recovery
// require separate product review. Do not import as gameplay authority.
const RANK_RATIOS=Object.freeze({I:0.75,II:1.00,III:1.25});
const REST_PERCENTS=Object.freeze({short_rest:10,long_rest:30});
const SPELL_SLOT_PERCENT_PER_LEVEL=5;
const validInteger=(n)=>Number.isSafeInteger(n)&&n>=0;
function maximum(physicalMaxDurability,rank){
  const n=Number(physicalMaxDurability);
  if(!validInteger(n)||!Object.prototype.hasOwnProperty.call(RANK_RATIOS,rank))return null;
  // Draft assumption: round durability cap up to integer points.
  return Math.ceil(n*RANK_RATIOS[rank]);
}
function initial(physicalMaxDurability,rank){
  const max=maximum(physicalMaxDurability,rank);
  return max===null?{valid:false,reason:"invalid_physical_durability_or_rank"}:{valid:true,rank,max,current:max};
}
function normalizeState(state){
  const max=Number(state?.max),current=Number(state?.current);
  return validInteger(max)&&validInteger(current)&&current<=max?{max,current}:null;
}
function canActivate(state){const v=normalizeState(state);return !!v&&v.current>=1;}
function activate(state){
  const v=normalizeState(state);
  if(!v)return {valid:false,reason:"invalid_state"};
  if(v.current<1)return {valid:false,reason:"magic_durability_depleted",max:v.max,current:v.current};
  return {valid:true,spent:1,max:v.max,current:v.current-1};
}
function recharge(state,restType,spentSpellSlotLevels=[]){
  const v=normalizeState(state);
  if(!v)return {valid:false,reason:"invalid_state"};
  if(!Object.prototype.hasOwnProperty.call(REST_PERCENTS,restType))return {valid:false,reason:"unknown_rest_type"};
  if(!Array.isArray(spentSpellSlotLevels)||spentSpellSlotLevels.some(level=>!Number.isSafeInteger(level)||level<1||level>9))return {valid:false,reason:"invalid_spent_spell_slot_levels"};
  // IMPORTANT: The caller must separately verify and spend real Slots in the canonical spell system.
  const restPercent=REST_PERCENTS[restType];
  const slotPercent=spentSpellSlotLevels.reduce((sum,level)=>sum+SPELL_SLOT_PERCENT_PER_LEVEL*level,0);
  const restRecovered=Math.ceil(v.max*restPercent/100);
  const slotRecovered=Math.ceil(v.max*slotPercent/100);
  const requested=restRecovered+slotRecovered;
  const actual=Math.min(requested,v.max-v.current);
  return {valid:true,max:v.max,before:v.current,current:v.current+actual,recovered:actual,
    restRecovered,slotRecovered,requested,restPercent,slotPercent,spentSpellSlotLevels:spentSpellSlotLevels.slice(),capped:requested>actual,
    assumptions:["ceil_maximum_and_recovery","spell_slot_level_multiplier","slot_recharge_during_rest","recharge_from_zero_allowed_draft"]};
}
const API=Object.freeze({version:"draft-v1",gameplayEnabled:false,RANK_RATIOS,REST_PERCENTS,SPELL_SLOT_PERCENT_PER_LEVEL,
  maximum,initial,normalizeState,canActivate,activate,recharge});
global.LuminousMagicDurabilityDesignReview=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
