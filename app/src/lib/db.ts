import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./password";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cubiculos (
  id INTEGER PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  barbero TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1
);

-- alicuota: G = general, R = reducida, A = adicional/lujo, E = exento
CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio INTEGER NOT NULL,           -- centavos de USD, IVA incluido
  alicuota TEXT NOT NULL DEFAULT 'G',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY,
  cedula TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT,
  fecha_nacimiento TEXT,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

-- estado: en_curso -> terminada -> facturada | anulada
CREATE TABLE IF NOT EXISTS atenciones (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  cubiculo_id INTEGER NOT NULL REFERENCES cubiculos(id),
  barbero TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'en_curso',
  inicio TEXT NOT NULL,
  fin TEXT,
  factura_id INTEGER REFERENCES facturas(id)
);

CREATE TABLE IF NOT EXISTS atencion_items (
  id INTEGER PRIMARY KEY,
  atencion_id INTEGER NOT NULL REFERENCES atenciones(id) ON DELETE CASCADE,
  servicio_id INTEGER REFERENCES servicios(id),
  nombre TEXT NOT NULL,
  precio INTEGER NOT NULL,           -- centavos de USD
  alicuota TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1
);

-- estado: pendiente (esperando al agente) | impresa | error
CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  total_usd INTEGER NOT NULL,        -- centavos de USD
  tasa REAL NOT NULL,                -- Bs por USD aplicada en esta factura
  total INTEGER NOT NULL,            -- centimos de Bs (lo que imprime la fiscal)
  metodo_pago TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  numero_fiscal TEXT,
  error TEXT
);

-- Cola que consume el agente fiscal instalado en la PC de caja.
-- tipo: factura | reporte_x | reporte_z ; estado: pendiente | tomado | ok | error
CREATE TABLE IF NOT EXISTS trabajos_fiscales (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  factura_id INTEGER REFERENCES facturas(id),
  comandos TEXT NOT NULL,            -- JSON: lista de comandos HKA (sin STX/ETX/LRC)
  estado TEXT NOT NULL DEFAULT 'pendiente',
  resultado TEXT,
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado TEXT
);

-- Tablets autorizadas por el admin para el ingreso de barberos.
-- Se guarda solo el hash del token; la cookie del dispositivo lleva el token.
CREATE TABLE IF NOT EXISTS dispositivos (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_uso TEXT
);

CREATE INDEX IF NOT EXISTS idx_atenciones_estado ON atenciones(estado);
CREATE INDEX IF NOT EXISTS idx_atenciones_cliente ON atenciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_trabajos_estado ON trabajos_fiscales(estado);
`;

const DEFAULTS: Record<string, string> = {
  negocio_nombre: "Tijeras Barbershop",
  iva_general: "16",
  iva_reducida: "8",
  iva_adicional: "31",
  // Bs por USD. Los precios se definen en USD y se facturan en Bs a esta tasa.
  tasa_bs: "0",
  tasa_actualizada: "",
  // simulador: la factura se marca impresa sin agente. agente: espera al agente fiscal.
  fiscal_modo: "simulador",
  // ancho de campos de la trama de item (protocolo HKA clasico 8+2 / 5+3)
  fiscal_precio_enteros: "8",
  fiscal_precio_decimales: "2",
  fiscal_cant_enteros: "5",
  fiscal_cant_decimales: "3",
};

function open(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "barberia.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);

  const insert = db.prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULTS)) insert.run(k, v);
  insert.run("session_secret", randomBytes(32).toString("hex"));
  const clave = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === "production" ? undefined : "admin");
  if (!clave) throw new Error("Defina ADMIN_PASSWORD para crear la base de datos en produccion");
  insert.run("admin_password", hashPassword(clave));
  insert.run("fiscal_token", randomBytes(24).toString("base64url"));

  const { n } = db.prepare("SELECT count(*) AS n FROM servicios").get() as { n: number };
  if (n === 0) {
    // Lista de precios de Tijeras Barber Shop (Ref. = USD)
    const s = db.prepare("INSERT INTO servicios (nombre, precio, activo) VALUES (?, ?, ?)");
    s.run("Corte", 12_00, 1);
    s.run("Barba", 12_00, 1);
    s.run("Corte + barba", 18_00, 1);
    s.run("Limpieza facial", 21_00, 1);
    s.run("Cirugía capilar", 0, 0); // precio por definir: el admin lo activa al fijarlo
    s.run("Masaje capilar", 2_00, 1);
    s.run("Lavado capilar", 3_00, 1);
    s.run("Cera depiladora", 3_00, 1);
  }
  return db;
}

// La conexion se abre al primer uso (no durante el build) y se reutiliza entre recargas
const g = globalThis as unknown as { __db?: DatabaseSync };
export const db = new Proxy({} as DatabaseSync, {
  get(_, prop) {
    const real = (g.__db ??= open());
    const v = Reflect.get(real, prop);
    return typeof v === "function" ? v.bind(real) : v;
  },
});

export function getConfig(): Record<string, string> {
  const rows = db.prepare("SELECT clave, valor FROM config").all() as { clave: string; valor: string }[];
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

export function setConfig(clave: string, valor: string) {
  db.prepare(
    "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
  ).run(clave, valor);
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
