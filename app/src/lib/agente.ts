import "server-only";
import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./api";
import { getConfig } from "./db";

// El agente fiscal se autentica con "Authorization: Bearer <fiscal_token>"
export function verificarAgente(req: Request) {
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(getConfig().fiscal_token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "Token de agente invalido");
  }
}
