import { Component, HostListener, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SwUpdate } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from './services/catalogo.service';
import { StorageService } from './services/storage.service';
import { Producto, PrecioStock, Pedido, Diagnostico, CacheEntry, LineaPedido } from './models';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:string}>; }
@Component({selector:'app-ventas',imports:[CommonModule,FormsModule],templateUrl:'./ventas.component.html'})
export class VentasComponent implements OnDestroy {
 private servicio=inject(CatalogoService); private storage=inject(StorageService); private sw=inject(SwUpdate);
 private versionSub=this.sw.versionUpdates.subscribe(e=>{if(e.type==='VERSION_READY')this.actualizacion.set(true);});
 productos=signal<Producto[]>([]);precios=signal<PrecioStock[]>([]);pedidos=signal<Pedido[]>([]);
 online=signal(navigator.onLine);cargando=signal(true);cargandoPrecios=signal(false);guardando=signal(false);iniciando=signal(true);
 errorCatalogo=signal('');errorPrecios=signal('');error=signal('');aviso=signal('');
 busqueda=signal('');categoria=signal('Todas');cantidades=signal<Partial<Record<number,string|number>>>({});seleccion=signal<Partial<Record<number,string|number>>>({});
 cliente='';panel=signal<'catalogo'|'pedidos'|'evidencias'>('catalogo');historialBusqueda=signal('');detalle=signal<Pedido|null>(null);
 actualizacion=signal(false);diagnostico=signal<Diagnostico|null>(null);install=signal<InstallEvent|null>(null);imagenesFallidas=signal<Record<number,boolean>>({});
 listoOffline=signal(false);confirmarEliminar=signal<Pedido|null>(null);intentoGuardar=signal(false);private draftId:string=crypto.randomUUID();private draftQueue:Promise<unknown>=Promise.resolve();
 categorias=computed(()=>['Todas',...new Set(this.productos().map(p=>p.categoria))]);
 filtrados=computed(()=>this.productos().filter(p=>this.normalizar(p.nombre).includes(this.normalizar(this.busqueda().trim()))&&(this.categoria()==='Todas'||p.categoria===this.categoria())));
 lineas=computed(()=>this.productos().filter(p=>this.cantidades()[p.id]!==undefined));
 unidades=computed(()=>this.lineas().reduce((n,p)=>n+(this.validaCantidad(this.cantidades()[p.id])?Number(this.cantidades()[p.id]):0),0));
 total=computed(()=>this.lineas().reduce((n,p)=>n+this.subtotalCentavos(p),0)/100);
 pendientes=computed(()=>this.pedidos().filter(p=>p.estado==='PENDIENTE').length);
 historial=computed(()=>this.pedidos().filter(p=>this.normalizar(p.cliente+' '+p.id).includes(this.normalizar(this.historialBusqueda().trim()))));
 constructor(){void this.iniciar();window.addEventListener('beforeinstallprompt',this.onInstall);window.addEventListener('appinstalled',this.onInstalled);navigator.serviceWorker?.addEventListener('controllerchange',this.onController);}
 private onInstall=(e:Event)=>{e.preventDefault();this.install.set(e as InstallEvent);};private onInstalled=()=>this.install.set(null);private onController=()=>{void this.verificarCache();};
 ngOnDestroy(){this.versionSub.unsubscribe();window.removeEventListener('beforeinstallprompt',this.onInstall);window.removeEventListener('appinstalled',this.onInstalled);navigator.serviceWorker?.removeEventListener('controllerchange',this.onController);}
 falloImagen(id:number){this.imagenesFallidas.update(x=>({...x,[id]:true}));}
 normalizar(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
 private async iniciar(){
  await this.cargar();
  try{await this.importarBorradores();await this.refrescar();const b=await this.storage.leerBorrador();if(b){this.cliente=b.cliente;this.cantidades.set(b.cantidades);this.draftId=b.id;}}
  catch{this.error.set('No se pudo abrir IndexedDB. Los formularios siguen disponibles; reintenta el acceso antes de guardar.');}
  this.iniciando.set(false);
 }
 @HostListener('window:online') conectado(){this.online.set(true);this.aviso.set('Conexión recuperada. Los pedidos siguen pendientes en este dispositivo.');void this.cargarPrecios();}
 @HostListener('window:offline') desconectado(){this.online.set(false);}
 precio(p:Producto){return this.precios().find(x=>x.productoId===p.id);}
 async cargar(){if(!this.iniciando()&&this.cargando())return;this.cargando.set(true);this.errorCatalogo.set('');
  try{this.productos.set(await firstValueFrom(this.servicio.obtenerCatalogo()));}catch{this.errorCatalogo.set('No se pudo cargar el catálogo. Abre la aplicación con conexión para prepararlo.');}finally{this.cargando.set(false);}
  await this.cargarPrecios();void this.verificarCache();
 }
 async cargarPrecios(){if(this.cargandoPrecios())return;this.cargandoPrecios.set(true);this.errorPrecios.set('');
  try{this.precios.set(await firstValueFrom(this.servicio.obtenerPrecios()));}catch{this.precios.set([]);this.errorPrecios.set('Precios y stock no disponibles. Consulta con conexión antes de registrar el pedido.');}finally{this.cargandoPrecios.set(false);}
 }
 async verificarCache(){try{if(!navigator.serviceWorker?.controller)return;await firstValueFrom(this.servicio.obtenerCatalogo());await firstValueFrom(this.servicio.obtenerPrecios());let cat=false,pre=false;for(const name of await caches.keys()){if(!name.endsWith(':cache'))continue;const cache=await caches.open(name);if(name.includes('catalogo-backus'))cat=!!await cache.match(location.origin+'/data/catalogo.json');if(name.includes('precios-backus'))pre=!!await cache.match(location.origin+'/data/precios.json');}this.listoOffline.set(cat&&pre);}catch{this.listoOffline.set(false);}}
 validaCantidad(v:unknown):boolean{return /^(?:[1-9]\d*)$/.test(String(v))&&Number.isSafeInteger(Number(v))&&Number(v)<=9999;}
 errorCantidad(p:Producto,v:unknown):string{if(!this.validaCantidad(v))return 'Usa un entero de 1 a 9999.';const dato=this.precio(p);if(!dato)return 'Precio no disponible.';if(Number(v)>dato.stock)return 'Máximo disponible: '+dato.stock+' unidades.';return '';}
 subtotalCentavos(p:Producto){return this.errorCantidad(p,this.cantidades()[p.id])?0:Math.round(this.precio(p)!.precio*100)*Number(this.cantidades()[p.id]);}
 elegir(p:Producto,v:string|number){this.seleccion.update(q=>({...q,[p.id]:v}));}
 agregar(p:Producto){const v=this.seleccion()[p.id]??1;const err=this.errorCantidad(p,v);if(err){this.error.set(p.nombre+': '+err);return;}const old=this.cantidades()[p.id];if(old!==undefined&&!this.validaCantidad(old)){this.error.set('Corrige la cantidad de '+p.nombre+' en el pedido.');return;}
  const n=Number(old??0)+Number(v);const combined=this.errorCantidad(p,n);if(combined){this.error.set(p.nombre+': '+combined);return;}this.cantidades.update(q=>({...q,[p.id]:n}));this.error.set('');this.persistir();this.aviso.set(p.nombre+' añadido al pedido.');
 }
 cambiarCantidad(p:Producto,v:string|number){this.cantidades.update(q=>({...q,[p.id]:v}));this.persistir();}
 quitar(p:Producto){this.cantidades.update(q=>{const n={...q};delete n[p.id];return n;});this.persistir();}
 limpiarFiltros(){this.busqueda.set('');this.categoria.set('Todas');}
 persistir(){if(this.iniciando())return;const b=structuredClone({id:this.draftId,cliente:this.cliente,cantidades:this.cantidades()});this.draftQueue=this.draftQueue.then(()=>this.storage.guardarBorrador(b)).catch(()=>this.error.set('No se pudo conservar el borrador. No cierres esta pestaña y reintenta el almacenamiento.'));}
 async guardar(){
  if(this.guardando())return;this.intentoGuardar.set(true);this.error.set('');
  if(!this.cliente.trim()){this.error.set('Indica el nombre del cliente o negocio.');return;}if(!this.lineas().length){this.error.set('Añade al menos un producto al pedido.');return;}
  for(const p of this.lineas()){const err=this.errorCantidad(p,this.cantidades()[p.id]);if(err){this.error.set(p.nombre+': '+err);return;}}
  this.guardando.set(true);const lineas:LineaPedido[]=this.lineas().map(p=>({productoId:p.id,producto:p.nombre,precioUnitario:this.precio(p)!.precio,cantidad:Number(this.cantidades()[p.id]),subtotal:this.subtotalCentavos(p)/100}));
  const pedido:Pedido={id:this.draftId,cliente:this.cliente.trim(),fecha:new Date().toISOString(),lineas,total:lineas.reduce((s,l)=>s+Math.round(l.subtotal*100),0)/100,estado:'PENDIENTE',origen:this.online()?'ONLINE':'OFFLINE'};
  try{await this.storage.guardarPedido(pedido);this.pedidos.update(ps=>[pedido,...ps]);this.cantidades.set({});this.cliente='';this.draftId=crypto.randomUUID();this.intentoGuardar.set(false);this.persistir();this.aviso.set('Pedido guardado en este dispositivo. Pendiente de envío; no se envió a un servidor.');}
  catch{this.error.set('No se pudo guardar en IndexedDB. No se confirmó el pedido. Conservamos los datos del formulario para reintentar.');}
  finally{this.guardando.set(false);}
 }
 async refrescar(){const ps=await this.storage.listarPedidos();this.pedidos.set(ps.sort((a,b)=>b.fecha.localeCompare(a.fecha)));}
 async recargarHistorial(){try{await this.refrescar();this.error.set('');}catch{this.error.set('No se pudo leer el historial de IndexedDB. Reintenta sin eliminar los datos del navegador.');}}
 async verDetalle(p:Pedido){try{const dato=await this.storage.obtenerPedido(p.id);if(!dato)throw new Error('No existe');this.detalle.set(dato);setTimeout(()=>document.querySelector<HTMLElement>('.dialog-heading button')?.focus());}catch{this.error.set('No se pudo recuperar el detalle del pedido.');}}
 pedirEliminar(p:Pedido){this.confirmarEliminar.set(p);setTimeout(()=>document.querySelector<HTMLElement>('.confirm-dialog button')?.focus());}
 @HostListener('document:keydown',['$event']) controlarFoco(e:KeyboardEvent){if(e.key!=='Tab'||(!this.detalle()&&!this.confirmarEliminar()))return;const items=Array.from(document.querySelectorAll<HTMLElement>('.dialog-backdrop button:not(:disabled)'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 async eliminar(){const p=this.confirmarEliminar();if(!p||this.guardando())return;this.guardando.set(true);try{await this.storage.eliminarPedido(p.id);this.pedidos.update(ps=>ps.filter(x=>x.id!==p.id));this.confirmarEliminar.set(null);this.detalle.set(null);this.aviso.set('Pedido eliminado de este dispositivo.');}catch{this.error.set('No se pudo eliminar el pedido. El registro se conserva.');}finally{this.guardando.set(false);}}
 exportar(){const url=URL.createObjectURL(new Blob([JSON.stringify(this.pedidos(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='backus-pedidos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 cambiarPanel(p:'catalogo'|'pedidos'|'evidencias'){this.panel.set(p);this.detalle.set(null);if(p==='evidencias')void this.inspeccionar();}
 @HostListener('document:keydown.escape') cerrarDialogos(){if(!this.guardando()){this.detalle.set(null);this.confirmarEliminar.set(null);}}
 async instalar(){const e=this.install();if(!e)return;await e.prompt();await e.userChoice;this.install.set(null);}
 async comprobarActualizacion(){if(!this.sw.isEnabled){this.aviso.set('Esta función está disponible en el build de producción.');return;}try{const nueva=await this.sw.checkForUpdate();this.aviso.set(nueva?'Nueva versión disponible.':'Estás utilizando la última versión disponible.');}catch{this.error.set('No se pudo comprobar la versión. Revisa la conexión.');}}
 recargarVersion(){location.reload();}
 async inspeccionar(){this.panel.set('evidencias');try{const reg=await navigator.serviceWorker?.getRegistration();const entries:CacheEntry[]=[];for(const name of await caches.keys()){if(!name.includes('ngsw:')||!name.endsWith(':cache'))continue;const cache=await caches.open(name);for(const req of await cache.keys())if(req.url.includes('/data/')){const response=await cache.match(req);entries.push({cache:name,url:req.url,datos:await response?.json() as unknown});}}let pedidos:Pedido[]=[];let errorAlmacenamiento:string|undefined;try{pedidos=await this.storage.listarPedidos();}catch{errorAlmacenamiento='No se pudo leer IndexedDB.';}this.diagnostico.set({capturado:new Date().toISOString(),conectividad:this.online()?'ONLINE':'OFFLINE',worker:reg?.active?.scriptURL??'Sin registro',estado:reg?.active?.state??'No activo',controlaPagina:!!navigator.serviceWorker?.controller,caches:entries,pedidos,errorAlmacenamiento});}catch{this.error.set('No se pudo leer el diagnóstico PWA. Ejecuta el build de producción en localhost o HTTPS.');}}
 private async importarBorradores(){
  const raw=localStorage.getItem('backus-borradores-v1');if(!raw)return;const datos:unknown=JSON.parse(raw);if(!Array.isArray(datos))throw new Error('Borradores inválidos');const pedidos:Pedido[]=[];
  for(const item of datos){if(!item||typeof item!=='object')continue;const b=item as {id?:unknown;cliente?:unknown;fecha?:unknown;lineas?:unknown};if(typeof b.id!=='string'||typeof b.cliente!=='string'||!Array.isArray(b.lineas))continue;
   const lineas:LineaPedido[]=[];for(const value of b.lineas){const l=value as {productoId:number;cantidad:number;precioReferencial:number};if(!this.validaCantidad(l.cantidad)||!Number.isFinite(l.precioReferencial))continue;lineas.push({productoId:l.productoId,producto:this.productos().find(p=>p.id===l.productoId)?.nombre??'Producto '+l.productoId,precioUnitario:l.precioReferencial,cantidad:l.cantidad,subtotal:Math.round(l.precioReferencial*100)*l.cantidad/100});}
   if(lineas.length)pedidos.push({id:b.id,cliente:b.cliente,fecha:typeof b.fecha==='string'?b.fecha:new Date().toISOString(),lineas,total:lineas.reduce((s,l)=>s+Math.round(l.subtotal*100),0)/100,estado:'PENDIENTE',origen:'LEGADO'});
  }
  await this.storage.importarAnteriores(pedidos);
 }
}
