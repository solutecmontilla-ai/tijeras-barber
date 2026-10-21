import "server-only";
import { db } from "./db";

export type Cliente = {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
};

export type Item = { servicio_id: number | null; nombre: string; precio: number; alicuota: string; cantidad: number };

export function clientePorCedula(cedula: string): Cliente | undefined {
  return db.prepare("SELECT * FROM clientes WHERE cedula = ?").get(cedula) as Cliente | undefined;
}

export function itemsDe(atencionId: number): Item[] {
  return db
    .prepare("SELECT servicio_id, nombre, precio, alicuota, cantidad FROM atencion_items WHERE atencion_id = ?")
    .all(atencionId) as Item[];
}

// Visitas anteriores ya cerradas (terminadas o facturadas), mas reciente primero
export function visitas(clienteId: number, limite = 10, excluirId = 0) {
  const rows = db
    .prepare(
      `SELECT id, barbero, inicio, fin FROM atenciones
       WHERE cliente_id = ? AND id != ? AND estado IN ('terminada', 'facturada')
       ORDER BY inicio DESC LIMIT ?`,
    )
    .all(clienteId, excluirId, limite) as { id: number; barbero: string; inicio: string; fin: string | null }[];
  return rows.map((r) => ({ ...r, items: itemsDe(r.id) }));
}

export function duracionSeg(inicio: string, fin: string | null): number {
  const a = Date.parse(inicio + "Z");
  const b = fin ? Date.parse(fin + "Z") : Date.now();
  return Math.max(0, Math.round((b - a) / 1000));
}
