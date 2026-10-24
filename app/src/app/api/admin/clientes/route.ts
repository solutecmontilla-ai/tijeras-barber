import { body, soloAdmin } from "@/lib/api";
import { actualizarCliente, type DatosCliente } from "@/lib/consultas";
import { db } from "@/lib/db";

export const GET = soloAdmin((req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;
  return db
    .prepare(
      `SELECT c.*, (SELECT max(inicio) FROM atenciones a WHERE a.cliente_id = c.id AND a.estado = 'facturada') AS ultima_visita,
              (SELECT count(*) FROM atenciones a WHERE a.cliente_id = c.id AND a.estado = 'facturada') AS visitas
       FROM clientes c
       WHERE c.cedula LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ?
       ORDER BY ultima_visita DESC NULLS LAST LIMIT 100`,
    )
    .all(like, like, like);
});

// Edita los datos del cliente (desde caja o desde el listado de clientes)
export const POST = soloAdmin(async (req) => {
  const b = await body<DatosCliente & { id: number }>(req);
  actualizarCliente(Number(b.id), b);
  return db.prepare("SELECT * FROM clientes WHERE id = ?").get(Number(b.id));
});
