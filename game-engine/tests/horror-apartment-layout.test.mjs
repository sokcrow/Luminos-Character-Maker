import assert from 'node:assert/strict';
import {
  APARTMENT_GRID,DEFAULT_APARTMENT_ITEMS,
  furnitureFootprint,furnitureCenter,rotateFurnitureFacing,
  validateApartmentItems,defaultApartmentLayout,writeApartmentLayout,readApartmentLayout
} from '../src/world/HorrorApartmentLayout.js';

const original=defaultApartmentLayout();
assert.equal(original.length,12);
assert.deepEqual(validateApartmentItems(original).errors,[]);
assert.equal(APARTMENT_GRID.cols,12);
assert.equal(APARTMENT_GRID.rows,10);
assert.deepEqual(furnitureFootprint('bed','south'),{w:2,d:3});
assert.deepEqual(furnitureFootprint('bed','east'),{w:3,d:2});
assert.equal(rotateFurnitureFacing('west'),'north');

const bed=original.find(item=>item.type==='bed');
assert.ok(furnitureCenter(bed));
const collision=validateApartmentItems([...original,{id:'duplicate-on-bed',type:'chair',col:1,row:1,facing:'south'}]);
assert.equal(collision.items.length,original.length);
assert.ok(collision.errors.some(x=>x.includes('superpuestos')));
const overflow=validateApartmentItems([{id:'overflow',type:'bed',col:11,row:9,facing:'south'}]);
assert.ok(overflow.errors.some(x=>x.includes('Fuera')));

const store=new Map();
const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
writeApartmentLayout(original,storage);
assert.deepEqual(readApartmentLayout(storage),original);
store.set('forest-horror-apartment-layout-v1','INVALID JSON');
assert.deepEqual(readApartmentLayout(storage),original);
assert.deepEqual(DEFAULT_APARTMENT_ITEMS.map(x=>x.id),original.map(x=>x.id));
console.log('Horror Apartment grid tests: OK (12 furniture footprints, placement, rotation, storage).');
