import { Routes } from '@angular/router';
export const routes: Routes = [
 {path: '', redirectTo: 'catalogo', pathMatch: 'full'},
 {path: 'catalogo', loadComponent: () => import('./ventas.component').then(m => m.VentasComponent)},
 {path: '**', redirectTo: 'catalogo'}
];
