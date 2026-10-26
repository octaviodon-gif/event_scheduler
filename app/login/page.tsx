import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-300 p-8 text-center dark:border-neutral-700">
        <h1 className="text-2xl font-semibold">Event Scheduler</h1>
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
            className="w-full rounded-md bg-black px-4 py-2 text-white hover:opacity-80 dark:bg-white dark:text-black"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
