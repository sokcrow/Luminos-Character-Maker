// Forest Horror · apartment layout / furniture-facing contract.
// Map coordinates follow Forest's hidden XZ grid, never a player-visible snap grid.
export const APARTMENT_LAYOUT_KEY = 'forest-horror-apartment-layout-v1';
export const APARTMENT_GRID = Object.freeze({cols:12,rows:10,x0:-6,z0:-5});
export const FACING = Object.freeze(['north','east','south','west']);
export const FACING_ARROW = Object.freeze({north:'↑',east:'→',south:'↓',west:'←'});
export const FURNITURE_TYPES = Object.freeze({
  bed:       {label:'Cama',         w:2,d:3,height:.54, color:'#647b88'},
  nightstand:{label:'Buró',         w:1,d:1,height:.55, color:'#96765b'},
  wardrobe:  {label:'Armario',      w:2,d:1,height:2.2, color:'#746657'},
  desk:      {label:'Escritorio',   w:2,d:1,height:.78, color:'#a18873'},
  chair:     {label:'Silla',        w:1,d:1,height:.82, color:'#686969'},
  sofa:      {label:'Sofá',         w:3,d:1,height:.83, color:'#6f7e70'},
  table:     {label:'Mesa',         w:2,d:2,height:.76, color:'#8b7868'},
  tv:        {label:'Televisor',    w:2,d:1,height:1.25,color:'#303946'},
  fridge:    {label:'Refrigerador', w:1,d:1,height:2.1, color:'#b9c1c4'},
  stove:     {label:'Estufa',       w:2,d:1,height:.92, color:'#879193'},
  sink:      {label:'Fregadero',    w:2,d:1,height:.91, color:'#82959b'},
  shelf:     {label:'Estantería',   w:2,d:1,height:1.8, color:'#816e61'}
});
export const DEFAULT_APARTMENT_ITEMS = Object.freeze([
  {id:'bed-1',type:'bed',col:1,row:1,facing:'south'},
  {id:'nightstand-1',type:'nightstand',col:3,row:2,facing:'south'},
  {id:'wardrobe-1',type:'wardrobe',col:0,row:5,facing:'east'},
  {id:'desk-1',type:'desk',col:1,row:7,facing:'north'},
  {id:'chair-1',type:'chair',col:3,row:7,facing:'west'},
  {id:'tv-1',type:'tv',col:5,row:0,facing:'south'},
  {id:'sofa-1',type:'sofa',col:4,row:8,facing:'north'},
  {id:'table-1',type:'table',col:7,row:5,facing:'north'},
  {id:'fridge-1',type:'fridge',col:11,row:1,facing:'west'},
  {id:'stove-1',type:'stove',col:9,row:0,facing:'south'},
  {id:'sink-1',type:'sink',col:9,row:2,facing:'south'},
  {id:'shelf-1',type:'shelf',col:0,row:0,facing:'east'}
]);
export function furnitureFootprint(type, facing='south') {
  const def=FURNITURE_TYPES[type];
  if(!def)return null;
  return facing==='east'||facing==='west' ? {w:def.d,d:def.w} : {w:def.w,d:def.d};
}
export function rotateFurnitureFacing(facing,steps=1){
  const i=FACING.indexOf(facing);
  return FACING[((i<0?2:i)+steps%4+4)%4];
}
export function furnitureCenter(item){
  const fp=furnitureFootprint(item.type,item.facing);
  if(!fp)return null;
  return {x:APARTMENT_GRID.x0+item.col+fp.w/2,z:APARTMENT_GRID.z0+item.row+fp.d/2};
}
export function furnitureRotationY(facing){
  return {south:0,east:Math.PI/2,north:Math.PI,west:-Math.PI/2}[facing] ?? 0;
}
export function furnitureFacingVector(facing){
  return {south:{x:0,z:1},east:{x:1,z:0},north:{x:0,z:-1},west:{x:-1,z:0}}[facing] || {x:0,z:1};
}
export function validateApartmentItems(items){
  const accepted=[],errors=[],occupied=new Set(),ids=new Set();
  if(!Array.isArray(items))return {items:[],errors:['El plano debe ser un arreglo.']};
  for(const raw of items){
    const f=raw && FURNITURE_TYPES[raw.type], facing=raw?.facing;
    const col=raw?.col,row=raw?.row,id=String(raw?.id||'');
    if(!f||!FACING.includes(facing)||!Number.isInteger(col)||!Number.isInteger(row)||!id||ids.has(id)){
      errors.push('Mueble inválido: '+id);continue;
    }
    const fp=furnitureFootprint(raw.type,facing);
    if(col<0||row<0||col+fp.w>APARTMENT_GRID.cols||row+fp.d>APARTMENT_GRID.rows){
      errors.push('Fuera del apartamento: '+id);continue;
    }
    const cells=[];
    for(let r=row;r<row+fp.d;r++)for(let c=col;c<col+fp.w;c++)cells.push(c+','+r);
    if(cells.some(cell=>occupied.has(cell))){errors.push('Muebles superpuestos: '+id);continue;}
    ids.add(id);cells.forEach(cell=>occupied.add(cell));
    accepted.push({id,type:raw.type,col,row,facing});
  }
  return {items:accepted,errors};
}
export function defaultApartmentLayout(){
  return DEFAULT_APARTMENT_ITEMS.map(item=>({...item}));
}
export function readApartmentLayout(storage=typeof localStorage!=='undefined'?localStorage:null){
  if(!storage)return defaultApartmentLayout();
  try{
    const raw=storage.getItem(APARTMENT_LAYOUT_KEY);
    if(!raw)return defaultApartmentLayout();
    const parsed=JSON.parse(raw),validated=validateApartmentItems(parsed);
    return validated.errors.length?defaultApartmentLayout():validated.items;
  }catch(_){return defaultApartmentLayout();}
}
export function writeApartmentLayout(items,storage=typeof localStorage!=='undefined'?localStorage:null){
  const verified=validateApartmentItems(items);
  if(verified.errors.length)throw Error(verified.errors.join('; '));
  if(storage)storage.setItem(APARTMENT_LAYOUT_KEY,JSON.stringify(verified.items));
  return verified.items;
}
