/* Shared user audio catalog. Binary files live in a private R2 bucket. */
(function (global) {
  'use strict';
  if (global.LuminousAudioLibrary) return;
  const KINDS = {music:'Canciones',ambience:'Ambientes',sfx:'Efectos de sonido'};
  const ID = /^r2_[a-f0-9]{64}$/;
  const LIMIT = 25 * 1024 * 1024;
  const bytesLabel = n => (n / 1024 / 1024).toFixed(1) + ' MB';
  function serviceUrl(value) {
    try {
      const url = new URL(value);
      // Firebase tokens are sent only to a deliberately configured Worker.
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
      return url.origin;
    } catch (_) { return ''; }
  }
  class Library {
    constructor({user,db,onChange,onBusyChange,isDirector=false}) {
      this.user=user;this.db=db;this.onChange=onChange;this.onBusyChange=onBusyChange;this.director=isDirector;
      this.scope=global.LuminousCombatContext?.isolated ? global.LuminousCombatContext.id : 'default';
      this.entries=[];this.endpoint='';this.bytes=0;this.busy=false;this.destroyed=false;this.generation=0;
      this.configRef=db.ref('campaña/config/audio_service_url');
      this.configListener=snapshot=>{
        const next=serviceUrl(snapshot.val());
        if(next===this.endpoint)return;
        this.xhr?.abort();this.endpoint=next;this.entries=[];this.generation++;this.render();this.onChange();
        if(next){const previous=this.pendingRefresh;Promise.resolve(previous).catch(()=>{}).then(()=>{if(!this.destroyed&&this.endpoint===next)return this.refresh();}).catch(error=>this.message(error.message));}
      };
      this.configRef.on('value',this.configListener,()=>this.message('No se pudo leer la configuración de la biblioteca.'));
      this.timer=global.setInterval(()=>{if(this.endpoint)this.refresh().catch(error=>this.message(error.message));},10*60*1000);
    }
    tracks(kind){return this.entries.filter(entry=>entry.kind===kind);}
    message(text){this.status=text;if(this.statusNode)this.statusNode.textContent=text;}
    setDirector(value){this.director=value;this.render();}
    async request(path,{method='GET',body,kind,name,onProgress,signal}={}) {
      if(!this.endpoint)throw Error('Primero conecta la biblioteca de audio.');
      const endpoint=this.endpoint,url=new URL(path,endpoint);url.searchParams.set('scope',this.scope);
      if(kind)url.searchParams.set('kind',kind);if(name)url.searchParams.set('name',name);
      const token=await this.user.getIdToken();
      if(this.destroyed||endpoint!==this.endpoint)throw Error('La sesión de audio cambió.');
      if(body) return new Promise((resolve,reject)=>{
        const xhr=new global.XMLHttpRequest();this.xhr=xhr;
        xhr.open(method,url.href);xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('Content-Type','application/octet-stream');
        xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress?.(event.loaded/event.total);};
        xhr.onload=()=>{this.xhr=null;let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error('El servicio devolvió una respuesta inválida.'));return;}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(result.error||'No se pudo subir el archivo.'));};
        xhr.onerror=()=>{this.xhr=null;reject(Error('La conexión se interrumpió. Puedes reintentar la subida.'));};
        xhr.onabort=()=>{this.xhr=null;reject(Error('Subida cancelada.'));};xhr.send(body);
      });
      const response=await global.fetch(url.href,{method,headers:{Authorization:'Bearer '+token},signal,cache:'no-store',redirect:'error'});
      let result;try{result=await response.json();}catch{throw Error('El servicio de audio no respondió correctamente.');}
      if(!response.ok)throw Error(result.error||'No se pudo completar la operación.');return result;
    }
    refresh({invalidateUrls=false}={}) {
      // Recovery must fetch a new ticket even if an ordinary refresh is in flight.
      if(this.pendingRefresh)return invalidateUrls
        ? this.pendingRefresh.catch(()=>{}).then(()=>this.refresh({invalidateUrls:true}))
        : this.pendingRefresh;
      const generation=this.generation;
      this.pendingRefresh=this.request('/catalog').then(result=>{
        if(this.destroyed||generation!==this.generation)return;
        const old=new Map(this.entries.map(e=>[e.id,e]));
        this.entries=(result.tracks||[]).filter(entry=>{
          try{const u=new URL(entry.url);return ID.test(entry.id)&&KINDS[entry.kind]&&u.origin===this.endpoint&&u.pathname===`/media/${this.scope}/${entry.id}`&&Number.isFinite(entry.bytes)&&entry.bytes>0&&typeof entry.label==='string';}catch{return false;}
        }).map(entry=>{
          const cached=old.get(entry.id);
          return !invalidateUrls && cached?.expiresAt>Date.now()+120000 ? {...entry,url:cached.url,expiresAt:cached.expiresAt} : entry;
        });
        this.bytes=Number(result.bytes)||0;this.render();this.onChange();
      }).finally(()=>{this.pendingRefresh=null;});
      return this.pendingRefresh;
    }
    async upload(files,kind) {
      if(!this.director||this.busy)throw Error('Sólo el DM puede subir archivos.');
      if(!KINDS[kind])throw Error('Elige un tipo de audio.');
      this.busy=true;this.render();let done=0,duplicates=0;const failures=[];
      try {
        for(const file of files){
          if(this.destroyed)break;
          if(!file.size||file.size>LIMIT){failures.push(file.name+': el máximo es 25 MB y no puede estar vacío.');continue;}
          if(!/\.(mp3|ogg|oga|wav|flac|m4a)$/i.test(file.name)){failures.push(file.name+': formato no compatible.');continue;}
          this.message('Subiendo '+file.name+'…');
          try{
            const result=await this.request('/tracks',{method:'PUT',body:file,kind,name:file.name.replace(/\.[^.]+$/,''),onProgress:value=>{if(this.progress)this.progress.value=value;}});
            if(result.duplicate)duplicates++;else done++;
          }catch(error){failures.push(file.name+': '+error.message);}
        }
        if(!this.destroyed){
          await this.refresh();
          if(done)await this.db.ref('campaña/audio_director/library_revision').set(global.firebase.database.ServerValue.TIMESTAMP);
          this.message(`${done} subidos · ${duplicates} ya estaban en la biblioteca.`+(failures.length?' '+failures.join(' '):''));
        }
      } finally {this.busy=false;if(this.progress)this.progress.value=0;this.render();}
      return {uploaded:done,duplicates,failures};
    }
    async remove(entry) {
      if(!this.director||this.busy)return;
      if(!global.confirm('¿Eliminar «'+entry.label+'» de la biblioteca compartida?'))return;
      this.busy=true;this.deleting=true;this.onBusyChange?.();this.render();
      try{await this.request('/tracks/'+entry.id,{method:'DELETE'});await this.refresh();await this.db.ref('campaña/audio_director/library_revision').set(global.firebase.database.ServerValue.TIMESTAMP);this.message('Audio eliminado.');}
      catch(error){this.message(error.message);}
      finally{this.busy=false;this.deleting=false;this.onBusyChange?.();this.render();}
    }
    mount(panel) {
      this.host=global.document.createElement('section');this.host.className='audio-cloud-library';
      this.host.setAttribute('aria-label','Mis archivos de audio');
      const node=(tag,text)=>{const n=global.document.createElement(tag);if(text)n.textContent=text;return n;};
      this.host.appendChild(node('h3','Mis archivos'));
      this.usage=node('p');this.host.appendChild(this.usage);
      const setup=node('details');setup.className='audio-library-setup';setup.appendChild(node('summary','Conectar biblioteca'));
      const label=node('label','Dirección de tu biblioteca Cloudflare');const input=node('input');input.type='url';input.placeholder='https://limbus-audio.tu-cuenta.workers.dev';input.setAttribute('aria-label','Dirección de biblioteca');label.appendChild(input);setup.appendChild(label);this.endpointInput=input;
      const save=node('button','Guardar conexión');save.type='button';save.onclick=async()=>{
        const url=serviceUrl(input.value);if(!url){this.message('Introduce la dirección HTTPS de tu Worker de Cloudflare.');return;}
        save.disabled=true;try{await this.configRef.set(url);this.message('Conexión guardada. Comprobando biblioteca…');}catch{this.message('No se pudo guardar. Revisa los permisos del DM.');}finally{save.disabled=false;}
      };setup.appendChild(save);this.host.appendChild(setup);this.setup=setup;
      const form=node('div');form.className='audio-upload-controls';
      const kindLabel=node('label','Tipo de archivo');const kind=node('select');kind.setAttribute('aria-label','Tipo de archivo');for(const [value,label]of Object.entries(KINDS)){const option=node('option',label);option.value=value;kind.appendChild(option);}kindLabel.appendChild(kind);form.appendChild(kindLabel);
      const fileLabel=node('label','Seleccionar archivos · hasta 25 MB cada uno');const files=node('input');files.type='file';files.multiple=true;files.accept='.mp3,.ogg,.oga,.wav,.flac,.m4a';files.setAttribute('aria-label','Seleccionar archivos de audio');fileLabel.appendChild(files);form.appendChild(fileLabel);
      const upload=node('button','Subir archivos');upload.type='button';upload.onclick=()=>{const selected=Array.from(files.files||[]);if(!selected.length){this.message('Selecciona al menos un archivo.');return;}this.upload(selected,kind.value).catch(error=>this.message(error.message));};form.appendChild(upload);
      const cancel=node('button','Cancelar subida actual');cancel.type='button';cancel.onclick=()=>this.xhr?.abort();form.appendChild(cancel);this.cancel=cancel;
      this.progress=node('progress');this.progress.max=1;this.progress.value=0;this.progress.setAttribute('aria-label','Progreso de subida');form.appendChild(this.progress);
      this.host.appendChild(form);this.form=form;
      const search=node('input');search.type='search';search.placeholder='Buscar en mis archivos…';search.setAttribute('aria-label','Buscar en mis archivos');search.oninput=()=>this.renderList(search.value);this.host.appendChild(search);this.search=search;
      this.list=node('div');this.list.className='audio-cloud-files';this.host.appendChild(this.list);
      this.statusNode=node('p');this.statusNode.setAttribute('role','status');this.host.appendChild(this.statusNode);
      panel.querySelector('.luminous-audio-scroll').appendChild(this.host);this.render();
    }
    renderList(query='') {
      if(!this.list)return;this.list.replaceChildren();
      const entries=this.entries.filter(e=>e.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
      for(const entry of entries){const row=global.document.createElement('div');row.className='audio-cloud-file';const name=global.document.createElement('span');name.textContent=entry.label+' · '+KINDS[entry.kind]+' · '+bytesLabel(entry.bytes);row.appendChild(name);const remove=global.document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.disabled=this.busy;remove.onclick=()=>this.remove(entry);row.appendChild(remove);this.list.appendChild(row);}
      if(!entries.length){const empty=global.document.createElement('p');empty.textContent=this.endpoint?'Aún no hay archivos que coincidan.':'Conecta tu biblioteca para subir canciones y efectos.';this.list.appendChild(empty);}
    }
    render(){
      if(!this.host)return;
      this.host.hidden=!this.director;
      if(this.endpointInput&&global.document.activeElement!==this.endpointInput)this.endpointInput.value=this.endpoint;
      this.usage.textContent=this.entries.length+' archivos · '+bytesLabel(this.bytes)+' utilizados';
      this.form.querySelectorAll('input,select,button').forEach(n=>{n.disabled=this.busy||!this.endpoint;});
      this.cancel.disabled=!this.busy;this.cancel.hidden=!this.busy;
      this.statusNode.textContent=this.status||'';this.renderList(this.search.value);
    }
    destroy(){this.destroyed=true;this.generation++;global.clearInterval(this.timer);this.xhr?.abort();this.configRef.off('value',this.configListener);this.host?.remove();}
  }
  global.LuminousAudioLibrary=Library;
})(window);
