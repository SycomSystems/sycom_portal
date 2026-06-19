import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export const runtime = "nodejs"

const LOGO_META = path.join(process.cwd(), "public", "uploads", "logo-meta.json")
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

export async function GET(_req: NextRequest) {
  try {
    const meta = JSON.parse(await readFile(LOGO_META, "utf-8"))
    const filePath = path.join(UPLOAD_DIR, meta.filename)
    const fileData = await readFile(filePath)
    const ext = meta.filename.split(".").pop()?.toLowerCase() ?? ""
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      svg: "image/svg+xml", webp: "image/webp",
    }
    const contentType = contentTypeMap[ext] ?? "application/octet-stream"
    return new NextResponse(fileData, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800",
        "Last-Modified": new Date(meta.updatedAt).toUTCString(),
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
