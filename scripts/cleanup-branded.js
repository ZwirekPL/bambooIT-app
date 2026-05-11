const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const p = new PrismaClient({
  datasourceUrl: 'postgresql://dietetyk:dietetyk123@localhost:5432/dietetyk_ai?schema=public'
});

const brandKeywords = ['Pillsbury','Kraft','Campbell','Kellogg','General Mills','Nabisco','Oscar Mayer','Hormel','Tyson','Heinz','Del Monte','Dole','Gerber','Nestle','Hershey','Mars','Pepperidge Farm','Stouffer','Lean Cuisine','Healthy Choice','Marie Callender','Banquet','Swanson','Birds Eye','Green Giant','Betty Crocker','Duncan Hines','Jell-O','JELL-O','Cool Whip','Shake N Bake','Stove Top','Minute Maid','Tropicana','Prego','Ragu','Old El Paso','McCormick','Hellmann','Best Foods','Hidden Valley','Wish-Bone','Newman','Crisco','Wesson','Smart Ones','Morningstar','Boca','Worthington','Loma Linda','George Weston','Thomas English','Sara Lee','Entenmann','Hostess','Little Debbie','Frito-Lay','Quaker','Malt-O-Meal','Cream of Wheat','Carnation','Ovaltine','Ensure','Boost','SlimFast','PowerBar','Clif ','Totino','DiGiorno','Red Baron','Tombstone','Buitoni','Bertolli','Progresso','Goya','Gamesa','La Moderna','Ready Crust','USDA Commodity','Archway','Formulated bar','Frozen novelties'];

async function main() {
  const catsToRemove = await p.foodCategory.findMany({
    where: { nameEn: { in: ['Fast Foods', 'Restaurant Foods', 'Baby Foods', 'American Indian/Alaska Native Foods'] } },
    select: { id: true }
  });
  const catIds = catsToRemove.map(c => c.id);

  const allProducts = await p.foodProduct.findMany({ select: { id: true, name: true, categoryId: true } });
  const toDelete = allProducts.filter(x =>
    (x.categoryId && catIds.includes(x.categoryId)) ||
    brandKeywords.some(kw => x.name.toLowerCase().includes(kw.toLowerCase()))
  );
  const toKeep = allProducts.filter(x => !toDelete.some(d => d.id === x.id));

  console.log(`To delete: ${toDelete.length} | To keep: ${toKeep.length}`);

  const deleteIds = toDelete.map(x => x.id);

  for (let i = 0; i < deleteIds.length; i += 50) {
    const batch = deleteIds.slice(i, i + 50);
    await p.foodProductDietFlag.deleteMany({ where: { foodProductId: { in: batch } } });
    await p.foodProductNutrients.deleteMany({ where: { foodProductId: { in: batch } } });
    await p.foodProductAllergen.deleteMany({ where: { foodProductId: { in: batch } } });
    await p.foodProductSourceMeta.deleteMany({ where: { foodProductId: { in: batch } } });
    await p.householdMeasure.deleteMany({ where: { foodProductId: { in: batch } } });
    await p.foodProductAlias.deleteMany({ where: { foodProductId: { in: batch } } });
    // DataQualityIssue uses entityId not foodProductId
    await p.dataQualityIssue.deleteMany({ where: { entityId: { in: batch } } });
    await p.foodProduct.deleteMany({ where: { id: { in: batch } } });
    process.stdout.write(`\r${Math.min(i + 50, deleteIds.length)}/${deleteIds.length}`);
  }
  console.log('\nDelete done.');

  const exportData = toKeep.map(x => ({ id: x.id, nameEn: x.name }));
  fs.writeFileSync('food-names-to-translate.json', JSON.stringify(exportData));
  console.log(`Exported ${exportData.length} names to food-names-to-translate.json`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message.substring(0, 300)); process.exit(1); });
