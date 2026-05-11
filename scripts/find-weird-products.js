const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const p = new PrismaClient();

async function main() {
  const products = await p.cleanProduct.findMany({
    where: { sourcePrimary: { in: ['ILEWAZY', 'MANUAL'] } },
    select: { name: true, category: true },
    orderBy: { name: 'asc' },
  });

  const weird = [];

  for (const prod of products) {
    const n = prod.name;
    let reason = '';

    // Egzotyczne
    if (/kumkwat|tamaryn|karambola|gujawa|liczi|grzyby enoki|bakłażan indyjski|topinambur|fioletowe ziemniak|strąki tamaryn/i.test(n)) reason = 'egzotyczny';

    // Podroby i dziczyzna
    if (/serc z indyk|serc z gęsi|wątrób|mózg|ozór|flaki|głowizn|żołądk|kopyt|koniny|bażant|sarnin/i.test(n)) reason = 'podroby/dziczyzna';

    // Gotowe dania
    if (/gołąbek|pierogi |knedle|kopytk|krokiet|kartacz|pasztecik|winogrona faszerowane/i.test(n)) reason = 'gotowe danie';

    // Alkohol
    if (/wino |wódki|brandy|ginu |rumu |piwo |cydr|spirytus|likier|nalewk|martini|aperol/i.test(n)) reason = 'alkohol';

    // Napoje smieci
    if (/napój energet|napój gazowane|coca|fanta|sprite|lemoniada|napój izotonic|black after|black sex|chi$|ajerkoniaku/i.test(n)) reason = 'napoj smieci';

    // Slodycze
    if (/ptasie mleczko|delicje|gryllaż|pralin|marcepan|panna cotta|tiramisu|brownie|muffin|croissant|donut|pączek|biszkopt|fawork/i.test(n)) reason = 'slodycze';

    // Przetworzone
    if (/instant|w zalewie|marynowa|pasteryzow|mix do |mieszanka do/i.test(n)) reason = 'przetworzone';

    // Niszowe
    if (/serwatk|kazeina|białka konopne|benzoesanu|błonnika konopne|błonnika gryczane|demineralizowanej/i.test(n)) reason = 'niszowy';

    // Prefiksy (nie wyczyszczone)
    if (/^(Garść |Łyżeczka |Łyżka |Kromka |Kawałek |Porcja |Szklanka |Kieliszek |Plaster |\d+ )/i.test(n)) reason = 'prefiks';

    // Fast food
    if (/pizza |hamburger|hot dog|kebab|nuggets|strips|kanapka.*KFC|kanapka.*zinger/i.test(n)) reason = 'fast food';

    // Branded
    if (/Serduszko|Mlekovita|Podlaski|Knorr|Abba|Felix|enerBio|Crispy|Tassimo|Nescafe|Milka|Oreo|Fantasia|Monte|Danonek|Actimel|Activia|Bakuś|Delfiko|Rolmlecz/i.test(n)) reason = 'branded';

    // Zla gramatyka
    if (/Parmezanu$|Mozzarelli$|Jarmużu$|rozmarynu$|bazylii$/i.test(n)) reason = 'zla gramatyka';

    // Gotowe produkty przetworzone
    if (/^(Kostki |Deser |Cappuccino |Frytka |Chrzan |Chutney|Rosołow|Budyń |Bulionetka)/i.test(n)) reason = 'przetworzony gotowy';

    // Ryby przetworzone
    if (/mrożony stek|polędwica tuńczyk|brzuszek wędzony|okoń wędzony|dorsz wędzony|paluszki rybne|pasta z tuńczyka|sałatki z tuńczyk/i.test(n)) reason = 'ryba przetworzona';

    // Niszowe oleje (juz filtrowane ale sprawdzmy)
    if (/olej z awokado|olej arganow|olej rydzow|olej z czarnuszk|olej z ostropest|olej carotino|olej z pestek|olej koperkow|olej krokoszow|olej makow|olej migdałow|olej konopn|olej z lniank|olej z nasion|olej z czerwonej|olej ze zbóż|olej kujawsk/i.test(n)) reason = 'niszowy olej';

    // Kawy specjalne
    if (/cappuccino|latte macchiato|kawa żołędziówk|cold brew/i.test(n)) reason = 'kawa specjalna';

    // Mleko niszowe
    if (/mleko zagęszczone|mleko kokosowe o smaku|kozy mleko/i.test(n)) reason = 'mleko niszowe';

    if (reason) weird.push({ name: n, category: prod.category, reason });
  }

  // Group by reason
  const byReason = {};
  for (const w of weird) {
    if (!byReason[w.reason]) byReason[w.reason] = [];
    byReason[w.reason].push(w.name);
  }

  let output = '=== DZIWNE PRODUKTY — DO PRZEGLĄDU ===\n';
  output += 'Razem: ' + weird.length + ' produktow\n';
  output += 'Jesli produkt ma ZOSTAC — dopisz ZOSTAW na koncu linii\n';
  output += 'Reszta zostanie odfiltrowana z promptu AI (nie usunieta z bazy)\n\n';

  for (const [reason, names] of Object.entries(byReason).sort()) {
    output += '--- ' + reason.toUpperCase() + ' (' + names.length + ') ---\n';
    names.sort().forEach(n => output += n + '\n');
    output += '\n';
  }

  fs.writeFileSync(path.resolve(__dirname, '../data/dziwne-produkty-review.txt'), output, 'utf8');
  console.log('Saved to data/dziwne-produkty-review.txt');
  console.log('Dziwne produkty:', weird.length);
  for (const [reason, names] of Object.entries(byReason).sort()) {
    console.log('  ' + reason + ': ' + names.length);
  }

  await p.$disconnect();
}

main().catch(console.error);
