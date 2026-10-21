import { HttpError, soloBarbero } from "@/lib/api";
import { itemsDe } from "@/lib/consultas";
import { db } from "@/lib/db";

// Nunca se envian horas ni duracion al barbero: el cronometro es solo para el admin
export const GET = soloBarbero(({}, { session }) => {
  const cub = db
    .prepare("SELECT numero, barbero FROM cubiculos WHERE id = ? AND activo = 1")
    .get(session.cubiculoId) as { numero: number; barbero: string } | undefined;
  if (!cub) throw new HttpError(401, "Cubiculo desactivado");

  const activa = db
    .prepare(
      `SELECT a.id, c.cedula, c.nombre, c.apellido FROM atenciones a
       JOIN clientes c ON c.id = a.cliente_id
       WHERE a.cubiculo_id = ? AND a.estado = 'en_curso' ORDER BY a.id DESC LIMIT 1`,
    )
    .get(session.cubiculoId) as { id: number; cedula: string; nombre: string; apellido: string } | undefined;

  const servicios = db.prepare("SELECT id, nombre FROM servicios WHERE activo = 1 ORDER BY nombre").all();

  return {
    cubiculo: cub,
    servicios,
    activa: activa ? { ...activa, items: itemsDe(activa.id).map((i) => i.nombre) } : null,
  };
});
