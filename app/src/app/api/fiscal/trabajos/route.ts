import { publico } from "@/lib/api";
import { verificarAgente } from "@/lib/agente";
import { db, tx } from "@/lib/db";

// El agente pide el siguiente trabajo. Se marca "tomado" para que no se imprima dos veces;
// un trabajo tomado nunca se reentrega automaticamente (evita facturas fiscales duplicadas).
export const POST = publico((req) => {
  verificarAgente(req);
  const trabajo = tx(() => {
    const t = db
      .prepare("SELECT id, tipo, comandos FROM trabajos_fiscales WHERE estado = 'pendiente' ORDER BY id LIMIT 1")
      .get() as { id: number; tipo: string; comandos: string } | undefined;
    if (!t) return null;
    db.prepare("UPDATE trabajos_fiscales SET estado = 'tomado', actualizado = datetime('now') WHERE id = ?").run(t.id);
    return { id: t.id, tipo: t.tipo, comandos: JSON.parse(t.comandos) as string[] };
  });
  return { trabajo };
});
