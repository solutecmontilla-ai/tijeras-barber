import { publico } from "@/lib/api";
import { clearSession } from "@/lib/session";

export const POST = publico(async () => {
  await clearSession();
  return { ok: true };
});
