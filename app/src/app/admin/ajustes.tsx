"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fechaLocal } from "@/lib/http";

type Config = Record<string, string | null>;

export function Ajustes() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [clave, setClave] = useState("");
  const [msg, setMsg] = useState("");
  const [verToken, setVerToken] = useState(false);

  const cargar = useCallback(() => api<Config>("/api/admin/config").then(setCfg), []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!cfg) return null;

  async function guardar(extra: Record<string, unknown> = {}) {
    setMsg("");
    try {
      await api("/api/admin/config", { ...cfg, ...extra });
      setMsg("Guardado");
      cargar();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const campo = (k: string) => ({ value: cfg[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCfg({ ...cfg, [k]: e.target.value }) });

  async function reporte(tipo: "x" | "z") {
    if (tipo === "z" && !window.confirm("El reporte Z cierra el día fiscal. ¿Continuar?")) return;
    await api("/api/admin/reporte", { tipo });
    setMsg(`Reporte ${tipo.toUpperCase()} enviado a la impresora`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="tarjeta space-y-4">
        <h2 className="text-lg font-semibold">Impresora fiscal (The Factory HKA)</h2>
        <label className="block">
          <span className="etiqueta">Modo</span>
          <select className="campo" {...campo("fiscal_modo")}>
            <option value="simulador">Simulador (sin impresora, para pruebas)</option>
            <option value="agente">Agente fiscal en la PC de caja</option>
          </select>
        </label>
        <div className="rounded-xl bg-stone-950 p-4 text-sm">
          <div className="etiqueta">Token del agente</div>
          <code className="break-all text-oro">{verToken ? cfg.fiscal_token : "••••••••••••••••"}</code>
          <div className="mt-2 flex gap-2">
            <button className="btn-gris px-3 py-1 text-xs" onClick={() => setVerToken(!verToken)}>
              {verToken ? "Ocultar" : "Mostrar"}
            </button>
            <button
              className="btn-gris px-3 py-1 text-xs"
              onClick={() => window.confirm("El agente dejará de funcionar hasta que actualice su token. ¿Regenerar?") && guardar({ regenerar_token: true })}
            >
              Regenerar
            </button>
          </div>
          <div className="mt-3 text-stone-400">
            Última actividad del agente: {fechaLocal(cfg.agente_ultima_actividad)}
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-400">Formato de tramas (avanzado)</summary>
          <p className="my-2 text-stone-500">
            Dígitos de precio y cantidad en el comando de item. Protocolo clásico: 8+2 y 5+3. Ajustar según el modelo.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {["fiscal_precio_enteros", "fiscal_precio_decimales", "fiscal_cant_enteros", "fiscal_cant_decimales"].map((k) => (
              <label key={k}>
                <span className="etiqueta">{k.replace("fiscal_", "").replace("_", " ")}</span>
                <input className="campo" inputMode="numeric" {...campo(k)} />
              </label>
            ))}
          </div>
        </details>
        <div className="flex flex-wrap gap-2 border-t border-stone-800 pt-4">
          <button className="btn-gris" onClick={() => reporte("x")}>
            Reporte X
          </button>
          <button className="btn-rojo" onClick={() => reporte("z")}>
            Reporte Z (cierre)
          </button>
        </div>
      </section>

      <section className="tarjeta space-y-4">
        <h2 className="text-lg font-semibold">Negocio</h2>
        <label className="block">
          <span className="etiqueta">Nombre</span>
          <input className="campo" {...campo("negocio_nombre")} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className="etiqueta">IVA general %</span>
            <input className="campo" inputMode="decimal" {...campo("iva_general")} />
          </label>
          <label>
            <span className="etiqueta">IVA reducido %</span>
            <input className="campo" inputMode="decimal" {...campo("iva_reducida")} />
          </label>
          <label>
            <span className="etiqueta">IVA adicional %</span>
            <input className="campo" inputMode="decimal" {...campo("iva_adicional")} />
          </label>
        </div>
        <label className="block">
          <span className="etiqueta">Nueva clave de administrador</span>
          <input className="campo" type="password" value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        <button
          className="btn-oro"
          onClick={() => {
            guardar(clave ? { nueva_clave: clave } : {});
            setClave("");
          }}
        >
          Guardar ajustes
        </button>
        {msg && <p className="text-sm text-stone-300">{msg}</p>}
      </section>
    </div>
  );
}
