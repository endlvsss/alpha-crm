import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-mono text-xs tracking-[0.14em] text-accent-ink uppercase">404</p>
      <h1 className="font-display text-2xl font-bold">No encontramos ese registro</h1>
      <Link href="/" className="text-sm text-accent-ink underline">Volver al inicio</Link>
    </main>
  );
}
