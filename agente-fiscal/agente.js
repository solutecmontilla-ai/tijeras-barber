// Agente fiscal Tijeras: consulta al servidor los trabajos pendientes (facturas,
// reportes X/Z), los imprime en la HKA por puerto serial y reporta el resultado.
// Solo hace conexiones salientes: no requiere abrir puertos en el router.
import { readFileSync, appendFileSync } from "node:fs";
import { SerialPort } from "serialport";
import { ImpresoraHKA } from "./hka.js";

const cfg = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const INTERVALO = cfg.intervaloMs ?? 3000;

function log(...a) {
  const linea = `[${new Date().toLocaleString("es-VE")}] ${a.join(" ")}`;
  console.log(linea);
  try {
    appendFileSync(new URL("./agente.log", import.meta.url), linea + "\n");
  } catch {}
}

async function servidor(ruta, data) {
  const res = await fetch(new URL(ruta, cfg.servidor), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(data ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Servidor ${res.status}: ${json.error ?? res.statusText}`);
  return json;
}

// Extrae el numero de la ultima factura del estado S1. La posicion depende del
// modelo/firmware; se configura en config.json (s1NumeroFactura: [inicio, largo]).
function numeroFactura(s1) {
  const [ini, largo] = cfg.s1NumeroFactura ?? [21, 8];
  const n = s1.slice(ini, ini + largo).trim();
  return /^\d+$/.test(n) ? n : undefined;
}

async function procesar(imp, t) {
  // Reportes Z pueden tardar bastante mientras la impresora imprime
  const timeout = t.tipo === "reporte_z" ? 60_000 : t.tipo === "reporte_x" ? 30_000 : undefined;
  for (const c of t.comandos) await imp.enviar(c, timeout);
  if (t.tipo !== "factura") return {};
  try {
    const s1 = await imp.consultar("S1");
    return { numeroFiscal: numeroFactura(s1), detalle: { s1 } };
  } catch (e) {
    return { detalle: { s1Error: e.message } };
  }
}

async function ciclo(imp) {
  const { trabajo } = await servidor("/api/fiscal/trabajos");
  if (!trabajo) return false;
  log(`Trabajo #${trabajo.id} (${trabajo.tipo})`);
  try {
    const r = await procesar(imp, trabajo);
    await servidor(`/api/fiscal/trabajos/${trabajo.id}`, { ok: true, ...r });
    log(`Trabajo #${trabajo.id} OK ${r.numeroFiscal ?? ""}`);
  } catch (e) {
    log(`Trabajo #${trabajo.id} ERROR: ${e.message}`);
    await servidor(`/api/fiscal/trabajos/${trabajo.id}`, { ok: false, error: e.message });
  }
  return true;
}

async function main() {
  if (process.argv.includes("--puertos")) {
    for (const p of await SerialPort.list()) console.log(p.path, "-", p.friendlyName ?? p.manufacturer ?? "");
    return;
  }

  const imp = new ImpresoraHKA({ puerto: cfg.puerto, baudios: cfg.baudios, paridad: cfg.paridad, log });
  await imp.abrir();
  log(`Impresora abierta en ${cfg.puerto}`);

  if (process.argv.includes("--probar")) {
    log("Estado:", JSON.stringify(await imp.estado()));
    log("S1:", await imp.consultar("S1"));
    await imp.cerrar();
    return;
  }

  log(`Conectando a ${cfg.servidor} cada ${INTERVALO} ms`);
  for (;;) {
    try {
      // Si hubo trabajo, se consulta de inmediato el siguiente
      if (await ciclo(imp)) continue;
    } catch (e) {
      log("Error:", e.message);
    }
    await new Promise((r) => setTimeout(r, INTERVALO));
  }
}

main().catch((e) => {
  log("Fatal:", e.message);
  process.exit(1);
});
