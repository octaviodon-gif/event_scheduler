import Link from "next/link";
import { auth, signOut } from "@/auth";

export const instant = false;

const options = [
  {
    title: "Item categories",
    description: "Define the types of items you rent, like inflables or toldos.",
    href: "/categories",
  },
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
    title: "Business settings",
    description: "Event number prefix, business name, event duration, buffer and timezone.",
    href: "/settings",
  },
];

export default async function Dashboard() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="flex items-center gap-3 text-sm"
        >
          <span className="text-neutral-500">{session?.user?.email}</span>
          <button type="submit" className="rounded-md border px-3 py-1 hover:opacity-70">
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
              className="rounded-xl border border-neutral-300 p-5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
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
