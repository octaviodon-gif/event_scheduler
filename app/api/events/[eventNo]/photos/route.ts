import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_PHOTOS = 3;
const MAX_BYTES = 4 * 1024 * 1024; // Vercel limits request bodies to ~4.5 MB

type Ctx = { params: Promise<{ eventNo: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!(await auth())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const n = Number((await params).eventNo);
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "Evento inválido" }, { status: 400 });

  const ev = await prisma.event.findUnique({ where: { eventNo: n }, select: { eventNo: true } });
  if (!ev) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const count = await prisma.eventPhoto.count({ where: { eventNo: n } });
  if (count >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Máximo ${MAX_PHOTOS} fotos por evento` }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen es muy grande (máx. 4 MB)" }, { status: 400 });
  }

  const blob = await put(`events/${n}/photo.jpg`, file, {
    access: "public",
    addRandomSuffix: true, // makes the URL impossible to guess
    contentType: file.type,
  });
  const photo = await prisma.eventPhoto.create({ data: { eventNo: n, url: blob.url } });
  return NextResponse.json({ id: photo.id, url: photo.url });
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!(await auth())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const n = Number((await params).eventNo);
  const id = Number(new URL(req.url).searchParams.get("id"));
  const photo = await prisma.eventPhoto.findFirst({ where: { id, eventNo: n } });
  if (!photo) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  await del(photo.url);
  await prisma.eventPhoto.delete({ where: { id: photo.id } });
  return NextResponse.json({ ok: true });
}
