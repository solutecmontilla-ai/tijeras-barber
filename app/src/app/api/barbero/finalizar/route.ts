import { HttpError, soloBarbero } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = soloBarbero(({}, { session }) => {
  const r = db
    .prepare(
      "UPDATE atenciones SET estado = 'terminada', fin = strftime('%Y-%m-%d %H:%M:%S', 'now') WHERE cubiculo_id = ? AND estado = 'en_curso'",
    )
    .run(session.cubiculoId);
  if (r.changes === 0) throw new HttpError(404, "No hay servicio en curso");
  return { ok: true };
});
