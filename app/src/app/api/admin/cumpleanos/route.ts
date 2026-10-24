import { soloAdmin } from "@/lib/api";
import { cumpleanos } from "@/lib/consultas";

export const GET = soloAdmin(() => cumpleanos(7));
