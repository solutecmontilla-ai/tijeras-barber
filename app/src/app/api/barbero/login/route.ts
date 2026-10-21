import { body, HttpError, publico } from "@/lib/api";
import { db } from "@/lib/db";
import { dispositivoActual } from "@/lib/dispositivo";
import { setSession } from "@/lib/session";

export const POST = publico(async (req) => {
  const disp = await dispositivoActual();
  if (!disp) throw new HttpError(403, "Dispositivo no autorizado");
  const { numero } = await body<{ numero: unknown }>(req);
  const cub = db
    .prepare("SELECT id, numero, barbero FROM cubiculos WHERE numero = ? AND activo = 1")
    .get(Number(numero)) as { id: number; numero: number; barbero: string } | undefined;
  if (!cub) throw new HttpError(404, "Cubiculo no registrado");
  await setSession({ rol: "barbero", cubiculoId: cub.id, dispositivoId: disp.id });
  return { numero: cub.numero, barbero: cub.barbero };
});
