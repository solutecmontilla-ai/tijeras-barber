import Link from "next/link";

export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
      <div className="text-center">
        <div className="text-5xl">✂️</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Tijeras Barbershop</h1>
      </div>
      <div className="grid w-full max-w-md gap-4">
        <Link href="/cubiculo" className="btn-oro py-6 text-xl">
          Soy barbero
        </Link>
        <Link href="/admin" className="btn-gris py-4">
          Administración
        </Link>
      </div>
    </main>
  );
}
