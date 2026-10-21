import { body, HttpError, soloAdmin } from "@/lib/api";
import { encolar } from "@/lib/fiscal";

// Reporte X (lectura, no cierra) o Z (cierre fiscal del dia)
export const POST = soloAdmin(async (req) => {
  const { tipo } = await body<{ tipo: string }>(req);
  if (tipo === "x") return { id: encolar("reporte_x", ["I0X"]) };
  if (tipo === "z") return { id: encolar("reporte_z", ["I0Z"]) };
  throw new HttpError(400, "Tipo de reporte invalido");
});
