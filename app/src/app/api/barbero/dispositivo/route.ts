import { publico } from "@/lib/api";
import { dispositivoActual } from "@/lib/dispositivo";

export const GET = publico(async () => {
  const d = await dispositivoActual();
  return { autorizado: !!d, nombre: d?.nombre ?? null };
});
