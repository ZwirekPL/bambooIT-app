const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // First, revert ALL products that were just moved to 'przyprawy' back to their original categories
  // We need to identify which ones are real spices vs which just mention spices in their name

  const allInSpices = await p.cleanProduct.findMany({
    where: { category: 'przyprawy' },
    select: { id: true, name: true },
  });

  console.log(`Total products currently in 'przyprawy': ${allInSpices.length}`);

  // Real spices: products whose name starts with "przyprawy, " or "Przyprawa " (standalone spice products)
  const realSpices = [];
  const notSpices = [];

  for (const prod of allInSpices) {
    const lower = prod.name.toLowerCase();
    if (
      lower.startsWith('przyprawy, ') ||  // "przyprawy, oregano, suszony(a)"
      lower.startsWith('przyprawa ')       // "Przyprawa do mięs", "Przyprawa Maggi"
    ) {
      realSpices.push(prod);
    } else {
      notSpices.push(prod);
    }
  }

  console.log(`\nReal spices (${realSpices.length}):`);
  realSpices.forEach((s) => console.log(`  + ${s.name}`));

  console.log(`\nNOT spices - need to revert (${notSpices.length}):`);
  notSpices.forEach((s) => console.log(`  - ${s.name}`));

  // Revert non-spices back to produkty-gotowe (their original categories are lost,
  // but we know them from the output above)
  // Let's map them back based on known patterns
  for (const prod of notSpices) {
    const lower = prod.name.toLowerCase();
    let newCat = 'produkty-gotowe'; // default fallback

    if (lower.includes('kurczak') || lower.includes('wieprzowina') || lower.includes('mięso')) {
      newCat = 'mieso-i-wedliny';
    } else if (lower.includes('kulek kokosowych') || lower.includes('ciasteczk')) {
      newCat = 'slodycze-i-przekaski';
    } else if (lower.includes('brzoskwini') || lower.includes('owoce')) {
      newCat = 'owoce';
    } else if (lower.includes('płatki') || lower.includes('płatek')) {
      newCat = 'produkty-zbozowe';
    } else if (lower.includes('kuskus') || lower.includes('przyprawa do') || lower.includes('przyprawa kuchni')) {
      newCat = 'napoje'; // these were originally in napoje based on output
    } else if (lower.includes('twój smak')) {
      newCat = 'nabial-i-jaja';
    } else if (lower.includes('żółty ryż')) {
      newCat = 'produkty-gotowe';
    }

    await p.cleanProduct.update({
      where: { id: prod.id },
      data: { category: newCat },
    });
    console.log(`  Reverted "${prod.name}" -> ${newCat}`);
  }

  console.log(`\nDone. ${realSpices.length} products remain in 'przyprawy' category.`);

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
