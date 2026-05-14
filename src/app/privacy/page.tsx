export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px', fontFamily: 'sans-serif', color: '#111' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Sycom Portal — platná od 14. 5. 2026</p>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>1. Prevádzkovateľ</h2>
      <p style={{ marginBottom: 24 }}>Sycom Systems s.r.o., Slovenská republika. Kontakt: admin@sycom.sk</p>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>2. Aké údaje zbierame</h2>
      <ul style={{ marginBottom: 24, paddingLeft: 20 }}>
        <li>Meno a emailová adresa (prihlásenie)</li>
        <li>Obsah tiketov a komentárov (IT podpora)</li>
        <li>Evidencia odpracovaných hodín</li>
        <li>Push notifikačný token zariadenia</li>
      </ul>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>3. Účel spracovania</h2>
      <p style={{ marginBottom: 24 }}>Údaje sú spracovávané výhradne za účelom poskytovania IT supportu klientom spoločnosti Sycom Systems s.r.o. Nie sú predávané tretím stranám ani používané na reklamné účely.</p>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>4. Bezpečnosť</h2>
      <p style={{ marginBottom: 24 }}>Všetka komunikácia je šifrovaná (HTTPS/TLS). Prístup majú len oprávnení zamestnanci.</p>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>5. Vaše práva</h2>
      <p style={{ marginBottom: 24 }}>Prístup, oprava alebo vymazanie údajov: admin@sycom.sk</p>
      <p style={{ color: '#888', fontSize: 13, marginTop: 48 }}>© 2026 Sycom Systems s.r.o.</p>
    </main>
  )
}
