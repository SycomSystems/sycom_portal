// prisma/seed.ts
import { PrismaClient, Role, TicketStatus, TicketPriority, TicketCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Admin user ──
  const adminPassword = await bcrypt.hash('Admin@Sycom2024!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sycom.sk' },
    update: {},
    create: {
      name: 'Admin Sycom',
      email: 'admin@sycom.sk',
      password: adminPassword,
      role: Role.ADMIN,
      department: 'IT',
    },
  })

  // ── Agent users ──
  const agentPassword = await bcrypt.hash('Agent@Sycom2024!', 12)
  const agent1 = await prisma.user.upsert({
    where: { email: 'marek.kovac@sycom.sk' },
    update: {},
    create: {
      name: 'Marek Kováč',
      email: 'marek.kovac@sycom.sk',
      password: agentPassword,
      role: Role.AGENT,
      department: 'IT',
      phone: '0948 938 217',
    },
  })

  const agent2 = await prisma.user.upsert({
    where: { email: 'jana.rybarova@sycom.sk' },
    update: {},
    create: {
      name: 'Jana Rybárová',
      email: 'jana.rybarova@sycom.sk',
      password: agentPassword,
      role: Role.AGENT,
      department: 'IT',
    },
  })

  // ── Client user ──
  const clientPassword = await bcrypt.hash('Client@2024!', 12)
  const client1 = await prisma.user.upsert({
    where: { email: 'jan.novak@firma.sk' },
    update: {},
    create: {
      name: 'Ján Novák',
      email: 'jan.novak@firma.sk',
      password: clientPassword,
      role: Role.CLIENT,
      department: 'Obchod',
    },
  })

  // ── Team ──
  const team = await prisma.team.upsert({
    where: { name: 'IT Support' },
    update: {},
    create: {
      name: 'IT Support',
      description: 'Hlavný tím technickej podpory',
      color: '#1a6fba',
    },
  })

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: agent1.id, teamId: team.id } },
    update: {},
    create: { userId: agent1.id, teamId: team.id, isLead: true },
  })

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: agent2.id, teamId: team.id } },
    update: {},
    create: { userId: agent2.id, teamId: team.id },
  })

  // ── KB Categories ──
  const kbCats = [
    { name: 'Sieť & VPN', slug: 'siet-vpn', icon: '🌐', color: '#1a6fba', sortOrder: 1 },
    { name: 'Email & Kalendár', slug: 'email-kalendar', icon: '📧', color: '#2a9d5c', sortOrder: 2 },
    { name: 'Bezpečnosť', slug: 'bezpecnost', icon: '🔐', color: '#e63946', sortOrder: 3 },
    { name: 'Hardvér', slug: 'hardver', icon: '🖥️', color: '#e9952a', sortOrder: 4 },
    { name: 'Cloud & O365', slug: 'cloud-o365', icon: '☁️', color: '#7b3fbe', sortOrder: 5 },
    { name: 'Onboarding', slug: 'onboarding', icon: '👋', color: '#1a6fba', sortOrder: 6 },
  ]

  for (const cat of kbCats) {
    await prisma.kbCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }

  // ── Sample KB Article ──
  const netCat = await prisma.kbCategory.findUnique({ where: { slug: 'siet-vpn' } })
  await prisma.kbArticle.upsert({
    where: { slug: 'nastavenie-vpn' },
    update: {},
    create: {
      title: 'Nastavenie a riešenie problémov s VPN',
      slug: 'nastavenie-vpn',
      excerpt: 'Krok za krokom sprievodca konfiguráciou firemnej VPN.',
      content: `# Nastavenie VPN

## Požiadavky
- Windows 10/11 alebo macOS 12+
- GlobalProtect klient (dostupný na IT portáli)
- Firemné prihlasovacie údaje

## Inštalácia
1. Stiahnite GlobalProtect z portálu
2. Spustite inštalátor a postupujte podľa pokynov
3. Zadajte adresu brány: **vpn.sycom.sk**
4. Prihláste sa firemným emailom a heslom

## Bežné chyby
- **Chyba 106**: Reštartujte službu a skúste znova
- **Timeout**: Skontrolujte internetové pripojenie

## Kontakt
Pre ďalšiu pomoc kontaktujte helpdesk: 0948 938 217`,
      isPublished: true,
      categoryId: netCat?.id,
      viewCount: 284,
    },
  })

  // ── Sample Tickets ──
  const slaDeadline = new Date()
  slaDeadline.setHours(slaDeadline.getHours() + 1)

  await prisma.ticket.create({
    data: {
      subject: 'VPN nefunguje po aktualizácii Windows',
      description: 'Po aktualizácii na Windows 11 build 24H2 klient GlobalProtect VPN prestalo fungovať s chybovým kódom 106.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.CRITICAL,
      category: TicketCategory.NETWORK,
      creatorId: client1.id,
      assigneeId: agent1.id,
      teamId: team.id,
      slaDeadline,
    },
  })

  await prisma.ticket.create({
    data: {
      subject: 'Outlook nesynchronizuje email',
      description: 'Outlook sa nesynchronizuje s Exchange serverom. Posledná synchronizácia bola pred 3 hodinami.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      category: TicketCategory.EMAIL,
      creatorId: client1.id,
      assigneeId: agent2.id,
      teamId: team.id,
    },
  })

  console.log('✅ Seed complete!')
  console.log('')
  console.log('📋 Login credentials:')
  console.log('  Admin:  admin@sycom.sk       / Admin@Sycom2024!')
  console.log('  Agent:  marek.kovac@sycom.sk / Agent@Sycom2024!')
  console.log('  Client: jan.novak@firma.sk   / Client@2024!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
