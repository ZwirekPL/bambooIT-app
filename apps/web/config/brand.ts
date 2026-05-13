/**
 * Brand configuration — single source of truth for bambooIT identity.
 * To rename the brand, change this file only.
 * All pages, headers, footers, and metadata reference BRAND.*
 */
export const BRAND = {
  name:       'bambooIT',
  shortName:  'bambooIT',
  domain:     'bambooit.pl',
  tagline:    'Outsourcing IT, strony, aplikacje i automatyzacje dla małych i średnich firm.',
  taglineEn:  'IT outsourcing, websites, custom apps and process automation for SMBs.',
  email:      'hello@bambooit.pl',
  // TODO: placeholder from mockup — replace with real phone number when registered.
  phone:      '+48 71 777 17 77',
  // TODO: empty until real Facebook/Instagram profiles exist; Footer hides icons when blank.
  social: {
    facebook:  '',
    instagram: '',
  },
  // TODO: placeholder NIP — replace with real value after Bambooit Sp. z o.o. is registered.
  nip:        '000-000-00-00',
  seo: {
    title:       'bambooIT — Ekologiczne myślenie o IT',
    description: 'Outsourcing IT dla MŚP w Polsce. Stała opieka, szybka reakcja, przewidywalny koszt. Pakiety od 390 zł/mies. Wrocław + zdalnie.',
    ogImage:     '/images/og-image.png',
  },
  author: {
    name:     'Zespół bambooIT',
    bio:      'Jesteśmy dwuosobowym zespołem IT. Remigiusz prowadzi obsługę IT i pakiety abonamentowe. Wirgiliusz buduje strony, aplikacje i automatyzacje. Bez infolinii, bez korporacyjnej dystansy.',
    bioEn:    'We are a two-person IT team. Remigiusz runs IT support and subscription packages. Wirgiliusz builds websites, apps and automation. No call centers, no corporate distance.',
    image:    '',
    aboutUrl: '/o-nas',
  },
  /** Design token references — for use in JS/metadata contexts (PWA theme, llms.txt, etc.) */
  colors: {
    navy:   '#1A2735',  // navy-deep — PWA theme color, mockup nav/footer canvas
    bamboo: '#8BC34A',  // accent — mockup --green
    paper:  '#F6F4EE',  // page canvas — mockup --paper
  },
  /** GEO (Generative Engine Optimization) metadata */
  geo: {
    foundingYear: 2026,
    headquarters: 'Wrocław, Poland',
    // TODO: real registered address when Bambooit Sp. z o.o. is incorporated.
    address: 'Wrocław, Poland',
    specialties: [
      'outsourcing IT',
      'obsługa IT dla MŚP',
      'strony internetowe',
      'aplikacje webowe na zamówienie',
      'automatyzacje procesów',
      'cyberbezpieczeństwo i RODO',
      'Microsoft 365 i Google Workspace',
    ],
  },
} as const;

export type Brand = typeof BRAND;
