import Image from "next/image";
import Link from "next/link";
import { landing } from "@/lib/landing-content";
import { getSettings } from "@/lib/settings";

// Public page for everyone who is not signed in. It shows no private data.
export default async function Landing() {
  const s = await getSettings();
  const name = s.businessName || "Bebecitos";

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <section className="flex flex-col items-center py-8 text-center">
        <Image src="/logo.png" alt="Bebecitos Play-gym" width={180} height={200} priority />
        <h1 className="mt-4 text-3xl font-semibold">{name}</h1>
        <p className="mt-2 max-w-xl text-lg text-neutral-700">{landing.tagline}</p>
        <p className="mt-3 max-w-xl text-sm text-neutral-500">{landing.intro}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={landing.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Síguenos en Instagram
          </a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-medium text-brand">Misión</h2>
          <p className="mt-2 text-sm text-neutral-700">{landing.mission}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-medium text-brand">Visión</h2>
          <p className="mt-2 text-sm text-neutral-700">{landing.vision}</p>
        </div>
      </section>

      <section className="mt-8 text-center">
        <h2 className="text-xl font-medium text-brand">Nuestros valores</h2>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {landing.values.map((v) => (
            <li key={v} className="rounded-full border border-violet-200 bg-white px-4 py-1.5 text-sm text-brand">
              {v}
            </li>
          ))}
        </ul>
      </section>

      {landing.photos.length > 0 && (
        <section className="mt-10">
          <h2 className="text-center text-xl font-medium text-brand">Galería</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {landing.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.src}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                className="aspect-square w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-12 flex flex-wrap items-center justify-center gap-4 border-t border-violet-100 pt-6 text-xs text-neutral-500">
        <Link href="/login" className="underline">
          Acceso del personal
        </Link>
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
      </footer>
    </main>
  );
}
