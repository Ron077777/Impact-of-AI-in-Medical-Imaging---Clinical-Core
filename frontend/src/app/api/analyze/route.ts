import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { detail: "Missing form field 'file'." },
        { status: 400 },
      );
    }

    const upstream = new FormData();
    upstream.set("file", file, file.name);

    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: upstream,
    });

    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
