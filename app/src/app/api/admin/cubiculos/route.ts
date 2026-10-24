import { body, HttpError, soloAdmin, texto } from "@/lib/api";
import { db, tx } from "@/lib/db";

// Los cubiculos eliminados con historial quedan archivados con numero negativo (-id):
// conservan sus atenciones pero liberan el numero y no se listan ni permiten ingresar.
export const GET = soloAdmin(() => db.prepare("SELECT * FROM cubiculos WHERE numero > 0 ORDER BY numero").all());

// Crea, actualiza (si viene id) o elimina (si viene eliminar) un cubiculo
export const POST = soloAdmin(async (req) => {
  const b = await body<{ id?: number; numero: unknown; barbero: unknown; activo?: boolean; eliminar?: number }>(req);
  if (b.eliminar) {
    const id = Number(b.eliminar);
    return tx(() => {
      const ocupado = db
        .prepare("SELECT 1 FROM atenciones WHERE cubiculo_id = ? AND estado IN ('en_curso', 'terminada')")
        .get(id);
      if (ocupado) throw new HttpError(409, "Tiene un cliente en servicio o por facturar");
      const usado = db.prepare("SELECT 1 FROM atenciones WHERE cubiculo_id = ?").get(id);
      const r = usado
        ? db.prepare("UPDATE cubiculos SET numero = -id, activo = 0 WHERE id = ?").run(id)
        : db.prepare("DELETE FROM cubiculos WHERE id = ?").run(id);
      if (r.changes === 0) throw new HttpError(404, "Cubiculo no encontrado");
      return { ok: true };
    });
  }
  const numero = Math.floor(Number(b.numero));
  if (!(numero >= 1 && numero <= 999)) throw new HttpError(400, "Numero de cubiculo invalido");
  const barbero = texto(b.barbero, "nombre del barbero", 60);
  const activo = b.activo === false ? 0 : 1;
  const dup = db.prepare("SELECT id FROM cubiculos WHERE numero = ? AND id != ?").get(numero, b.id ?? 0);
  if (dup) throw new HttpError(409, `El cubiculo ${numero} ya existe`);
  if (b.id) {
    db.prepare("UPDATE cubiculos SET numero = ?, barbero = ?, activo = ? WHERE id = ?").run(numero, barbero, activo, b.id);
  } else {
    db.prepare("INSERT INTO cubiculos (numero, barbero, activo) VALUES (?, ?, ?)").run(numero, barbero, activo);
  }
  return { ok: true };
});
