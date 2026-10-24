import { body, HttpError, soloAdmin, texto } from "@/lib/api";
import { db, tx } from "@/lib/db";

export const GET = soloAdmin(() => db.prepare("SELECT * FROM servicios ORDER BY activo DESC, nombre").all());

export const POST = soloAdmin(async (req) => {
  const b = await body<{ id?: number; nombre: unknown; precio: unknown; alicuota?: unknown; activo?: boolean; eliminar?: number }>(
    req,
  );
  // Eliminar: el historial conserva nombre y precio de cada item, solo pierde el enlace al servicio
  if (b.eliminar) {
    const id = Number(b.eliminar);
    return tx(() => {
      const pendiente = db
        .prepare(
          `SELECT 1 FROM atencion_items i JOIN atenciones a ON a.id = i.atencion_id
           WHERE i.servicio_id = ? AND a.estado IN ('en_curso', 'terminada')`,
        )
        .get(id);
      if (pendiente) throw new HttpError(409, "Hay un cliente en servicio o por facturar con este servicio");
      db.prepare("UPDATE atencion_items SET servicio_id = NULL WHERE servicio_id = ?").run(id);
      const r = db.prepare("DELETE FROM servicios WHERE id = ?").run(id);
      if (r.changes === 0) throw new HttpError(404, "Servicio no encontrado");
      return { ok: true };
    });
  }
  const nombre = texto(b.nombre, "nombre", 40);
  const precio = Math.round(Number(b.precio) * 100);
  if (!(precio > 0)) throw new HttpError(400, "Precio invalido");
  const alicuota = ["G", "R", "A", "E"].includes(String(b.alicuota)) ? String(b.alicuota) : "G";
  const activo = b.activo === false ? 0 : 1;
  if (b.id) {
    db.prepare("UPDATE servicios SET nombre = ?, precio = ?, alicuota = ?, activo = ? WHERE id = ?").run(
      nombre,
      precio,
      alicuota,
      activo,
      b.id,
    );
  } else {
    db.prepare("INSERT INTO servicios (nombre, precio, alicuota, activo) VALUES (?, ?, ?, ?)").run(
      nombre,
      precio,
      alicuota,
      activo,
    );
  }
  return { ok: true };
});
