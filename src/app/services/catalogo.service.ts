import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
export type { Producto, PrecioStock } from '../models';
import { Producto, PrecioStock } from '../models';
@Injectable({providedIn:'root'})
export class CatalogoService {
 private http=inject(HttpClient);
 obtenerCatalogo(){return this.http.get<Producto[]>('/data/catalogo.json').pipe(timeout(12000));}
 obtenerPrecios(){return this.http.get<PrecioStock[]>('/data/precios.json').pipe(timeout(12000));}
}
