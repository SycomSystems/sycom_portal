import { prisma } from './prisma'

export async function logAudit(
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  oldValue?: any,
  newValue?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        entityType,
        entityId,
        action,
        oldValue: oldValue != null ? JSON.stringify(oldValue) : null,
        newValue: newValue != null ? JSON.stringify(newValue) : null,
      },
    })
  } catch (e) {
    console.error('[audit] Failed to write audit log:', e)
  }
}
