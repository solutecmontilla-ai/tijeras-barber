import { body, HttpError, soloAdmin } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = soloAdmin(() =>
  db
    .prepare(
      `SELECT f.id, f.fecha, f.total, f.total_usd, f.tasa, f.metodo_pago, f.estado, f.numero_fiscal, f.error,
              c.cedula, c.nombre, c.apellido
       FROM facturas f JOIN clientes c ON c.id = f.cliente_id
       ORDER BY f.id DESC LIMIT 200`,
    )
    .all(),
);

// Reintenta una factura con error: vuelve a poner su trabajo en la cola del agente.
// Solo se permite cuando el agente reporto error (la impresora no emitio el documento).
export const POST = soloAdmin(async (req) => {
  const { facturaId } = await body<{ facturaId: number }>(req);
  const r = db
    .prepare(
      `UPDATE trabajos_fiscales SET estado = 'pendiente', resultado = NULL, actualizado = datetime('now')
       WHERE factura_id = ? AND estado = 'error'`,
    )
    .run(Number(facturaId));
  if (r.changes === 0) throw new HttpError(409, "La factura no tiene un trabajo con error");
  db.prepare("UPDATE facturas SET estado = 'pendiente', error = NULL WHERE id = ?").run(Number(facturaId));
  return { ok: true };
});
