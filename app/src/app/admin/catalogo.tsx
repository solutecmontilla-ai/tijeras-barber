"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usd } from "@/lib/http";

type Cubiculo = { id: number; numero: number; barbero: string; activo: number };
type Servicio = { id: number; nombre: string; precio: number; alicuota: string; activo: number };

const ALICUOTAS: Record<string, string> = { G: "IVA general", R: "IVA reducido", A: "IVA adicional", E: "Exento" };

export function Catalogo() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Cubiculos />
      <Servicios />
    </div>
  );
}

function useLista<T>(url: string) {
  const [lista, setLista] = useState<T[]>([]);
  const cargar = useCallback(() => api<T[]>(url).then(setLista), [url]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  return [lista, cargar] as const;
}

function Cubiculos() {
  const [lista, cargar] = useLista<Cubiculo>("/api/admin/cubiculos");
  const [form, setForm] = useState({ id: 0, numero: "", barbero: "", activo: true });
  const [error, setError] = useState("");

  return (
    <section className="tarjeta space-y-4">
      <h2 className="text-lg font-semibold">Cubículos</h2>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api("/api/admin/cubiculos", { ...form, id: form.id || undefined });
            setForm({ id: 0, numero: "", barbero: "", activo: true });
            cargar();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input
          className="campo w-24"
          placeholder="N°"
          inputMode="numeric"
          value={form.numero}
          onChange={(e) => setForm({ ...form, numero: e.target.value })}
        />
        <input
          className="campo min-w-40 flex-1"
          placeholder="Barbero"
          value={form.barbero}
          onChange={(e) => setForm({ ...form, barbero: e.target.value })}
        />
        <button className="btn-oro">{form.id ? "Guardar" : "Agregar"}</button>
        {form.id > 0 && (
          <button type="button" className="btn-gris" onClick={() => setForm({ id: 0, numero: "", barbero: "", activo: true })}>
            Cancelar
          </button>
        )}
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-stone-800">
        {lista.map((c) => (
          <li key={c.id} className={`flex items-center gap-3 py-2 ${c.activo ? "" : "opacity-40"}`}>
            <span className="w-12 text-2xl font-bold text-oro">{c.numero}</span>
            <span className="flex-1">{c.barbero}</span>
            <button
              className="btn-gris px-3 py-1 text-sm"
              onClick={() => setForm({ id: c.id, numero: String(c.numero), barbero: c.barbero, activo: !!c.activo })}
            >
              Editar
            </button>
            <button
              className="btn-gris px-3 py-1 text-sm"
              onClick={async () => {
                await api("/api/admin/cubiculos", { ...c, activo: !c.activo });
                cargar();
              }}
            >
              {c.activo ? "Desactivar" : "Activar"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Servicios() {
  const [lista, cargar] = useLista<Servicio>("/api/admin/servicios");
  const vacio = { id: 0, nombre: "", precio: "", alicuota: "G", activo: true };
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState("");

  return (
    <section className="tarjeta space-y-4">
      <h2 className="text-lg font-semibold">Servicios y productos</h2>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api("/api/admin/servicios", { ...form, id: form.id || undefined });
            setForm(vacio);
            cargar();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input
          className="campo min-w-40 flex-1"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <input
          className="campo w-32"
          placeholder="Precio $"
          inputMode="decimal"
          value={form.precio}
          onChange={(e) => setForm({ ...form, precio: e.target.value })}
        />
        <select className="campo w-40" value={form.alicuota} onChange={(e) => setForm({ ...form, alicuota: e.target.value })}>
          {Object.entries(ALICUOTAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn-oro">{form.id ? "Guardar" : "Agregar"}</button>
      </form>
      <p className="text-xs text-stone-500">Precio en dólares con IVA incluido. Se factura en bolívares a la tasa del día.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-stone-800">
        {lista.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-3 py-2 ${s.activo ? "" : "opacity-40"}`}>
            <span className="flex-1">{s.nombre}</span>
            <span className="text-xs text-stone-400">{ALICUOTAS[s.alicuota]}</span>
            <span className="w-28 text-right tabular-nums">{usd(s.precio)}</span>
            <button
              className="btn-gris px-3 py-1 text-sm"
              onClick={() =>
                setForm({ id: s.id, nombre: s.nombre, precio: String(s.precio / 100), alicuota: s.alicuota, activo: !!s.activo })
              }
            >
              Editar
            </button>
            <button
              className="btn-gris px-3 py-1 text-sm"
              onClick={async () => {
                await api("/api/admin/servicios", { ...s, precio: s.precio / 100, activo: !s.activo });
                cargar();
              }}
            >
              {s.activo ? "Desactivar" : "Activar"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
