"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fechaLocal } from "@/lib/http";

type Disp = { id: number; nombre: string; activo: number; creado: string; ultimo_uso: string | null };

export function Dispositivos() {
  const [datos, setDatos] = useState<{ actual: number | null; lista: Disp[] } | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(() => api<{ actual: number | null; lista: Disp[] }>("/api/admin/dispositivos").then(setDatos), []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!datos) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="tarjeta space-y-4">
        <h2 className="text-lg font-semibold">Autorizar esta tablet</h2>
        <p className="text-sm text-stone-400">
          Los barberos solo pueden entrar con su número de cubículo desde tablets autorizadas. Abra esta página en la
          tablet de la barbería, inicie sesión como admin y autorícela. Luego cierre la sesión de admin.
        </p>
        {datos.actual ? (
          <p className="rounded-xl bg-emerald-950 px-4 py-3 text-emerald-200">Este navegador ya está autorizado.</p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                await api("/api/admin/dispositivos", { accion: "autorizar", nombre });
                setNombre("");
                cargar();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <input
              className="campo flex-1"
              placeholder="Nombre (ej. Tablet recepción)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <button className="btn-oro">Autorizar</button>
          </form>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="text-lg font-semibold">Dispositivos</h2>
        {datos.lista.length === 0 && <p className="text-sm text-stone-500">Ninguno autorizado todavía.</p>}
        <ul className="divide-y divide-stone-800">
          {datos.lista.map((d) => (
            <li key={d.id} className={`flex flex-wrap items-center gap-3 py-2 ${d.activo ? "" : "opacity-40"}`}>
              <div className="flex-1">
                <div>
                  {d.nombre} {d.id === datos.actual && <span className="text-xs text-oro">(este)</span>}
                </div>
                <div className="text-xs text-stone-500">Último uso: {fechaLocal(d.ultimo_uso)}</div>
              </div>
              {d.activo ? (
                <button
                  className="btn-rojo px-3 py-1 text-sm"
                  onClick={async () => {
                    if (!window.confirm(`¿Revocar "${d.nombre}"? Los barberos no podrán entrar desde ahí.`)) return;
                    await api("/api/admin/dispositivos", { accion: "revocar", id: d.id });
                    cargar();
                  }}
                >
                  Revocar
                </button>
              ) : (
                <span className="text-xs text-stone-500">revocado</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
