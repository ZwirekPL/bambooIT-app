const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

function num(val) {
  if (!val || val === '-' || val === 'traces' || val === 'trace') return null;
  const s = String(val).replace(',', '.').replace('<', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const GROUP_MAP = {
  '01':'produkty-gotowe','02':'warzywa','03':'produkty-gotowe',
  '04':'mieso-i-wedliny','05':'nabial-i-jaja','06':'produkty-zbozowe',
  '07':'slodycze-i-przekaski','08':'slodycze-i-przekaski',
  '09':'napoje','10':'tluszcze','11':'przyprawy',
};

async function main() {
  const dataDir = path.resolve(__dirname, '../data');

  // 1. Parse full CIQUAL XLS
  const wb = XLSX.readFile(path.join(dataDir, 'ciqual-2020.xls'));
  const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const ciqMap = {};
  for (const row of rawData) {
    const name = row['alim_nom_eng'];
    if (!name) continue;
    const protein = num(row['Protein (g/100g)']);
    const fat = num(row['Fat (g/100g)']);
    const carbs = num(row['Carbohydrate (g/100g)']);
    const gc = String(row['alim_grp_code']).padStart(2, '0');
    ciqMap[name] = {
      category: GROUP_MAP[gc] || 'produkty-gotowe',
      kcal: Math.round((protein||0)*4 + (fat||0)*9 + (carbs||0)*4),
      protein: protein||0, fat: fat||0, carbs: carbs||0,
      fiber: num(row['Fibres (g/100g)']), sugars: num(row['Sugars (g/100g)']),
      salt: num(row['Salt (g/100g)']), saturatedFat: num(row['FA saturated (g/100g)']),
      monoFat: num(row['FA mono (g/100g)']), polyFat: num(row['FA poly (g/100g)']),
      omega3: num(row['FA 18:3 c9,c12,c15 (n-3) (g/100g)']),
      epa: num(row['FA 20:5 5c,8c,11c,14c,17c (n-3) EPA (g/100g)']),
      dha: num(row['FA 22:6 4c,7c,10c,13c,16c,19c (n-3) DHA (g/100g)']),
      cholesterol: num(row['Cholesterol (mg/100g)']),
      calcium: num(row['Calcium (mg/100g)']), iron: num(row['Iron (mg/100g)']),
      magnesium: num(row['Magnesium (mg/100g)']), phosphorus: num(row['Phosphorus (mg/100g)']),
      potassium: num(row['Potassium (mg/100g)']), sodium: num(row['Sodium (mg/100g)']),
      zinc: num(row['Zinc (mg/100g)']), copper: num(row['Copper (mg/100g)']),
      manganese: num(row['Manganese (mg/100g)']), selenium: num(row['Selenium (µg/100g)']),
      iodine: num(row['Iodine (µg/100g)']), chloride: num(row['Chloride (mg/100g)']),
      vitA: num(row['Retinol (µg/100g)']), vitD: num(row['Vitamin D (µg/100g)']),
      vitE: num(row['Vitamin E (mg/100g)']), vitC: num(row['Vitamin C (mg/100g)']),
      vitB1: num(row['Vitamin B1 or Thiamin (mg/100g)']),
      vitB2: num(row['Vitamin B2 or Riboflavin (mg/100g)']),
      vitB3: num(row['Vitamin B3 or Niacin (mg/100g)']),
      vitB5: num(row['Vitamin B5 or Pantothenic acid (mg/100g)']),
      vitB6: num(row['Vitamin B6 (mg/100g)']),
      folate: num(row['Vitamin B9 or Folate (µg/100g)']),
      vitB12: num(row['Vitamin B12 (µg/100g)']),
    };
  }
  console.log('CIQUAL map:', Object.keys(ciqMap).length);

  // 2. Load translations
  const b1 = JSON.parse(fs.readFileSync(path.join(dataDir, 'ciqual-translations-batch1.json'), 'utf8'));
  const b2 = JSON.parse(fs.readFileSync(path.join(dataDir, 'ciqual-translations-batch2.json'), 'utf8'));
  const b3 = JSON.parse(fs.readFileSync(path.join(dataDir, 'ciqual-translations-batch3.json'), 'utf8'));
  const transMap = {};
  for (const t of [...b1.translations, ...b2.translations, ...b3.translations]) {
    transMap[t.pl] = t.en;
  }

  // 3. Parse accepted from review
  const lines = fs.readFileSync(path.join(dataDir, 'ciqual-import-review.txt'), 'utf8').split('\n');
  const accepted = [];
  for (const line of lines) {
    if (!line.includes('kcal')) continue;
    if (/^(===|---|Nowe|Duplikaty|Egzotyczne|Jeśli)/.test(line)) continue;
    const match = line.match(/^(.+?)\s+\(\d+\s+kcal/);
    if (match) accepted.push(match[1].trim());
  }
  console.log('Accepted:', accepted.length);

  // 4. Import
  const p = new PrismaClient();
  let imported = 0, errors = 0, dupSlug = 0, noData = 0, noTrans = 0;

  for (const plName of accepted) {
    const enName = transMap[plName];
    if (!enName) { noTrans++; continue; }
    const ciq = ciqMap[enName];
    if (!ciq) { noData++; continue; }

    const slug = plName.toLowerCase()
      .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l')
      .replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

    const existingSlug = await p.cleanProduct.findFirst({ where: { slug } });
    if (existingSlug) { dupSlug++; continue; }

    try {
      await p.cleanProduct.create({
        data: {
          name: plName, nameEn: enName, slug, type: 'BASE',
          category: ciq.category, sourcePrimary: 'CIQUAL',
          qualityScore: 85, verificationStatus: 'VERIFIED', hasMicronutrients: true,
          nutrients: { create: {
            kcalPer100g: ciq.kcal, proteinPer100g: ciq.protein, fatPer100g: ciq.fat,
            carbsPer100g: ciq.carbs, fiberPer100g: ciq.fiber, sugarsPer100g: ciq.sugars,
            saltPer100g: ciq.salt, saturatedFatPer100g: ciq.saturatedFat,
            monounsaturatedFatPer100g: ciq.monoFat, polyunsaturatedFatPer100g: ciq.polyFat,
            omega3Per100g: ciq.omega3, epaPer100g: ciq.epa, dhaPer100g: ciq.dha,
            cholesterolMg: ciq.cholesterol, calciumMg: ciq.calcium, ironMg: ciq.iron,
            magnesiumMg: ciq.magnesium, phosphorusMg: ciq.phosphorus,
            potassiumMg: ciq.potassium, sodiumMg: ciq.sodium,
            zincMg: ciq.zinc, copperMg: ciq.copper, manganeseMg: ciq.manganese,
            seleniumUg: ciq.selenium, iodineUg: ciq.iodine, chlorideMg: ciq.chloride,
            vitaminAUg: ciq.vitA, vitaminDUg: ciq.vitD, vitaminEMg: ciq.vitE,
            vitaminCMg: ciq.vitC, vitaminB1Mg: ciq.vitB1, vitaminB2Mg: ciq.vitB2,
            vitaminB3Mg: ciq.vitB3, vitaminB5Mg: ciq.vitB5, vitaminB6Mg: ciq.vitB6,
            folateUg: ciq.folate, vitaminB12Ug: ciq.vitB12,
          }},
        },
      });
      imported++;
    } catch (err) {
      errors++;
      if (errors <= 3) console.log('  Error:', plName, err.message?.slice(0, 100));
    }
  }

  const total = await p.cleanProduct.count();
  const withMicro = await p.cleanProduct.count({ where: { hasMicronutrients: true } });
  const bySrc = await p.cleanProduct.groupBy({ by: ['sourcePrimary'], _count: true });

  console.log('\n=== WYNIK ===');
  console.log('Zaimportowano:', imported);
  console.log('Duplikat slug:', dupSlug);
  console.log('Brak tłumaczenia:', noTrans);
  console.log('Brak danych CIQUAL:', noData);
  console.log('Błędy:', errors);
  console.log('\n=== STAN BAZY ===');
  bySrc.forEach(s => console.log('  ' + s.sourcePrimary + ': ' + s._count));
  console.log('  RAZEM:', total);
  console.log('  Z mikro:', withMicro, '(' + Math.round(withMicro/total*100) + '%)');

  await p.$disconnect();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
