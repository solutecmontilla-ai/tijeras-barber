// Compartido entre servidor y navegador

// Medianoche (en UTC) del dia actual en Venezuela, que no tiene horario de verano (UTC-4)
export function hoyVenezuela(): Date {
  const d = new Date(Date.now() - 4 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Dias hasta el proximo cumpleanos (0 = hoy). Un 29/02 se celebra el 28/02 en años no bisiestos.
export function diasParaCumple(fechaNac: string | null | undefined, hoy = hoyVenezuela()): number | null {
  const m = fechaNac?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mes = Number(m[1]) - 1;
  const dia = Number(m[2]);
  const en = (anio: number) => {
    const bisiesto = new Date(Date.UTC(anio, 1, 29)).getUTCMonth() === 1;
    return Date.UTC(anio, mes, mes === 1 && dia === 29 && !bisiesto ? 28 : dia);
  };
  let t = en(hoy.getUTCFullYear());
  if (t < hoy.getTime()) t = en(hoy.getUTCFullYear() + 1);
  return Math.round((t - hoy.getTime()) / 86400_000);
}
