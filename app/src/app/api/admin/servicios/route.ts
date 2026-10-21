import { body, HttpError, soloAdmin, texto } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = soloAdmin(() => db.prepare("SELECT * FROM servicios ORDER BY activo DESC, nombre").all());

export const POST = soloAdmin(async (req) => {
  const b = await body<{ id?: number; nombre: unknown; precio: unknown; alicuota?: unknown; activo?: boolean }>(req);
  const nombre = texto(b.nombre, "nombre", 40);
  const precio = Math.round(Number(b.precio) * 100);
  if (!(precio > 0)) throw new HttpError(400, "Precio invalido");
  const alicuota = ["G", "R", "A", "E"].includes(String(b.alicuota)) ? String(b.alicuota) : "G";
  const activo = b.activo === false ? 0 : 1;
  if (b.id) {
    db.prepare("UPDATE servicios SET nombre = ?, precio = ?, alicuota = ?, activo = ? WHERE id = ?").run(
      nombre,
      precio,
      alicuota,
      activo,
      b.id,
    );
  } else {
    db.prepare("INSERT INTO servicios (nombre, precio, alicuota, activo) VALUES (?, ?, ?, ?)").run(
      nombre,
      precio,
      alicuota,
      activo,
    );
  }
  return { ok: true };
});
