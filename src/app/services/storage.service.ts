import { Injectable } from '@angular/core';
import { Borrador, Pedido } from '../models';
@Injectable({providedIn:'root'})
export class StorageService {
 private db?: Promise<IDBDatabase>;
 private abrir(): Promise<IDBDatabase> {
  return this.db ??= new Promise((resolve,reject)=>{
   const q=indexedDB.open('backusVentasDB',2);
   q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('pedidos'))db.createObjectStore('pedidos',{keyPath:'id'});if(!db.objectStoreNames.contains('configuracion'))db.createObjectStore('configuracion',{keyPath:'id'});};
   q.onsuccess=()=>{q.result.onversionchange=()=>{q.result.close();this.db=undefined;};resolve(q.result);};
   q.onerror=()=>{this.db=undefined;reject(q.error);};
   q.onblocked=()=>{this.db=undefined;reject(new Error('Cierra otras pestañas de Backus y vuelve a intentar.'));};
  });
 }
 private async ejecutar<T>(name:string,mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await this.abrir();return new Promise((resolve,reject)=>{const t=db.transaction(name,mode);const q=fn(t.objectStore(name));t.oncomplete=()=>resolve(q.result);t.onerror=()=>reject(t.error??q.error);t.onabort=()=>reject(t.error??q.error??new Error('Transacción cancelada.'));});
 }
 guardarPedido(pedido:Pedido){return this.ejecutar('pedidos','readwrite',s=>s.add(pedido));}
 listarPedidos(){return this.ejecutar<Pedido[]>('pedidos','readonly',s=>s.getAll());}
 obtenerPedido(id:string|number){return this.ejecutar<Pedido|undefined>('pedidos','readonly',s=>s.get(id));}
 eliminarPedido(id:string|number){return this.ejecutar('pedidos','readwrite',s=>s.delete(id));}
 guardarBorrador(b:Borrador){return this.ejecutar('configuracion','readwrite',s=>s.put({id:'borrador',valor:b}));}
 async leerBorrador():Promise<Borrador|undefined>{const r=await this.ejecutar<{valor:Borrador}|undefined>('configuracion','readonly',s=>s.get('borrador'));return r?.valor;}
 async importarAnteriores(pedidos:Pedido[]){
  const db=await this.abrir();return new Promise<void>((resolve,reject)=>{const t=db.transaction(['pedidos','configuracion'],'readwrite');const s=t.objectStore('configuracion');const q=s.get('migracion-local-v1');q.onsuccess=()=>{if(q.result)return;for(const p of pedidos)t.objectStore('pedidos').put(p);s.put({id:'migracion-local-v1',fecha:new Date().toISOString()});};t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??new Error('No se pudo importar.'));});
 }
}
