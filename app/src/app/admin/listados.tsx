"use client";

import { useCallback, useEffect, useState } from "react";
import { diasParaCumple } from "@/lib/fechas";
import { api, dinero, fechaLocal, usd } from "@/lib/http";

type Factura = {
  id: number;
  fecha: string;
  total: number;
  total_usd: number;
  tasa: number;
  metodo_pago: string;
  estado: "pendiente" | "impresa" | "error";
  numero_fiscal: string | null;
  error: string | null;
  cedula: string;
  nombre: string;
  apellido: string;
};

const COLOR_ESTADO = { pendiente: "text-amber-600", impresa: "text-emerald-600", error: "text-red-600" };

export function Facturas() {
  const [lista, setLista] = useState<Factura[]>([]);
  const cargar = useCallback(() => api<Factura[]>("/api/admin/facturas").then(setLista).catch(() => {}), []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [cargar]);

  return (
    <div className="tarjeta overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="text-left text-stone-400">
          <tr className="border-b border-stone-800">
            <th className="p-3">#</th>
            <th className="p-3">Fecha</th>
            <th className="p-3">Cliente</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3">N° fiscal</th>
            <th className="p-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((f) => (
            <tr key={f.id} className="border-b border-stone-800/60">
              <td className="p-3 text-stone-500">{f.id}</td>
              <td className="p-3 whitespace-nowrap">{fechaLocal(f.fecha)}</td>
              <td className="p-3">
                {f.nombre} {f.apellido} <span className="text-stone-500">{f.cedula}</span>
              </td>
              <td className="p-3 text-right tabular-nums">
                {dinero(f.total)}
                <div className="text-xs text-stone-500">
                  {usd(f.total_usd)} · tasa {f.tasa.toLocaleString("es-VE")}
                </div>
              </td>
              <td className="p-3">{f.numero_fiscal ?? "—"}</td>
              <td className={`p-3 ${COLOR_ESTADO[f.estado]}`}>
                {f.estado}
                {f.error && <div className="text-xs text-red-700">{f.error}</div>}
                {f.estado === "error" && (
                  <button
                    className="btn-gris mt-1 px-2 py-1 text-xs"
                    onClick={async () => {
                      if (!window.confirm("Verifique que la impresora NO emitió esta factura antes de reintentar. ¿Reintentar?"))
                        return;
                      await api("/api/admin/facturas", { facturaId: f.id });
                      cargar();
                    }}
                  >
                    Reintentar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lista.length === 0 && <p className="p-5 text-stone-500">Aún no hay facturas.</p>}
    </div>
  );
}

type Cliente = {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  ultima_visita: string | null;
  visitas: number;
};

export function Clientes() {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Cliente[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const buscar = useCallback(() => api<Cliente[]>(`/api/admin/clientes?q=${encodeURIComponent(q)}`).then(setLista), [q]);
  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  return (
    <div className="space-y-4">
      <input className="campo max-w-md" placeholder="Buscar por cédula o nombre" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tarjeta overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-400">
            <tr className="border-b border-stone-800">
              <th className="p-3">Cédula</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Nacimiento</th>
              <th className="p-3">Última visita</th>
              <th className="p-3 text-right">Visitas</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) =>
              editando === c.id ? (
                <EditarCliente
                  key={c.id}
                  c={c}
                  onCerrar={(cambio) => {
                    setEditando(null);
                    if (cambio) buscar();
                  }}
                />
              ) : (
                <tr key={c.id} className="border-b border-stone-800/60">
                  <td className="p-3">{c.cedula}</td>
                  <td className="p-3">
                    {c.nombre} {c.apellido} {diasParaCumple(c.fecha_nacimiento) === 0 && <span title="Hoy cumple años">🎂</span>}
                  </td>
                  <td className="p-3">{c.telefono ?? "—"}</td>
                  <td className="p-3">{c.fecha_nacimiento?.split("-").reverse().join("/") ?? "—"}</td>
                  <td className="p-3">{fechaLocal(c.ultima_visita, false)}</td>
                  <td className="p-3 text-right">{c.visitas}</td>
                  <td className="p-3 text-right">
                    <button className="btn-gris px-3 py-1 text-xs" onClick={() => setEditando(c.id)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditarCliente({ c, onCerrar }: { c: Cliente; onCerrar: (cambio: boolean) => void }) {
  const [form, setForm] = useState({
    cedula: c.cedula,
    nombre: c.nombre,
    apellido: c.apellido,
    telefono: c.telefono ?? "",
    fechaNacimiento: c.fecha_nacimiento ?? "",
  });
  const [error, setError] = useState("");
  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <tr className="border-b border-stone-800/60 bg-stone-900">
      <td colSpan={7} className="p-3">
        <form
          className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api("/api/admin/clientes", { id: c.id, ...form });
              onCerrar(true);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <input className="campo" placeholder="Cédula" {...campo("cedula")} />
          <input className="campo" placeholder="Nombre" {...campo("nombre")} />
          <input className="campo" placeholder="Apellido" {...campo("apellido")} />
          <input className="campo" placeholder="Teléfono" inputMode="tel" {...campo("telefono")} />
          <input className="campo" type="date" {...campo("fechaNacimiento")} />
          <div className="flex gap-2">
            <button className="btn-oro flex-1">Guardar</button>
            <button type="button" className="btn-gris" onClick={() => onCerrar(false)}>
              ✕
            </button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
