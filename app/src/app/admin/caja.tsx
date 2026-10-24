"use client";

import { useCallback, useEffect, useState } from "react";
import { diasParaCumple } from "@/lib/fechas";
import { aBs, api, dinero, duracion, fechaLocal, usd } from "@/lib/http";

type EnCola = {
  id: number;
  estado: "en_curso" | "terminada";
  inicio: string;
  barbero: string;
  cubiculo: number;
  cedula: string;
  nombre: string;
  apellido: string;
  duracionSeg: number;
  servicios: string[];
  total: number;
};
type Item = { servicio_id: number | null; nombre: string; precio: number; alicuota: string; cantidad: number };
type Detalle = {
  atencion: { id: number; cliente_id: number; estado: string; barbero: string; cubiculo: number; inicio: string; fin: string | null; duracionSeg: number; items: Item[] };
  cliente: { cedula: string; nombre: string; apellido: string; telefono: string | null; fecha_nacimiento: string | null };
  historial: { id: number; barbero: string; inicio: string; duracionSeg: number; items: Item[] }[];
};
type Servicio = { id: number; nombre: string; precio: number; activo: number };

const METODOS: Record<string, string> = {
  "01": "Efectivo Bs",
  "02": "Efectivo divisas",
  "05": "Tarjeta de débito",
  "06": "Tarjeta de crédito",
  "09": "Pago móvil",
  "10": "Transferencia",
};

export function Caja() {
  const [cola, setCola] = useState<EnCola[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [tasa, setTasa] = useState<{ tasa: number; actualizada: string | null } | null>(null);

  const cargarTasa = useCallback(() => api<{ tasa: number; actualizada: string | null }>("/api/admin/tasa").then(setTasa), []);
  useEffect(() => {
    cargarTasa();
  }, [cargarTasa]);

  const cargar = useCallback(() => api<EnCola[]>("/api/admin/cola").then(setCola).catch(() => {}), []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [cargar]);

  const enCurso = cola.filter((c) => c.estado === "en_curso");
  const terminadas = cola.filter((c) => c.estado === "terminada");

  return (
    <div className="space-y-6">
    <Tasa actual={tasa} onCambio={cargarTasa} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="space-y-6">
        <div>
          <h2 className="etiqueta">Listos para facturar ({terminadas.length})</h2>
          <div className="space-y-2">
            {terminadas.length === 0 && <p className="text-sm text-stone-500">Nada pendiente.</p>}
            {terminadas.map((c) => (
              <Fila key={c.id} c={c} activa={sel === c.id} onClick={() => setSel(c.id)} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="etiqueta">En servicio ahora ({enCurso.length})</h2>
          <div className="space-y-2">
            {enCurso.map((c) => (
              <Fila key={c.id} c={c} activa={sel === c.id} onClick={() => setSel(c.id)} />
            ))}
          </div>
        </div>
      </section>
      <section>
        {sel ? (
          <Facturar
            key={sel}
            id={sel}
            tasa={tasa?.tasa ?? 0}
            onListo={() => {
              setSel(null);
              cargar();
            }}
          />
        ) : (
          <div className="tarjeta text-stone-500">Seleccione un cliente de la lista para facturar.</div>
        )}
      </section>
    </div>
    </div>
  );
}

function Tasa({ actual, onCambio }: { actual: { tasa: number; actualizada: string | null } | null; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [error, setError] = useState("");
  if (!actual) return null;
  const sinTasa = !(actual.tasa > 0);

  return (
    <div className={`tarjeta flex flex-wrap items-center gap-4 p-4 ${sinTasa ? "border-red-300" : ""}`}>
      <div>
        <div className="etiqueta">Tasa del día (Bs por $)</div>
        <div className="text-2xl font-bold tabular-nums text-oro">
          {sinTasa ? "Sin configurar" : actual.tasa.toLocaleString("es-VE", { maximumFractionDigits: 4 })}
        </div>
        {actual.actualizada && <div className="text-xs text-stone-500">Actualizada {fechaLocal(actual.actualizada)}</div>}
      </div>
      {editando ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api("/api/admin/tasa", { tasa: valor });
              setEditando(false);
              onCambio();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <input className="campo w-40" inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} />
          <button className="btn-oro">Guardar</button>
          <button type="button" className="btn-gris" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button
          className="btn-gris"
          onClick={() => {
            setValor(sinTasa ? "" : String(actual.tasa));
            setEditando(true);
          }}
        >
          Cambiar tasa
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Fila({ c, activa, onClick }: { c: EnCola; activa: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`tarjeta block w-full p-4 text-left transition hover:border-stone-600 ${activa ? "border-oro" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {c.nombre} {c.apellido}
        </span>
        <span className={`text-sm tabular-nums ${c.estado === "en_curso" ? "text-oro" : "text-stone-400"}`}>
          ⏱ {duracion(c.duracionSeg)}
        </span>
      </div>
      <div className="mt-1 text-sm text-stone-400">
        Cub. {c.cubiculo} · {c.barbero} · {c.servicios.join(", ")}
      </div>
      <div className="mt-1 text-sm">{usd(c.total)}</div>
    </button>
  );
}

function Facturar({ id, tasa, onListo }: { id: number; tasa: number; onListo: () => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [form, setForm] = useState({ nombre: "", apellido: "", telefono: "", fechaNacimiento: "", metodoPago: "01" });
  const [items, setItems] = useState<{ servicioId: number; cantidad: number }[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [resultado, setResultado] = useState<{ estado: string; numero_fiscal: string | null } | null>(null);

  useEffect(() => {
    api<Detalle>(`/api/admin/atencion/${id}`).then((r) => {
      setD(r);
      setForm((f) => ({
        ...f,
        nombre: r.cliente.nombre,
        apellido: r.cliente.apellido,
        telefono: r.cliente.telefono ?? "",
        fechaNacimiento: r.cliente.fecha_nacimiento ?? "",
      }));
      setItems(
        r.atencion.items.filter((i) => i.servicio_id).map((i) => ({ servicioId: i.servicio_id!, cantidad: i.cantidad })),
      );
    });
    api<Servicio[]>("/api/admin/servicios").then(setServicios);
  }, [id]);

  if (!d) return <div className="tarjeta text-stone-500">Cargando…</div>;

  const precio = (sid: number) => servicios.find((s) => s.id === sid)?.precio ?? 0;
  const totalUsd = items.reduce((t, i) => t + precio(i.servicioId) * i.cantidad, 0);
  const totalBs = items.reduce((t, i) => t + aBs(precio(i.servicioId), tasa) * i.cantidad, 0);
  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm({ ...form, [k]: e.target.value });
      setGuardado(false);
    },
  });

  if (resultado) {
    return (
      <div className="tarjeta space-y-4 text-center">
        <div className="text-4xl">🧾</div>
        <div className="text-xl font-semibold">
          {resultado.estado === "impresa" ? `Factura ${resultado.numero_fiscal ?? ""} impresa` : "Factura enviada a la impresora"}
        </div>
        {resultado.estado === "pendiente" && (
          <p className="text-sm text-stone-400">El agente fiscal la imprimirá en segundos. Puede ver el estado en Facturas.</p>
        )}
        <button className="btn-oro" onClick={onListo}>
          Listo
        </button>
      </div>
    );
  }

  return (
    <div className="tarjeta space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm text-stone-400">{d.cliente.cedula}</div>
          <div className="text-xl font-bold">
            {d.cliente.nombre} {d.cliente.apellido}
          </div>
          {diasParaCumple(form.fechaNacimiento) === 0 && (
            <div className="mt-1 inline-block rounded-lg bg-red-50 px-2 py-1 text-sm font-semibold text-oro">
              🎂 ¡Hoy cumple años!
            </div>
          )}
        </div>
        <div className="text-right text-sm text-stone-400">
          Cub. {d.atencion.cubiculo} · {d.atencion.barbero}
          <div className="text-base text-oro tabular-nums">
            ⏱ {duracion(d.atencion.duracionSeg)} {d.atencion.estado === "en_curso" && "(en curso)"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="etiqueta">Nombre</span>
          <input className="campo" {...campo("nombre")} />
        </label>
        <label>
          <span className="etiqueta">Apellido</span>
          <input className="campo" {...campo("apellido")} />
        </label>
        <label>
          <span className="etiqueta">Teléfono</span>
          <input className="campo" inputMode="tel" placeholder="0414-0000000" {...campo("telefono")} />
        </label>
        <label>
          <span className="etiqueta">Fecha de nacimiento</span>
          <input className="campo" type="date" {...campo("fechaNacimiento")} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            className="btn-gris"
            disabled={enviando}
            onClick={async () => {
              setError("");
              setGuardado(false);
              setEnviando(true);
              try {
                const { nombre, apellido, telefono, fechaNacimiento } = form;
                await api("/api/admin/clientes", { id: d.atencion.cliente_id, nombre, apellido, telefono, fechaNacimiento });
                setD({ ...d, cliente: { ...d.cliente, nombre, apellido } });
                setGuardado(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setEnviando(false);
              }
            }}
          >
            Guardar cliente
          </button>
          {guardado && <span className="text-sm text-emerald-600">✓ Datos guardados</span>}
        </div>
      </div>

      <div>
        <div className="etiqueta">Consumo</div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="campo flex-1"
                value={it.servicioId}
                onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, servicioId: Number(e.target.value) } : x)))}
              >
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <input
                className="campo w-20 text-center"
                type="number"
                min={1}
                max={99}
                value={it.cantidad}
                onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, cantidad: Number(e.target.value) } : x)))}
              />
              <span className="w-36 text-right tabular-nums">
                {dinero(aBs(precio(it.servicioId), tasa) * it.cantidad)}
                <span className="block text-xs text-stone-500">{usd(precio(it.servicioId) * it.cantidad)}</span>
              </span>
              <button className="btn-gris px-3" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn-gris text-sm"
            disabled={servicios.length === 0}
            onClick={() => setItems([...items, { servicioId: servicios.find((s) => s.activo)?.id ?? servicios[0].id, cantidad: 1 }])}
          >
            + Agregar servicio o producto
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-stone-800 pt-4">
        <label className="min-w-48">
          <span className="etiqueta">Forma de pago</span>
          <select className="campo" {...campo("metodoPago")}>
            {Object.entries(METODOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="text-right">
          <div className="etiqueta">Total (IVA incl.)</div>
          <div className="text-3xl font-bold tabular-nums">{dinero(totalBs)}</div>
          <div className="text-sm text-stone-400 tabular-nums">
            {usd(totalUsd)} × {tasa.toLocaleString("es-VE", { maximumFractionDigits: 4 })}
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          className="btn-oro flex-1 py-4 text-lg"
          disabled={enviando || items.length === 0 || !(tasa > 0)}
          onClick={async () => {
            setError("");
            setEnviando(true);
            try {
              setResultado(await api("/api/admin/facturar", { atencionId: id, ...form, items, tasa }));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setEnviando(false);
            }
          }}
        >
          Facturar e imprimir
        </button>
        <button
          className="btn-rojo"
          disabled={enviando}
          onClick={async () => {
            if (!window.confirm("¿Anular esta atención sin facturar?")) return;
            await api("/api/admin/anular", { atencionId: id });
            onListo();
          }}
        >
          Anular
        </button>
      </div>

      <div>
        <div className="etiqueta">Visitas anteriores</div>
        {d.historial.length === 0 ? (
          <p className="text-sm text-stone-500">Primera visita.</p>
        ) : (
          <ul className="divide-y divide-stone-800 text-sm">
            {d.historial.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {fechaLocal(h.inicio, false)} · {h.items.map((i) => i.nombre).join(", ")}
                </span>
                <span className="text-stone-400">
                  {h.barbero} · ⏱ {duracion(h.duracionSeg)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
