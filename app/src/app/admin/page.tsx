"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { Caja } from "./caja";
import { Catalogo } from "./catalogo";
import { Clientes, Facturas } from "./listados";
import { Ajustes } from "./ajustes";
import { Dispositivos } from "./dispositivos";

const PESTANAS = {
  caja: "Por facturar",
  facturas: "Facturas",
  clientes: "Clientes",
  catalogo: "Cubículos y servicios",
  dispositivos: "Dispositivos",
  ajustes: "Impresora y ajustes",
} as const;
type Pestana = keyof typeof PESTANAS;

export default function Admin() {
  const [sesion, setSesion] = useState<boolean | null>(null);
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Pestana>("caja");

  useEffect(() => {
    api("/api/admin/cola")
      .then(() => setSesion(true))
      .catch(() => setSesion(false));
  }, []);

  if (sesion === null) return <main className="flex flex-1 items-center justify-center text-stone-500">Cargando…</main>;

  if (!sesion) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Tijeras Barber Shop" className="mx-auto h-28 w-28" />
        <h1 className="text-center text-2xl font-bold">Administración</h1>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api("/api/admin/login", { password: clave });
              setSesion(true);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <input
            className="campo"
            type="password"
            placeholder="Clave"
            autoFocus
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-oro">Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-800 px-4 py-3">
        <span className="mr-4 flex items-center gap-2 font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-8 w-8" />
          Tijeras · Admin
        </span>
        <nav className="flex flex-wrap gap-1">
          {(Object.keys(PESTANAS) as Pestana[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`btn px-3 py-1.5 text-sm ${tab === k ? "bg-oro text-white" : "text-stone-300 hover:bg-stone-800"}`}
            >
              {PESTANAS[k]}
            </button>
          ))}
        </nav>
        <button
          className="btn-gris ml-auto px-3 py-1.5 text-sm"
          onClick={async () => {
            await api("/api/salir", {});
            setSesion(false);
          }}
        >
          Salir
        </button>
      </header>
      <main className="flex-1 p-4 md:p-6">
        {tab === "caja" && <Caja />}
        {tab === "facturas" && <Facturas />}
        {tab === "clientes" && <Clientes />}
        {tab === "catalogo" && <Catalogo />}
        {tab === "dispositivos" && <Dispositivos />}
        {tab === "ajustes" && <Ajustes />}
      </main>
    </div>
  );
}
