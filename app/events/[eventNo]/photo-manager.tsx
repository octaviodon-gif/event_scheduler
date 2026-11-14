"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_PHOTOS = 3;

// Shrinks a photo to max 1600px JPEG so it uploads fast and fits the 4 MB limit
async function compress(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (blob) return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    // fall through: upload the original
  }
  return file;
}

export default function PhotoManager({
  eventNo,
  photos,
}: {
  eventNo: number;
  photos: { id: number; url: string }[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const room = MAX_PHOTOS - photos.length;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const small = await compress(f);
        const fd = new FormData();
        fd.append("file", small);
        const res = await fetch(`/api/events/${eventNo}/photos`, { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "No se pudo subir la foto");
        }
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: number) {
    if (!confirm("¿Borrar esta foto?")) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/events/${eventNo}/photos?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) setError("No se pudo borrar la foto");
    else router.refresh();
  }

  return (
    <section className="mt-4 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm dark:border-neutral-700">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium">Photos of the setup</h2>
        <span className="text-xs text-neutral-500">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="Setup" className="aspect-square w-full rounded-lg object-cover" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(p.id)}
                aria-label="Delete photo"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-sm text-white hover:bg-black/80 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {room > 0 ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="mt-3 rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {busy ? "Working…" : photos.length === 0 ? "Add photos" : "Add another photo"}
          </button>
        </>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">Limit reached. Delete one to add another.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
