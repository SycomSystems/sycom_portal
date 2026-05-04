import { prisma } from './prisma'

export async function logAudit(
  userId: string | null,
  entityType: string,
  entityId: string,
  action: string,
  oldValue?: any,
  newValue?: any,
  ip?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        entityType,
        entityId,
        action,
        ip: ip ?? null,
        oldValue: oldValue != null ? JSON.stringify(oldValue) : null,
        newValue: newValue != null ? JSON.stringify(newValue) : null,
      },
    })
  } catch (e) {
    console.error('[audit] Failed to write audit log:', e)
  }
}
