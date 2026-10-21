import { randomBytes } from "node:crypto";
import { body, HttpError, soloAdmin } from "@/lib/api";
import { db, getConfig, setConfig } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const EDITABLES = [
  "negocio_nombre",
  "iva_general",
  "iva_reducida",
  "iva_adicional",
  "fiscal_modo",
  "fiscal_precio_enteros",
  "fiscal_precio_decimales",
  "fiscal_cant_enteros",
  "fiscal_cant_decimales",
];

export const GET = soloAdmin(() => {
  const cfg = getConfig();
  const ultimo = db
    .prepare("SELECT max(actualizado) AS t FROM trabajos_fiscales WHERE estado IN ('ok', 'error', 'tomado')")
    .get() as { t: string | null };
  return {
    ...Object.fromEntries(EDITABLES.map((k) => [k, cfg[k]])),
    fiscal_token: cfg.fiscal_token,
    agente_ultima_actividad: ultimo.t,
  };
});

export const POST = soloAdmin(async (req) => {
  const b = await body<Record<string, unknown>>(req);
  for (const k of EDITABLES) if (typeof b[k] === "string") setConfig(k, b[k]);
  if (typeof b.nueva_clave === "string") {
    if (b.nueva_clave.length < 6) throw new HttpError(400, "La clave debe tener al menos 6 caracteres");
    setConfig("admin_password", hashPassword(b.nueva_clave));
  }
  if (b.regenerar_token === true) setConfig("fiscal_token", randomBytes(24).toString("base64url"));
  return { ok: true };
});
