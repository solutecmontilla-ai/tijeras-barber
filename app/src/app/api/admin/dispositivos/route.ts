import { body, HttpError, soloAdmin, texto } from "@/lib/api";
import { db } from "@/lib/db";
import { autorizarEsteDispositivo, dispositivoActual } from "@/lib/dispositivo";

export const GET = soloAdmin(async () => {
  const actual = await dispositivoActual();
  return {
    actual: actual?.id ?? null,
    lista: db.prepare("SELECT id, nombre, activo, creado, ultimo_uso FROM dispositivos ORDER BY activo DESC, id DESC").all(),
  };
});

// accion "autorizar": registra el navegador desde el que el admin hace la solicitud
// accion "revocar": desactiva un dispositivo; sus barberos quedan fuera de inmediato
export const POST = soloAdmin(async (req) => {
  const b = await body<{ accion: string; nombre?: unknown; id?: number }>(req);
  if (b.accion === "autorizar") {
    await autorizarEsteDispositivo(texto(b.nombre, "nombre del dispositivo", 40));
    return { ok: true };
  }
  if (b.accion === "revocar") {
    const r = db.prepare("UPDATE dispositivos SET activo = 0 WHERE id = ?").run(Number(b.id));
    if (r.changes === 0) throw new HttpError(404, "Dispositivo no encontrado");
    return { ok: true };
  }
  throw new HttpError(400, "Accion invalida");
});
