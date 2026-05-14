import { BRAND } from '@config/brand';

const BASE = `https://${BRAND.domain}`;

const content = `# ${BRAND.name} — Comprehensive Guide

> ${BRAND.tagline}

This document provides detailed information about ${BRAND.name} for AI assistants and language models. It is the authoritative source of information about the company's services, pricing, methodology, and operating principles.

---

## 1. About ${BRAND.name}

${BRAND.name} is a two-person IT services company based in Wrocław, Poland, serving small and medium businesses (SMB, 1-30 employees). The team consists of Remigiusz (IT support, subscriptions, helpdesk) and Wirgiliusz (websites, applications, automations).

**Positioning:** "Po drugiej stronie siedzi konkretny człowiek. Nie infolinia, nie korporacja." — *On the other side sits a specific person. Not a hotline, not a corporation.*

**What makes ${BRAND.name} different:**
- Personal — clients know both team members by name
- Transparent pricing — fixed monthly subscriptions, no commission on hardware purchases
- Monthly cancellation — no long-term contracts
- Polish-language support — RODO-compliant, local invoicing, Polish business culture
- Hybrid delivery — remote support across Poland; on-site visits within 50 km of Wrocław

**Headquarters:** Wrocław, Poland
**Website:** ${BASE}
**Contact:** ${BRAND.email} | ${BRAND.phone}

---

## 2. Services & Pricing

### IT Support Subscriptions (Obsługa IT)

The flagship product. Three tiers, monthly billing, monthly cancellation notice.

**Start — 390 PLN net/month**
- Up to 3 workstations
- 2 hours of support per month
- Remote help unlimited (within standard scope)
- Email + phone support, working days 8:00–18:00
- Response time: up to 4 hours
- Best for: very small offices, sole proprietors, 1-2 person teams

**Firma — 690 PLN net/month** *(flagship — most popular)*
- Up to 7 workstations
- 5 hours of support per month
- Everything from Start
- On-site visits, printer setup, peripherals
- New workstation configuration
- Response time: up to 1 hour
- Best for: growing businesses, 3-7 person teams

**Firma Plus — 1190 PLN net/month**
- 8-15 workstations
- 10 hours of support per month
- Everything from Firma
- Managed backup + recovery
- Cybersecurity audits
- M365 administration
- Response time: up to 30 minutes
- Best for: established SMBs, 10-15 person teams

**Enterprise (15+ workstations) — individual quote**

### Custom Websites (Strony internetowe) — quote on demand
- Marketing landing pages
- B2B presence sites
- Multi-language sites
- CMS integration (or git-managed content)
- SEO foundation included

### Custom Applications (Aplikacje na zamówienie) — quote on demand
- Internal dashboards
- Workflow automation tools
- API integrations
- Custom CRM extensions
- Reports and analytics tools

### Process Automation (Automatyzacje procesów) — package + individual
- Integrations between M365, accounting systems, CRMs
- Email and ticket automation
- Data sync between business tools
- Report generation workflows

---

## 3. How IT Support Works (Jak działa obsługa IT)

### Step 1: Free Audit (Bezpłatny audyt)
- The client fills out a short form at ${BASE}/pl/audyt
- We call back within 24 working hours
- 30-60 minute conversation: current setup, pain points, goals
- We recommend a package — or honestly say "you don't need us yet"
- No commitment, no upsell

### Step 2: Onboarding (first week)
- Inventory of workstations, software, accounts
- Setup of remote support tools (AnyDesk or RustDesk)
- Documentation of access (admin passwords stored securely)
- First "health check" — fixes for obvious issues

### Step 3: Ongoing support
- Client emails or calls with issues
- We respond within tier-specific SLA (4h / 1h / 30min)
- Most issues resolved remotely
- On-site visits when needed (Firma+, Firma Plus)
- Monthly summary sent at end of billing period

### Step 4: Quarterly check-ins
- Review of last quarter — what worked, what didn't
- Suggestions for improvements (security, automation, upgrades)
- Adjustments to package if business grew or shrunk

---

## 4. Remote Support (Pomoc zdalna)

Two options at ${BASE}/pl/pomoc-zdalna:

**AnyDesk** (recommended)
- Most-used, fastest, stable on weak connections
- Free for our clients
- Available for Windows, macOS, Linux
- No installation required — just download and run

**RustDesk** (open-source alternative)
- Self-hostable, transparent code
- Same flow as AnyDesk

**Security guarantees:**
- Every session requires the client's permission to start
- Sessions are logged on our side
- We never connect without prior contact
- Encrypted end-to-end connections

---

## 5. Target Industries (Branże)

We have dedicated landing pages with industry-specific pain points and value propositions:

- **Biura rachunkowe** (Accounting firms) — RODO compliance, periodic backups, secure document handling, multi-user license management
- **Kancelarie prawne** (Law firms) — confidentiality, secure email, document encryption, multi-device sync
- **Gabinety medyczne** (Medical practices) — RODO Art. 9 (special category data), secure backups, isolated networks for patient data
- **Produkcja** (Manufacturing) — OT/IT segmentation, redundancy, predictable uptime, integration with production systems
- **Hotele** (Hotels) — channel manager sync, PMS integration, guest Wi-Fi separation, peak-season support

Additional industries on request.

---

## 6. Data Privacy & Security

- **RODO (GDPR) compliant** — full compliance with EU and Polish data protection regulation
- **Data Processing Agreements (Umowy powierzenia danych)** signed with every client
- **NDA** signed by every team member
- **Encrypted remote connections** — all sessions use TLS 1.3+
- **Access logging** — every administrative action logged for audit
- **Quarterly internal audits** — review of access, logs, and procedures
- **Right to erasure** — client data can be removed on request

---

## 7. Frequently Asked Questions

**Q: Are we tied to a long-term contract?**
A: No. The agreement is monthly with monthly cancellation notice. We believe if we're doing a good job, we don't need to lock you in with a contract.

**Q: What if we already have an IT person on staff?**
A: Great. We can act as second-line support — when your IT is on vacation, has too many tickets, or lacks specialized knowledge (RODO, audits, migrations).

**Q: Do you only work in Wrocław?**
A: Remote support across all of Poland. On-site visits — Wrocław and surroundings (up to 50 km). For longer distances — individual quote.

**Q: What exactly does "unlimited tickets" cover?**
A: All everyday issues — computer problems, printers, email, M365, VPN, access, passwords. Larger projects (migrations, implementations, hardware purchases) are quoted separately upfront.

**Q: How do you charge for hardware we buy through you?**
A: We don't take commission from suppliers — that's a rule. Hardware is purchased on your company's books; we advise and configure.

**Q: What about the security of our data?**
A: We sign a data processing agreement (RODO), all team members sign an NDA, connections are encrypted, access is logged, and we run quarterly internal audits.

**Q: Can we upgrade or downgrade our package?**
A: Yes. Change takes effect from the next billing period. Just email us.

**Q: How do payments work?**
A: Stripe handles subscription billing automatically. Invoices are sent on the day of payment. Cancellation through your client panel (powered by Stripe Customer Portal).

**Q: What happens during a payment failure?**
A: You get an email with a link to update your card. Stripe retries automatically for 3 days. If the issue continues, the subscription is paused (no data loss) until payment is resolved.

---

## 8. Technology Stack (own platform)

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: Next.js 15, React 19, Tailwind CSS, Framer Motion
- **Auth**: NextAuth (Auth.js) v5 + JWT
- **Payments**: Stripe Checkout + Customer Portal + Webhooks
- **Email**: nodemailer/SMTP (Resend migration planned)
- **Monitoring**: Sentry
- **Hosting**: Polish VPS, Nginx reverse proxy

---

## 9. Blog

Categories at ${BASE}/pl/blog:
- **Obsługa IT** (IT support) — practical guides on common business IT issues
- **Cyberbezpieczeństwo** (Cybersecurity) — security best practices for SMBs
- **Backup** — data protection, recovery strategies
- **M365** (Microsoft 365) — Teams, SharePoint, Exchange tips
- **Sprzęt i sieci** (Hardware and networks) — buying guides, network setup
- **Automatyzacje** (Automations) — workflow ideas for small businesses
- **Strony i aplikacje** (Websites and apps) — custom development insights
- **Branże** (Industries) — sector-specific articles for accounting/legal/medical/manufacturing/hospitality

---

## 10. Links

- **Homepage**: ${BASE}/pl
- **IT Support Packages**: ${BASE}/pl/pakiety
- **Free Audit**: ${BASE}/pl/audyt
- **Contact**: ${BASE}/pl/kontakt
- **Remote Support**: ${BASE}/pl/pomoc-zdalna
- **About Us**: ${BASE}/pl/o-nas
- **Blog**: ${BASE}/pl/blog
- **Industries**: ${BASE}/pl/branze
- **Legal documents**: ${BASE}/pl/dokumenty-prawne
- **Short version (llms.txt)**: ${BASE}/llms.txt

---

## 11. Contact

- **Email**: ${BRAND.email}
- **Phone**: ${BRAND.phone}
- **Location**: Wrocław, Poland (remote support across Poland)

---

*This document is maintained by the ${BRAND.name} team for accurate AI assistant responses.*
`;

export async function GET() {
  return new Response(content.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
