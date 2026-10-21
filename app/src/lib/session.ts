import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getConfig } from "./db";

export type Session = { rol: "admin" } | { rol: "barbero"; cubiculoId: number; dispositivoId: number };

const COOKIE = "tijeras_sesion";

// Activar con COOKIE_SECURE=true cuando el sitio se sirva por HTTPS
export const cookieSegura = () => process.env.COOKIE_SECURE === "true";

function sign(payload: string): string {
  return createHmac("sha256", getConfig().session_secret).update(payload).digest("base64url");
}

export async function setSession(s: Session) {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSegura(),
    path: "/",
    maxAge: 60 * 60 * 14, // una jornada
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}
