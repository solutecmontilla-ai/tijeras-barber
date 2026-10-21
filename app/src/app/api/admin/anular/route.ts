import { body, HttpError, soloAdmin } from "@/lib/api";
import { db } from "@/lib/db";

// Descarta una atencion no facturada (cliente se fue, error del barbero, etc.)
export const POST = soloAdmin(async (req) => {
  const { atencionId } = await body<{ atencionId: number }>(req);
  const r = db
    .prepare("UPDATE atenciones SET estado = 'anulada' WHERE id = ? AND estado IN ('en_curso', 'terminada')")
    .run(Number(atencionId));
  if (r.changes === 0) throw new HttpError(409, "No se puede anular");
  return { ok: true };
});
