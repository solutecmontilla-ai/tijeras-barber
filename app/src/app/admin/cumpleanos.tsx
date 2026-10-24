"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";

type Cumple = { id: number; nombre: string; apellido: string; telefono: string | null; dias: number };

const CLAVE_AVISO = "tijeras_cumple_avisado";

// Avisa con una notificacion del navegador una sola vez al dia (si el admin la permitio)
function notificar(hoy: Cumple[]) {
  if (hoy.length === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const dia = new Date().toDateString();
  try {
    if (localStorage.getItem(CLAVE_AVISO) === dia) return;
    localStorage.setItem(CLAVE_AVISO, dia);
  } catch {
    // sin almacenamiento se avisa en cada carga
  }
  new Notification("🎂 Cumpleaños hoy", {
    body: hoy.map((c) => `${c.nombre} ${c.apellido}`).join(", "),
    icon: "/icono-tijeras.svg",
  });
}

const cuando = (dias: number) => (dias === 1 ? "mañana" : `en ${dias} días`);

export function Cumpleanos() {
  const [lista, setLista] = useState<Cumple[]>([]);
  // Seguro en el render del servidor: el componente no muestra nada hasta cargar la lista
  const [permiso, setPermiso] = useState<NotificationPermission | "no">(() =>
    typeof Notification === "undefined" ? "no" : Notification.permission,
  );

  useEffect(() => {
    api<Cumple[]>("/api/admin/cumpleanos")
      .then((l) => {
        setLista(l);
        notificar(l.filter((c) => c.dias === 0));
      })
      .catch(() => {});
  }, []);

  if (lista.length === 0) return null;
  const hoy = lista.filter((c) => c.dias === 0);
  const proximos = lista.filter((c) => c.dias > 0);

  return (
    <div className="tarjeta mb-6 space-y-2 border-oro/40 p-4">
      {hoy.length > 0 && (
        <div>
          <span className="font-semibold text-oro">🎂 Hoy cumple años: </span>
          {hoy.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <b>
                {c.nombre} {c.apellido}
              </b>
              {c.telefono && <span className="text-stone-400"> ({c.telefono})</span>}
            </span>
          ))}
        </div>
      )}
      {proximos.length > 0 && (
        <div className="text-sm text-stone-400">
          Próximos: {proximos.map((c) => `${c.nombre} ${c.apellido} (${cuando(c.dias)})`).join(" · ")}
        </div>
      )}
      {permiso === "default" && (
        <button
          className="btn-gris px-3 py-1 text-xs"
          onClick={async () => {
            const p = await Notification.requestPermission();
            setPermiso(p);
            notificar(hoy);
          }}
        >
          Activar notificaciones de cumpleaños
        </button>
      )}
    </div>
  );
}
