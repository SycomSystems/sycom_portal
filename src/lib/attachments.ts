// Shared attachment helpers — used by both API routes and client components.
// Pure functions only (no server-only imports) so they can be imported anywhere.

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Allowed MIME types (images, PDF, Office docs, text/logs, archives).
export const ALLOWED_MIME_TYPES: string[] = [
  // images
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic',
  // pdf
  'application/pdf',
  // ms office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // text
  'text/plain', 'text/csv', 'text/markdown',
  // archives
  'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed',
  'application/x-rar-compressed', 'application/vnd.rar',
  // fallback for browsers that send empty type
  'application/octet-stream',
]

// Executable / script extensions we never accept, regardless of MIME type.
export const BLOCKED_EXTENSIONS: string[] = [
  'exe', 'msi', 'bat', 'cmd', 'com', 'sh', 'bash', 'ps1', 'psm1',
  'js', 'mjs', 'cjs', 'vbs', 'jar', 'app', 'deb', 'rpm', 'dmg',
  'scr', 'pif', 'reg', 'dll', 'so',
]

export function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

// Make a filesystem-safe name; keeps a readable base + extension.
export function sanitizeFilename(filename: string): string {
  const cleaned = (filename || 'subor').replace(/[^a-zA-Z0-9._-]/g, '_')
  // avoid empty / hidden names
  return cleaned.replace(/^\.+/, '').slice(0, 180) || 'subor'
}

export type FileValidationResult = { ok: true } | { ok: false; error: string }

export function validateFile(name: string, type: string, size: number): FileValidationResult {
  if (size > MAX_FILE_SIZE) {
    return { ok: false, error: `Súbor je príliš veľký (max. ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB).` }
  }
  const ext = getExtension(name)
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `Typ súboru .${ext} nie je povolený.` }
  }
  if (type && !ALLOWED_MIME_TYPES.includes(type)) {
    return { ok: false, error: 'Tento typ súboru nie je podporovaný.' }
  }
  return { ok: true }
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Accept attribute for the <input type="file"> picker.
export const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,.7z'
