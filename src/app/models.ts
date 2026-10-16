export interface Producto { id: number; nombre: string; categoria: string; precio: number; stock: number; imagen?: string; }
export interface PrecioStock { productoId: number; precio: number; stock: number; actualizado: string; }
export interface LineaPedido { productoId: number; producto: string; precioUnitario: number; cantidad: number; subtotal: number; }
export type EstadoPedido = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';
export interface Pedido { id: string | number; cliente: string; fecha: string; lineas: LineaPedido[]; total: number; estado: EstadoPedido; origen: 'ONLINE' | 'OFFLINE' | 'LEGADO'; }
export interface Borrador { id: string; cliente: string; cantidades: Partial<Record<number, string | number>>; }
export interface CacheEntry { cache: string; url: string; datos: unknown; }
export interface Diagnostico { capturado: string; conectividad: string; worker: string; estado: string; controlaPagina: boolean; caches: CacheEntry[]; pedidos: Pedido[]; errorAlmacenamiento?: string; }
