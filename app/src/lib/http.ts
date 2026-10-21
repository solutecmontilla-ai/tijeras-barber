// Cliente HTTP para los componentes del navegador
export async function api<T = unknown>(url: string, data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Error de conexion"), { status: res.status });
  return json as T;
}

export function dinero(centimos: number, moneda = "Bs") {
  return `${moneda} ${(centimos / 100).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Precios del catalogo: centavos de USD
export const usd = (centavos: number) => dinero(centavos, "$");

// Mismo redondeo que el servidor: precio unitario en Bs a centimos
export const aBs = (centavosUsd: number, tasa: number) => Math.round(centavosUsd * tasa);

export function duracion(seg: number) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return h ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

// Las fechas se guardan en UTC ("YYYY-MM-DD HH:MM:SS"); se muestran en hora local
export function fechaLocal(utc: string | null, conHora = true) {
  if (!utc) return "—";
  const d = new Date(utc.replace(" ", "T") + "Z");
  return conHora ? d.toLocaleString("es-VE") : d.toLocaleDateString("es-VE");
}
