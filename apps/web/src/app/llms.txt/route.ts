import { BRAND } from '@config/brand';

const content = `# ${BRAND.name}

> ${BRAND.tagline}

## About

bambooIT is a two-person IT services company based in Wrocław, Poland, serving small and medium businesses (1-30 employees). We provide subscription-based IT support, custom websites, applications on demand, and process automation. Our positioning: "By the other side sits a specific person — not a hotline, not a corporation."

## Services

- **IT Support Subscriptions** (Obsługa IT / abonament): Three tiers — Start (390 PLN/month, up to 3 workstations, 2h support), Firma (690 PLN/month, up to 7 workstations, 5h support — flagship), Firma Plus (1190 PLN/month, 8-15 workstations, 10h support). Monthly billing, monthly cancellation notice, transparent pricing.
- **Websites** (Strony internetowe): Individual quote based on scope — landing pages, marketing sites, B2B presence.
- **Custom Applications** (Aplikacje na zamówienie): Individual quote — internal tools, dashboards, integrations, custom workflows.
- **Process Automation** (Automatyzacje procesów): Package + individual quotes — workflow automation, integrations between business tools (M365, accounting systems, CRMs, etc.).

## Key Facts

- **Location**: Wrocław, Poland (remote support across Poland; on-site visits within 50 km of Wrocław)
- **Team**: Two-person — Remigiusz (IT support, subscriptions, helpdesk) and Wirgiliusz (websites, applications, automations)
- **Languages**: Polish (primary); English on request
- **Domain**: ${BRAND.domain}
- **Pricing**: from 390 PLN/month (IT support starter package), websites/apps/automations quoted individually
- **Target client**: Small Polish businesses 1-30 employees — accounting firms, law firms, medical practices, hotels, small production, professional services
- **Differentiation**: Personal — by-name relationships, not ticket numbers
- **Compliance**: RODO (GDPR) compliant; signed data processing agreements; encrypted connections; logged remote access sessions
- **Remote support**: AnyDesk or RustDesk (client downloads the program, shares session ID — no installation required)

## Links

- [Homepage](https://${BRAND.domain}/pl)
- [IT Support Packages](https://${BRAND.domain}/pl/pakiety)
- [Free Audit](https://${BRAND.domain}/pl/audyt)
- [Contact](https://${BRAND.domain}/pl/kontakt)
- [Remote Support](https://${BRAND.domain}/pl/pomoc-zdalna)
- [About Us](https://${BRAND.domain}/pl/o-nas)
- [Blog](https://${BRAND.domain}/pl/blog)
- [Industries](https://${BRAND.domain}/pl/branze) — landing pages for accounting firms, law firms, medical practices, manufacturing, hotels
- [Full AI-readable version](https://${BRAND.domain}/llms-full.txt)

## Contact

- Email: ${BRAND.email}
- Phone: ${BRAND.phone}
`;

export async function GET() {
  return new Response(content.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
