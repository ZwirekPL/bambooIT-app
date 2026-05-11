/**
 * Seed data for FoodItem + FoodNutrients + FoodAllergen.
 * All nutritional values are per 100 g of edible portion.
 * Sources: IŻŻ (Instytut Żywności i Żywienia), USDA FoodData Central.
 */

export interface FoodSeedItem {
  name: string;
  brand?: string;
  category: string;
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
  fiber?: number;  // g
  sugar?: number;  // g
  allergens?: {
    gluten?: boolean;
    lactose?: boolean;
    nuts?: boolean;
    soy?: boolean;
    eggs?: boolean;
    fish?: boolean;
    celery?: boolean;
    mustard?: boolean;
    sesame?: boolean;
  };
}

export const FOOD_SEED_DATA: FoodSeedItem[] = [
  // ─── WARZYWA ────────────────────────────────────────────────────────────────
  { name: 'Marchew', category: 'Warzywa', kcal: 41, protein: 0.9, fat: 0.2, carbs: 9.6, fiber: 2.8 },
  { name: 'Ziemniaki', category: 'Warzywa', kcal: 77, protein: 2.0, fat: 0.1, carbs: 17.5, fiber: 2.2 },
  { name: 'Brokuły', category: 'Warzywa', kcal: 34, protein: 2.8, fat: 0.4, carbs: 7.0, fiber: 2.6 },
  { name: 'Szpinak', category: 'Warzywa', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2 },
  { name: 'Pomidory', category: 'Warzywa', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2 },
  { name: 'Ogórek', category: 'Warzywa', kcal: 15, protein: 0.7, fat: 0.1, carbs: 3.6, fiber: 0.5 },
  { name: 'Papryka czerwona', category: 'Warzywa', kcal: 31, protein: 1.0, fat: 0.3, carbs: 6.0, fiber: 2.1 },
  { name: 'Papryka żółta', category: 'Warzywa', kcal: 27, protein: 1.0, fat: 0.2, carbs: 6.3, fiber: 0.9 },
  { name: 'Papryka zielona', category: 'Warzywa', kcal: 20, protein: 0.9, fat: 0.2, carbs: 4.6, fiber: 1.7 },
  { name: 'Cebula', category: 'Warzywa', kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fiber: 1.7 },
  { name: 'Czosnek', category: 'Warzywa', kcal: 149, protein: 6.4, fat: 0.5, carbs: 33.1, fiber: 2.1 },
  { name: 'Kalafior', category: 'Warzywa', kcal: 25, protein: 1.9, fat: 0.3, carbs: 5.0, fiber: 2.0 },
  { name: 'Kapusta biała', category: 'Warzywa', kcal: 25, protein: 1.3, fat: 0.1, carbs: 5.8, fiber: 2.5 },
  { name: 'Kapusta czerwona', category: 'Warzywa', kcal: 31, protein: 1.4, fat: 0.2, carbs: 7.4, fiber: 2.1 },
  { name: 'Sałata lodowa', category: 'Warzywa', kcal: 14, protein: 0.9, fat: 0.1, carbs: 2.9, fiber: 1.2 },
  { name: 'Por', category: 'Warzywa', kcal: 61, protein: 1.5, fat: 0.3, carbs: 14.2, fiber: 1.8 },
  { name: 'Burak ćwikłowy', category: 'Warzywa', kcal: 43, protein: 1.6, fat: 0.2, carbs: 9.6, fiber: 2.0 },
  { name: 'Cukinia', category: 'Warzywa', kcal: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1.0 },
  { name: 'Bakłażan', category: 'Warzywa', kcal: 25, protein: 1.0, fat: 0.2, carbs: 5.9, fiber: 3.0 },
  { name: 'Pieczarki', category: 'Warzywa', kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3, fiber: 1.0 },
  { name: 'Fasolka szparagowa gotowana', category: 'Warzywa', kcal: 31, protein: 1.8, fat: 0.1, carbs: 7.1, fiber: 3.4 },
  { name: 'Kukurydza gotowana', category: 'Warzywa', kcal: 96, protein: 3.4, fat: 1.5, carbs: 21.0, fiber: 2.4 },
  { name: 'Szparagi', category: 'Warzywa', kcal: 20, protein: 2.2, fat: 0.1, carbs: 3.9, fiber: 2.1 },
  { name: 'Dynia', category: 'Warzywa', kcal: 26, protein: 1.0, fat: 0.1, carbs: 6.5, fiber: 0.5 },
  { name: 'Rzodkiewka', category: 'Warzywa', kcal: 16, protein: 0.7, fat: 0.1, carbs: 3.4, fiber: 1.6 },
  { name: 'Seler naciowy', category: 'Warzywa', kcal: 16, protein: 0.7, fat: 0.2, carbs: 3.0, fiber: 1.6, allergens: { celery: true } },
  { name: 'Groszek zielony gotowany', category: 'Warzywa', kcal: 84, protein: 5.4, fat: 0.4, carbs: 15.6, fiber: 5.5 },
  { name: 'Słodki ziemniak (batat)', category: 'Warzywa', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20.1, fiber: 3.0 },
  { name: 'Rukola', category: 'Warzywa', kcal: 25, protein: 2.6, fat: 0.7, carbs: 3.7, fiber: 1.6 },
  { name: 'Jarmuż', category: 'Warzywa', kcal: 49, protein: 4.3, fat: 0.9, carbs: 8.8, fiber: 3.6 },

  // ─── OWOCE ──────────────────────────────────────────────────────────────────
  { name: 'Jabłko', category: 'Owoce', kcal: 52, protein: 0.3, fat: 0.2, carbs: 13.8, fiber: 2.4 },
  { name: 'Banan', category: 'Owoce', kcal: 89, protein: 1.1, fat: 0.3, carbs: 22.8, fiber: 2.6 },
  { name: 'Pomarańcza', category: 'Owoce', kcal: 47, protein: 0.9, fat: 0.1, carbs: 11.8, fiber: 2.4 },
  { name: 'Truskawki', category: 'Owoce', kcal: 32, protein: 0.7, fat: 0.3, carbs: 7.7, fiber: 2.0 },
  { name: 'Borówki (jagody)', category: 'Owoce', kcal: 57, protein: 0.7, fat: 0.3, carbs: 14.5, fiber: 2.4 },
  { name: 'Maliny', category: 'Owoce', kcal: 52, protein: 1.2, fat: 0.7, carbs: 11.9, fiber: 6.5 },
  { name: 'Mango', category: 'Owoce', kcal: 60, protein: 0.8, fat: 0.4, carbs: 15.0, fiber: 1.6 },
  { name: 'Winogrona zielone', category: 'Owoce', kcal: 69, protein: 0.7, fat: 0.2, carbs: 18.1, fiber: 0.9 },
  { name: 'Gruszka', category: 'Owoce', kcal: 57, protein: 0.4, fat: 0.1, carbs: 15.2, fiber: 3.1 },
  { name: 'Wiśnie', category: 'Owoce', kcal: 63, protein: 1.1, fat: 0.2, carbs: 16.0, fiber: 2.1 },
  { name: 'Śliwki', category: 'Owoce', kcal: 46, protein: 0.7, fat: 0.3, carbs: 11.4, fiber: 1.4 },
  { name: 'Morele', category: 'Owoce', kcal: 48, protein: 1.4, fat: 0.4, carbs: 11.1, fiber: 2.0 },
  { name: 'Kiwi', category: 'Owoce', kcal: 61, protein: 1.1, fat: 0.5, carbs: 14.7, fiber: 3.0 },
  { name: 'Ananas', category: 'Owoce', kcal: 50, protein: 0.5, fat: 0.1, carbs: 13.1, fiber: 1.4 },
  { name: 'Arbuz', category: 'Owoce', kcal: 30, protein: 0.6, fat: 0.2, carbs: 7.6, fiber: 0.4 },
  { name: 'Cytryna', category: 'Owoce', kcal: 29, protein: 1.1, fat: 0.3, carbs: 9.3, fiber: 2.8 },
  { name: 'Grejpfrut', category: 'Owoce', kcal: 42, protein: 0.8, fat: 0.1, carbs: 10.7, fiber: 1.6 },
  { name: 'Melon', category: 'Owoce', kcal: 34, protein: 0.8, fat: 0.2, carbs: 8.1, fiber: 0.9 },
  { name: 'Brzoskwinia', category: 'Owoce', kcal: 39, protein: 0.9, fat: 0.3, carbs: 9.5, fiber: 1.5 },
  { name: 'Granat', category: 'Owoce', kcal: 83, protein: 1.7, fat: 1.2, carbs: 18.7, fiber: 4.0 },
  { name: 'Awokado', category: 'Owoce', kcal: 160, protein: 2.0, fat: 14.7, carbs: 8.5, fiber: 6.7 },
  { name: 'Mandarynka', category: 'Owoce', kcal: 53, protein: 0.8, fat: 0.3, carbs: 13.3, fiber: 1.8 },
  { name: 'Porzeczka czarna', category: 'Owoce', kcal: 63, protein: 1.4, fat: 0.4, carbs: 15.4, fiber: 0.0 },
  { name: 'Agrest', category: 'Owoce', kcal: 44, protein: 0.9, fat: 0.6, carbs: 10.0, fiber: 4.3 },
  { name: 'Daktyle suszone', category: 'Owoce', kcal: 277, protein: 1.8, fat: 0.2, carbs: 74.9, fiber: 6.7 },

  // ─── MIĘSO I DRÓB ───────────────────────────────────────────────────────────
  { name: 'Pierś z kurczaka gotowana', category: 'Mięso i drób', kcal: 165, protein: 31.0, fat: 3.6, carbs: 0.0 },
  { name: 'Udo z kurczaka bez skóry gotowane', category: 'Mięso i drób', kcal: 174, protein: 25.0, fat: 7.7, carbs: 0.0 },
  { name: 'Kurczak cały pieczony ze skórą', category: 'Mięso i drób', kcal: 215, protein: 18.6, fat: 15.1, carbs: 0.0 },
  { name: 'Pierś z indyka gotowana', category: 'Mięso i drób', kcal: 189, protein: 29.0, fat: 7.4, carbs: 0.0 },
  { name: 'Polędwica wołowa surowa', category: 'Mięso i drób', kcal: 158, protein: 22.2, fat: 7.4, carbs: 0.0 },
  { name: 'Mielona wołowina 15% tłuszczu', category: 'Mięso i drób', kcal: 215, protein: 17.9, fat: 15.5, carbs: 0.0 },
  { name: 'Schab wieprzowy surowy', category: 'Mięso i drób', kcal: 182, protein: 22.0, fat: 10.0, carbs: 0.0 },
  { name: 'Polędwiczka wieprzowa surowa', category: 'Mięso i drób', kcal: 121, protein: 20.2, fat: 4.3, carbs: 0.0 },
  { name: 'Łopatka wieprzowa surowa', category: 'Mięso i drób', kcal: 196, protein: 19.0, fat: 13.0, carbs: 0.0 },
  { name: 'Karkówka wieprzowa surowa', category: 'Mięso i drób', kcal: 237, protein: 18.0, fat: 18.0, carbs: 0.0 },
  { name: 'Boczek surowy', category: 'Mięso i drób', kcal: 541, protein: 9.4, fat: 56.7, carbs: 0.0 },
  { name: 'Szynka wieprzowa gotowana', category: 'Mięso i drób', kcal: 145, protein: 19.0, fat: 7.5, carbs: 0.5 },
  { name: 'Kiełbasa śląska', category: 'Mięso i drób', kcal: 302, protein: 16.2, fat: 26.0, carbs: 1.0 },
  { name: 'Kabanos wieprzowy', category: 'Mięso i drób', kcal: 428, protein: 29.7, fat: 34.2, carbs: 1.5 },
  { name: 'Cielęcina chuda', category: 'Mięso i drób', kcal: 172, protein: 19.7, fat: 9.9, carbs: 0.0 },
  { name: 'Wątroba wieprzowa', category: 'Mięso i drób', kcal: 134, protein: 20.6, fat: 4.7, carbs: 2.5 },
  { name: 'Wątroba wołowa', category: 'Mięso i drób', kcal: 135, protein: 20.4, fat: 3.8, carbs: 3.7 },
  { name: 'Żeberka wieprzowe', category: 'Mięso i drób', kcal: 292, protein: 17.1, fat: 24.6, carbs: 0.0 },
  { name: 'Mielona wieprzowina', category: 'Mięso i drób', kcal: 297, protein: 17.0, fat: 25.0, carbs: 0.0 },
  { name: 'Baranina (udziec)', category: 'Mięso i drób', kcal: 282, protein: 16.6, fat: 23.7, carbs: 0.0 },

  // ─── RYBY I OWOCE MORZA ─────────────────────────────────────────────────────
  { name: 'Łosoś atlantycki', category: 'Ryby i owoce morza', kcal: 208, protein: 20.0, fat: 13.4, carbs: 0.0, allergens: { fish: true } },
  { name: 'Makrela', category: 'Ryby i owoce morza', kcal: 205, protein: 19.0, fat: 13.9, carbs: 0.0, allergens: { fish: true } },
  { name: 'Tuńczyk w wodzie (puszka)', category: 'Ryby i owoce morza', kcal: 116, protein: 25.5, fat: 0.5, carbs: 0.0, allergens: { fish: true } },
  { name: 'Tuńczyk w oleju (puszka)', category: 'Ryby i owoce morza', kcal: 198, protein: 28.5, fat: 9.4, carbs: 0.0, allergens: { fish: true } },
  { name: 'Dorsz atlantycki', category: 'Ryby i owoce morza', kcal: 82, protein: 17.8, fat: 0.7, carbs: 0.0, allergens: { fish: true } },
  { name: 'Pstrąg tęczowy', category: 'Ryby i owoce morza', kcal: 141, protein: 19.9, fat: 6.2, carbs: 0.0, allergens: { fish: true } },
  { name: 'Śledź atlantycki', category: 'Ryby i owoce morza', kcal: 158, protein: 18.0, fat: 9.0, carbs: 0.0, allergens: { fish: true } },
  { name: 'Halibut', category: 'Ryby i owoce morza', kcal: 111, protein: 22.5, fat: 2.3, carbs: 0.0, allergens: { fish: true } },
  { name: 'Mintaj', category: 'Ryby i owoce morza', kcal: 72, protein: 15.8, fat: 0.5, carbs: 0.0, allergens: { fish: true } },
  { name: 'Sandacz', category: 'Ryby i owoce morza', kcal: 84, protein: 19.2, fat: 0.4, carbs: 0.0, allergens: { fish: true } },
  { name: 'Tilapia', category: 'Ryby i owoce morza', kcal: 96, protein: 20.1, fat: 2.0, carbs: 0.0, allergens: { fish: true } },
  { name: 'Karp', category: 'Ryby i owoce morza', kcal: 127, protein: 17.8, fat: 5.6, carbs: 0.0, allergens: { fish: true } },
  { name: 'Łosoś wędzony', category: 'Ryby i owoce morza', kcal: 117, protein: 18.3, fat: 4.3, carbs: 0.0, allergens: { fish: true } },
  { name: 'Sardynki w oleju (puszka)', category: 'Ryby i owoce morza', kcal: 208, protein: 24.6, fat: 11.4, carbs: 0.0, allergens: { fish: true } },
  { name: 'Krewetki gotowane', category: 'Ryby i owoce morza', kcal: 99, protein: 24.0, fat: 0.3, carbs: 0.0, allergens: { fish: true } },
  { name: 'Kalmary', category: 'Ryby i owoce morza', kcal: 92, protein: 15.6, fat: 1.4, carbs: 3.1, allergens: { fish: true } },
  { name: 'Małże gotowane', category: 'Ryby i owoce morza', kcal: 86, protein: 11.9, fat: 2.2, carbs: 3.7, allergens: { fish: true } },
  { name: 'Flądra', category: 'Ryby i owoce morza', kcal: 91, protein: 18.8, fat: 1.9, carbs: 0.0, allergens: { fish: true } },

  // ─── NABIAŁ ─────────────────────────────────────────────────────────────────
  { name: 'Mleko pełne 3,2%', category: 'Nabiał', kcal: 61, protein: 3.2, fat: 3.2, carbs: 4.8, allergens: { lactose: true } },
  { name: 'Mleko 2%', category: 'Nabiał', kcal: 46, protein: 3.3, fat: 2.0, carbs: 4.8, allergens: { lactose: true } },
  { name: 'Mleko odtłuszczone 0,5%', category: 'Nabiał', kcal: 34, protein: 3.4, fat: 0.2, carbs: 4.9, allergens: { lactose: true } },
  { name: 'Jogurt naturalny 2%', category: 'Nabiał', kcal: 56, protein: 3.5, fat: 2.0, carbs: 5.7, allergens: { lactose: true } },
  { name: 'Jogurt skyr', category: 'Nabiał', kcal: 62, protein: 9.9, fat: 0.2, carbs: 4.5, allergens: { lactose: true } },
  { name: 'Jogurt grecki 10%', category: 'Nabiał', kcal: 97, protein: 9.0, fat: 5.0, carbs: 3.6, allergens: { lactose: true } },
  { name: 'Twaróg półtłusty', category: 'Nabiał', kcal: 155, protein: 17.0, fat: 7.5, carbs: 3.0, allergens: { lactose: true } },
  { name: 'Twaróg chudy', category: 'Nabiał', kcal: 98, protein: 18.7, fat: 0.6, carbs: 3.5, allergens: { lactose: true } },
  { name: 'Ser gouda', category: 'Nabiał', kcal: 356, protein: 25.0, fat: 27.5, carbs: 2.2, allergens: { lactose: true } },
  { name: 'Ser mozzarella', category: 'Nabiał', kcal: 254, protein: 18.0, fat: 19.9, carbs: 2.2, allergens: { lactose: true } },
  { name: 'Ser feta', category: 'Nabiał', kcal: 264, protein: 14.2, fat: 21.3, carbs: 4.1, allergens: { lactose: true } },
  { name: 'Ser cheddar', category: 'Nabiał', kcal: 402, protein: 24.9, fat: 33.1, carbs: 1.3, allergens: { lactose: true } },
  { name: 'Ser parmezan', category: 'Nabiał', kcal: 431, protein: 38.5, fat: 29.7, carbs: 4.1, allergens: { lactose: true } },
  { name: 'Ser camembert', category: 'Nabiał', kcal: 300, protein: 19.8, fat: 24.3, carbs: 0.5, allergens: { lactose: true } },
  { name: 'Serek wiejski', category: 'Nabiał', kcal: 98, protein: 11.1, fat: 4.3, carbs: 3.4, allergens: { lactose: true } },
  { name: 'Ser ricotta', category: 'Nabiał', kcal: 174, protein: 11.3, fat: 13.0, carbs: 3.0, allergens: { lactose: true } },
  { name: 'Masło', category: 'Nabiał', kcal: 717, protein: 0.9, fat: 81.1, carbs: 0.1, allergens: { lactose: true } },
  { name: 'Śmietana 18%', category: 'Nabiał', kcal: 196, protein: 2.7, fat: 20.0, carbs: 2.5, allergens: { lactose: true } },
  { name: 'Śmietanka kremówka 30%', category: 'Nabiał', kcal: 292, protein: 2.2, fat: 30.4, carbs: 3.1, allergens: { lactose: true } },
  { name: 'Kefir', category: 'Nabiał', kcal: 61, protein: 3.3, fat: 3.3, carbs: 4.0, allergens: { lactose: true } },
  { name: 'Maślanka', category: 'Nabiał', kcal: 40, protein: 3.4, fat: 1.0, carbs: 4.6, allergens: { lactose: true } },
  { name: 'Masło klarowane (ghee)', category: 'Nabiał', kcal: 876, protein: 0.3, fat: 99.8, carbs: 0.0 },

  // ─── ZBOŻA I KASZE ──────────────────────────────────────────────────────────
  { name: 'Kasza gryczana gotowana', category: 'Zboża i kasze', kcal: 101, protein: 3.6, fat: 0.8, carbs: 20.5, fiber: 1.7 },
  { name: 'Kasza jaglana gotowana', category: 'Zboża i kasze', kcal: 119, protein: 3.5, fat: 1.0, carbs: 23.7, fiber: 1.3 },
  { name: 'Kasza pęczak gotowany', category: 'Zboża i kasze', kcal: 123, protein: 3.4, fat: 0.5, carbs: 26.3, fiber: 1.0, allergens: { gluten: true } },
  { name: 'Ryż biały gotowany', category: 'Zboża i kasze', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28.2, fiber: 0.4 },
  { name: 'Ryż brązowy gotowany', category: 'Zboża i kasze', kcal: 112, protein: 2.6, fat: 0.9, carbs: 23.5, fiber: 1.8 },
  { name: 'Ryż jaśminowy gotowany', category: 'Zboża i kasze', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28.2, fiber: 0.3 },
  { name: 'Płatki owsiane', category: 'Zboża i kasze', kcal: 389, protein: 16.9, fat: 6.9, carbs: 66.3, fiber: 10.6, allergens: { gluten: true } },
  { name: 'Makaron pszenny biały gotowany', category: 'Zboża i kasze', kcal: 158, protein: 5.8, fat: 0.9, carbs: 31.3, fiber: 1.8, allergens: { gluten: true } },
  { name: 'Makaron pełnoziarnisty gotowany', category: 'Zboża i kasze', kcal: 174, protein: 7.5, fat: 1.4, carbs: 35.4, fiber: 3.9, allergens: { gluten: true } },
  { name: 'Quinoa gotowana', category: 'Zboża i kasze', kcal: 120, protein: 4.4, fat: 1.9, carbs: 21.3, fiber: 2.8 },
  { name: 'Kasza kus-kus gotowana', category: 'Zboża i kasze', kcal: 112, protein: 3.8, fat: 0.2, carbs: 23.2, fiber: 1.4, allergens: { gluten: true } },
  { name: 'Kasza bulgur gotowana', category: 'Zboża i kasze', kcal: 83, protein: 3.1, fat: 0.2, carbs: 18.6, fiber: 4.5, allergens: { gluten: true } },
  { name: 'Amarantus gotowany', category: 'Zboża i kasze', kcal: 102, protein: 3.8, fat: 1.6, carbs: 18.7, fiber: 2.1 },
  { name: 'Mąka pszenna tortowa (typ 450)', category: 'Zboża i kasze', kcal: 364, protein: 10.0, fat: 1.2, carbs: 76.3, fiber: 2.7, allergens: { gluten: true } },
  { name: 'Mąka pszenna razowa (typ 2000)', category: 'Zboża i kasze', kcal: 339, protein: 12.5, fat: 2.5, carbs: 71.0, fiber: 7.3, allergens: { gluten: true } },
  { name: 'Płatki kukurydziane', category: 'Zboża i kasze', kcal: 379, protein: 7.0, fat: 1.5, carbs: 83.3, fiber: 3.3 },
  { name: 'Otręby pszenne', category: 'Zboża i kasze', kcal: 206, protein: 14.6, fat: 4.3, carbs: 26.8, fiber: 42.8, allergens: { gluten: true } },
  { name: 'Kasza orkiszowa gotowana', category: 'Zboża i kasze', kcal: 127, protein: 5.5, fat: 0.9, carbs: 26.0, fiber: 3.9, allergens: { gluten: true } },
  { name: 'Musli z owocami', category: 'Zboża i kasze', kcal: 360, protein: 9.8, fat: 5.0, carbs: 69.0, fiber: 7.0, allergens: { gluten: true } },
  { name: 'Płatki żytnie', category: 'Zboża i kasze', kcal: 341, protein: 11.0, fat: 2.2, carbs: 70.7, fiber: 15.1, allergens: { gluten: true } },

  // ─── PIECZYWO ───────────────────────────────────────────────────────────────
  { name: 'Chleb żytni pełnoziarnisty', category: 'Pieczywo', kcal: 259, protein: 8.5, fat: 3.3, carbs: 49.0, fiber: 7.9, allergens: { gluten: true } },
  { name: 'Chleb pszenny biały', category: 'Pieczywo', kcal: 265, protein: 8.9, fat: 3.2, carbs: 49.0, fiber: 2.7, allergens: { gluten: true } },
  { name: 'Chleb graham', category: 'Pieczywo', kcal: 247, protein: 8.5, fat: 2.2, carbs: 49.6, fiber: 6.5, allergens: { gluten: true } },
  { name: 'Bułka pszenna', category: 'Pieczywo', kcal: 289, protein: 9.2, fat: 3.0, carbs: 57.0, fiber: 2.4, allergens: { gluten: true } },
  { name: 'Chleb żytni razowy', category: 'Pieczywo', kcal: 241, protein: 8.0, fat: 1.7, carbs: 46.0, fiber: 8.0, allergens: { gluten: true } },
  { name: 'Bagietka', category: 'Pieczywo', kcal: 272, protein: 9.0, fat: 1.5, carbs: 53.0, fiber: 2.5, allergens: { gluten: true } },
  { name: 'Chleb tostowy', category: 'Pieczywo', kcal: 278, protein: 8.5, fat: 3.5, carbs: 52.0, fiber: 3.0, allergens: { gluten: true } },
  { name: 'Tortilla pszenna', category: 'Pieczywo', kcal: 306, protein: 9.0, fat: 7.5, carbs: 47.0, fiber: 2.5, allergens: { gluten: true } },
  { name: 'Wafle ryżowe', category: 'Pieczywo', kcal: 381, protein: 8.0, fat: 2.8, carbs: 79.7, fiber: 3.4 },
  { name: 'Pieczywo chrupkie żytnie', category: 'Pieczywo', kcal: 354, protein: 11.2, fat: 3.9, carbs: 68.3, fiber: 16.7, allergens: { gluten: true } },
  { name: 'Pumpernikiel', category: 'Pieczywo', kcal: 241, protein: 8.3, fat: 1.0, carbs: 50.0, fiber: 7.5, allergens: { gluten: true } },
  { name: 'Chleb bezglutenowy', category: 'Pieczywo', kcal: 256, protein: 4.5, fat: 5.0, carbs: 50.0, fiber: 3.0 },

  // ─── ROŚLINY STRĄCZKOWE ─────────────────────────────────────────────────────
  { name: 'Soczewica czerwona gotowana', category: 'Rośliny strączkowe', kcal: 116, protein: 9.0, fat: 0.4, carbs: 20.1, fiber: 7.9 },
  { name: 'Soczewica zielona gotowana', category: 'Rośliny strączkowe', kcal: 116, protein: 9.0, fat: 0.4, carbs: 20.1, fiber: 7.9 },
  { name: 'Ciecierzyca gotowana', category: 'Rośliny strączkowe', kcal: 164, protein: 8.9, fat: 2.6, carbs: 27.4, fiber: 7.6 },
  { name: 'Fasola czerwona gotowana', category: 'Rośliny strączkowe', kcal: 127, protein: 8.7, fat: 0.5, carbs: 22.8, fiber: 7.4 },
  { name: 'Fasola biała gotowana', category: 'Rośliny strączkowe', kcal: 139, protein: 9.7, fat: 0.5, carbs: 25.1, fiber: 6.3 },
  { name: 'Edamame gotowane', category: 'Rośliny strączkowe', kcal: 121, protein: 11.9, fat: 5.2, carbs: 8.9, fiber: 5.2, allergens: { soy: true } },
  { name: 'Tofu twarde', category: 'Rośliny strączkowe', kcal: 76, protein: 8.1, fat: 4.5, carbs: 1.9, fiber: 0.3, allergens: { soy: true } },
  { name: 'Tempeh', category: 'Rośliny strączkowe', kcal: 193, protein: 19.0, fat: 10.8, carbs: 9.4, allergens: { soy: true } },
  { name: 'Groch żółty łuskany gotowany', category: 'Rośliny strączkowe', kcal: 118, protein: 8.3, fat: 0.4, carbs: 21.1, fiber: 8.3 },
  { name: 'Soja gotowana', category: 'Rośliny strączkowe', kcal: 173, protein: 16.6, fat: 9.0, carbs: 9.9, fiber: 6.0, allergens: { soy: true } },
  { name: 'Bób gotowany', category: 'Rośliny strączkowe', kcal: 110, protein: 8.0, fat: 0.5, carbs: 19.7, fiber: 7.7 },

  // ─── ORZECHY I NASIONA ──────────────────────────────────────────────────────
  { name: 'Migdały', category: 'Orzechy i nasiona', kcal: 579, protein: 21.2, fat: 49.9, carbs: 21.6, fiber: 12.5, allergens: { nuts: true } },
  { name: 'Orzechy włoskie', category: 'Orzechy i nasiona', kcal: 654, protein: 15.2, fat: 65.2, carbs: 13.7, fiber: 6.7, allergens: { nuts: true } },
  { name: 'Orzechy laskowe', category: 'Orzechy i nasiona', kcal: 628, protein: 15.0, fat: 60.8, carbs: 16.7, fiber: 9.7, allergens: { nuts: true } },
  { name: 'Orzechy nerkowca', category: 'Orzechy i nasiona', kcal: 553, protein: 18.2, fat: 43.8, carbs: 30.2, fiber: 3.3, allergens: { nuts: true } },
  { name: 'Orzechy ziemne', category: 'Orzechy i nasiona', kcal: 567, protein: 25.8, fat: 49.2, carbs: 16.1, fiber: 8.5, allergens: { nuts: true } },
  { name: 'Pistacje', category: 'Orzechy i nasiona', kcal: 560, protein: 20.2, fat: 45.4, carbs: 27.2, fiber: 10.6, allergens: { nuts: true } },
  { name: 'Makadamia', category: 'Orzechy i nasiona', kcal: 718, protein: 7.9, fat: 75.8, carbs: 13.8, fiber: 8.6, allergens: { nuts: true } },
  { name: 'Pekan', category: 'Orzechy i nasiona', kcal: 691, protein: 9.2, fat: 72.0, carbs: 13.9, fiber: 9.6, allergens: { nuts: true } },
  { name: 'Pestki dyni', category: 'Orzechy i nasiona', kcal: 559, protein: 30.2, fat: 49.1, carbs: 10.7, fiber: 6.0 },
  { name: 'Pestki słonecznika', category: 'Orzechy i nasiona', kcal: 584, protein: 20.8, fat: 51.5, carbs: 20.0, fiber: 8.6 },
  { name: 'Siemię lniane', category: 'Orzechy i nasiona', kcal: 534, protein: 18.3, fat: 42.2, carbs: 28.9, fiber: 27.3 },
  { name: 'Nasiona chia', category: 'Orzechy i nasiona', kcal: 486, protein: 16.5, fat: 30.7, carbs: 42.1, fiber: 34.4 },
  { name: 'Sezam', category: 'Orzechy i nasiona', kcal: 573, protein: 17.7, fat: 49.7, carbs: 23.5, fiber: 11.8, allergens: { sesame: true } },
  { name: 'Masło orzechowe naturalne', category: 'Orzechy i nasiona', kcal: 588, protein: 25.1, fat: 50.4, carbs: 20.1, fiber: 6.0, allergens: { nuts: true } },
  { name: 'Tahini (pasta sezamowa)', category: 'Orzechy i nasiona', kcal: 595, protein: 17.0, fat: 53.8, carbs: 21.2, fiber: 9.3, allergens: { sesame: true } },

  // ─── JAJA ───────────────────────────────────────────────────────────────────
  { name: 'Jajko kurze gotowane', category: 'Jaja', kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1, allergens: { eggs: true } },
  { name: 'Białko jajka surowe', category: 'Jaja', kcal: 52, protein: 10.9, fat: 0.2, carbs: 0.7, allergens: { eggs: true } },
  { name: 'Żółtko jajka surowe', category: 'Jaja', kcal: 322, protein: 16.4, fat: 26.5, carbs: 3.6, allergens: { eggs: true } },

  // ─── TŁUSZCZE I OLEJE ───────────────────────────────────────────────────────
  { name: 'Oliwa z oliwek extra virgin', category: 'Tłuszcze i oleje', kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: 'Olej rzepakowy', category: 'Tłuszcze i oleje', kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: 'Olej kokosowy', category: 'Tłuszcze i oleje', kcal: 862, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: 'Olej słonecznikowy', category: 'Tłuszcze i oleje', kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: 'Olej lniany', category: 'Tłuszcze i oleje', kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: 'Olej z awokado', category: 'Tłuszcze i oleje', kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: 'Margaryna', category: 'Tłuszcze i oleje', kcal: 719, protein: 0.2, fat: 80.4, carbs: 0.7 },
  { name: 'Olej sezamowy', category: 'Tłuszcze i oleje', kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0, allergens: { sesame: true } },

  // ─── PRZYPRAWY I SOSY ───────────────────────────────────────────────────────
  { name: 'Miód naturalny', category: 'Przyprawy i sosy', kcal: 304, protein: 0.3, fat: 0.0, carbs: 82.4, fiber: 0.2 },
  { name: 'Cukier biały', category: 'Przyprawy i sosy', kcal: 387, protein: 0.0, fat: 0.0, carbs: 99.8 },
  { name: 'Passata pomidorowa', category: 'Przyprawy i sosy', kcal: 32, protein: 1.6, fat: 0.4, carbs: 6.4, fiber: 1.3 },
  { name: 'Sos sojowy', category: 'Przyprawy i sosy', kcal: 53, protein: 8.1, fat: 0.1, carbs: 4.9, allergens: { soy: true } },
  { name: 'Musztarda sarepska', category: 'Przyprawy i sosy', kcal: 66, protein: 4.4, fat: 4.1, carbs: 5.3, fiber: 3.3, allergens: { mustard: true, celery: true } },
  { name: 'Ketchup', category: 'Przyprawy i sosy', kcal: 112, protein: 1.5, fat: 0.1, carbs: 26.7 },
  { name: 'Majonez', category: 'Przyprawy i sosy', kcal: 680, protein: 1.2, fat: 74.9, carbs: 3.8, allergens: { eggs: true } },
  { name: 'Ocet jabłkowy', category: 'Przyprawy i sosy', kcal: 22, protein: 0.0, fat: 0.0, carbs: 5.0 },
  { name: 'Koncentrat pomidorowy 30%', category: 'Przyprawy i sosy', kcal: 82, protein: 4.3, fat: 0.5, carbs: 15.5, fiber: 3.8 },
  { name: 'Hummus', category: 'Przyprawy i sosy', kcal: 166, protein: 7.9, fat: 9.6, carbs: 14.3, fiber: 6.0, allergens: { sesame: true } },
  { name: 'Pesto bazyliowe', category: 'Przyprawy i sosy', kcal: 450, protein: 5.5, fat: 45.0, carbs: 8.0, fiber: 1.5, allergens: { nuts: true } },
  { name: 'Sos worcestershire', category: 'Przyprawy i sosy', kcal: 78, protein: 1.2, fat: 0.1, carbs: 18.8 },

  // ─── NAPOJE ─────────────────────────────────────────────────────────────────
  { name: 'Mleko migdałowe niesłodzone', category: 'Napoje', kcal: 17, protein: 0.6, fat: 1.1, carbs: 0.6, fiber: 0.3, allergens: { nuts: true } },
  { name: 'Napój owsiany', category: 'Napoje', kcal: 45, protein: 1.0, fat: 1.5, carbs: 6.6, fiber: 0.8, allergens: { gluten: true } },
  { name: 'Napój sojowy', category: 'Napoje', kcal: 33, protein: 3.3, fat: 1.8, carbs: 0.5, fiber: 0.3, allergens: { soy: true } },
  { name: 'Napój ryżowy', category: 'Napoje', kcal: 47, protein: 0.3, fat: 1.0, carbs: 9.2, fiber: 0.2 },
  { name: 'Sok pomarańczowy 100%', category: 'Napoje', kcal: 45, protein: 0.7, fat: 0.2, carbs: 10.4, fiber: 0.2 },
  { name: 'Sok jabłkowy 100%', category: 'Napoje', kcal: 46, protein: 0.1, fat: 0.1, carbs: 11.3, fiber: 0.1 },
  { name: 'Kakao w proszku niesłodzone', category: 'Napoje', kcal: 228, protein: 19.6, fat: 13.7, carbs: 57.9, fiber: 33.2 },
  { name: 'Herbata zielona (napar)', category: 'Napoje', kcal: 1, protein: 0.0, fat: 0.0, carbs: 0.2 },
];
