import { body, normalizarCedula, soloBarbero } from "@/lib/api";
import { clientePorCedula, visitas } from "@/lib/consultas";

export const POST = soloBarbero(async (req) => {
  const { cedula } = await body<{ cedula: unknown }>(req);
  const ced = normalizarCedula(cedula);
  const c = clientePorCedula(ced);
  if (!c) return { cedula: ced, cliente: null };
  const [ultima] = visitas(c.id, 1);
  return {
    cedula: ced,
    cliente: { nombre: c.nombre, apellido: c.apellido },
    ultimaVisita: ultima
      ? { fecha: ultima.inicio.slice(0, 10), barbero: ultima.barbero, servicios: ultima.items.map((i) => i.nombre) }
      : null,
  };
});
