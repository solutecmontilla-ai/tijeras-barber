import { HttpError, soloAdmin } from "@/lib/api";
import { duracionSeg, itemsDe, visitas, type Cliente } from "@/lib/consultas";
import { db } from "@/lib/db";

export const GET = soloAdmin(({}, { params }) => {
  const a = db
    .prepare(
      `SELECT a.*, cu.numero AS cubiculo FROM atenciones a
       JOIN cubiculos cu ON cu.id = a.cubiculo_id WHERE a.id = ?`,
    )
    .get(Number(params.id)) as
    | { id: number; cliente_id: number; inicio: string; fin: string | null; estado: string }
    | undefined;
  if (!a) throw new HttpError(404, "Atencion no encontrada");
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(a.cliente_id) as Cliente;
  return {
    atencion: { ...a, duracionSeg: duracionSeg(a.inicio, a.fin), items: itemsDe(a.id) },
    cliente,
    historial: visitas(a.cliente_id, 10, a.id).map((v) => ({ ...v, duracionSeg: duracionSeg(v.inicio, v.fin) })),
  };
});
