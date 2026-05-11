/**
 * add-basic-ingredients.js
 * Adds ~80 basic Polish cooking ingredients with full micronutrients from CIQUAL.
 * These are the essential products that every diet plan needs.
 *
 * Run: cd packages/database && node ../../scripts/add-basic-ingredients.js
 */

const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

function num(val) {
  if (!val || val === '-' || val === 'traces') return null;
  const s = String(val).replace(',', '.').replace('<', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function guessCat(name) {
  if (/ryż|kasza|makaron|mąka|chleb|bułka|płatki|kuskus|bulgur|tortill/i.test(name)) return 'produkty-zbozowe';
  if (/pomidor|ogórek|marchew|ziemniak|sałat|szpinak|brokul|cukin|papryk|cebul|czosnek|fasol|soczewic|ciecierzyc|groszek|kukurydz|burak|kapust|seler|por |dyni|bakłażan|kalafior|rukol/i.test(name)) return 'warzywa';
  if (/masło|olej|oliwa|śmietan|smalec/i.test(name)) return 'tluszcze';
  if (/ser |jogurt|mleko|jajk|twaróg|ricotta/i.test(name)) return 'nabial-i-jaja';
  if (/mięso|schab|wołow|wieprzow|kurczak|indyk|kaczk/i.test(name)) return 'mieso-i-wedliny';
  if (/łosoś|dorsz|krewetk|tuńczyk|pstrąg|makrela|śledź/i.test(name)) return 'ryby';
  if (/truskawk|malin|borówk|jabłk|banan|pomarańcz|gruszk|cytryn|winogrona|kiwi|mango|ananas|arbuz|brzoskwin|nektaryn|śliwk|czereśni/i.test(name)) return 'owoce';
  if (/migdał|orzech|pestk|sezam|siemię|nasion/i.test(name)) return 'bakalie-i-nasiona';
  return 'przyprawy';
}

// Polish name → CIQUAL search term (substring to match in English name)
const BASICS = {
  // Zboża i kasze
  'Płatki owsiane': 'Oat flakes',
  'Ryż biały': 'Rice, white',
  'Ryż brązowy': 'Rice, brown',
  'Ryż basmati': 'Rice, basmati',
  'Makaron pszenny': 'Pasta, dry',
  'Makaron pełnoziarnisty': 'Pasta, wholemeal',
  'Kasza gryczana': 'Buckwheat',
  'Kasza jęczmienna pęczak': 'Barley, pearl',
  'Kasza bulgur': 'Bulgur',
  'Kuskus': 'Couscous, dry',
  'Mąka pszenna': 'Flour, wheat',
  'Chleb pszenny': 'Bread, white',
  'Chleb pełnoziarnisty': 'Bread, whole wheat',
  'Chleb żytni': 'Bread, rye',
  'Bułka pszenna': 'Roll, white',
  'Tortilla pszenna': 'Tortilla',

  // Warzywa
  'Pomidor': 'Tomato, raw',
  'Ogórek': 'Cucumber, raw',
  'Marchew': 'Carrot, raw',
  'Ziemniaki': 'Potato, raw',
  'Sałata': 'Lettuce, raw',
  'Szpinak': 'Spinach, raw',
  'Brokuł': 'Broccoli, raw',
  'Cukinia': 'Courgette',
  'Papryka czerwona': 'Pepper, red, raw',
  'Papryka zielona': 'Pepper, green, raw',
  'Czosnek': 'Garlic, raw',
  'Fasola biała': 'White bean',
  'Fasola czerwona': 'Red bean',
  'Soczewica czerwona': 'Lentil, coral',
  'Soczewica zielona': 'Lentil, green',
  'Ciecierzyca': 'Chickpea',
  'Groszek zielony': 'Pea, raw',
  'Kukurydza': 'Sweetcorn',
  'Burak': 'Beetroot, raw',
  'Kapusta biała': 'Cabbage, white',
  'Seler naciowy': 'Celery, raw',
  'Por': 'Leek, raw',
  'Bakłażan': 'Aubergine',
  'Kalafior': 'Cauliflower, raw',
  'Rukola': 'Rocket salad',
  'Pieczarki': 'Mushroom',
  'Bataty': 'Sweet potato',

  // Tłuszcze
  'Masło': 'Butter, salted',
  'Masło niesolone': 'Butter, unsalted',
  'Olej rzepakowy': 'Rapeseed',
  'Olej słonecznikowy': 'Sunflower oil',
  'Olej kokosowy': 'Coconut oil',
  'Śmietana 18%': 'Sour cream',
  'Śmietana 30%': 'Thick cream 30%',

  // Nabiał
  'Ser gouda': 'Gouda',
  'Ser cheddar': 'Cheddar',
  'Ser feta': 'Feta',
  'Ser mozzarella': 'Mozzarella',
  'Ser parmezan': 'Parmesan',
  'Ser ricotta': 'Ricotta',
  'Jogurt grecki': 'Greek',
  'Twaróg półtłusty': 'Cottage cheese',

  // Mięso
  'Mięso mielone wołowe': 'Minced beef',
  'Mięso mielone wieprzowe': 'Minced pork',
  'Schab wieprzowy': 'Pork, loin',
  'Udko z kurczaka': 'Chicken, thigh',
  'Filet z indyka': 'Turkey, breast',
  'Kaczka': 'Duck, breast',

  // Ryby
  'Łosoś': 'Salmon, Atlantic',
  'Dorsz': 'Cod, raw',
  'Tuńczyk świeży': 'Tuna, raw',
  'Tuńczyk w puszce': 'Tuna, canned',
  'Pstrąg': 'Trout, raw',
  'Makrela': 'Mackerel, raw',
  'Krewetki': 'Shrimp, raw',
  'Śledź': 'Herring, raw',

  // Owoce
  'Truskawki': 'Strawberry, raw',
  'Maliny': 'Raspberry, raw',
  'Borówki': 'Blueberry, raw',
  'Jabłko': 'Apple, raw',
  'Banan': 'Banana, raw',
  'Pomarańcza': 'Orange, raw',
  'Gruszka': 'Pear, raw',
  'Cytryna': 'Lemon, raw',
  'Kiwi': 'Kiwi, raw',
  'Mango': 'Mango, raw',
  'Ananas': 'Pineapple, raw',
  'Brzoskwinia': 'Peach, raw',
  'Śliwka': 'Plum, raw',
  'Winogrona': 'Grape, raw',
  'Arbuz': 'Watermelon, raw',

  // Orzechy i nasiona
  'Migdały': 'Almond, raw',
  'Orzechy włoskie': 'Walnut, raw',
  'Orzechy nerkowca': 'Cashew',
  'Pestki słonecznika': 'Sunflower seed',
  'Pestki dyni': 'Pumpkin seed',
  'Siemię lniane': 'Flax seed',
  'Sezam': 'Sesame seed',
  'Orzechy laskowe': 'Hazelnut',

  // Przyprawy i sosy
  'Miód': 'Honey',
  'Cukier': 'Sugar, white',
  'Sól': 'Salt, table',
  'Pieprz czarny': 'Pepper, black',
  'Passata pomidorowa': 'Tomato, puree',
  'Sos sojowy': 'Soy sauce',
  'Ocet jabłkowy': 'Vinegar, cider',
  'Musztarda': 'Mustard',
  'Majonez': 'Mayonnaise',
  'Ketchup': 'Ketchup',
  'Bulion warzywny': 'Vegetable broth',
};

async function main() {
  console.log('=== Adding Basic Polish Cooking Ingredients ===\n');

  // Parse CIQUAL XLS
  const wb = XLSX.readFile(path.resolve(__dirname, '../data/ciqual-2020.xls'));
  const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log('CIQUAL entries:', rawData.length);

  const p = new PrismaClient();
  let imported = 0, skipped = 0, notFound = 0;

  for (const [plName, searchTerm] of Object.entries(BASICS)) {
    // Check if already exists
    const exists = await p.cleanProduct.findFirst({
      where: { name: { equals: plName, mode: 'insensitive' } },
    });
    if (exists) { skipped++; continue; }

    // Check slug duplicate
    const slug = makeSlug(plName);
    const slugExists = await p.cleanProduct.findFirst({ where: { slug } });
    if (slugExists) { skipped++; continue; }

    // Find in CIQUAL (search for best match)
    const searchLower = searchTerm.toLowerCase();
    const ciqRow = rawData.find(r => {
      const name = (r['alim_nom_eng'] || '').toLowerCase();
      return name.includes(searchLower);
    });

    if (!ciqRow) {
      console.log('  NOT FOUND:', plName, '→', searchTerm);
      notFound++;
      continue;
    }

    const protein = num(ciqRow['Protein (g/100g)']);
    const fat = num(ciqRow['Fat (g/100g)']);
    const carbs = num(ciqRow['Carbohydrate (g/100g)']);
    const kcal = Math.round((protein || 0) * 4 + (fat || 0) * 9 + (carbs || 0) * 4);

    try {
      await p.cleanProduct.create({
        data: {
          name: plName,
          nameEn: ciqRow['alim_nom_eng'],
          slug,
          type: 'BASE',
          category: guessCat(plName),
          sourcePrimary: 'MANUAL',
          qualityScore: 95, // highest — these are essentials
          verificationStatus: 'VERIFIED',
          hasMicronutrients: true,
          nutrients: {
            create: {
              kcalPer100g: kcal,
              proteinPer100g: protein || 0,
              fatPer100g: fat || 0,
              carbsPer100g: carbs || 0,
              fiberPer100g: num(ciqRow['Fibres (g/100g)']),
              sugarsPer100g: num(ciqRow['Sugars (g/100g)']),
              saltPer100g: num(ciqRow['Salt (g/100g)']),
              saturatedFatPer100g: num(ciqRow['FA saturated (g/100g)']),
              monounsaturatedFatPer100g: num(ciqRow['FA mono (g/100g)']),
              polyunsaturatedFatPer100g: num(ciqRow['FA poly (g/100g)']),
              cholesterolMg: num(ciqRow['Cholesterol (mg/100g)']),
              calciumMg: num(ciqRow['Calcium (mg/100g)']),
              ironMg: num(ciqRow['Iron (mg/100g)']),
              magnesiumMg: num(ciqRow['Magnesium (mg/100g)']),
              phosphorusMg: num(ciqRow['Phosphorus (mg/100g)']),
              potassiumMg: num(ciqRow['Potassium (mg/100g)']),
              sodiumMg: num(ciqRow['Sodium (mg/100g)']),
              zincMg: num(ciqRow['Zinc (mg/100g)']),
              copperMg: num(ciqRow['Copper (mg/100g)']),
              manganeseMg: num(ciqRow['Manganese (mg/100g)']),
              seleniumUg: num(ciqRow['Selenium (µg/100g)']),
              iodineUg: num(ciqRow['Iodine (µg/100g)']),
              chlorideMg: num(ciqRow['Chloride (mg/100g)']),
              vitaminAUg: num(ciqRow['Retinol (µg/100g)']),
              vitaminDUg: num(ciqRow['Vitamin D (µg/100g)']),
              vitaminEMg: num(ciqRow['Vitamin E (mg/100g)']),
              vitaminCMg: num(ciqRow['Vitamin C (mg/100g)']),
              vitaminB1Mg: num(ciqRow['Vitamin B1 or Thiamin (mg/100g)']),
              vitaminB2Mg: num(ciqRow['Vitamin B2 or Riboflavin (mg/100g)']),
              vitaminB3Mg: num(ciqRow['Vitamin B3 or Niacin (mg/100g)']),
              vitaminB5Mg: num(ciqRow['Vitamin B5 or Pantothenic acid (mg/100g)']),
              vitaminB6Mg: num(ciqRow['Vitamin B6 (mg/100g)']),
              folateUg: num(ciqRow['Vitamin B9 or Folate (µg/100g)']),
              vitaminB12Ug: num(ciqRow['Vitamin B12 (µg/100g)']),
            },
          },
        },
      });
      console.log('  ✅', plName, '(' + kcal + ' kcal) ←', ciqRow['alim_nom_eng']);
      imported++;
    } catch (err) {
      console.log('  ❌', plName, ':', err.message?.slice(0, 60));
    }
  }

  const total = await p.cleanProduct.count();
  const manual = await p.cleanProduct.count({ where: { sourcePrimary: 'MANUAL' } });
  const withMicro = await p.cleanProduct.count({ where: { hasMicronutrients: true } });

  console.log('\n=== WYNIK ===');
  console.log('Imported:', imported);
  console.log('Skipped (already exist):', skipped);
  console.log('Not found in CIQUAL:', notFound);
  console.log('\nMANUAL products:', manual);
  console.log('Total products:', total);
  console.log('With micro:', withMicro);

  await p.$disconnect();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
