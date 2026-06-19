# Automatické rozpoznávanie faktúr — implementácia
> Zdokumentované z projektu portal-pepe (máj 2026). Pripravené na prenos do portal_sycom.

## Prehľad architektúry

```
Email (IMAP) → Celery task → pdfplumber → regex/GPT-4o-mini → DB
                                                              ├── invoice_ocr_results
                                                              ├── received_email_logs
                                                              ├── ai_api_logs
                                                              ├── financial_documents (schválenie)
                                                              └── materials / stock_movements (sklad)
```

---

## 1. Závislosti

Do `requirements.txt` pridať:
```
pdfplumber==0.11.4
openai==1.54.3        # len pre verziu, HTTP voláme priamo cez httpx
```
`httpx` musí byť už v projekte.

---

## 2. Nové DB tabuľky

### `invoice_ocr_results`
```sql
CREATE TABLE invoice_ocr_results (
    id                    SERIAL PRIMARY KEY,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    direction             VARCHAR(20),           -- 'dodavatel' | 'odberatel'
    supplier_name         VARCHAR(300),
    supplier_ico          VARCHAR(20),
    customer_name         VARCHAR(300),
    customer_ico          VARCHAR(20),
    invoice_number        VARCHAR(100),
    variable_symbol       VARCHAR(100),
    total_amount          NUMERIC(14,2),
    due_date              VARCHAR(30),
    items                 TEXT,                  -- JSON pole položiek
    source_email          VARCHAR(255),
    filename              VARCHAR(300),
    recognition_method    VARCHAR(20),           -- 'regex' | 'openai'
    error                 TEXT,
    financial_document_id INTEGER REFERENCES financial_documents(id) ON DELETE SET NULL,
    is_duplicate          BOOLEAN NOT NULL DEFAULT false,
    duplicate_of_id       INTEGER REFERENCES invoice_ocr_results(id) ON DELETE SET NULL
);
CREATE INDEX ix_invoice_ocr_results_created_at ON invoice_ocr_results(created_at);
```

### `received_email_logs`
```sql
CREATE TABLE received_email_logs (
    id                    SERIAL PRIMARY KEY,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    from_email            VARCHAR(255) NOT NULL,
    subject               VARCHAR(255) NOT NULL DEFAULT '',
    filename              VARCHAR(300),
    status                VARCHAR(20) NOT NULL DEFAULT 'processed',
    error                 TEXT,
    invoice_ocr_result_id INTEGER REFERENCES invoice_ocr_results(id) ON DELETE SET NULL
);
CREATE INDEX ix_received_email_logs_created_at ON received_email_logs(created_at);
```

### `ai_api_logs`
```sql
CREATE TABLE ai_api_logs (
    id                    SERIAL PRIMARY KEY,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    model                 VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini',
    prompt_tokens         INTEGER,
    completion_tokens     INTEGER,
    cost_usd              FLOAT,
    request_preview       TEXT,
    response_preview      TEXT,
    invoice_ocr_result_id INTEGER REFERENCES invoice_ocr_results(id) ON DELETE SET NULL,
    error                 TEXT
);
CREATE INDEX ix_ai_api_logs_created_at ON ai_api_logs(created_at);
```

---

## 3. `system_settings` kľúče

### IMAP (pridať do existujúceho Email tabu v Nastaveniach)
| Kľúč | Príklad |
|---|---|
| `imap_host` | `imap.websupport.sk` |
| `imap_port` | `993` |
| `imap_user` | `portal@firma.sk` |
| `imap_password` | heslo (maskovať ako `***`) |
| `imap_mailbox` | `INBOX` |

### OpenAI (nový tab Faktúry / AI)
| Kľúč | Popis |
|---|---|
| `openai_api_key` | API kľúč (maskovať) |
| `openai_credit_threshold` | prah upozornenia v EUR |
| `openai_credit_notify_users` | čiarkou oddelené ID userov |

---

## 4. Backend — nové súbory

### `services/imap_service.py`
```python
import imaplib, email
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def get_imap_config(db: AsyncSession) -> dict | None:
    keys = ["imap_host", "imap_port", "imap_user", "imap_password", "imap_mailbox"]
    result = await db.execute(select(SystemSetting).where(SystemSetting.key.in_(keys)))
    rows = {r.key: r.value for r in result.scalars().all()}
    if not rows.get("imap_host") or not rows.get("imap_user") or not rows.get("imap_password"):
        return None
    return {
        "host":     rows.get("imap_host", ""),
        "port":     int(rows.get("imap_port", "993")),
        "user":     rows.get("imap_user", ""),
        "password": rows.get("imap_password", ""),
        "mailbox":  rows.get("imap_mailbox") or "INBOX",  # POZOR: `or`, nie default parameter!
    }

class IMAPService:
    def connect(self, host, port, user, password):
        self._conn = imaplib.IMAP4_SSL(host, port)
        self._conn.login(user, password)

    def fetch_unread_with_attachments(self, mailbox="INBOX"):
        # Vráti len emaily s PDF prílohami
        # [{uid, sender, subject, attachments:[{filename, data}]}]
        self._conn.select(mailbox)
        _, uids_raw = self._conn.search(None, "UNSEEN")
        # ... iteruj, parsuj email.message_from_bytes, filter PDF content-type

    def mark_as_read(self, uid):
        self._conn.store(uid, "+FLAGS", "\\Seen")
```

**GOTCHA:** `rows.get("imap_mailbox") or "INBOX"` — nie `rows.get("imap_mailbox", "INBOX")`.
Prázdny string `""` zo DB obíde default parameter, ale `or "INBOX"` ho zachytí.

---

### `services/invoice_parser.py`

**Krok 1 — pdfplumber:**
```python
import pdfplumber, io

def extract_text(pdf_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)
```

**Krok 2 — regex parser:**
Extrahuje: číslo faktúry, variabilný symbol, celkovú sumu, dátum splatnosti, dodávateľa, odberateľa, IČO.
`_complete = True` ak ≥ 3 z 5 hlavných polí vyplnené → ak False, ide do OpenAI.

IČO regex: `r"IČO[:\s]+(\d{6,12})"` + čistenie `re.sub(r"[^\d]", "", raw)`.

VS fallback: ak `variable_symbol` chýba, použiť `invoice_number`.

**Krok 3 — OpenAI (ak regex nestačí):**
```python
async def parse_openai(text: str, db: AsyncSession) -> tuple[dict, int | None]:
    # Vracia (parsed_dict, ai_log_id)
    # ai_log_id treba na FK update po flush() OCR result!
    prompt = (
        "Extrahuj z faktúry ako JSON: supplier_name, supplier_ico, customer_name, "
        "customer_ico, invoice_number, variable_symbol, total_amount, due_date, "
        "items[{name,qty,unit,unit_price,total}]. Ak pole chýba → null."
    )
    # POST /v1/chat/completions, model=gpt-4o-mini, temperature=0, response_format=json_object
    # Zapiš AiApiLog PRED volaním, updatuj ho PO — tokeny, cena, preview
```

Cena: `0.15 / 1_000_000` (input) + `0.60 / 1_000_000` (output) USD/token.

**Krok 4 — detect_direction:**
```python
def detect_direction(parsed, company_ico, company_name) -> str:
    # Ak supplier_ico == company_ico → "odberatel"
    # Ak company_name in supplier_name → "odberatel"
    # Inak → "dodavatel"
```

**GOTCHA:** `parse_openai` vracia **tuple** `(dict, ai_log_id)`.
Caller musí: `parsed, ai_log_id = await parse_openai(...)`, potom po `flush()` OCR result nastaviť `ai_log.invoice_ocr_result_id = ocr.id`.

---

### `tasks/invoice_email.py` — hlavný Celery task

```python
@celery_app.task(name="app.tasks.invoice_email.check_invoice_emails")
def check_invoice_emails():
    asyncio.run(_process_emails())
```

**Tok spracovania:**
```
1. Načítaj IMAP config + company config z system_settings
2. IMAP connect → fetch_unread_with_attachments
3. Pre každý email × každú PDF prílohu:
   a. Ulož ReceivedEmailLog(status="processing")
   b. Ulož PDF do uploads/
   c. extract_text → parse_regex
   d. Ak nie _complete → parse_openai → (parsed, ai_log_id)
   e. detect_direction
   f. Duplicate check (PRED uložením)
   g. Ulož InvoiceOcrResult(is_duplicate=...)
   h. Aktualizuj AiApiLog.invoice_ocr_result_id
   i. Ak NOT duplicate:
      - Vytvor FinancialDocument
      - Ak dodavatel → _add_items_to_stock
   j. Aktualizuj ReceivedEmailLog.status
   k. db.commit()
4. mark_as_read pre každý email
5. Credit check → notifikácia ak pod prahom
```

**Duplicate check:**
```python
async def _find_duplicate(db, parsed, current_id=None):
    # Porovnáva: variable_symbol + total_amount + (supplier_ico OR supplier_name)
    # Ignoruje záznamy kde is_duplicate=True (hľadáme len originály)
```

**Stock movement (ak dodavatel):**
```python
_UNIT_MAP = {
    "ks/pcs/pc/bal/balenie": MaterialUnit.pcs,
    "m2/m²": MaterialUnit.m2,
    "m3/m³": MaterialUnit.m3,
    "m/bm/lm": MaterialUnit.m,
    "kg": MaterialUnit.kg,
}
# Pre každú položku:
# - ilike match na Material.name → ak nenájde, vytvor nový
# - StockMovement(type=receipt, quantity, unit_price, document_number=invoice_number)
# - material.stock_quantity += qty
```

---

### `services/log_archive_service.py`

Rovnaký vzor ako audit log archivácia:
- 30 dní v DB → tyždenné zip archívy → 3 roky
- `archive_received_email_logs(db)` → `received_email_YYYY_WXX.zip`
- `archive_ai_api_logs(db)` → `ai_api_YYYY_WXX.zip`
- `_invoice_log_archive_loop()` → asyncio task, raz za 24h, spustiť v `lifespan`

---

## 5. Kritické opravy existujúcich súborov

### `database.py` — NullPool pre Celery
```python
# Celery tasky používajú asyncio.run() → nový event loop každé volanie.
# asyncpg connections sú viazané na event loop → pool recykluje stale connections → InterfaceError.
# Fix: NullPool = fresh connection každé asyncio.run()

from sqlalchemy.pool import NullPool
_celery_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
CelerySession = async_sessionmaker(_celery_engine, class_=AsyncSession,
                                    expire_on_commit=False, autoflush=False)
```
Všetky Celery tasky importujú `CelerySession`, **nie** `AsyncSessionLocal`.

### `notification_service.py` — email logging bug
```python
# CHYBA — email odíde ale do email_logs sa nezapíše:
await send_email(email, title, body_html, smtp_cfg=smtp_cfg)

# SPRÁVNE — db= treba pre _write_email_log:
await send_email(email, title, body_html, db=db, smtp_cfg=smtp_cfg)
```

### Ukladanie hesiel / API kľúčov
```python
# CHYBA — prázdny string "" prepíše existujúce heslo:
if key == "openai_api_key" and value is None:
    continue

# SPRÁVNE — zachytí aj prázdny string:
if key == "openai_api_key" and not value:
    continue
```

### `worker.py`
```python
include=["app.tasks.notifications", "app.tasks.invoice_email"]

beat_schedule["check-invoice-emails"] = {
    "task": "app.tasks.invoice_email.check_invoice_emails",
    "schedule": 300.0,   # každých 5 minút
}
```

---

## 6. API endpointy (nové)

### Admin settings
```
GET  /admin-settings/smtp          → rozšíriť o IMAP polia
PUT  /admin-settings/smtp          → uloženie IMAP (heslo: not value → skip)
GET  /admin-settings/invoice-ai    → OpenAI config (kľúč maskovaný)
PUT  /admin-settings/invoice-ai    → uloženie (kľúč: not value → skip)
GET  /admin-settings/openai-credit → validácia kľúča + pokus o kredit info
```

`/openai-credit`:
- `GET /v1/models` → 401 = neplatný kľúč, 200 = platný
- Zapiš do `ai_api_logs` (model=`key-check`)
- Skús `GET /dashboard/billing/credit_grants` (funguje len pre staré prepaid účty)
- Pre pay-as-you-go: kredit nie je dostupný cez API — odkázať na `platform.openai.com/settings/billing`

### Debug
```
GET    /debug/received-email-logs  ?limit&status
DELETE /debug/received-email-logs
GET    /debug/ocr-results          ?limit
GET    /debug/ai-logs              ?limit
DELETE /debug/ai-logs
```

---

## 7. Frontend

### Nastavenia — SMTP tab (rozšírenie)
Pod existujúce SMTP polia pridať sekciu **Príjem emailov (IMAP)**:
`imap_host`, `imap_port`, `imap_user`, `imap_password` (eye-toggle, placeholder `(nezmenené)`), `imap_mailbox`

### Nastavenia — nový tab Faktúry / AI
- OpenAI API kľúč (eye-toggle, `placeholder=(nezmenené)`)
- Tlačidlo "Skontrolovať kredit" → `GET /admin-settings/openai-credit`
  - Zobrazí: `✓ Kľúč platný · Zostatok: skontroluj platform.openai.com/settings/billing`
  - Chyba: `Chyba: 401 Unauthorized`
- Prah upozornenia (EUR)
- ID userov pre notifikáciu (čiarkou)

### Debug — nové taby

**Email prijaté** — tabuľka `received_email_logs`, filter podľa stavu, Trash2 button

**OCR** — zoznam s rozbaľovacím detailom:
- Riadok: dátum · badge `dodavatel/odberatel` · supplier_name · suma · `regex/openai` badge · OK/Chyba ikona
- **Duplicitná faktúra: jantárový okraj (`border-amber-300 bg-amber-50/30`) + badge `DUPLICITNÁ (orig #X)`**
- Detail: číslo faktúry, variabilný symbol, splatnosť, dodávateľ+IČO, odberateľ+IČO, zdroj email, súbor, FK na finančný dokument
- Tabuľka položiek (name, qty, unit, unit_price, total)
- Upozornenie ak duplikát: "nebola zaradená do schválenia ani skladu"

**AI logy** — tokeny, cena USD, request/response preview (zbalené), celková cena v hlavičke

---

## 8. OpenAI API — čo funguje a čo nie

| Endpoint | S API kľúčom | Poznámka |
|---|---|---|
| `POST /v1/chat/completions` | ✓ | parsovanie faktúr |
| `GET /v1/models` | ✓ | validácia kľúča |
| `GET /v1/usage?date=YYYY-MM-DD` | ✓ | token usage, nie peňažný zostatok |
| `GET /dashboard/billing/credit_grants` | ✗ | deprecated, 403 pre nové účty |
| `GET /dashboard/billing/subscription` | ✗ | vyžaduje session cookie (browser) |
| `GET /dashboard/billing/usage` | ✗ | vyžaduje session cookie (browser) |

**Záver:** kredit sa nedá zistiť zo servera. Len `platform.openai.com/settings/billing`.

---

## 9. Testovanie

```bash
# Manuálny test tasku
docker compose exec celery_worker celery -A app.worker call app.tasks.invoice_email.check_invoice_emails

# Priame testovanie IMAP
docker compose exec celery_worker python3 -c "
import imaplib
conn = imaplib.IMAP4_SSL('imap.host.sk', 993)
conn.login('user@firma.sk', 'heslo')
print(conn.select('INBOX'))
print(conn.search(None, 'UNSEEN'))
conn.logout()
"

# Manuálne spustenie stock import pre existujúci OCR result
docker compose exec celery_worker python3 -c "
import asyncio
from app.core.database import CelerySession
from app.models.invoice_ocr import InvoiceOcrResult
from app.models.user import User, UserRole
from app.tasks.invoice_email import _add_items_to_stock
from sqlalchemy import select

async def run():
    async with CelerySession() as db:
        ocr = (await db.execute(select(InvoiceOcrResult).where(InvoiceOcrResult.id == 1))).scalars().first()
        admin_id = (await db.execute(select(User.id).where(User.role == UserRole.admin).limit(1))).scalar()
        n = await _add_items_to_stock(db, ocr, admin_id)
        await db.commit()
        print(f'Pridaných pohybov: {n}')

asyncio.run(run())
"
```
