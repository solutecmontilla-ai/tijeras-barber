import { body, HttpError, soloAdmin } from "@/lib/api";
import { getConfig, setConfig } from "@/lib/db";

export const GET = soloAdmin(() => {
  const cfg = getConfig();
  return { tasa: Number(cfg.tasa_bs), actualizada: cfg.tasa_actualizada || null };
});

export const POST = soloAdmin(async (req) => {
  const { tasa } = await body<{ tasa: unknown }>(req);
  const n = Number(String(tasa).replace(",", "."));
  if (!(n > 0 && n < 10_000_000)) throw new HttpError(400, "Tasa invalida");
  setConfig("tasa_bs", String(Math.round(n * 10_000) / 10_000));
  setConfig("tasa_actualizada", new Date().toISOString().slice(0, 19).replace("T", " "));
  return { ok: true };
});
