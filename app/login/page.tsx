import Image from "next/image";
import { signIn } from "@/auth";
import { getSettings } from "@/lib/settings";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const s = await getSettings();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-violet-200 bg-white p-8 text-center shadow-sm">
        <Image src="/logo.png" alt="Bebecitos Play-gym" width={144} height={160} priority className="mx-auto" />
        <h1 className="mt-4 text-2xl font-semibold">{s.businessName || "Event Scheduler"}</h1>
        <p className="mt-2 text-sm text-neutral-500">Sign in to manage your rentals.</p>

        {error && (
          <p className="mt-4 rounded-md bg-red-100 p-3 text-sm text-red-800">
            {error === "AccessDenied"
              ? "That Google account is not allowed to use this app."
              : "Sign-in failed. Please try again."}
          </p>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-brand px-4 py-2 text-white hover:opacity-80"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
