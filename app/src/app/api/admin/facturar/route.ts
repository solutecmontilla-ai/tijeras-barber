import { body, HttpError, soloAdmin, texto } from "@/lib/api";
import { db, getConfig, tx } from "@/lib/db";
import { comandosFactura, encolar, METODOS_PAGO, type MetodoPago } from "@/lib/fiscal";

type Entrada = {
  atencionId: number;
  nombre: unknown;
  apellido: unknown;
  telefono?: unknown;
  fechaNacimiento?: unknown;
  metodoPago: unknown;
  tasa: unknown; // la que vio el admin en pantalla; debe coincidir con la vigente
  items: { servicioId: number; cantidad: number }[];
};

export const POST = soloAdmin(async (req) => {
  const b = await body<Entrada>(req);
  const metodo = String(b.metodoPago) as MetodoPago;
  if (!(metodo in METODOS_PAGO)) throw new HttpError(400, "Metodo de pago invalido");

  const telefono = typeof b.telefono === "string" ? b.telefono.trim().slice(0, 20) || null : null;
  const fechaNac =
    typeof b.fechaNacimiento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fechaNacimiento) ? b.fechaNacimiento : null;
  const nombre = texto(b.nombre, "nombre", 40);
  const apellido = texto(b.apellido, "apellido", 40);

  // El admin puede ajustar servicios y cantidades antes de facturar
  const items = (Array.isArray(b.items) ? b.items : []).map((it) => {
    const s = db.prepare("SELECT id, nombre, precio, alicuota FROM servicios WHERE id = ?").get(Number(it.servicioId)) as
      | { id: number; nombre: string; precio: number; alicuota: string }
      | undefined;
    const cantidad = Math.floor(Number(it.cantidad));
    if (!s || !(cantidad >= 1 && cantidad <= 99)) throw new HttpError(400, "Item invalido");
    return { ...s, cantidad };
  });
  if (items.length === 0) throw new HttpError(400, "La factura no tiene items");

  const tasa = Number(getConfig().tasa_bs);
  if (!(tasa > 0)) throw new HttpError(400, "Configure la tasa del dia antes de facturar");
  if (Number(b.tasa) !== tasa) throw new HttpError(409, "La tasa cambio. Revise el total antes de facturar.");
  // Precio unitario en Bs redondeado a centimos: es lo que imprime la fiscal
  const itemsBs = items.map((it) => ({ ...it, precio: Math.round(it.precio * tasa) }));

  const facturaId = tx(() => {
    const a = db
      .prepare("SELECT id, cliente_id, estado FROM atenciones WHERE id = ?")
      .get(Number(b.atencionId)) as { id: number; cliente_id: number; estado: string } | undefined;
    if (!a) throw new HttpError(404, "Atencion no encontrada");
    if (a.estado === "facturada") throw new HttpError(409, "Esta atencion ya fue facturada");
    if (a.estado === "anulada") throw new HttpError(409, "Esta atencion fue anulada");

    db.prepare(
      "UPDATE clientes SET nombre = ?, apellido = ?, telefono = ?, fecha_nacimiento = ? WHERE id = ?",
    ).run(nombre, apellido, telefono, fechaNac, a.cliente_id);

    db.prepare("DELETE FROM atencion_items WHERE atencion_id = ?").run(a.id);
    const ins = db.prepare(
      "INSERT INTO atencion_items (atencion_id, servicio_id, nombre, precio, alicuota, cantidad) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const it of items) ins.run(a.id, it.id, it.nombre, it.precio, it.alicuota, it.cantidad);

    const totalUsd = items.reduce((t, i) => t + i.precio * i.cantidad, 0);
    const totalBs = itemsBs.reduce((t, i) => t + i.precio * i.cantidad, 0);
    const f = db
      .prepare("INSERT INTO facturas (cliente_id, total_usd, tasa, total, metodo_pago) VALUES (?, ?, ?, ?, ?)")
      .run(a.cliente_id, totalUsd, tasa, totalBs, metodo);
    const id = Number(f.lastInsertRowid);
    db.prepare(
      "UPDATE atenciones SET estado = 'facturada', factura_id = ?, fin = coalesce(fin, strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?",
    ).run(id, a.id);

    const { cedula } = db.prepare("SELECT cedula FROM clientes WHERE id = ?").get(a.cliente_id) as { cedula: string };
    encolar(
      "factura",
      comandosFactura({ cedula, nombreCliente: `${nombre} ${apellido}`, telefono, items: itemsBs, metodoPago: metodo }),
      id,
    );
    return id;
  });

  return db.prepare("SELECT id, estado, numero_fiscal, total FROM facturas WHERE id = ?").get(facturaId);
});
