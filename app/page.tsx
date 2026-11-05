import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import Landing from "./landing";

export const instant = false;

const options = [
  {
    title: "Register Purchases",
    description: "Record items you bought: quantity, provider, price and status.",
    href: "/purchases",
  },
  {
    title: "Set Setup",
    description: "Bundle purchased items into rentable sets and set their prices.",
    href: "/sets",
  },
  {
    title: "Register Customer & Event",
    description: "Book an event and send the Google Calendar invite.",
    href: "/events",
  },
  {
    title: "Ganancias",
    description: "Ingresos por mes y año, y el set más rentado.",
    href: "/profits",
  },
  {
    title: "Business settings",
    description: "Event number prefix, business name, event duration, buffer and timezone.",
    href: "/settings",
  },
];

export default async function Dashboard() {
  const session = await auth();
  if (!session) return <Landing />; // signed-out visitors see the public page

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Bebecitos Play-gym" width={58} height={64} priority />
          <h1 className="text-2xl font-semibold">Dashboard</h1>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="flex flex-wrap items-center gap-3 text-sm"
        >
          <span className="break-all text-neutral-500">{session?.user?.email}</span>
          <button type="submit" className="whitespace-nowrap rounded-md border px-3 py-1 hover:opacity-70">
            Sign out
          </button>
        </form>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {options.map((o) =>
          o.href ? (
            <Link
              key={o.title}
              href={o.href}
              className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm transition hover:border-accent hover:shadow-md"
            >
              <h2 className="font-medium">{o.title}</h2>
              <p className="mt-2 text-sm text-neutral-500">{o.description}</p>
            </Link>
          ) : (
            <div
              key={o.title}
              className="rounded-xl border border-dashed border-neutral-300 p-5 opacity-60 dark:border-neutral-700"
            >
              <h2 className="font-medium">{o.title}</h2>
              <p className="mt-2 text-sm text-neutral-500">{o.description}</p>
              <p className="mt-3 text-xs uppercase tracking-wide">Coming soon</p>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
