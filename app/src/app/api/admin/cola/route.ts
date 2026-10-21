import { soloAdmin } from "@/lib/api";
import { duracionSeg, itemsDe } from "@/lib/consultas";
import { db } from "@/lib/db";

// Clientes en servicio y servicios terminados pendientes por facturar
export const GET = soloAdmin(() => {
  const rows = db
    .prepare(
      `SELECT a.id, a.estado, a.inicio, a.fin, a.barbero, cu.numero AS cubiculo,
              c.cedula, c.nombre, c.apellido
       FROM atenciones a
       JOIN clientes c ON c.id = a.cliente_id
       JOIN cubiculos cu ON cu.id = a.cubiculo_id
       WHERE a.estado IN ('en_curso', 'terminada')
       ORDER BY a.estado DESC, a.inicio`,
    )
    .all() as { id: number; inicio: string; fin: string | null }[];
  return rows.map((r) => {
    const items = itemsDe(r.id);
    return {
      ...r,
      duracionSeg: duracionSeg(r.inicio, r.fin),
      servicios: items.map((i) => i.nombre),
      total: items.reduce((t, i) => t + i.precio * i.cantidad, 0),
    };
  });
});
