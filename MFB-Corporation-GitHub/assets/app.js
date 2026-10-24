(function () {
'use strict';
const $ = (s, root) => (root || document).querySelector(s);
const $$ = (s, root) => Array.from((root || document).querySelectorAll(s));
const tools = window.MFB_TOOLS || [];
const config = window.MFB_CONFIG || {};
const appScript = document.currentScript || Array.from(document.scripts).find(s => /(?:^|\/)app\.js(?:\?|$)/.test(s.src));
const siteBase = new URL('../', appScript ? appScript.src : new URL('assets/app.js', location.href).href);
config.origin = siteBase.href.replace(/\/$/, '');
const canonical = new URL(location.href); canonical.search=''; canonical.hash='';
if (location.protocol === 'https:' || location.protocol === 'http:') {
 let c=document.querySelector('link[rel="canonical"]');if(!c){c=document.createElement('link');c.rel='canonical';document.head.appendChild(c);}c.href=canonical.href;
 for(const pair of [['og:url',canonical.href],['og:image',new URL('assets/social.png',siteBase).href]]) {
  let m=document.querySelector('meta[property="'+pair[0]+'"]');if(!m){m=document.createElement('meta');m.setAttribute('property',pair[0]);document.head.appendChild(m);}m.content=pair[1];
 }
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic = (name) => '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ((window.MFB_ICONS || {})[name] || '') + '</svg>';
const num = (n, max=2) => new Intl.NumberFormat('es',{maximumFractionDigits:max}).format(n);
const money = n => new Intl.NumberFormat('es',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const filename = s => String(s).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _.-]/g,'').trim().slice(0,90) || 'mfb';
const storage = {
  read(key, fallback) { try { const v=localStorage.getItem('mfb:'+key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  write(key,value) { try { localStorage.setItem('mfb:'+key,JSON.stringify(value)); return true; } catch { return false; } }
};
let toastTimeout;
function toast(message) {
 const el=$('#toast'); el.textContent=message; el.classList.add('visible');
 clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('visible'),3600);
}
function message(text, error=false) {
 const el=$('#tool-message'); if(!el) return toast(text);
 el.textContent=text; el.classList.toggle('error',error); el.hidden=!text;
}
function download(blob,name) {
 const url=URL.createObjectURL(blob); const a=document.createElement('a');
 a.href=url; a.download=filename(name); document.body.appendChild(a); a.click(); a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function downloadText(content,name,type='text/plain;charset=utf-8') { download(new Blob([content],{type}),name); }
async function copy(text) {
 if(!String(text).trim()) { toast('Primero añade o genera un contenido.'); return; }
 try {
  if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(String(text));
  else { const t=document.createElement('textarea'); t.value=String(text); t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); if(!document.execCommand('copy')) throw new Error(); t.remove(); }
  toast('Copiado. Una cosa menos.');
 } catch { toast('No se pudo copiar. Selecciona el texto y usa Ctrl+C.'); }
}
async function share(url,title) {
 try { if(navigator.share) await navigator.share({title,url}); else await copy(url); }
 catch(err) { if(err.name!=='AbortError') await copy(url); }
}
function confirmAction(title,text) {
 const d=$('#confirm-dialog'); $('#confirm-title').textContent=title; $('#confirm-text').textContent=text;
 return new Promise(resolve=>{d.returnValue='cancel';d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();});
}
const scripts = {};
function loadScript(src) {
 src=new URL(src.replace(/^\/+/,''),siteBase).href;
 if(scripts[src]) return scripts[src];
 scripts[src]=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{delete scripts[src];s.remove();reject(new Error('No se pudo cargar un componente. Comprueba la conexión y vuelve a intentarlo.'));};document.head.appendChild(s);});
 return scripts[src];
}
async function loadQR() { await loadScript('/assets/vendor/qrcode.js'); await loadScript('/assets/vendor/qrcode_UTF8.js'); }
function output(id,big,label,details=[],formula='') {
 const el=$(id); el.innerHTML='<strong class="result-number">'+esc(big)+'</strong><span class="result-caption">'+esc(label)+'</span>'+
 (details.length?'<div class="result-details">'+details.map(x=>'<div><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('')+'</div>':'')+
 (formula?'<p class="result-formula">'+esc(formula)+'</p>':'');
}
function val(id) { const s=$(id).value; if(s.trim()==='') throw new Error('Completa todos los campos para calcular.');const n=Number(s);if(!Number.isFinite(n))throw new Error('Introduce números válidos.');return n; }
function between(n,min,max,name='El valor') { if(n<min||n>max) throw new Error(name+' debe estar entre '+num(min)+' y '+num(max)+'.');return n; }
function wrap(fn) { return function(event){ if(event)event.preventDefault();try{fn();message('');}catch(err){const result=$('.tool-workspace .result-display');if(result)result.innerHTML='<span class="result-symbol">'+ic('info')+'</span><p>Revisa los datos para calcular de nuevo.</p>';message(err.message||'No se pudo calcular. Revisa los datos.',true);} }; }

const favRaw=storage.read('favorites',[]);
let favorites=new Set(Array.isArray(favRaw)?favRaw.filter(id=>tools.some(t=>t.id===id)):[]);
function updateFavorites() {
 $$('.saved-count').forEach(el=>el.textContent=favorites.size);
 $$('[data-favorite]').forEach(b=>{
  const id=b.dataset.favorite,t=tools.find(t=>t.id===id),on=favorites.has(id);
  b.setAttribute('aria-pressed',String(on)); b.setAttribute('aria-label',(on?'Quitar de guardados: ':'Guardar: ')+(t?t.name:id));
  const label=$('span',b); if(label) label.textContent=on?'Guardada':'Guardar';
 });
}
let refreshDirectory=()=>{};
document.addEventListener('click',async event=>{
 const fav=event.target.closest('[data-favorite]');
 if(fav) {
  const id=fav.dataset.favorite;
  if(favorites.has(id)) {favorites.delete(id);toast('Quitada de tus guardados.');} else {favorites.add(id);toast('Herramienta guardada para la próxima.');}
  if(!storage.write('favorites',Array.from(favorites))) toast('No pudimos guardar en este navegador. El cambio durará solo esta visita.');
  updateFavorites();refreshDirectory();return;
 }
 const action=event.target.closest('[data-action]');
 if(action) {const site=action.dataset.action==='share-site';await share(site?siteBase.href:location.origin+location.pathname,site?'MFB Corporation — Herramientas gratuitas':document.title);}
 const c=event.target.closest('[data-copy]');
 if(c) {const el=document.getElementById(c.dataset.copy);if(el)await copy(el.value||el.textContent);}
 const dl=event.target.closest('[data-download-text]');
 if(dl) {const el=document.getElementById(dl.dataset.downloadText),text=el?(el.value||el.textContent):'';if(!text.trim())return toast('Todavía no hay contenido para descargar.');downloadText(text,'mfb-texto.'+(dl.dataset.extension||'txt'));}
});
updateFavorites();
const menu=$('.mobile-menu-btn');
if(menu)menu.addEventListener('click',()=>{const on=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(on));menu.setAttribute('aria-label',on?'Cerrar menú':'Abrir menú');$('#mobile-nav').hidden=!on;menu.innerHTML=ic(on?'close':'menu');});
document.addEventListener('keydown',event=>{
 if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){
  const input=$('#hero-search')||$('#tool-search');if(input){event.preventDefault();input.focus();}
 }
 if(event.key==='Escape'&&menu){menu.setAttribute('aria-expanded','false');$('#mobile-nav').hidden=true;menu.innerHTML=ic('menu');}
});
if($('#tools-grid')) {
 const params=new URLSearchParams(location.search);
 let category='Todas',onlySaved=params.get('guardados')==='1',query=params.get('q')||'';
 const input=$('#tool-search');input.value=query;
 if(onlySaved){const title=$('.directory .section-heading h1, .directory .section-heading h2');if(title)title.textContent='Tus herramientas guardadas.';}
 const cards=$$('.tool-card',$('#tools-grid'));
 refreshDirectory=function(){
  query=input.value;
  const tokens=normalize(query.trim()).split(/\s+/).filter(Boolean);
  let count=0;const sort=$('#tool-sort').value;
  const ordered=cards.slice().sort((a,b)=>sort==='az'?tools.find(t=>t.id===a.dataset.tool).name.localeCompare(tools.find(t=>t.id===b.dataset.tool).name,'es'):tools.findIndex(t=>t.id===a.dataset.tool)-tools.findIndex(t=>t.id===b.dataset.tool));
  ordered.forEach(card=>{
   const t=tools.find(t=>t.id===card.dataset.tool);
   const haystack=normalize([t.name,t.desc,t.cat,t.keys].join(' '));
   const visible=(category==='Todas'||t.cat===category)&&(!onlySaved||favorites.has(t.id))&&tokens.every(q=>haystack.includes(q));
   card.hidden=!visible;if(visible)count++;$('#tools-grid').appendChild(card);
  });
  $('#result-count').textContent=count+' herramienta'+(count===1?'':'s')+(onlySaved?' guardada'+(count===1?'':'s'):'');
  $('#empty-state').hidden=count>0;$('#tools-grid').hidden=count===0;
  if(!count&&onlySaved&&!query){$('#empty-state h3').textContent='Tu caja de favoritas empieza aquí';$('#empty-state p').textContent='Pulsa la estrella de una herramienta para tenerla a mano en este dispositivo.';}
  else {$('#empty-state h3').textContent='No encontramos esa herramienta';$('#empty-state p').textContent='Prueba otra palabra o vuelve a ver todas las herramientas.';}
 };
 input.addEventListener('input',refreshDirectory);$('#tool-sort').addEventListener('change',refreshDirectory);
 $$('[data-category-filter]').forEach(b=>b.addEventListener('click',()=>{
  category=b.dataset.categoryFilter;
  $$('[data-category-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  refreshDirectory();
 }));
 $('#clear-filters').addEventListener('click',()=>{category='Todas';onlySaved=false;input.value='';$$('[data-category-filter]').forEach(x=>{const on=x.dataset.categoryFilter==='Todas';x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});if(location.search)history.replaceState(null,'',location.pathname);const title=$('.directory .section-heading h1, .directory .section-heading h2');if(title)title.textContent='Lo que necesitas, cuando lo necesitas.';refreshDirectory();});
 refreshDirectory();
 if(params.has('q')) setTimeout(()=>input.focus(),100);
}
if($('#hero-qr')) loadQR().then(()=>{const qr=window.qrcode(0,'M');qr.addData(config.origin||location.origin);qr.make();$('#hero-qr').innerHTML=qr.createSvgTag({cellSize:3,margin:12,scalable:true});}).catch(()=>{$('#hero-qr').innerHTML=ic('qr');});
const toolId=document.body.dataset.toolId;
if(toolId) {
 const inits={
  'comprimir-imagen':initImage,'redimensionar-imagen':initImage,'convertir-imagen':initImage,'imagenes-a-pdf':initPDF,
  'generador-qr':initQR,'contador-palabras':initCount,'limpiar-texto':initTransform,'formatear-json':initJSON,
  'pomodoro':initTimer,'lista-tareas':initTasks,'notas':initNotes,'porcentajes':initPercent,'calculadora-descuentos':initDiscount,
  'dividir-gastos':initSplit,'conversor-unidades':initUnits,'calculadora-notas':initGrades,'dias-entre-fechas':initDates,'generador-contrasenas':initPassword
 };
 try { if(inits[toolId]) inits[toolId](); } catch(err) {message('No se pudo iniciar la herramienta. Recarga la página para volver a intentarlo.',true);}
}
function bindDrop(zone,input,handler) {
 ['dragenter','dragover'].forEach(n=>zone.addEventListener(n,e=>{e.preventDefault();zone.classList.add('dragover');}));
 ['dragleave','drop'].forEach(n=>zone.addEventListener(n,e=>{e.preventDefault();zone.classList.remove('dragover');}));
 zone.addEventListener('drop',e=>handler(Array.from(e.dataTransfer.files)));
 input.addEventListener('change',()=>handler(Array.from(input.files)));
}
const validImageTypes=['image/jpeg','image/png','image/webp'];
async function readImage(file,maxMB=25) {
 if(!validImageTypes.includes(file.type))throw new Error('Elige una imagen JPG, PNG o WebP. No se admiten archivos HEIC, SVG o GIF.');
 if(file.size>maxMB*1024*1024)throw new Error('La imagen supera el límite de '+maxMB+' MB.');
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('No se pudo leer esa imagen. El archivo podría estar dañado.'));i.src=url;});
  if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('La imagen tiene demasiados píxeles. Usa una de hasta 40 megapíxeles.');
  return img;
 }finally{URL.revokeObjectURL(url);}
}
function blobFromCanvas(canvas,type,quality) {return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('El navegador no pudo crear el archivo. Prueba con una imagen más pequeña.')),type,quality));}
function fileSize(bytes) {return bytes>=1024*1024?num(bytes/1024/1024,2)+' MB':num(bytes/1024,1)+' KB';}
function initImage(){
 let image=null,file=null,blob=null,previewUrl=null,sequence=0;
 const upload=$('#image-file'),downloadButton=$('#download-image'),processButton=$('#process-image');
 async function pick(files) {
  const f=files[0];if(!f)return;sequence++;blob=null;downloadButton.disabled=true;
  $('#image-summary').textContent='';$('#image-result').innerHTML='<div class="result-display"><span class="result-symbol">'+ic('image-down')+'</span><p>Leyendo tu imagen…</p></div>';
  try{
   image=await readImage(f);file=f;message('');
   $('#selected-file').hidden=false;$('#selected-file').innerHTML=ic('check')+esc(f.name)+' · '+fileSize(f.size)+' · '+num(image.naturalWidth)+' × '+num(image.naturalHeight)+' px';
   $('#image-controls').hidden=false;
   if(toolId==='redimensionar-imagen'){$('#image-width').value=image.naturalWidth;$('#image-height').value=image.naturalHeight;}
   if(toolId==='convertir-imagen')$('#format').value=f.type==='image/jpeg'?'image/png':'image/jpeg';
   await process();
  }catch(err){image=null;blob=null;$('#image-controls').hidden=true;message(err.message,true);}
 }
 async function process(){
  if(!image)return;
  const token=++sequence;blob=null;downloadButton.disabled=true;processButton.disabled=true;processButton.textContent='Procesando…';
  try{
   let w=image.naturalWidth,h=image.naturalHeight;
   if(toolId==='redimensionar-imagen'){w=Math.round(between(val('#image-width'),1,6000,'El ancho'));h=Math.round(between(val('#image-height'),1,6000,'El alto'));}
   else if(toolId==='comprimir-imagen'){const max=Number($('#max-width').value);if(max>0&&w>max){h=Math.max(1,Math.round(h*max/w));w=max;}}
   if(w*h>36000000)throw new Error('El resultado supera 36 megapíxeles. Reduce el ancho o el alto.');
   const type=$('#format').value,quality=Number($('#quality').value)/100;
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Tu navegador no admite el procesamiento de imágenes.');
   if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,w,h);
   const next=await blobFromCanvas(canvas,type,quality);
   if(token!==sequence)return;
   if(next.type!==type)throw new Error('Este navegador no puede exportar ese formato. Elige JPG o PNG.');
   blob=next;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);
   const result=$('#image-result');result.textContent='';const img=document.createElement('img');img.src=previewUrl;img.alt='Vista previa de la imagen procesada';result.appendChild(img);
   const saved=(1-blob.size/file.size)*100;
   $('#image-summary').innerHTML='<b>'+fileSize(file.size)+' → '+fileSize(blob.size)+'</b><br>'+num(w)+' × '+num(h)+' px · '+(saved>=0?num(saved,1)+' % menos peso':num(-saved,1)+' % más peso; prueba con menor calidad o tamaño');
   downloadButton.disabled=false;message(saved<0?'El resultado pesa más que el original. Puedes reducir la calidad o las dimensiones antes de descargar.':'');
  }catch(err){if(token===sequence)message(err.message,true);}
  finally{if(token===sequence){processButton.disabled=false;processButton.innerHTML=ic('sparkles')+'Procesar imagen';}}
 }
 bindDrop($('#image-drop'),upload,pick);
 processButton.addEventListener('click',process);
 $('#quality').addEventListener('input',()=>{$('#quality-value').textContent=$('#quality').value+' %';blob=null;downloadButton.disabled=true;});
 const invalidate=()=>{blob=null;downloadButton.disabled=true;message('Has cambiado los ajustes. Pulsa «Procesar imagen» para actualizar la vista previa.');};
 $('#format').addEventListener('change',()=>{$('#quality').disabled=$('#format').value==='image/png';invalidate();});
 $('#quality').addEventListener('change',invalidate);
 if($('#max-width'))$('#max-width').addEventListener('change',invalidate);
 if($('#image-width')){
  const ratio=()=>image?image.naturalWidth/image.naturalHeight:1;
  $('#image-width').addEventListener('input',()=>{$('#image-height').value=Math.max(1,Math.round(Number($('#image-width').value)/ratio()));invalidate();});
  $('#image-height').addEventListener('input',()=>{$('#image-width').value=Math.max(1,Math.round(Number($('#image-height').value)*ratio()));invalidate();});
  $('#image-preset').addEventListener('change',()=>{if($('#image-preset').value){$('#image-width').value=$('#image-preset').value;$('#image-height').value=Math.max(1,Math.round(Number($('#image-width').value)/ratio()));invalidate();}});
 }
 downloadButton.addEventListener('click',()=>{if(!blob||!file)return;const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[blob.type]||'png';download(blob,filename(file.name.replace(/\.[^.]*$/,''))+'-mfb.'+ext);toast('Tu imagen está lista.');});
}
function initPDF() {
 let entries=[],busy=false,pdfUrl=null;
 const list=$('#pdf-file-list'),button=$('#create-pdf');
 function invalidatePDF(){if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=null;$('#download-pdf').hidden=true;$('#download-pdf').removeAttribute('href');}
 function render(){
  list.innerHTML=entries.map((x,i)=>'<div class="pdf-file"><img src="'+esc(x.url)+'" alt="Miniatura de la página '+(i+1)+'"><span>'+esc(x.file.name)+'<small>Página '+(i+1)+' · '+fileSize(x.file.size)+'</small></span><button class="icon-button" data-pdf-up="'+i+'" aria-label="Subir página '+(i+1)+'" '+(i===0?'disabled':'')+'>↑</button><button class="icon-button" data-pdf-down="'+i+'" aria-label="Bajar página '+(i+1)+'" '+(i===entries.length-1?'disabled':'')+'>↓</button><button class="icon-button" data-pdf-remove="'+i+'" aria-label="Eliminar página '+(i+1)+'">'+ic('trash')+'</button></div>').join('');
  button.disabled=!entries.length||busy;
  if(entries.length)output('#pdf-result',String(entries.length),'página'+(entries.length===1?'':'s')+' en tu PDF', [['Tamaño de página','A4 vertical'],['Orden','El de la lista']]);
  else $('#pdf-result').innerHTML='<span class="result-symbol">'+ic('file')+'</span><p>Añade imágenes para crear tu documento.</p>';
 }
 async function pick(files){
  if(busy)return;invalidatePDF();
  const next=entries.slice();let error='';
  for(const file of files){
   if(next.length>=12){error='El límite es de 12 imágenes por documento.';break;}
   if(next.reduce((s,x)=>s+x.file.size,0)+file.size>40*1024*1024){error='El conjunto de imágenes supera 40 MB.';break;}
   try{await readImage(file,25);next.push({file,url:URL.createObjectURL(file)});}catch(err){error=err.message;break;}
  }
  entries=next;render();message(error,!!error);$('#pdf-files').value='';
 }
 bindDrop($('#pdf-drop'),$('#pdf-files'),pick);
 list.addEventListener('click',event=>{
  if(busy)return;const b=event.target.closest('button');if(!b)return;invalidatePDF();
  if(b.dataset.pdfRemove!==undefined){const i=Number(b.dataset.pdfRemove);URL.revokeObjectURL(entries[i].url);entries.splice(i,1);}
  else if(b.dataset.pdfUp!==undefined){const i=Number(b.dataset.pdfUp);if(i>0)[entries[i-1],entries[i]]=[entries[i],entries[i-1]];}
  else if(b.dataset.pdfDown!==undefined){const i=Number(b.dataset.pdfDown);if(i<entries.length-1)[entries[i+1],entries[i]]=[entries[i],entries[i+1]];}
  render();
 });
 button.addEventListener('click',async()=>{
  if(!entries.length||busy)return;busy=true;render();button.textContent='Preparando tu PDF…';message('');
  try{
   await loadScript('/assets/vendor/pdf-lib.min.js');
   const doc=await window.PDFLib.PDFDocument.create();doc.setTitle('Documento creado con MFB Corporation');doc.setCreator('MFB Corporation');doc.setProducer('MFB Corporation · PDF local');
   for(let i=0;i<entries.length;i++){
    button.textContent='Página '+(i+1)+' de '+entries.length+'…';
    const img=await readImage(entries[i].file),scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const b=await blobFromCanvas(canvas,'image/jpeg',.9),embedded=await doc.embedJpg(await b.arrayBuffer());
    const page=doc.addPage([595.28,841.89]),fit=Math.min(547.28/embedded.width,793.89/embedded.height);
    const w=embedded.width*fit,h=embedded.height*fit;page.drawImage(embedded,{x:(595.28-w)/2,y:(841.89-h)/2,width:w,height:h});
    canvas.width=1;canvas.height=1;
   }
   const bytes=await doc.save();if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('#download-pdf').href=pdfUrl;$('#download-pdf').hidden=false;message('Documento creado: '+entries.length+' página'+(entries.length===1?'':'s')+' · '+fileSize(bytes.length)+'. Pulsa «Descargar PDF» para guardarlo.');toast('Tu PDF está listo para descargar.');
  }catch(err){message(err.message||'No se pudo generar el PDF. Prueba con menos imágenes.',true);}
  finally{busy=false;button.innerHTML=ic('file')+'Crear PDF';render();}
 });
 render();
}
function initQR(){
 if(!$('#qr-text').value.trim())$('#qr-text').value=location.protocol==='file:'?'https://example.com':siteBase.href;
 let svg='',generation=0;
 const generate=async()=>{
  const seq=++generation;
  try{
   const text=$('#qr-text').value.trim();if(!text)throw new Error('Escribe un enlace o un texto para generar el código.');
   if(new TextEncoder().encode(text).length>1600)throw new Error('El texto es demasiado largo. Usa hasta 1.600 bytes, especialmente si contiene emojis.');
   await loadQR();if(seq!==generation)return;
   const qr=window.qrcode(0,'M');qr.addData(text);qr.make();
   svg=qr.createSvgTag({cellSize:8,margin:32,scalable:true});
   $('#qr-preview').innerHTML=svg;$('#qr-png').disabled=false;$('#qr-svg').disabled=false;message('');
  }catch(err){svg='';$('#qr-preview').textContent='Añade un contenido válido.';$('#qr-png').disabled=true;$('#qr-svg').disabled=true;message(err.message||'No se pudo crear el QR. Usa un texto más corto.',true);}
 };
 $('#generate-qr').addEventListener('click',generate);
 $('#qr-text').addEventListener('input',()=>{svg='';$('#qr-png').disabled=true;$('#qr-svg').disabled=true;$('#qr-preview').textContent='Pulsa «Generar código QR» para actualizarlo.';});
 $('#qr-svg').addEventListener('click',()=>{if(svg)downloadText(svg,'codigo-qr-mfb.svg','image/svg+xml;charset=utf-8');});
 $('#qr-png').addEventListener('click',async()=>{
  if(!svg)return;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{
   const size=Number($('#qr-size').value),canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
   const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);
   download(await blobFromCanvas(canvas,'image/png',1),'codigo-qr-mfb.png');toast('QR descargado. Recuerda probarlo.');
  }catch{message('No se pudo descargar el PNG. Prueba la descarga SVG.',true);}
  finally{URL.revokeObjectURL(url);}
 });
 generate();
}
function initCount(){
 const text=$('#text-input');
 function count(){
  const s=text.value,chars=Array.from(s).length;
  let words=0;
  if(s.trim()) {if(Intl.Segmenter){const segmenter=new Intl.Segmenter('es',{granularity:'word'});for(const item of segmenter.segment(s))if(item.isWordLike)words++;}else words=s.trim().split(/\s+/u).length;}
  const paragraphs=s.trim()?s.trim().split(/\n\s*\n|\n/u).filter(x=>x.trim()).length:0;
  $('#stat-words').textContent=num(words);$('#stat-chars').textContent=num(chars);$('#stat-paragraphs').textContent=num(paragraphs);$('#stat-reading').textContent=words===0?'0 min':words<200?'< 1 min':num(Math.ceil(words/200))+' min';
  $('#text-extra').textContent=num(Array.from(s.replace(/\s/gu,'')).length)+' caracteres sin espacios';
 }
 let t;text.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(count,90);});count();
}
function initTransform(){
 $$('[data-transform]').forEach(button=>button.addEventListener('click',()=>{
  const s=$('#text-input').value;if(!s.trim())return message('Pega un texto antes de transformarlo.',true);
  let result=s;
  switch(button.dataset.transform){
   case 'spaces':result=s.split('\n').map(l=>l.replace(/[ \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();break;
   case 'upper':result=s.toLocaleUpperCase('es');break;
   case 'lower':result=s.toLocaleLowerCase('es');break;
   case 'sentence':result=s.toLocaleLowerCase('es').replace(/(^|[.!?]\s+)([a-záéíóúüñ¿¡]*)([a-záéíóúüñ])/giu,(m,p,a,b)=>p+(a+b).replace(/[a-záéíóúüñ]/iu,c=>c.toLocaleUpperCase('es')));break;
   case 'unique':result=Array.from(new Set(s.split(/\r?\n/).map(l=>l.trim()))).join('\n');break;
   case 'sort':result=s.split(/\r?\n/).sort((a,b)=>a.localeCompare(b,'es')).join('\n');break;
  }
  $('#text-output').value=result;message('Texto transformado. Revisa el resultado antes de usarlo.');
 }));
}
function initJSON(){
 function process(compact){
  try{
   const text=$('#json-input').value;if(!text.trim())throw new Error('Pega un documento JSON para empezar.');
   const parsed=JSON.parse(text);$('#json-output').value=JSON.stringify(parsed,null,compact?0:2);message('JSON válido. '+(compact?'Resultado compactado.':'Sangría de 2 espacios.'));
  }catch(err){$('#json-output').value='';message('Revisa el JSON: '+err.message,true);}
 }
 $('#format-json').addEventListener('click',()=>process(false));$('#compact-json').addEventListener('click',()=>process(true));
}
function initNotes(){
 const saved=storage.read('note',{title:'Mi nota',body:''});
 const raw=saved&&typeof saved==='object'?saved:{title:'Mi nota',body:''};
 $('#note-title').value=typeof raw.title==='string'?raw.title.slice(0,100):'Mi nota';$('#note-body').value=typeof raw.body==='string'?raw.body.slice(0,250000):'';
 let debounce;
 function save(){
  const success=storage.write('note',{title:$('#note-title').value,body:$('#note-body').value});
  $('#note-status').innerHTML=ic(success?'check':'info')+(success?'Guardado en este dispositivo':'No se pudo guardar. Descarga una copia.');
 }
 function count(){$('#note-count').textContent=num(Array.from($('#note-body').value).length)+' caracteres';}
 ['#note-title','#note-body'].forEach(id=>$(id).addEventListener('input',()=>{count();$('#note-status').textContent='Guardando…';clearTimeout(debounce);debounce=setTimeout(save,350);}));
 window.addEventListener('pagehide',save);
 $('#download-note').addEventListener('click',()=>{if(!$('#note-body').value.trim())return toast('Escribe algo antes de descargar tu nota.');downloadText($('#note-title').value+'\n\n'+$('#note-body').value,filename($('#note-title').value)+'.txt');});
 $('#clear-note').addEventListener('click',async()=>{if(await confirmAction('¿Borrar esta nota?','Se eliminará del navegador. Descarga una copia si quieres conservarla.')){$('#note-title').value='Mi nota';$('#note-body').value='';clearTimeout(debounce);save();count();toast('Nota borrada.');}});
 count();
}
function initTasks(){
 const raw=storage.read('tasks',[]);
 let tasks=Array.isArray(raw)?raw.filter(x=>x&&typeof x.text==='string'&&typeof x.id==='string').slice(0,500).map(x=>({id:x.id.slice(0,80),text:x.text.slice(0,180),done:!!x.done})):[];
 let filter='all';
 function save(){if(!storage.write('tasks',tasks))toast('No se pudo guardar. Exporta tu lista para conservarla.');}
 function render(){
  const shown=tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
  $('#task-list').innerHTML=shown.length?shown.map(t=>'<div class="task-item'+(t.done?' done':'')+'"><input type="checkbox" id="task-'+esc(t.id)+'" data-task-check="'+esc(t.id)+'" '+(t.done?'checked':'')+' aria-label="Completar: '+esc(t.text)+'"><label for="task-'+esc(t.id)+'">'+esc(t.text)+'</label><button class="icon-button" data-task-delete="'+esc(t.id)+'" aria-label="Eliminar: '+esc(t.text)+'">'+ic('trash')+'</button></div>').join(''):'<div class="task-empty">'+ic('tasks')+(filter==='done'?'Todavía no hay tareas completadas.':filter==='pending'?'Todo resuelto por aquí.':'Tu lista empieza con una pequeña tarea.')+'</div>';
  const remaining=tasks.filter(t=>!t.done).length;$('#task-counter').textContent=remaining+' pendiente'+(remaining===1?'':'s');$('#clear-done').disabled=!tasks.some(t=>t.done);
 }
 $('#task-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#task-input').value.trim();if(!text)return;if(tasks.length>=500)return toast('Has llegado a 500 tareas. Exporta y limpia tu lista.');tasks.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2),text,done:false});$('#task-input').value='';save();render();$('#task-input').focus();});
 $('#task-list').addEventListener('change',e=>{const id=e.target.dataset.taskCheck;if(!id)return;const t=tasks.find(t=>t.id===id);if(t)t.done=e.target.checked;save();render();});
 $('#task-list').addEventListener('click',e=>{const b=e.target.closest('[data-task-delete]');if(!b)return;tasks=tasks.filter(t=>t.id!==b.dataset.taskDelete);save();render();});
 $$('[data-task-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.taskFilter;$$('[data-task-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render();}));
 $('#clear-done').addEventListener('click',()=>{tasks=tasks.filter(t=>!t.done);save();render();toast('Tareas completadas eliminadas.');});
 $('#export-tasks').addEventListener('click',()=>{if(!tasks.length)return toast('Añade una tarea antes de exportar.');downloadText('Mis tareas · MFB Corporation\n\n'+tasks.map(t=>(t.done?'[x] ':'[ ] ')+t.text).join('\n'),'mis-tareas-mfb.txt');});
 render();
}
function initPercent(){
 function labels(){
  const mode=$('#percent-mode').value;
  $('span',$('#percent-a').closest('label')).textContent=mode==='of'?'Porcentaje (%)':mode==='ratio'?'Parte':'Valor inicial';
  $('span',$('#percent-b').closest('label')).textContent=mode==='of'?'Cantidad':mode==='ratio'?'Total':'Valor final';
 }
 const calculate=wrap(()=>{
  const a=val('#percent-a'),b=val('#percent-b'),mode=$('#percent-mode').value;
  if(Math.abs(a)>1e15||Math.abs(b)>1e15)throw new Error('Usa valores cuya magnitud sea de hasta un cuatrillón.');
  let value,label,formula;
  if(mode==='of'){value=a*b/100;label=num(a)+' % de '+num(b);formula=num(a)+' × '+num(b)+' ÷ 100';}
  else if(mode==='ratio'){if(b===0)throw new Error('El total no puede ser cero.');value=a/b*100;label='del total';formula=num(a)+' ÷ '+num(b)+' × 100';}
  else{if(a===0)throw new Error('No se puede calcular un cambio porcentual desde cero.');value=(b-a)/Math.abs(a)*100;label=value>0?'de aumento':value<0?'de disminución':'sin cambio';formula='('+num(b)+' − '+num(a)+') ÷ |'+num(a)+'| × 100';}
  output('#percent-result',num(value,6)+(mode==='of'?'':' %'),label,[],formula);
 });
 $('#percent-mode').addEventListener('change',()=>{labels();calculate();});$('#percent-form').addEventListener('submit',calculate);labels();calculate();
}
function initDiscount(){
 const calculate=wrap(()=>{
  const price=between(val('#discount-price'),0,1e9,'El precio'),rate=between(val('#discount-rate'),0,100,'El descuento'),tax=between(val('#tax-rate'),0,100,'El impuesto');
  const saving=price*rate/100,base=price-saving,added=base*tax/100,total=base+added;
  output('#discount-result',money(total),'precio final · en tu misma moneda',[['Precio original',money(price)],['Ahorras ('+num(rate)+' %)',money(saving)],['Base con descuento',money(base)],['Impuesto ('+num(tax)+' %)',money(added)]],'Se aplica primero el descuento y después el impuesto.');
 });
 $('#discount-form').addEventListener('submit',calculate);calculate();
}
function initSplit(){
 const calculate=wrap(()=>{
  const amount=between(val('#split-total'),0,1e9,'El total'),people=between(val('#split-people'),1,10000,'El número de personas'),tip=between(val('#split-tip'),0,100,'La propina');
  if(!Number.isInteger(people))throw new Error('El número de personas debe ser entero.');
  const cents=Math.round((amount+Number.EPSILON)*100),total=Math.round(cents*(1+tip/100)),base=Math.floor(total/people),extra=total%people;
  const details=[['Cuenta original',money(cents/100)],['Propina',money((total-cents)/100)],['Total a repartir',money(total/100)]];
  if(extra){details.push([extra+' persona'+(extra===1?'':'s'),money((base+1)/100)+' cada una']);details.push([(people-extra)+' persona'+(people-extra===1?'':'s'),money(base/100)+' cada una']);}
  else details.push([people+' persona'+(people===1?'':'s'),money(base/100)+' cada una']);
  output('#split-result',money(total/people/100),'por persona aprox.',details,extra?'El reparto ajusta los centavos para que la suma coincida.':'El total se divide exactamente.');
 });
 $('#split-form').addEventListener('submit',calculate);calculate();
}
function initUnits(){
 const data={
  length:[['m','Metros',1],['cm','Centímetros',.01],['mm','Milímetros',.001],['km','Kilómetros',1000],['in','Pulgadas',.0254],['ft','Pies',.3048],['yd','Yardas',.9144],['mi','Millas',1609.344]],
  mass:[['kg','Kilogramos',1],['g','Gramos',.001],['mg','Miligramos',.000001],['lb','Libras',.45359237],['oz','Onzas (avoirdupois)',.028349523125],['t','Toneladas métricas',1000]],
  temperature:[['c','Celsius (°C)',1],['f','Fahrenheit (°F)',1],['k','Kelvin (K)',1]],
  area:[['m2','Metros cuadrados',1],['cm2','Centímetros cuadrados',.0001],['km2','Kilómetros cuadrados',1000000],['ha','Hectáreas',10000],['ft2','Pies cuadrados',.09290304],['acre','Acres',4046.8564224]],
  volume:[['l','Litros',1],['ml','Mililitros',.001],['m3','Metros cúbicos',1000],['gal','Galones líquidos (EE. UU.)',3.785411784]]
 };
 function populate(){const options=data[$('#unit-type').value].map(u=>'<option value="'+u[0]+'">'+u[1]+'</option>').join('');$('#unit-from').innerHTML=options;$('#unit-to').innerHTML=options;$('#unit-to').selectedIndex=1;calculate();}
 const calculate=wrap(()=>{
  const type=$('#unit-type').value,a=$('#unit-from').value,b=$('#unit-to').value,value=val('#unit-value');
  if(Math.abs(value)>1e15)throw new Error('Usa un valor de magnitud menor o igual a 10¹⁵.');
  const from=data[type].find(u=>u[0]===a),to=data[type].find(u=>u[0]===b);
  let result;
  if(type==='temperature'){const c=a==='c'?value:a==='f'?(value-32)*5/9:value-273.15;if(c< -273.15000001)throw new Error('La temperatura no puede estar por debajo del cero absoluto.');result=b==='c'?c:b==='f'?c*9/5+32:c+273.15;}
  else result=value*from[2]/to[2];
  const formatted=new Intl.NumberFormat('es',{maximumSignificantDigits:8}).format(Math.abs(result)<1e-12?0:result);
  output('#unit-result',formatted,to[1],[[num(value,8)+' '+from[1],formatted+' '+to[1]]],'El resultado se muestra con hasta 8 cifras significativas.');
 });
 $('#unit-type').addEventListener('change',populate);
 ['#unit-value','#unit-from','#unit-to'].forEach(id=>$(id).addEventListener(id==='#unit-value'?'input':'change',calculate));
 $('#swap-units').addEventListener('click',()=>{const from=$('#unit-from').value;$('#unit-from').value=$('#unit-to').value;$('#unit-to').value=from;calculate();});populate();
}
function initGrades(){
 const calculate=wrap(()=>{
  const scale=between(val('#grade-scale'),1,1000,'El máximo de escala'),current=between(val('#grade-current'),0,scale,'La nota acumulada'),weight=between(val('#grade-weight'),0,99.99,'El peso acumulado'),exam=between(val('#grade-exam'),0,scale,'La nota del examen'),target=between(val('#grade-target'),0,scale,'La meta');
  const w=weight/100,final=current*w+exam*(1-w),needed=(target-current*w)/(1-w);
  const details=[['Acumulado ('+num(weight)+' %)',money(current*w)],['Examen ('+num(100-weight)+' %)',money(exam*(1-w))],['Tu meta',num(target)+' / '+num(scale)]];
  details.push(['Necesitas en el examen',needed<=0?'La meta se alcanza con 0':needed>scale?'Más de '+num(scale)+' · fuera de la escala':num(needed,4)+' / '+num(scale)]);
  output('#grades-result',money(final),'nota final sobre '+num(scale),details,needed>scale?'La meta no se puede alcanzar con el peso y el máximo indicados.':needed>0?'La nota necesaria se muestra con 4 decimales. Comprueba el redondeo de tu institución.':'Confirma las reglas de evaluación de tu institución.');
 });
 $('#grades-form').addEventListener('submit',calculate);calculate();
}
function initDates(){
 const today=new Date(),end=new Date();end.setDate(end.getDate()+7);
 const dateString=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 $('#date-start').value=dateString(today);$('#date-end').value=dateString(end);
 const calculate=wrap(()=>{
  const a=$('#date-start').value,b=$('#date-end').value;if(!a||!b)throw new Error('Selecciona las dos fechas.');
  const start=Date.parse(a+'T00:00:00Z'),finish=Date.parse(b+'T00:00:00Z');
  if(!Number.isFinite(start)||!Number.isFinite(finish))throw new Error('Selecciona fechas válidas.');
  if(finish<start)throw new Error('La fecha final debe ser igual o posterior a la inicial.');
  const days=Math.round((finish-start)/86400000)+($('#date-inclusive').checked?1:0),weeks=Math.floor(days/7),remaining=days%7;
  output('#dates-result',num(days),'día'+(days===1?'':'s')+' de calendario',[['Equivalente',weeks+' semanas y '+remaining+' días'],['Recuento',$('#date-inclusive').checked?'Incluye ambos extremos':'Diferencia entre fechas']],'Incluye fines de semana y festivos. No calcula plazos legales.');
 });
 $('#dates-form').addEventListener('submit',calculate);$('#date-inclusive').addEventListener('change',calculate);calculate();
}
function initPassword(){
 const pools={lower:'abcdefghijklmnopqrstuvwxyz',upper:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',numbers:'0123456789',symbols:'!@#$%&*+-_=?:.,;()[]{}'};
 function randomInt(max){
  const buffer=new Uint32Array(1),limit=4294967296-(4294967296%max);let n;
  do{crypto.getRandomValues(buffer);n=buffer[0];}while(n>=limit);return n%max;
 }
 function generate(){
  const options=$$('.password-option:checked').map(x=>pools[x.value]);
  if(!options.length){$('#password-output').textContent='';$('#copy-password').disabled=true;return message('Selecciona al menos un grupo de caracteres.',true);}
  try{
   const length=Number($('#password-length').value),pool=options.join(''),chars=options.map(p=>p[randomInt(p.length)]);
   while(chars.length<length)chars.push(pool[randomInt(pool.length)]);
   for(let i=chars.length-1;i>0;i--){const j=randomInt(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
   $('#password-output').textContent=chars.join('');$('#password-info').textContent=length+' caracteres · '+options.length+' grupos de caracteres · aleatoriedad criptográfica';
   $('#copy-password').disabled=false;message('');
  }catch{message('Tu navegador no permite generar claves criptográficas. Usa un navegador moderno en una conexión segura.',true);$('#copy-password').disabled=true;}
 }
 $('#password-length').addEventListener('input',()=>{$('#password-length-label').textContent=$('#password-length').value+' caracteres';generate();});
 $$('.password-option').forEach(x=>x.addEventListener('change',generate));$('#generate-password').addEventListener('click',generate);
 $('#copy-password').addEventListener('click',()=>copy($('#password-output').textContent));generate();
}
function initTimer(){
 let mode='focus',running=false,remaining=25*60,total=remaining,deadline=0,interval=null,completed=0,audio=null,finished=false;
 const fields={focus:$('#focus-min'),short:$('#short-min'),long:$('#long-min')},captions={focus:'TU MOMENTO DE FOCO',short:'UNA PAUSA MERECIDA',long:'TIEMPO PARA RECARGAR'};
 function duration(){const max=mode==='focus'?180:mode==='short'?60:90;return Math.round(between(Number(fields[mode].value),1,max,'La duración'))*60;}
 function render(){
  $('#timer-display').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  $('#timer-caption').textContent=captions[mode];$('#timer-progress').style.strokeDashoffset=String(678.584*(1-remaining/total));
  $('#timer-toggle').innerHTML=ic(running?'pause':'play')+(running?'Pausar':finished?'Empezar otra vez':remaining<total?'Continuar':'Iniciar');
  Object.values(fields).forEach(f=>f.disabled=running);
  $$('[data-mode]').forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 }
 function pause(){running=false;clearInterval(interval);interval=null;}
 function reset(){pause();finished=false;try{remaining=total=duration();message('');}catch(err){remaining=total=25*60;message(err.message,true);}$('#timer-state').textContent=mode==='focus'?'¿Qué vas a resolver hoy?':'Baja el ritmo por un momento.';document.title='Temporizador Pomodoro online gratis | MFB Corporation';render();}
 function beep(){
  if(!$('#timer-sound').checked||!audio)return;
  try{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=740;gain.gain.setValueAtTime(.05,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.6);oscillator.start();oscillator.stop(audio.currentTime+.6);}catch{}
 }
 function tick(){
  remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
  if(remaining===0){pause();finished=true;if(mode==='focus'){completed++;$('#completed-count').textContent=completed;}$('#timer-state').textContent='¡Bloque completado! Tú eliges qué sigue.';document.title='¡Bloque completado! · MFB Corporation';beep();toast('¡Bloque completado! Un paso más.');}
  else document.title=$('#timer-display').textContent+' · MFB Corporation';
  render();
 }
 $('#timer-toggle').addEventListener('click',()=>{
  if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));pause();$('#timer-state').textContent='En pausa. Continúa cuando quieras.';render();return;}
  try{
   if(finished){remaining=total=duration();finished=false;}
   if(remaining===total)remaining=total=duration();
   if(!audio&&$('#timer-sound').checked){const AudioCtx=window.AudioContext||window.webkitAudioContext;if(AudioCtx)audio=new AudioCtx();}
   if(audio&&audio.state==='suspended')audio.resume().catch(()=>{});
   deadline=Date.now()+remaining*1000;running=true;$('#timer-state').textContent=mode==='focus'?'Una sola tarea. Tú puedes.':'Este ratito es para ti.';interval=setInterval(tick,250);message('');render();
  }catch(err){message(err.message,true);}
 });
 $('#timer-reset').addEventListener('click',reset);
 $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;reset();}));
 Object.values(fields).forEach(f=>f.addEventListener('change',reset));
 document.addEventListener('visibilitychange',()=>{if(running&&!document.hidden)tick();});reset();
}
function mediaKit(){
 return 'MFB CORPORATION · FICHA DEL PROYECTO\n\n'+(config.origin||'')+'\n\nQué es\nUn directorio de 18 herramientas gratuitas en español para imágenes, PDF, texto, cálculos y organización.\n\nEnfoque\nResolver tareas cotidianas sin cuentas, con procesamiento en el navegador.\n\nFormatos posibles\nPatrocinio identificado en una sección del sitio. Condiciones y precio por acordar con datos reales.\n\nEstado\nLanzamiento. No se acredita ninguna cifra de tráfico, patrocinador o campaña activa.\n\nContacto\n'+(config.contactEmail||'Canal de contacto aún no configurado.')+'\n';
}
if($('#download-media-kit'))$('#download-media-kit').addEventListener('click',()=>downloadText(mediaKit(),'ficha-mfb.txt'));
if($('#suggestion-form'))$('#suggestion-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#suggestion-text').value.trim();if(!text)return;downloadText('Sugerencia para MFB Corporation\nTipo: '+$('#suggestion-type').value+'\n\n'+text+'\n\nEste mensaje se ha preparado localmente. No se ha enviado.','sugerencia-mfb.txt');toast('Sugerencia descargada. No se ha enviado.');});
if($('#clear-local-data'))$('#clear-local-data').addEventListener('click',async()=>{
 if(await confirmAction('¿Borrar los datos de MFB Corporation?','Se eliminarán las notas, tareas, favoritos y el avance de lanzamiento de este navegador. Descarga las copias que quieras conservar.')){
  try{for(const key of Object.keys(localStorage))if(key.startsWith('mfb:'))localStorage.removeItem(key);favorites.clear();updateFavorites();$('#privacy-status').textContent='Los datos locales de MFB Corporation se han eliminado.';toast('Datos de MFB Corporation eliminados.');}
  catch{$('#privacy-status').textContent='No se pudo acceder al almacenamiento de este navegador.';}
 }
});
if($('[data-launch-step]')){
 const raw=storage.read('launch',[]),done=new Set(Array.isArray(raw)?raw:[]);
 $$('[data-launch-step]').forEach(c=>{c.checked=done.has(c.dataset.launchStep);c.addEventListener('change',()=>{if(c.checked)done.add(c.dataset.launchStep);else done.delete(c.dataset.launchStep);storage.write('launch',Array.from(done));render();});});
 function render(){$('#launch-count').textContent=done.size+' de 6 pasos completados';$('#launch-bar').style.width=(done.size/6*100)+'%';}render();
 $('#download-launch').addEventListener('click',()=>downloadText('PLAN DE LANZAMIENTO · MFB CORPORATION\n\n'+$$('.launch-item').map(l=>($('input',l).checked?'[x] ':'[ ] ')+$('b',l).textContent+'\n'+$('small',l).textContent).join('\n\n')+'\n\nAdSense: https://support.google.com/adsense/answer/9724?hl=es\nSEO: https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=es\n\nNo hay garantía de tráfico ni ingresos.','plan-de-lanzamiento-mfb.txt'));
}
})();
