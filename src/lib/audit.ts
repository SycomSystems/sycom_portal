import { prisma } from './prisma'

export async function logAudit(
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  oldValue?: string | null,
  newValue?: string | null
) {
  try {
    await prisma.auditLog.create({
      data: { userId, entityType, entityId, action, oldValue: oldValue ?? null, newValue: newValue ?? null },
    })
  } catch (err: any) {
    console.error('[audit] logAudit failed:', err.message)
  }
}
