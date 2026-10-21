import { body, HttpError, ipCliente, publico } from "@/lib/api";
import { getConfig } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setSession } from "@/lib/session";

// Bloqueo por IP: 5 intentos fallidos => 15 minutos sin poder intentar
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const fallos = new Map<string, { n: number; hasta: number }>();

export const POST = publico(async (req) => {
  const ip = ipCliente(req);
  const f = fallos.get(ip);
  if (f && f.n >= MAX_FALLOS && f.hasta > Date.now()) {
    throw new HttpError(429, "Demasiados intentos. Espere 15 minutos.");
  }

  const { password } = await body<{ password: unknown }>(req);
  if (!verifyPassword(String(password ?? ""), getConfig().admin_password)) {
    const n = f && f.hasta > Date.now() ? f.n + 1 : 1;
    fallos.set(ip, { n, hasta: Date.now() + BLOQUEO_MS });
    await new Promise((r) => setTimeout(r, 800));
    throw new HttpError(401, "Clave incorrecta");
  }
  fallos.delete(ip);
  await setSession({ rol: "admin" });
  return { ok: true };
});
