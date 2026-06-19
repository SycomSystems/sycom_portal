import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
export const runtime = "nodejs"
export async function GET() {
  try {
    const data = await readFile(path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf"))
    return new NextResponse(data, { headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=31536000" } })
  } catch { return new NextResponse(null, { status: 404 }) }
}
