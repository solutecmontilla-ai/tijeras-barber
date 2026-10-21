import { body, HttpError, publico } from "@/lib/api";
import { verificarAgente } from "@/lib/agente";
import { db, tx } from "@/lib/db";

// El agente reporta el resultado de un trabajo tomado
export const POST = publico(async (req, { params }) => {
  verificarAgente(req);
  const b = await body<{ ok: boolean; numeroFiscal?: string; error?: string; detalle?: unknown }>(req);
  tx(() => {
    const t = db
      .prepare("SELECT id, factura_id FROM trabajos_fiscales WHERE id = ? AND estado = 'tomado'")
      .get(Number(params.id)) as { id: number; factura_id: number | null } | undefined;
    if (!t) throw new HttpError(404, "Trabajo no encontrado o ya reportado");
    db.prepare("UPDATE trabajos_fiscales SET estado = ?, resultado = ?, actualizado = datetime('now') WHERE id = ?").run(
      b.ok ? "ok" : "error",
      JSON.stringify({ numeroFiscal: b.numeroFiscal, error: b.error, detalle: b.detalle }),
      t.id,
    );
    if (t.factura_id) {
      db.prepare("UPDATE facturas SET estado = ?, numero_fiscal = ?, error = ? WHERE id = ?").run(
        b.ok ? "impresa" : "error",
        b.ok ? (b.numeroFiscal ?? null) : null,
        b.ok ? null : String(b.error ?? "Error desconocido").slice(0, 300),
        t.factura_id,
      );
    }
  });
  return { ok: true };
});
