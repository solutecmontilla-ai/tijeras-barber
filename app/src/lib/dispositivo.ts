import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { cookieSegura } from "./session";

// Cookie de larga duracion que identifica una tablet autorizada por el admin.
// Sin ella no se puede ingresar con numero de cubiculo.
const COOKIE = "tijeras_dispositivo";
const UN_ANO = 60 * 60 * 24 * 365;

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function dispositivoActual(): Promise<{ id: number; nombre: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const d = db
    .prepare("SELECT id, nombre FROM dispositivos WHERE token_hash = ? AND activo = 1")
    .get(hash(token)) as { id: number; nombre: string } | undefined;
  if (!d) return null;
  db.prepare("UPDATE dispositivos SET ultimo_uso = datetime('now') WHERE id = ?").run(d.id);
  return d;
}

export async function autorizarEsteDispositivo(nombre: string) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO dispositivos (nombre, token_hash) VALUES (?, ?)").run(nombre, hash(token));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSegura(),
    path: "/",
    maxAge: UN_ANO,
  });
}
