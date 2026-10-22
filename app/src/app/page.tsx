import Link from "next/link";

export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Tijeras Barber Shop" className="h-56 w-auto" />
        <p className="mt-4 text-lg font-semibold tracking-wide text-stone-300">¡Tu escape, tu momento!</p>
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
