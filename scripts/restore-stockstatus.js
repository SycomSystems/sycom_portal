/**
 * Obnoví stockStatus z zálohy po reprocessingu.
 * Spusti: node scripts/restore-stockstatus.js
 */
'use strict'
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const backup = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'logs', 'stockstatus-backup.json'), 'utf8'))

async function main() {
  let restored = 0, notFound = 0

  for (const entry of backup) {
    // Hľadáme zhodu: invoiceNumber + totalAmount + supplierIco (alebo supplierName)
    const where = {
      stockStatus: { in: ['na', 'pending'] }, // iba ak ešte nebol nastavený
      totalAmount: entry.totalAmount,
    }

    const candidates = await prisma.invoiceOcrResult.findMany({
      where: {
        ...where,
        OR: [
          entry.invoiceNumber ? { invoiceNumber: entry.invoiceNumber } : {},
          entry.variableSymbol ? { variableSymbol: entry.variableSymbol } : {},
          entry.supplierIco ? { supplierIco: entry.supplierIco } : {},
        ].filter(o => Object.keys(o).length > 0),
      },
      select: { id: 1, invoiceNumber: 1, supplierName: 1, stockStatus: 1 },
    })

    if (candidates.length === 0) {
      console.log(`Nenájdené: ${entry.invoiceNumber || entry.supplierName} ${entry.totalAmount}€`)
      notFound++
      continue
    }

    // Ak viac kandidátov, berieme prvého
    const match = candidates[0]
    await prisma.invoiceOcrResult.update({
      where: { id: match.id },
      data: { stockStatus: entry.stockStatus },
    })
    console.log(`Obnovené [${entry.stockStatus}]: ${match.invoiceNumber || match.supplierName} (id: ${match.id})`)
    restored++
  }

  console.log(`\nObnovených: ${restored} | Nenájdených: ${notFound}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
