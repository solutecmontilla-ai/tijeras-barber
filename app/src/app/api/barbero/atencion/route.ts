import { body, HttpError, normalizarCedula, soloBarbero, texto } from "@/lib/api";
import { clientePorCedula } from "@/lib/consultas";
import { db, tx } from "@/lib/db";

// Registra al cliente (si es nuevo), los servicios elegidos e inicia el cronometro oculto
export const POST = soloBarbero(async (req, { session }) => {
  const b = await body<{ cedula: unknown; nombre?: unknown; apellido?: unknown; servicios: unknown }>(req);
  const cedula = normalizarCedula(b.cedula);
  const ids = Array.isArray(b.servicios) ? [...new Set(b.servicios.map(Number))] : [];
  if (ids.length === 0) throw new HttpError(400, "Seleccione al menos un servicio");

  const servicios = ids.map((id) => {
    const s = db.prepare("SELECT id, nombre, precio, alicuota FROM servicios WHERE id = ? AND activo = 1").get(id) as
      | { id: number; nombre: string; precio: number; alicuota: string }
      | undefined;
    if (!s) throw new HttpError(400, "Servicio no disponible");
    return s;
  });

  const id = tx(() => {
    const ocupado = db
      .prepare("SELECT 1 FROM atenciones WHERE cubiculo_id = ? AND estado = 'en_curso'")
      .get(session.cubiculoId);
    if (ocupado) throw new HttpError(409, "Ya tiene un cliente en servicio. Finalicelo primero.");

    let cliente = clientePorCedula(cedula);
    if (!cliente) {
      const r = db
        .prepare("INSERT INTO clientes (cedula, nombre, apellido) VALUES (?, ?, ?)")
        .run(cedula, texto(b.nombre, "nombre", 40), texto(b.apellido, "apellido", 40));
      cliente = { id: Number(r.lastInsertRowid) } as NonNullable<typeof cliente>;
    }

    const cub = db.prepare("SELECT barbero FROM cubiculos WHERE id = ? AND activo = 1").get(session.cubiculoId) as
      | { barbero: string }
      | undefined;
    if (!cub) throw new HttpError(403, "Este cubiculo fue desactivado o eliminado");
    const { barbero } = cub;
    const r = db
      .prepare(
        "INSERT INTO atenciones (cliente_id, cubiculo_id, barbero, inicio) VALUES (?, ?, ?, strftime('%Y-%m-%d %H:%M:%S', 'now'))",
      )
      .run(cliente.id, session.cubiculoId, barbero);
    const atencionId = Number(r.lastInsertRowid);
    const ins = db.prepare(
      "INSERT INTO atencion_items (atencion_id, servicio_id, nombre, precio, alicuota) VALUES (?, ?, ?, ?, ?)",
    );
    for (const s of servicios) ins.run(atencionId, s.id, s.nombre, s.precio, s.alicuota);
    return atencionId;
  });

  return { id };
});
