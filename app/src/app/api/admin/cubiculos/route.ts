import { body, HttpError, soloAdmin, texto } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = soloAdmin(() => db.prepare("SELECT * FROM cubiculos ORDER BY numero").all());

// Crea o actualiza (si viene id) un cubiculo
export const POST = soloAdmin(async (req) => {
  const b = await body<{ id?: number; numero: unknown; barbero: unknown; activo?: boolean }>(req);
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
