import "server-only";
import { HttpError, normalizarCedula, texto } from "./api";
import { db } from "./db";
import { diasParaCumple } from "./fechas";

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

export type DatosCliente = { cedula?: unknown; nombre: unknown; apellido: unknown; telefono?: unknown; fechaNacimiento?: unknown };

// Edicion de datos del cliente (caja y listado). La cedula solo cambia si se envia.
export function actualizarCliente(id: number, b: DatosCliente) {
  const nombre = texto(b.nombre, "nombre", 40);
  const apellido = texto(b.apellido, "apellido", 40);
  const telefono = typeof b.telefono === "string" ? b.telefono.trim().slice(0, 20) || null : null;
  const fechaNac =
    typeof b.fechaNacimiento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fechaNacimiento) ? b.fechaNacimiento : null;
  const cedula = b.cedula === undefined ? null : normalizarCedula(b.cedula);
  if (cedula) {
    const otro = clientePorCedula(cedula);
    if (otro && otro.id !== id) throw new HttpError(409, "Ya existe otro cliente con esa cedula");
  }
  const r = db
    .prepare(
      "UPDATE clientes SET cedula = coalesce(?, cedula), nombre = ?, apellido = ?, telefono = ?, fecha_nacimiento = ? WHERE id = ?",
    )
    .run(cedula, nombre, apellido, telefono, fechaNac, id);
  if (r.changes === 0) throw new HttpError(404, "Cliente no encontrado");
  return { nombre, apellido, telefono };
}

// Clientes que cumplen años hoy (dias = 0) o en los proximos dias
export function cumpleanos(dias = 7) {
  const rows = db
    .prepare("SELECT id, cedula, nombre, apellido, telefono, fecha_nacimiento FROM clientes WHERE fecha_nacimiento IS NOT NULL")
    .all() as Cliente[];
  return rows
    .map((c) => ({ ...c, dias: diasParaCumple(c.fecha_nacimiento) ?? Infinity }))
    .filter((c) => c.dias <= dias)
    .sort((a, b) => a.dias - b.dias);
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
