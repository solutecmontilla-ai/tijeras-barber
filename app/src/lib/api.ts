import "server-only";
import { NextResponse } from "next/server";
import { dispositivoActual } from "./dispositivo";
import { getSession, type Session } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<S> = (req: Request, ctx: { session: S; params: Record<string, string> }) => unknown;

function wrap<S>(auth: (s: Session | null) => S | Promise<S>, fn: Handler<S>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      verificarOrigen(req);
      const session = await auth(await getSession());
      const out = await fn(req, { session, params: (await ctx?.params) ?? {} });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  };
}

// Defensa CSRF: un POST desde el navegador debe venir del mismo sitio.
// El agente fiscal no envia Origin, y se autentica con su token.
function verificarOrigen(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new HttpError(403, "Origen no permitido");
}

export function ipCliente(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export const publico = (fn: Handler<Session | null>) => wrap((s) => s, fn);

export const soloAdmin = (fn: Handler<{ rol: "admin" }>) =>
  wrap((s) => {
    if (s?.rol !== "admin") throw new HttpError(401, "Sesion de administrador requerida");
    return s;
  }, fn);

// Ademas de la sesion, exige que la tablet siga autorizada (el admin puede revocarla)
export const soloBarbero = (fn: Handler<{ rol: "barbero"; cubiculoId: number; dispositivoId: number }>) =>
  wrap(async (s) => {
    if (s?.rol !== "barbero") throw new HttpError(401, "Ingrese su numero de cubiculo");
    const d = await dispositivoActual();
    if (!d || d.id !== s.dispositivoId) throw new HttpError(403, "Dispositivo no autorizado");
    return s;
  }, fn);

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Solicitud invalida");
  }
}

export function texto(v: unknown, campo: string, max = 80): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new HttpError(400, `Falta ${campo}`);
  return s.slice(0, max);
}

export function normalizarCedula(v: unknown): string {
  const s = String(v ?? "").toUpperCase().replace(/[^VEJGP0-9]/g, "");
  const m = s.match(/^([VEJGP])?(\d{5,10})$/);
  if (!m) throw new HttpError(400, "Cedula invalida");
  return `${m[1] ?? "V"}${m[2]}`;
}
