import "server-only";
import { db, getConfig } from "./db";

// Comandos del protocolo The Factory HKA (Venezuela). El servidor solo arma el
// texto de cada comando; el agente fiscal agrega STX/ETX/LRC y lo envia por serial.

export type Alicuota = "G" | "R" | "A" | "E";

// Caracter de tasa que antecede cada item en la factura
const TASA_CHAR: Record<Alicuota, string> = { E: " ", G: "!", R: '"', A: "#" };

export const METODOS_PAGO = {
  "01": "Efectivo Bs",
  "02": "Efectivo divisas",
  "05": "Tarjeta de debito",
  "06": "Tarjeta de credito",
  "09": "Pago movil",
  "10": "Transferencia",
} as const;
export type MetodoPago = keyof typeof METODOS_PAGO;

// precio: centimos de Bs, IVA incluido
export type ItemFactura = { nombre: string; precio: number; alicuota: string; cantidad: number };

export function tasaPorcentaje(a: string, cfg = getConfig()): number {
  if (a === "G") return Number(cfg.iva_general);
  if (a === "R") return Number(cfg.iva_reducida);
  if (a === "A") return Number(cfg.iva_adicional);
  return 0;
}

function campo(valor: number, enteros: number, decimales: number): string {
  const n = Math.round(valor * 10 ** decimales);
  const s = String(n).padStart(enteros + decimales, "0");
  if (s.length > enteros + decimales) throw new Error(`Valor ${valor} excede el campo fiscal`);
  return s;
}

// Texto ASCII seguro para la impresora (sin acentos, maximo n caracteres)
function ascii(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, max);
}

export function comandosFactura(opts: {
  cedula: string;
  nombreCliente: string;
  telefono?: string | null;
  items: ItemFactura[];
  metodoPago: MetodoPago;
}): string[] {
  const cfg = getConfig();
  const pe = Number(cfg.fiscal_precio_enteros);
  const pd = Number(cfg.fiscal_precio_decimales);
  const ce = Number(cfg.fiscal_cant_enteros);
  const cd = Number(cfg.fiscal_cant_decimales);

  const cmds = [`iR*${ascii(opts.cedula, 20)}`, `iS*${ascii(opts.nombreCliente, 40)}`];
  if (opts.telefono) cmds.push(`i00Telefono: ${ascii(opts.telefono, 30)}`);

  for (const it of opts.items) {
    const a = (it.alicuota in TASA_CHAR ? it.alicuota : "G") as Alicuota;
    // Precios guardados con IVA incluido; la impresora recibe la base imponible
    const base = it.precio / 100 / (1 + tasaPorcentaje(a, cfg) / 100);
    cmds.push(`${TASA_CHAR[a]}${campo(base, pe, pd)}${campo(it.cantidad, ce, cd)}${ascii(it.nombre, 40)}`);
  }
  cmds.push("3"); // subtotal
  cmds.push(`1${opts.metodoPago}`); // pago total con el medio indicado: cierra la factura
  return cmds;
}

export function encolar(tipo: "factura" | "reporte_x" | "reporte_z", comandos: string[], facturaId?: number) {
  const modo = getConfig().fiscal_modo;
  if (modo === "simulador") {
    const r = db
      .prepare(
        "INSERT INTO trabajos_fiscales (tipo, factura_id, comandos, estado, resultado, actualizado) VALUES (?, ?, ?, 'ok', ?, datetime('now'))",
      )
      .run(tipo, facturaId ?? null, JSON.stringify(comandos), JSON.stringify({ simulado: true }));
    if (facturaId) {
      db.prepare("UPDATE facturas SET estado = 'impresa', numero_fiscal = ? WHERE id = ?").run(
        `SIM-${String(facturaId).padStart(8, "0")}`,
        facturaId,
      );
    }
    return Number(r.lastInsertRowid);
  }
  const r = db
    .prepare("INSERT INTO trabajos_fiscales (tipo, factura_id, comandos) VALUES (?, ?, ?)")
    .run(tipo, facturaId ?? null, JSON.stringify(comandos));
  return Number(r.lastInsertRowid);
}
