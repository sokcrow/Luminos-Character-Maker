import {
  APARTMENT_GRID,FURNITURE_TYPES,FACING_ARROW,
  furnitureFootprint,furnitureCenter,furnitureRotationY,furnitureFacingVector,
  readApartmentLayout
} from './HorrorApartmentLayout.js';

// Uses Forest's native renderer, collisions and interaction registry.
// Furniture origin is its grid footprint CENTER; the model's unrotated FRONT is local +Z.
export function createHorrorApartmentBuilder({THREE,wt,scene,addCollider,getInteractions,getWallOccluders}){
  const showArrows=new URLSearchParams(location.search).get('furnitureArrows')==='1';
  const mat=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.83,metalness});
  const colors={
    floor:mat('#4c4644'),plaster:mat('#555b64'),trim:mat('#292f38'),
    glow:new THREE.MeshBasicMaterial({color:'#9bbed6'}),
    dark:mat('#222733'),light:mat('#c5bcb0'),accent:mat('#8a625c'),
    blanket:mat('#667b87'),pillow:mat('#d8d4ce'),metal:mat('#a5adb3',.35)
  };
  function cube(parent,w,h,d,x,y,z,material){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function tileCube(parent,w,h,d,x,y,z,material){
    return cube(parent,wt(w),h,wt(d),wt(x),y,wt(z),material);
  }
  function buildModel(group,item,def) {
    const W=wt(def.w),D=wt(def.d),H=def.height;
    const c=mat(def.color);
    const add=(w,h,d,x,y,z,m=c)=>cube(group,w,h,d,x,y,z,m);
    const panel=add(W*.92,Math.max(.12,H*.3),D*.88,0,Math.max(.12,H*.3)/2,0);
    switch(item.type){
      case 'bed':
        add(W*.9,.20,D*.90,0,.38,0,colors.blanket);
        add(W*.78,.08,D*.20,0,.50,-D*.34,colors.pillow);
        add(W*.92,.77,.11,0,.38,-D*.48,colors.trim);
        break;
      case 'sofa':
        add(W*.95,.40,D*.83,0,.40,0,c);
        add(W*.95,.74,D*.19,0,.56,-D*.41,c);
        for(const x of [-W*.45,W*.45])add(.17,.61,D*.82,x,.38,0,c);
        break;
      case 'wardrobe':
      case 'shelf':
        add(W*.98,H-.12,D*.92,0,H/2,0,c);
        if(item.type==='wardrobe'){
          add(.032,H*.85,.03,-W*.02,H*.50,D*.47,colors.trim);
          for(const x of [-W*.30,W*.30])add(.055,.21,.06,x,H*.51,D*.49,colors.metal);
        }else{
          for(let i=1;i<4;i++)add(W*.88,.05,D*.70,0,H*i/4,D*.05,colors.trim);
        }
        break;
      case 'tv':
        add(W*.81,H*.68,.09,0,H*.59,D*.27,colors.dark);
        add(W*.72,H*.57,.02,0,H*.59,D*.33,colors.glow);
        add(W*.3,.06,D*.18,0,.12,0,colors.trim);
        break;
      case 'fridge':
        add(W*.9,H,D*.9,0,H*.5,0,c);
        add(.05,.44,.045,W*.30,H*.92,D*.46,colors.trim);
        add(W*.83,.034,.03,0,H*.54,D*.46,colors.trim);
        break;
      case 'stove':
      case 'sink':
        add(W*.96,.30,D*.94,0,H*.78,0,c);
        if(item.type==='stove'){
          for(const x of [-W*.24,W*.24])for(const z of [-D*.20,D*.20]){
            const burner=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.018,16),colors.trim);
            burner.position.set(x,H*.96,z);group.add(burner);
          }
        }else{
          add(W*.50,.015,D*.48,0,H*.97,0,colors.metal);
          add(.034,.26,.034,0,H*1.10,-D*.20,colors.trim);
        }
        break;
      case 'desk':
      case 'table':
        add(W*.95,.11,D*.91,0,H*.89,0,c);
        for(const x of [-W*.39,W*.39])for(const z of [-D*.34,D*.34])
          add(.085,H*.81,.085,x,H*.41,z,colors.trim);
        if(item.type==='desk')add(W*.29,.025,D*.16,0,H*.99,-D*.12,colors.dark);
        break;
      case 'chair':
        add(W*.79,.12,D*.77,0,.46,0,c);
        add(W*.81,.64,.10,0,.76,-D*.38,c);
        for(const x of [-W*.29,W*.29])for(const z of [-D*.29,D*.29])
          add(.07,.37,.07,x,.19,z,colors.trim);
        break;
      case 'nightstand':
        add(W*.83,H*.75,D*.81,0,H*.45,0,c);
        add(W*.65,.07,D*.04,0,H*.54,D*.41,colors.trim);
        break;
    }
    // A cardinal FRONT arrow belongs to every item, not just the furniture palette.
    if(showArrows){
      const arrow=new THREE.ArrowHelper(
        new THREE.Vector3(0,0,1),
        new THREE.Vector3(0,Math.max(.35,H+.20),D*.49),
        .66,0xffca55,.24,.12
      );
      group.add(arrow);
    }
  }
  return function buildHorrorApartment(){
    // clearMap() replaces these arrays; resolve the live registries at build time.
    const interactions=getInteractions(),wallOccluders=getWallOccluders();
    const root=new THREE.Group();
    root.name='Forest Horror · Apartamento (cuadrícula 12×10)';
    scene.background=new THREE.Color(0x121822);
    const {cols,rows,x0,z0}=APARTMENT_GRID;
    tileCube(root,cols,.18,rows,x0+cols/2,-.11,z0+rows/2,colors.floor);

    // Four physical boundaries, but the south facade is a cutaway for the fixed camera.
    const wallH=3.75,edge=.12,xMid=wt(x0+cols/2),zMid=wt(z0+rows/2);
    const north=cube(root,wt(cols),wallH,edge,xMid,wallH/2,wt(z0),colors.plaster);
    const west=cube(root,edge,wallH,wt(rows),wt(x0),wallH/2,zMid,colors.plaster);
    const east=cube(root,edge,wallH,wt(rows),wt(x0+cols),wallH/2,zMid,colors.plaster);
    for(const wall of [north,west,east]){wall.userData.cameraWallOccluder=true;wallOccluders.push(wall);}
    addCollider(xMid,wt(z0),wt(cols),.25,'apartment-north','exterior');
    addCollider(wt(x0),zMid,.25,wt(rows),'apartment-west','exterior');
    addCollider(wt(x0+cols),zMid,.25,wt(rows),'apartment-east','exterior');
    addCollider(xMid,wt(z0+rows),wt(cols),.25,'apartment-south-cutaway','exterior');

    // Painted room bands establish readable spaces without blocking the camera.
    const rugMat=new THREE.MeshStandardMaterial({color:'#45505d',roughness:1,transparent:true,opacity:.54,depthWrite:false});
    const rug=new THREE.Mesh(new THREE.PlaneGeometry(wt(4),wt(3)),rugMat);
    rug.rotation.x=-Math.PI/2;rug.position.set(wt(-3.7),.012,wt(-2.1));root.add(rug);
    const rug2=rug.clone();rug2.scale.set(1.5,1.3,1);rug2.position.set(wt(1.1),.015,wt(2.8));root.add(rug2);

    // Two windows with nocturnal blue glow; no roof blocks the interior camera.
    for(const x of [-3.7,2.3]){
      cube(root,wt(1.7),1.60,.04,wt(x),2.15,wt(z0)+.10,colors.trim);
      cube(root,wt(1.53),1.43,.045,wt(x),2.15,wt(z0)+.15,colors.glow);
      cube(root,.065,1.38,.06,wt(x),2.15,wt(z0)+.19,colors.trim);
    }
    const light=new THREE.PointLight(0xb3bccb,1.65,wt(13),2);
    light.position.set(0,3.6,wt(-.8));root.add(light);
    const lamp=new THREE.PointLight(0xffc28e,.58,wt(5),2);
    lamp.position.set(wt(-3.5),1.4,wt(2));root.add(lamp);
    // Entry threshold on the south cutaway (not a wall or a blocking door).
    tileCube(root,1.5,.08,.23,3,.04,z0+rows-.14,colors.trim);

    // The same saved grid drives visual furniture, collisions and interactions.
    const placed=readApartmentLayout();
    for(const item of placed){
      const def=FURNITURE_TYPES[item.type],fp=furnitureFootprint(item.type,item.facing),center=furnitureCenter(item);
      if(!def||!center)continue;
      const group=new THREE.Group();
      group.name=item.id+' · frente '+FACING_ARROW[item.facing];
      group.position.set(wt(center.x),0,wt(center.z));
      group.rotation.y=furnitureRotationY(item.facing);
      root.add(group);
      buildModel(group,item,def);
      addCollider(group.position.x,group.position.z,wt(fp.w)*.91,wt(fp.d)*.89,'furniture:'+item.type,'exterior');
      const facing=furnitureFacingVector(item.facing);
      const frontOffset=(item.facing==='north'||item.facing==='south'?fp.d:fp.w)*.5+.48;
      const ix=group.position.x+wt(facing.x*frontOffset),iz=group.position.z+wt(facing.z*frontOffset);
      interactions.push({
        kind:'message',label:'Examinar '+def.label,
        title:def.label,message:'Un objeto cotidiano. Por ahora, todo parece estar en su lugar.',
        point:new THREE.Vector3(ix,0,iz),radius:wt(1.0),
        tags:['horror-apartment','furniture',item.type]
      });
    }
    // A nonblocking entry point to test the door / hallway in the next iteration.
    interactions.push({
      kind:'message',label:'Mirar la puerta',
      title:'Puerta del apartamento',message:'El pasillo está silencioso. No recuerdas haber cerrado esta puerta.',
      point:new THREE.Vector3(wt(3),0,wt(4.1)),radius:wt(1.25)
    });
    return root;
  };
}
