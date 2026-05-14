/**
 * Seed: 8 mock blog posts for bambooIT (one per category) — pure lorem
 * ipsum content for layout/filter testing. Replace with real articles
 * via admin UI (/[locale]/admin/blog/nowy) once Remigiusz/writer is ready.
 * See docs/blog/CONTENT_SPEC.md for the writer brief.
 *
 * Run: cd packages/database && npx ts-node --transpile-only prisma/seed-bamboo-blog-mock.ts
 * Idempotent — upserts on slug.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOREM_PARA =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

const LOREM_PARA_2 =
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.';

function buildContent(h2Sections: string[], h3Sections: string[][]): string {
  // Builds a Markdown body with one paragraph intro + N H2 sections, each
  // with optional H3 sub-headings + lorem paragraphs.
  const blocks: string[] = [];
  blocks.push(LOREM_PARA);

  h2Sections.forEach((h2, i) => {
    blocks.push(`## ${h2}`);
    blocks.push(LOREM_PARA);
    const subs = h3Sections[i] ?? [];
    subs.forEach((h3) => {
      blocks.push(`### ${h3}`);
      blocks.push(LOREM_PARA_2);
    });
    if (subs.length === 0) {
      blocks.push(LOREM_PARA_2);
    }
  });

  return blocks.join('\n\n');
}

interface MockPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  readTime: number;
  publishedAt: Date;
  faq: { question: string; answer: string }[];
}

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const POSTS: MockPost[] = [
  {
    slug: 'outsourcing-it-wroclaw-kiedy-sie-oplaca',
    title: 'Outsourcing IT we Wrocławiu — kiedy się opłaca?',
    excerpt:
      'Lorem ipsum dolor sit amet — kiedy mała firma powinna oddać IT na zewnątrz, a kiedy zatrudnić informatyka na etat.',
    category: 'Obsługa IT',
    readTime: 6,
    publishedAt: new Date(NOW - 2 * DAY),
    content: buildContent(
      ['Kiedy outsourcing ma sens', 'Pułapki do uniknięcia', 'Co sprawdzić przed podpisaniem umowy'],
      [['Skala firmy', 'Charakter pracy'], [], ['Zakres usług', 'SLA i czas reakcji']],
    ),
    faq: [
      {
        question: 'Lorem ipsum question 1?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      },
      {
        question: 'Sed do eiusmod question 2?',
        answer: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
      },
    ],
  },
  {
    slug: 'rodo-w-malej-firmie-it-checklist',
    title: 'RODO w małej firmie — checklist dla IT',
    excerpt:
      'Lorem ipsum — co realnie musisz mieć w IT żeby spełnić RODO i nie dostać kary 100 000 zł.',
    category: 'Cyberbezpieczeństwo',
    readTime: 8,
    publishedAt: new Date(NOW - 5 * DAY),
    content: buildContent(
      ['Audyt aktualnego stanu', 'Wymagane procedury', 'Co kontroluje GIODO/UODO'],
      [['Inwentaryzacja danych', 'Mapa systemów'], ['Polityka haseł', 'Procedura wycieku'], []],
    ),
    faq: [
      {
        question: 'Czy musimy mieć IOD?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      },
      {
        question: 'Ile kosztuje audyt RODO?',
        answer: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem.',
      },
      {
        question: 'Co jeśli pracownik wyciekł dane?',
        answer: 'Excepteur sint occaecat cupidatat non proident sunt in culpa.',
      },
    ],
  },
  {
    slug: 'backup-w-smb-strategia-3-2-1',
    title: 'Backup w małej firmie — strategia 3-2-1 w praktyce',
    excerpt:
      'Lorem ipsum — jak zbudować backup który naprawdę zadziała gdy pojawi się ransomware lub awaria dysku.',
    category: 'Backup',
    readTime: 5,
    publishedAt: new Date(NOW - 8 * DAY),
    content: buildContent(
      ['Co to jest reguła 3-2-1', 'Implementacja w małej firmie', 'Test recovery — najważniejszy krok'],
      [[], ['Lokalny NAS', 'Chmura', 'Offline kopia'], ['Harmonogram testów']],
    ),
    faq: [
      {
        question: 'Jak często testować backup?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      },
      {
        question: 'Czy OneDrive to backup?',
        answer: 'Nie. Lorem ipsum — synchronizacja to nie kopia zapasowa.',
      },
    ],
  },
  {
    slug: 'microsoft-365-vs-google-workspace-dla-smb',
    title: 'Microsoft 365 vs Google Workspace — który wybrać do firmy?',
    excerpt:
      'Lorem ipsum — porównanie dwóch najpopularniejszych pakietów biurowych z perspektywy małej firmy.',
    category: 'Microsoft 365',
    readTime: 7,
    publishedAt: new Date(NOW - 12 * DAY),
    content: buildContent(
      ['Cena za użytkownika', 'Funkcjonalność', 'Integracje i kompatybilność'],
      [[], ['Outlook vs Gmail', 'Word vs Docs', 'Teams vs Meet'], []],
    ),
    faq: [
      {
        question: 'Czy mogę migrować z jednego na drugi?',
        answer: 'Tak, lorem ipsum — proces zajmuje zwykle 2-4 tygodnie.',
      },
      {
        question: 'Co z polskimi fakturami?',
        answer: 'Lorem ipsum sed do eiusmod tempor incididunt ut labore.',
      },
    ],
  },
  {
    slug: 'jak-dobrac-router-i-switch-do-malej-firmy',
    title: 'Jak dobrać router i switch do biura 5-15 osób',
    excerpt:
      'Lorem ipsum — praktyczny przewodnik po sprzęcie sieciowym dla małych firm. Bez prowizji, bez marketingu.',
    category: 'Sprzęt i sieci',
    readTime: 6,
    publishedAt: new Date(NOW - 18 * DAY),
    content: buildContent(
      ['Router — najważniejszy element', 'Switch — kiedy potrzebny', 'WiFi — jak nie przepłacić'],
      [['Co zmierzyć przed zakupem'], [], ['Access pointy mesh', 'Pasmo 5GHz vs 6GHz']],
    ),
    faq: [
      {
        question: 'Czy router za 200 zł wystarczy?',
        answer: 'Lorem ipsum — zazwyczaj nie, ale zależy od skali.',
      },
      {
        question: 'Ile portów w switchu?',
        answer: 'Ut enim ad minim veniam — minimum 2x liczba stanowisk.',
      },
    ],
  },
  {
    slug: 'automatyzacje-procesow-od-czego-zaczac',
    title: 'Automatyzacje procesów w MŚP — od czego zacząć?',
    excerpt:
      'Lorem ipsum — n8n, Make, Zapier, custom kod. Jak wybrać narzędzie i co zautomatyzować najpierw.',
    category: 'Automatyzacje',
    readTime: 7,
    publishedAt: new Date(NOW - 22 * DAY),
    content: buildContent(
      ['Mapowanie procesów', 'Wybór narzędzia', 'Pierwsze 3 automatyzacje'],
      [[], ['n8n self-hosted', 'Make.com', 'Custom skrypty'], ['Email → CRM', 'Faktura → księgowa', 'Lead → kalendarz']],
    ),
    faq: [
      {
        question: 'Ile kosztuje wdrożenie automatyzacji?',
        answer: 'Lorem ipsum dolor sit amet — zazwyczaj 2-5 tys. zł za proces.',
      },
      {
        question: 'Czy mogę to zrobić sam?',
        answer: 'Sed ut perspiciatis — proste tak, złożone lepiej zlecić.',
      },
    ],
  },
  {
    slug: 'kiedy-strona-internetowa-a-kiedy-aplikacja',
    title: 'Strona internetowa czy aplikacja webowa — co wybrać?',
    excerpt:
      'Lorem ipsum — różnice, koszty i kiedy każde z nich ma sens dla małej firmy.',
    category: 'Strony i aplikacje',
    readTime: 5,
    publishedAt: new Date(NOW - 28 * DAY),
    content: buildContent(
      ['Strona — wizytówka i SEO', 'Aplikacja webowa — narzędzie pracy', 'Hybrydy i SaaS-y'],
      [['Headless CMS vs prosty WordPress'], ['Panel klienta', 'Dashboard administracyjny'], []],
    ),
    faq: [
      {
        question: 'Czy potrzebuję obu?',
        answer: 'Lorem ipsum — większość małych firm zaczyna od strony.',
      },
      {
        question: 'Ile kosztuje strona?',
        answer: 'Excepteur sint occaecat — od 3 tys. zł za prosty landing.',
      },
    ],
  },
  {
    slug: 'it-w-biurze-rachunkowym-specyfika',
    title: 'IT w biurze rachunkowym — czego potrzebujesz inaczej niż reszta',
    excerpt:
      'Lorem ipsum — biura rachunkowe mają specyficzne wymagania bezpieczeństwa i dostępności. Sprawdzamy.',
    category: 'Branże',
    readTime: 6,
    publishedAt: new Date(NOW - 35 * DAY),
    content: buildContent(
      ['Bezpieczeństwo danych klientów', 'Integracje z programami księgowymi', 'JPK i e-Urząd'],
      [['Szyfrowanie dysków', 'Polityka dostępu'], ['Comarch Optima', 'Wapro', 'Insert'], []],
    ),
    faq: [
      {
        question: 'Czy musimy mieć dedykowany serwer?',
        answer: 'Lorem ipsum dolor sit amet — zależy od liczby klientów.',
      },
      {
        question: 'Co z RODO przy obsłudze klientów?',
        answer: 'Sed ut perspiciatis unde omnis iste — umowa powierzenia.',
      },
    ],
  },
  {
    slug: 'phishing-w-firmie-jak-rozpoznac',
    title: 'Phishing w firmie — 5 sygnałów, że to oszustwo',
    excerpt:
      'Lorem ipsum — fałszywe maile od „banku" i „prezesa" kosztują polskie firmy miliony rocznie. Sprawdź jak rozpoznać atak.',
    category: 'Cyberbezpieczeństwo',
    readTime: 5,
    publishedAt: new Date(NOW - 38 * DAY),
    content: buildContent(
      ['5 sygnałów alarmowych', 'Co zrobić jeśli kliknąłeś', 'Szkolenie zespołu'],
      [['Adres nadawcy', 'Linki vs. tekst', 'Presja czasu'], [], ['Symulacje phishingowe']],
    ),
    faq: [
      {
        question: 'Czy filtr antyspamowy wystarczy?',
        answer: 'Lorem ipsum — nie zawsze, najlepsze ataki przechodzą przez filtry.',
      },
    ],
  },
  {
    slug: 'kopia-zapasowa-zasada-3-2-1',
    title: 'Backup zgodnie z zasadą 3-2-1 — co to znaczy w praktyce',
    excerpt:
      'Lorem ipsum — 3 kopie, 2 nośniki, 1 lokalizacja offsite. Tłumaczymy z konkretnymi przykładami dla małych firm.',
    category: 'Backup',
    readTime: 7,
    publishedAt: new Date(NOW - 42 * DAY),
    content: buildContent(
      ['Skąd zasada 3-2-1', 'Wdrożenie w małej firmie', 'Test recovery'],
      [[], ['Dysk NAS', 'Chmura', 'Offsite'], ['Cykliczne testy']],
    ),
    faq: [
      {
        question: 'Czy OneDrive to backup?',
        answer: 'Lorem ipsum — to synchronizacja, nie backup. Skasowane pliki znikają.',
      },
      {
        question: 'Jak często testować backup?',
        answer: 'Sed ut perspiciatis — co kwartał minimum.',
      },
    ],
  },
  {
    slug: 'leasing-kontra-zakup-laptopow',
    title: 'Leasing czy zakup laptopów — co się opłaca firmie 10-osobowej',
    excerpt:
      'Lorem ipsum — analizujemy 3-letni TCO dla obu modeli. Wnioski mogą Cię zaskoczyć.',
    category: 'Sprzęt i sieci',
    readTime: 8,
    publishedAt: new Date(NOW - 50 * DAY),
    content: buildContent(
      ['Założenia kalkulacji', 'Leasing operacyjny', 'Zakup gotówkowy', 'Mix obu modeli'],
      [[], ['Plusy', 'Minusy'], ['Plusy', 'Minusy'], []],
    ),
    faq: [
      {
        question: 'A subskrypcja Dell / HP / Lenovo?',
        answer: 'Lorem ipsum — to wariant leasingu z serwisem; coraz popularniejszy.',
      },
    ],
  },
];

async function main() {
  const author = 'Zespół bambooIT';

  for (const post of POSTS) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        author,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        published: true,
        faq: post.faq,
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        readTime: post.readTime,
        publishedAt: post.publishedAt,
        published: true,
        faq: post.faq,
      },
    });
    console.log(`✓ ${post.slug} (${post.category})`);
  }

  console.log(`\nSeeded ${POSTS.length} mock posts. Run \`npm run dev -w apps/web\` and visit /pl/blog.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
