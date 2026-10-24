"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/http";

type Estado = {
  cubiculo: { numero: number; barbero: string };
  servicios: { id: number; nombre: string }[];
  activa: { id: number; cedula: string; nombre: string; apellido: string; items: string[] } | null;
};
type Busqueda = {
  cedula: string;
  cliente: { nombre: string; apellido: string } | null;
  cumpleHoy?: boolean;
  ultimaVisita?: { fecha: string; barbero: string; servicios: string[] } | null;
};

function Teclado({ valor, onChange, max = 10 }: { valor: string; onChange: (v: string) => void; max?: number }) {
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          className="btn-gris h-16 text-2xl"
          onClick={() => {
            if (t === "⌫") onChange(valor.slice(0, -1));
            else if (t === "C") onChange("");
            else if (valor.length < max) onChange(valor + t);
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export default function Cubiculo() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [numero, setNumero] = useState("");
  const [cedula, setCedula] = useState("");
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [elegidos, setElegidos] = useState<number[]>([]);

  const refrescar = useCallback(async () => {
    try {
      const d = await api<{ autorizado: boolean }>("/api/barbero/dispositivo");
      setAutorizado(d.autorizado);
      if (!d.autorizado) return setEstado(null);
      setEstado(await api<Estado>("/api/barbero/estado"));
    } catch {
      setEstado(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  async function accion(fn: () => Promise<unknown>) {
    setError("");
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function reiniciar() {
    setCedula("");
    setBusqueda(null);
    setNombre("");
    setApellido("");
    setElegidos([]);
  }

  if (cargando) return <main className="flex flex-1 items-center justify-center text-stone-500">Cargando…</main>;

  const aviso = error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800">{error}</p>;

  if (!autorizado) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold">Dispositivo no autorizado</h1>
        <p className="text-stone-400">
          Pida al administrador que autorice esta tablet desde Administración → Dispositivos.
        </p>
        <a href="/admin" className="btn-gris">
          Ir a administración
        </a>
      </main>
    );
  }

  // 1. Ingreso con numero de cubiculo
  if (!estado) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-tijeras.svg" alt="Tijeras Barber Shop" className="mx-auto h-36 w-auto" />
        <h1 className="text-center text-2xl font-bold">Número de cubículo</h1>
        <div className="campo text-center text-5xl font-bold tracking-widest h-20 flex items-center justify-center">
          {numero || <span className="text-stone-600">—</span>}
        </div>
        {aviso}
        <Teclado valor={numero} onChange={setNumero} max={3} />
        <button
          className="btn-oro py-4 text-xl"
          disabled={!numero || ocupado}
          onClick={() =>
            accion(async () => {
              await api("/api/barbero/login", { numero });
              setNumero("");
              await refrescar();
            })
          }
        >
          Entrar
        </button>
      </main>
    );
  }

  const encabezado = (
    <header className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
      <div>
        <div className="text-sm text-stone-400">Cubículo {estado.cubiculo.numero}</div>
        <div className="text-lg font-semibold">{estado.cubiculo.barbero}</div>
      </div>
      {!estado.activa && (
        <button
          className="btn-gris text-sm"
          onClick={() =>
            accion(async () => {
              await api("/api/salir", {});
              reiniciar();
              setEstado(null);
            })
          }
        >
          Salir
        </button>
      )}
    </header>
  );

  // 4. Servicio en curso: el barbero no ve el tiempo
  if (estado.activa) {
    const a = estado.activa;
    return (
      <>
        {encabezado}
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6 text-center">
          <div className="text-sm uppercase tracking-widest text-oro">En servicio</div>
          <div className="text-3xl font-bold">
            {a.nombre} {a.apellido}
          </div>
          <div className="text-stone-400">{a.cedula}</div>
          <ul className="tarjeta space-y-1 text-left">
            {a.items.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
          {aviso}
          <button
            className="btn-oro py-6 text-2xl"
            disabled={ocupado}
            onClick={() =>
              accion(async () => {
                await api("/api/barbero/finalizar", {});
                reiniciar();
                await refrescar();
              })
            }
          >
            Finalizar servicio
          </button>
        </main>
      </>
    );
  }

  // 2. Cedula del cliente
  if (!busqueda) {
    return (
      <>
        {encabezado}
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6">
          <h1 className="text-center text-2xl font-bold">Cédula del cliente</h1>
          <div className="campo text-center text-4xl font-bold tracking-wider h-20 flex items-center justify-center">
            {cedula || <span className="text-stone-600">—</span>}
          </div>
          {aviso}
          <Teclado valor={cedula} onChange={setCedula} />
          <button
            className="btn-oro py-4 text-xl"
            disabled={cedula.length < 5 || ocupado}
            onClick={() => accion(async () => setBusqueda(await api<Busqueda>("/api/barbero/cliente", { cedula })))}
          >
            Continuar
          </button>
        </main>
      </>
    );
  }

  // 3. Datos (si es nuevo) + servicios + iniciar
  const nuevo = !busqueda.cliente;
  const listo = elegidos.length > 0 && (!nuevo || (nombre.trim() && apellido.trim()));
  return (
    <>
      {encabezado}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-stone-400">{busqueda.cedula}</div>
            <div className="text-2xl font-bold">
              {nuevo ? "Cliente nuevo" : `${busqueda.cliente!.nombre} ${busqueda.cliente!.apellido}`}
            </div>
            {busqueda.cumpleHoy && <div className="mt-1 text-lg font-semibold text-oro">🎂 ¡Hoy cumple años!</div>}
          </div>
          <button className="btn-gris text-sm" onClick={reiniciar}>
            Cambiar
          </button>
        </div>

        {busqueda.ultimaVisita && (
          <div className="tarjeta border-oro/40">
            <div className="etiqueta">Última visita · {busqueda.ultimaVisita.fecha.split("-").reverse().join("/")}</div>
            <div>{busqueda.ultimaVisita.servicios.join(", ")}</div>
            <div className="mt-1 text-sm text-stone-400">Atendido por {busqueda.ultimaVisita.barbero}</div>
          </div>
        )}

        {nuevo && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="campo" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input
              className="campo"
              placeholder="Apellido"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </div>
        )}

        <div>
          <div className="etiqueta">Servicios</div>
          <div className="grid grid-cols-2 gap-3">
            {estado.servicios.map((s) => {
              const on = elegidos.includes(s.id);
              return (
                <button
                  key={s.id}
                  className={`btn min-h-20 text-lg ${on ? "bg-oro text-white" : "bg-stone-800 hover:bg-stone-700"}`}
                  onClick={() => setElegidos(on ? elegidos.filter((x) => x !== s.id) : [...elegidos, s.id])}
                >
                  {s.nombre}
                </button>
              );
            })}
          </div>
        </div>

        {aviso}
        <button
          className="btn-oro mt-auto py-6 text-2xl"
          disabled={!listo || ocupado}
          onClick={() =>
            accion(async () => {
              await api("/api/barbero/atencion", { cedula: busqueda.cedula, nombre, apellido, servicios: elegidos });
              await refrescar();
            })
          }
        >
          Iniciar
        </button>
      </main>
    </>
  );
}
