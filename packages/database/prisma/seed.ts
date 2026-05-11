/**
 * Seed: blog posts + food database.
 * Run: npx prisma db seed (from packages/database/)
 * Idempotent — blog posts upsert on slug; food items skipped if already present.
 */
import { PrismaClient } from '@prisma/client';
import { FOOD_SEED_DATA } from './seed-food-data';

const prisma = new PrismaClient();

interface SeedPost {
  slug: string;
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  content: string;
  category: string;
  author: string;
  publishedAt: Date;
  readTime: number;
  imageSrc?: string;
  imageAlt: string;
  imageAltEn: string;
  published: boolean;
}

const posts: SeedPost[] = [
  {
    slug: 'dieta-online-vs-tradycyjny-dietetyk-2026',
    title: 'Dieta online vs tradycyjny dietetyk w 2026 – co wybrać?',
    titleEn: 'Online Diet vs Traditional Dietitian in 2026 – Which to Choose?',
    excerpt:
      'Zastanawiasz się, czy wybrać dietę online czy wizytę u tradycyjnego dietetyka? Sprawdź porównanie kosztów, wygody i skuteczności w 2026 roku.',
    excerptEn:
      'Wondering whether to choose an online diet or a traditional dietitian visit? Compare costs, convenience and effectiveness in 2026.',
    content: `Jeszcze kilka lat temu wizyta u dietetyka oznaczała osobiste spotkanie w gabinecie. Dziś coraz więcej osób wybiera dietę online – wygodną, dostępną 24/7 i często tańszą alternatywę. Czy jednak dietetyk online może dorównać tradycyjnej konsultacji?

W 2026 roku rozwój technologii, w tym sztucznej inteligencji (AI), całkowicie zmienił sposób, w jaki tworzone są plany żywieniowe.

## Czym różni się dieta online od tradycyjnej wizyty?

### Dietetyk tradycyjny
- spotkanie w gabinecie,
- stałe godziny wizyt,
- wyższy koszt pojedynczej konsultacji,
- osobisty kontakt twarzą w twarz.

### Dieta online
- wywiad wypełniany przez internet,
- plan dostępny w panelu użytkownika,
- możliwość modyfikacji bez wizyty,
- często niższy koszt miesięczny.

## Koszty – co się bardziej opłaca?

W 2026 roku średnia cena konsultacji stacjonarnej w dużych miastach to 250–400 zł za wizytę.

Tymczasem subskrypcja diety online może kosztować około 129 zł miesięcznie i obejmować:
- regularną aktualizację planu,
- monitoring postępów,
- kontakt mailowy,
- dostęp do panelu z historią planów.

Z ekonomicznego punktu widzenia dieta online często okazuje się bardziej dostępna.

## Wygoda i dostępność

Jednym z największych atutów diety online jest elastyczność.
Nie musisz:
- dojeżdżać do gabinetu,
- dopasowywać się do godzin pracy specjalisty,
- czekać kilku tygodni na termin.

Plan pojawia się w panelu użytkownika do 24 godzin po akceptacji dietetyka.

## Rola AI w dietetyce

Nowoczesna dieta online nie polega wyłącznie na automatycznym generatorze jadłospisów.

W e-dietetyk.com proces wygląda tak:
1. Wypełniasz wywiad (3–5 minut).
2. AI tworzy spersonalizowany plan żywieniowy.
3. Dietetyk analizuje i zatwierdza plan.
4. Otrzymujesz gotowy jadłospis z gramaturami i listą zakupów.

Połączenie technologii i wiedzy specjalisty pozwala skrócić czas oczekiwania i zwiększyć personalizację.

## Czy dieta online jest tak samo skuteczna?

Skuteczność zależy przede wszystkim od:
- dopasowania planu,
- systematyczności,
- monitorowania postępów.

W praktyce wiele osób osiąga lepsze efekty w modelu online, ponieważ:
- plan jest zawsze pod ręką,
- łatwo kontrolować kalorie,
- możliwe są szybkie aktualizacje jadłospisu.

## Kiedy wybrać dietetyka stacjonarnego?

Wizyta osobista może być lepszym rozwiązaniem, jeśli:
- potrzebujesz bezpośredniego badania składu ciała w gabinecie,
- masz skomplikowane schorzenia wymagające częstych konsultacji,
- preferujesz kontakt twarzą w twarz.

## Podsumowanie

Dieta online w 2026 roku to nie tylko trend, ale pełnoprawna alternatywa dla tradycyjnej wizyty. Dzięki połączeniu AI i nadzoru dietetyka możesz otrzymać szybki, dopasowany plan żywieniowy bez wychodzenia z domu.

Jeśli zależy Ci na wygodzie, elastyczności i rozsądnym koszcie – dietetyk online może być najlepszym wyborem.`,
    category: 'Porady',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 9,
    imageSrc: '/blog/images/dieta_online_vs_tradycyjna.png',
    imageAlt: 'Porównanie diety online i tradycyjnej konsultacji dietetycznej w 2026 roku',
    imageAltEn: 'Comparison of online diet and traditional dietitian consultation in 2026',
    published: true,
  },
  {
    slug: 'planowanie-posilkow-na-redukcje-w-praktyce',
    title: 'Planowanie posiłków na redukcję w praktyce – jak zrobić to dobrze?',
    titleEn: 'Meal Planning for Weight Loss – How to Do It Right?',
    excerpt:
      'Redukcja masy ciała nie musi oznaczać chaosu w kuchni. Sprawdź, jak planować posiłki na redukcję w praktyce, by chudnąć skutecznie i bez frustracji.',
    excerptEn:
      "Weight loss doesn't have to mean chaos in the kitchen. Learn how to plan meals for weight reduction effectively and without frustration.",
    content: `Redukcja masy ciała to nie tylko „mniej jeść". Kluczem do sukcesu jest dobrze zaplanowany jadłospis, który pozwala utrzymać deficyt kaloryczny bez uczucia ciągłego głodu. Właśnie dlatego planowanie posiłków na redukcję ma ogromne znaczenie.

Dobrze ułożony plan żywieniowy online pomaga utrzymać strukturę dnia, kontrolować kalorie i uniknąć przypadkowego podjadania.

## Dlaczego planowanie jest tak ważne?

Bez planu łatwo:
- przekroczyć kalorie,
- podjadać między posiłkami,
- wybierać szybkie, przetworzone produkty,
- zniechęcić się po kilku dniach.

Plan redukcyjny daje jasność: wiesz co jesz, ile jesz i kiedy jesz.

## Krok 1: Oblicz swoje zapotrzebowanie

Redukcja polega na wprowadzeniu umiarkowanego deficytu kalorycznego. Zbyt duży deficyt:
- obniża energię,
- zwiększa ryzyko napadów głodu,
- utrudnia utrzymanie diety.

W e-dietetyk.com AI wylicza zapotrzebowanie na podstawie Twoich danych (wiek, wzrost, masa ciała, aktywność), a następnie dietetyk weryfikuje plan.

## Krok 2: Ustal makroskładniki

W praktyce na redukcji kluczowe są:

### Białko
Pomaga utrzymać sytość i chronić masę mięśniową.

### Węglowodany
Nie trzeba ich eliminować – ważne jest dopasowanie ilości i jakości.

### Tłuszcze
Wspierają gospodarkę hormonalną i sytość.

Dobrze zbilansowany jadłospis redukcyjny powinien uwzględniać wszystkie trzy makroskładniki.

## Krok 3: Zaplanuj tydzień z wyprzedzeniem

Najbardziej praktyczne podejście:
- 3–4 główne posiłki dziennie,
- powtarzalne śniadania,
- rotacja obiadów,
- lista zakupów na cały tydzień.

To właśnie dlatego dieta online z gotową listą zakupów znacząco ułatwia redukcję.

## Krok 4: Zadbaj o sytość

Na redukcji nie chodzi o jedzenie „jak najmniej", ale „jak najbardziej sycąco" w ramach kalorii.

Pomagają:
- warzywa o dużej objętości,
- produkty bogate w błonnik,
- odpowiednia ilość białka,
- regularne godziny posiłków.

## Najczęstsze błędy na redukcji

- zbyt niska kaloryczność,
- brak planu i improwizacja,
- jedzenie „na oko",
- brak kontroli porcji.

Plan żywieniowy online eliminuje te błędy, bo wszystko masz rozpisane: gramatury, miary domowe i kalorie.

## Czy AI może ułożyć skuteczny plan redukcyjny?

Tak – pod warunkiem, że:
- wypełnisz dokładny wywiad,
- określisz realny cel,
- dasz sobie minimum 4–6 tygodni.

W e-dietetyk.com plan generowany przez AI jest zatwierdzany przez dietetyka (w planach płatnych), co zwiększa bezpieczeństwo i skuteczność procesu.

## Podsumowanie

Planowanie posiłków na redukcję to fundament skutecznego odchudzania. Nie chodzi o perfekcję, ale o systematyczność i przewidywalność.

Jeśli chcesz uprościć ten proces, dieta online z automatycznym planem i listą zakupów może być najprostszym sposobem na osiągnięcie celu bez chaosu i frustracji.`,
    category: 'Porady',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 8,
    imageSrc: '/blog/images/planowanie_posilkow_redukcja.png',
    imageAlt: 'Planowanie jadłospisu redukcyjnego z wagą kuchenną i zdrowym posiłkiem',
    imageAltEn: 'Planning a weight-loss meal plan with kitchen scales and a healthy meal',
    published: true,
  },
  {
    slug: 'dieta-przy-insulinoopornosci-czy-ai-moze-pomoc',
    title: 'Dieta przy insulinooporności – czy AI może pomóc?',
    titleEn: 'Diet for Insulin Resistance – Can AI Help?',
    excerpt:
      'Insulinooporność nie oznacza, że musisz żyć na restrykcyjnej diecie. Zobacz, jak plan żywieniowy online może wspierać stabilizację glikemii i dlaczego połączenie AI + dietetyk ma tu sens.',
    excerptEn:
      "Insulin resistance doesn't mean living on a restrictive diet. See how an online nutrition plan can support blood sugar stabilization and why AI + dietitian makes sense.",
    content: `Insulinooporność (IO) to zaburzenie, w którym komórki gorzej reagują na insulinę. W praktyce może to utrudniać redukcję masy ciała, powodować wahania energii oraz zwiększać apetyt na słodkie. Dobrze dobrana dieta przy insulinooporności pomaga stabilizować poziom glukozy i ułatwia utrzymanie zdrowych nawyków.

W e-dietetyk.com plan żywieniowy online jest tworzony przez AI na podstawie Twoich odpowiedzi, a następnie weryfikowany przez dietetyka. Dzięki temu łatwiej dopasować jadłospis do stylu życia, preferencji i ewentualnych ograniczeń zdrowotnych.

## Jakie są cele diety przy insulinooporności?

Najważniejsze cele to:
- stabilizacja glikemii (mniej „zjazdów" i napadów głodu),
- poprawa wrażliwości na insulinę,
- ułatwienie redukcji masy ciała (jeśli to Twój cel),
- regularność posiłków i lepsza kontrola apetytu.

## Co zwykle działa najlepiej w praktyce?

Poniższe zasady są często pomocne, ale pamiętaj: dieta powinna być dopasowana indywidualnie.

### 1) Regularne posiłki i przewidywalność
Stałe pory jedzenia pomagają ograniczyć podjadanie. Nie chodzi o „idealny zegarek", tylko o rytm dnia, który da się utrzymać.

### 2) Wysoka jakość węglowodanów
W praktyce często lepiej sprawdzają się węglowodany złożone (np. kasze, pełne ziarna, warzywa) niż produkty mocno przetworzone.

### 3) Białko i błonnik w każdym głównym posiłku
To prosta zasada, która pomaga dłużej utrzymać sytość i stabilniejszą energię.

### 4) Mniej „pustych kalorii" w płynach
Słodzone napoje, soki i częste słodkie kawy potrafią mocno utrudniać kontrolę apetytu.

## Czy AI może pomóc przy insulinooporności?

AI świetnie wspiera proces w 3 obszarach:
- szybkie dopasowanie jadłospisu do Twoich preferencji i celu,
- propozycje zamian posiłków bez rozwalania kaloryczności i makro,
- porządek w tygodniu: plan, lista zakupów, powtarzalność.

Kluczowe jest jednak to, że w e-dietetyk.com w płatnych planach dietetyk dodatkowo analizuje plan i zatwierdza go – co zwiększa bezpieczeństwo i sensowność zaleceń.

## Jak zacząć dietę online przy IO?

1) Wypełnij wywiad żywieniowy (3–5 minut).
2) AI przygotowuje plan i przekazuje do weryfikacji dietetyka.
3) Plan pojawia się w panelu użytkownika do 24 godzin po akceptacji.
4) Realizujesz plan i monitorujesz postępy, a my aktualizujemy jadłospis zgodnie z harmonogramem planu.

## Najczęstsze błędy przy insulinooporności

- zbyt duże restrykcje (łatwo o „odbicie" i podjadanie),
- chaotyczne posiłki i częste przekąski bez planu,
- zbyt mało białka i błonnika,
- traktowanie IO jak „zakazu wszystkiego".

## Podsumowanie

Dieta przy insulinooporności nie musi być skomplikowana. Największą różnicę robi systematyczność, dopasowanie do Ciebie i konsekwentne trzymanie się planu. Jeśli chcesz prowadzenia krok po kroku, dieta online z połączeniem AI + dietetyk pozwala szybciej przejść od teorii do konkretów.

Jeśli masz IO i chcesz bezpiecznie zacząć — wypełnij wywiad, a my przygotujemy plan dopasowany do Twojego celu.`,
    category: 'AI i dietetyka',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 9,
    imageSrc: '/blog/images/dieta_przy_insulinoopornosci_ai.png',
    imageAlt:
      'Glukometr i nowoczesna grafika AI wspierająca plan żywieniowy przy insulinooporności',
    imageAltEn:
      'Blood glucose meter and AI graphic supporting a meal plan for insulin resistance',
    published: true,
  },
  {
    slug: 'subskrypcja-dietetyczna-czy-plan-jednorazowy-co-wybrac',
    title: 'Subskrypcja dietetyczna czy plan jednorazowy – co wybrać?',
    titleEn: 'Dietitian Subscription vs One-Time Plan – Which to Choose?',
    excerpt:
      'Nie wiesz, czy lepsza będzie opieka miesięczna czy jednorazowy plan diety? Sprawdź różnice i wybierz rozwiązanie dopasowane do swojego celu.',
    excerptEn:
      'Not sure whether monthly care or a one-time diet plan is better for you? Check the key differences and choose the right option.',
    content: `Wybór między subskrypcją dietetyczną a planem jednorazowym to jedna z najczęstszych decyzji osób rozpoczynających dietę online. Obie opcje mają swoje zalety, ale sprawdzą się w różnych sytuacjach.

W 2026 roku dieta online daje dużą elastyczność – możesz wybrać zarówno stałą opiekę miesięczną, jak i jednorazowy jadłospis na określony czas.

## Czym jest subskrypcja dietetyczna?

Subskrypcja (np. opieka miesięczna 129 zł) oznacza:

- automatyczne odnawianie planu co miesiąc,
- cotygodniową aktualizację jadłospisu,
- monitoring postępów,
- możliwość kontaktu z dietetykiem,
- stałe dopasowywanie planu do efektów.

To rozwiązanie dla osób, które chcą prowadzenia krok po kroku i systematycznej kontroli.

## Czym jest plan jednorazowy?

Plan jednorazowy (np. 2 lub 4 tygodnie) obejmuje:

- gotowy jadłospis wygenerowany przez AI,
- brak automatycznego odnawiania,
- brak stałej aktualizacji,
- plan dostępny przez określony czas.

To dobre rozwiązanie, jeśli:
- chcesz przetestować dietę online,
- potrzebujesz planu „na start",
- zależy Ci na jednorazowym wsparciu.

## Najważniejsze różnice

### 1️⃣ Aktualizacja planu
Subskrypcja → plan zmienia się wraz z Twoimi postępami.
Plan jednorazowy → otrzymujesz gotowy plan bez dalszych modyfikacji.

### 2️⃣ Monitoring
Subskrypcja → regularna analiza wyników.
Plan jednorazowy → brak bieżącej kontroli.

### 3️⃣ Automatyczne odnawianie
Subskrypcja → odnawia się automatycznie (możliwość anulowania w każdej chwili).
Plan jednorazowy → nie odnawia się automatycznie.

## Co wybrać przy redukcji?

Jeśli Twoim celem jest redukcja masy ciała, subskrypcja dietetyczna daje większą kontrolę i elastyczność.

Organizm zmienia się w trakcie odchudzania – dlatego aktualizacja kaloryczności i makroskładników jest kluczowa.

## Kiedy plan jednorazowy ma sens?

- gdy chcesz sprawdzić, jak wygląda dieta online,
- gdy masz już doświadczenie i potrzebujesz tylko struktury,
- gdy zależy Ci na krótkim, konkretnym okresie (np. 4 tygodnie).

## Czy AI wystarczy bez stałej opieki?

AI tworzy plan na podstawie Twojego wywiadu. W planach miesięcznych dietetyk dodatkowo analizuje i zatwierdza jadłospis, co zwiększa bezpieczeństwo i personalizację.

## Podsumowanie

Subskrypcja dietetyczna to rozwiązanie dla osób, które chcą systematycznych efektów i stałego wsparcia. Plan jednorazowy sprawdzi się jako opcja testowa lub krótkoterminowa.

Jeśli zależy Ci na trwałych efektach, regularnej aktualizacji planu i monitoringu – opieka miesięczna będzie bardziej kompleksowym rozwiązaniem.`,
    category: 'Subskrypcja',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 7,
    imageSrc: '/blog/images/subskrypcja_vs_plan_jednorazowy.png',
    imageAlt:
      'Porównanie subskrypcji dietetycznej i planu jednorazowego w aplikacji dietetycznej',
    imageAltEn:
      'Comparison of dietitian subscription and one-time plan in a diet application',
    published: true,
  },
  {
    slug: 'jak-liczyc-kalorie-bez-obsesji',
    title: 'Jak liczyć kalorie bez obsesji? Praktyczne podejście',
    titleEn: 'How to Count Calories Without Obsession – A Practical Approach',
    excerpt:
      'Liczenie kalorii może pomóc w redukcji, ale łatwo wpaść w przesadę. Sprawdź, jak kontrolować kalorie w zdrowy sposób i uniknąć dietetycznej obsesji.',
    excerptEn:
      "Counting calories can help with weight loss, but it's easy to go overboard. See how to track calories in a healthy, stress-free way.",
    content: `Liczenie kalorii to jedno z najpopularniejszych narzędzi w redukcji masy ciała. Problem zaczyna się wtedy, gdy zamiast wsparcia staje się źródłem stresu. Czy da się liczyć kalorie skutecznie, ale bez obsesji? Tak — kluczem jest odpowiednie podejście.

Dieta online pozwala kontrolować kaloryczność bez ciągłego liczenia „na oko", ponieważ plan żywieniowy jest już wcześniej zbilansowany.

## Czy liczenie kalorii jest konieczne?

Nie zawsze. Wszystko zależy od celu:

- redukcja masy ciała → kontrola kalorii ma duże znaczenie,
- utrzymanie wagi → wystarczy świadomość porcji,
- poprawa jakości diety → ważniejszy jest skład niż dokładna liczba kcal.

Liczenie kalorii to narzędzie, nie cel sam w sobie.

## Najczęstsze błędy przy liczeniu kalorii

1. Ważenie wszystkiego co do grama przez wiele miesięcy.
2. Panika przy minimalnym przekroczeniu kalorii.
3. Unikanie spotkań towarzyskich ze strachu przed „nadprogramowymi" kcal.
4. Traktowanie jedzenia wyłącznie jako liczby.

Takie podejście często prowadzi do frustracji i rezygnacji z diety.

## Zdrowe podejście do kontroli kalorii

### 1️⃣ Ustal zakres, nie jedną sztywną liczbę

Zamiast celu 1800 kcal dziennie, lepiej przyjąć zakres 1750–1850 kcal. To daje elastyczność i zmniejsza presję.

### 2️⃣ Skup się na strukturze posiłków

Jeśli w każdym posiłku masz:
- źródło białka,
- porcję warzyw,
- kontrolowaną ilość węglowodanów,
- zdrowe tłuszcze,

nie musisz obsesyjnie sprawdzać każdej liczby.

### 3️⃣ Korzystaj z gotowego planu

Plan żywieniowy online eliminuje konieczność codziennego liczenia. Otrzymujesz:
- dokładne gramatury,
- miary domowe,
- gotową listę zakupów,
- wyliczone makroskładniki.

Dzięki temu skupiasz się na realizacji planu, a nie kalkulatorze.

## Kiedy warto liczyć kalorie dokładniej?

- na początku redukcji,
- gdy efekty stoją w miejscu,
- przy przygotowaniu do zawodów sportowych,
- gdy masz trudność z oceną porcji „na oko".

## A kiedy lepiej odpuścić?

Jeśli:
- czujesz narastający stres,
- myślisz o jedzeniu cały dzień,
- unikasz wyjść z domu przez dietę,

to znak, że potrzebujesz bardziej elastycznego podejścia.

## Rola AI w kontroli kalorii

W nowoczesnej diecie online AI oblicza Twoje zapotrzebowanie i układa plan dopasowany do celu. W planach miesięcznych dietetyk dodatkowo analizuje jadłospis.

To pozwala utrzymać kontrolę kalorii bez ciągłego ręcznego liczenia.

## Podsumowanie

Liczenie kalorii może być pomocne, ale nie powinno dominować Twojego życia. Najlepsze efekty daje systematyczność, realistyczny deficyt i plan dopasowany do stylu życia.

Jeśli chcesz kontrolować kalorie bez stresu, dieta online z gotowym jadłospisem może być prostszym i zdrowszym rozwiązaniem.`,
    category: 'Porady',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 8,
    imageSrc: '/blog/images/jak_liczyc_kalorie_bez_obsesji.png',
    imageAlt:
      'Liczenie kalorii w zdrowy sposób bez obsesji przy użyciu aplikacji dietetycznej',
    imageAltEn: 'Counting calories in a healthy way without obsession using a diet app',
    published: true,
  },
  {
    slug: '10-szybkich-przepisow-na-zdrowe-sniadanie',
    title: '10 szybkich przepisów na zdrowe śniadanie',
    titleEn: '10 Quick Healthy Breakfast Recipes',
    excerpt:
      'Brakuje Ci czasu rano? Sprawdź 10 szybkich i zdrowych przepisów na śniadanie, które wspierają redukcję i dodają energii na cały dzień.',
    excerptEn:
      'Short on time in the morning? Discover 10 quick and healthy breakfast recipes that support weight loss and give you energy all day.',
    content: `Śniadanie to dla wielu osób najtrudniejszy posiłek dnia. Brak czasu, poranny pośpiech i brak pomysłu często kończą się słodką bułką lub całkowitym pominięciem posiłku. Tymczasem dobrze zbilansowane śniadanie pomaga ustabilizować poziom energii i kontrolować apetyt przez resztę dnia.

Jeśli korzystasz z diety online, gotowe propozycje śniadań są już zaplanowane pod Twoje zapotrzebowanie kaloryczne i makroskładniki.

## Dlaczego śniadanie ma znaczenie?

Dobrze skomponowane śniadanie:
- dostarcza białka,
- zawiera błonnik,
- zapobiega nagłym spadkom energii,
- ogranicza podjadanie.

Nie chodzi jednak o perfekcję — kluczowa jest regularność.

## 10 szybkich propozycji

### 1. Owsianka białkowa z owocami
Płatki owsiane + jogurt skyr + borówki + orzechy.

### 2. Jajecznica z warzywami
Jajka + szpinak + pomidory + pełnoziarniste pieczywo.

### 3. Smoothie wysokobiałkowe
Banan + jogurt naturalny + masło orzechowe + odżywka białkowa.

### 4. Kanapki z pastą jajeczną
Jajka + jogurt + szczypiorek + chleb pełnoziarnisty.

### 5. Twarożek z warzywami
Twaróg + rzodkiewka + ogórek + oliwa.

### 6. Omlet owsiany
Płatki owsiane + jajka + jogurt + owoce.

### 7. Pudding chia
Nasiona chia + mleko + owoce + orzechy.

### 8. Jogurt z granolą domową
Jogurt + płatki + migdały + miód.

### 9. Tosty pełnoziarniste z awokado
Awokado + jajko + rukola.

### 10. Fit batoniki owsiane (np. z airfryera)
Płatki owsiane + jogurt + miód + banan + gorzka czekolada.

## Jak dopasować śniadanie do celu?

- Na redukcji → wyższa zawartość białka i kontrola kalorii.
- Przy budowaniu masy → większa porcja węglowodanów.
- Przy pracy umysłowej → stabilny poziom energii (błonnik + białko).

Plan żywieniowy online uwzględnia Twoje zapotrzebowanie i automatycznie dobiera proporcje.

## Czy trzeba jeść śniadanie?

Nie każda osoba musi jeść wcześnie rano. Jeśli stosujesz post przerywany i czujesz się dobrze — to również może być dobre rozwiązanie. Kluczowe jest dopasowanie do stylu życia.

## Podsumowanie

Zdrowe śniadanie nie musi być skomplikowane ani czasochłonne. Wystarczy kilka prostych składników i 5–10 minut przygotowania.

Jeśli nie chcesz codziennie zastanawiać się, co zjeść rano, dieta online z gotowym jadłospisem może znacząco ułatwić planowanie posiłków.`,
    category: 'Przepisy',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 7,
    imageSrc: '/blog/images/zdrowe_sniadania_przepisy.png',
    imageAlt:
      'Zdrowe śniadanie z płatkami owsianymi i składnikami przygotowane w nowoczesnej kuchni',
    imageAltEn: 'Healthy oat breakfast with ingredients prepared in a modern kitchen',
    published: true,
  },
  {
    slug: 'czy-ai-moze-zastapic-dietetyka',
    title: 'Czy AI może zastąpić dietetyka? Jak działa AI w dietetyce online',
    titleEn: 'Can AI Replace a Dietitian? How AI Works in Online Dietetics',
    excerpt:
      'Sztuczna inteligencja coraz częściej tworzy plany żywieniowe. Czy AI może zastąpić dietetyka? Sprawdź, jak wygląda nowoczesna dieta online w 2026 roku.',
    excerptEn:
      'Artificial intelligence is increasingly creating nutrition plans. Can AI replace a dietitian? See how modern online dieting looks in 2026.',
    content: `Sztuczna inteligencja (AI) w 2026 roku zmienia sposób, w jaki powstają plany żywieniowe. Dieta online nie polega już wyłącznie na ręcznym układaniu jadłospisu przez specjalistę. Coraz częściej to AI analizuje dane użytkownika i tworzy spersonalizowany plan w kilka minut.

Czy jednak AI może całkowicie zastąpić dietetyka? Odpowiedź nie jest zero-jedynkowa.

## Jak działa AI w dietetyce online?

Proces w nowoczesnych platformach wygląda zazwyczaj tak:

1. Wypełniasz wywiad (wiek, masa ciała, cel, aktywność, preferencje).
2. Algorytm analizuje dane i wylicza zapotrzebowanie kaloryczne.
3. AI generuje jadłospis dopasowany do Twojego celu.
4. Dietetyk analizuje i zatwierdza plan (w modelach hybrydowych).

Dzięki temu plan może powstać w ciągu kilku minut, a nie kilku dni.

## Zalety wykorzystania AI

### Szybkość
Plan żywieniowy może być gotowy niemal natychmiast.

### Personalizacja
Algorytm uwzględnia:
- preferencje smakowe,
- alergie,
- nietolerancje,
- cel (redukcja, masa, utrzymanie),
- styl życia.

### Skalowalność
AI pozwala oferować dietę online w niższej cenie, bez obniżania jakości podstawowego planu.

## Czego AI nie zastąpi?

Sztuczna inteligencja:
- nie przeprowadzi pogłębionego wywiadu klinicznego,
- nie podejmie decyzji medycznych przy skomplikowanych schorzeniach,
- nie zastąpi doświadczenia specjalisty w trudnych przypadkach.

Dlatego najlepszym rozwiązaniem jest model hybrydowy: AI + dietetyk.

## Czy dieta generowana przez AI jest bezpieczna?

Bezpieczeństwo zależy od:
- jakości algorytmu,
- dokładności wywiadu,
- nadzoru specjalisty.

W e-dietetyk.com plan generowany przez AI jest w planach płatnych analizowany i zatwierdzany przez dietetyka. To połączenie szybkości technologii i wiedzy człowieka.

## AI vs klasyczna dieta online

Tradycyjna dieta online:
- dłuższy czas oczekiwania,
- ręczne tworzenie planu,
- mniejsza elastyczność zmian.

Dieta online z AI:
- szybkie dopasowanie,
- większa liczba zamienników,
- dynamiczne aktualizacje planu.

## Czy AI to przyszłość dietetyki?

AI nie zastępuje dietetyka – ale znacząco usprawnia jego pracę. Pozwala szybciej analizować dane i tworzyć spersonalizowane rozwiązania.

W 2026 roku najlepszym podejściem jest połączenie:
technologii + wiedzy specjalisty + monitoringu postępów.

## Podsumowanie

AI w dietetyce online to narzędzie, które zwiększa dostępność, skraca czas oczekiwania i poprawia personalizację planów żywieniowych. Jednak w bardziej wymagających przypadkach wsparcie dietetyka pozostaje kluczowe.

Jeśli szukasz nowoczesnej diety online, model hybrydowy AI + dietetyk może być najbardziej efektywnym rozwiązaniem.`,
    category: 'AI i dietetyka',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 9,
    imageSrc: '/blog/images/ai_vs_tradycyjna_dieta.png',
    imageAlt:
      'Porównanie diety online tworzonej przez AI i tradycyjnej konsultacji dietetycznej',
    imageAltEn:
      'Comparison of AI-generated online diet and traditional dietitian consultation',
    published: true,
  },
  {
    slug: 'jak-znalezc-motywacje-do-odchudzania',
    title: 'Jak znaleźć motywację do odchudzania i utrzymać ją na dłużej?',
    titleEn: 'How to Find Motivation to Lose Weight and Keep It Long-Term',
    excerpt:
      'Brakuje Ci motywacji do diety? Sprawdź, jak budować trwałe nawyki i utrzymać efekty bez rygoru, frustracji i efektu jo-jo.',
    excerptEn:
      'Lacking motivation for your diet? Learn how to build lasting habits and maintain results without rigidity, frustration or the yo-yo effect.',
    content: `Motywacja do odchudzania często pojawia się nagle – po zdjęciu z wakacji, badaniach krwi czy postanowieniu noworocznym. Problem w tym, że równie szybko potrafi zniknąć.

Dlatego skuteczna dieta online nie powinna opierać się wyłącznie na chwilowym zrywie, ale na systemie i dobrze zaplanowanych nawykach.

## Dlaczego tracimy motywację?

Najczęstsze powody to:
- zbyt ambitny cel,
- szybkie zniechęcenie brakiem efektów,
- restrykcyjna dieta,
- brak wsparcia.

Motywacja to emocja. A emocje są zmienne. Dlatego potrzebujesz czegoś więcej niż tylko „chęci".

## Pozytywna vs negatywna motywacja

### ❌ Negatywna motywacja
- „Muszę schudnąć"
- presja i wstyd
- nierealistyczny cel
- zbyt duży rygor

Taki model prowadzi często do efektu jo-jo.

### ✅ Pozytywna motywacja
- realny, mierzalny cel
- małe kroki
- skupienie na zdrowiu, nie tylko wadze
- system monitorowania postępów

To podejście daje większą trwałość efektów.

## Jak utrzymać motywację długoterminowo?

### 1. Ustal realny cel
Zamiast „–15 kg w 2 miesiące", wybierz:
„–0,5 kg tygodniowo przez 12 tygodni".

### 2. Skup się na procesie
Nie tylko waga ma znaczenie:
- lepszy sen,
- więcej energii,
- poprawa wyników badań,
- regularność posiłków.

### 3. Korzystaj z monitoringu
W planie miesięcznym możesz:
- śledzić postępy,
- aktualizować plan,
- konsultować zmiany z dietetykiem.

To zmniejsza ryzyko porzucenia diety.

### 4. Eliminuj perfekcjonizm
Jedno odstępstwo nie przekreśla całego planu. Liczy się średnia z tygodnia, nie pojedynczy dzień.

## Czy dieta online pomaga w motywacji?

Tak, ponieważ:
- masz gotowy plan,
- nie zastanawiasz się codziennie „co zjeść",
- widzisz konkretną strukturę działania,
- możesz korzystać z aktualizacji planu.

System zmniejsza decyzje i ułatwia wytrwanie.

## Psychologia nawyków

Badania pokazują, że nawyk buduje się średnio od 21 do 66 dni. Dlatego kluczowe jest:
- powtarzalność,
- prostota,
- brak nadmiernego rygoru.

Im łatwiejszy system, tym większa szansa, że stanie się Twoją rutyną.

## Podsumowanie

Motywacja nie jest czymś stałym – ale system może być. Najlepsze efekty przynosi połączenie:
realistycznego celu + prostego planu + monitoringu postępów.

Jeśli chcesz działać długofalowo, wybierz model, który wspiera konsekwencję, a nie chwilowy zryw.`,
    category: 'Motywacja',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 8,
    imageSrc: '/blog/images/motywacja_do_odchudzania.png',
    imageAlt: 'Porównanie pozytywnej i negatywnej motywacji w procesie odchudzania',
    imageAltEn: 'Comparison of positive and negative motivation in the weight loss process',
    published: true,
  },
  {
    slug: 'jak-planowac-tygodniowy-jadlospis-i-zakupy',
    title:
      'Jak planować tygodniowy jadłospis i zakupy, żeby oszczędzać czas i pieniądze?',
    titleEn:
      'How to Plan a Weekly Meal Schedule and Shopping List to Save Time and Money',
    excerpt:
      'Planowanie posiłków i lista zakupów to klucz do skutecznej diety. Sprawdź, jak ułożyć tygodniowy jadłospis i nie marnować jedzenia.',
    excerptEn:
      'Planning meals and a shopping list is the key to an effective diet. Learn how to plan a weekly menu and avoid food waste.',
    content: `Brak planu żywieniowego to jeden z głównych powodów, dla których dieta kończy się po kilku dniach. Impulsywne zakupy, brak pomysłu na obiad i podjadanie to efekt chaosu, nie braku silnej woli.

Dlatego tygodniowy jadłospis i przemyślana lista zakupów to fundament skutecznej diety online.

## Dlaczego warto planować posiłki?

Planowanie:
- zmniejsza liczbę spontanicznych decyzji,
- ogranicza podjadanie,
- pomaga kontrolować kalorie,
- pozwala oszczędzać pieniądze,
- redukuje marnowanie jedzenia.

To nie restrykcja — to organizacja.

## Krok 1: Ustal plan tygodniowy

Najlepiej zaplanować:
- 3–5 posiłków dziennie,
- stałe godziny jedzenia,
- dni z prostszymi daniami (np. przy intensywnej pracy).

W planie dietetycznym online jadłospis jest gotowy — zawiera dokładne gramatury i zamienniki.

## Krok 2: Stwórz listę zakupów

Dobrze przygotowana lista zakupów:
- jest podzielona na kategorie (warzywa, nabiał, mięso, suche produkty),
- uwzględnia dokładne ilości,
- eliminuje impulsywne zakupy.

W modelu subskrypcyjnym lista generowana jest automatycznie na podstawie jadłospisu.

## Krok 3: Gotuj z wyprzedzeniem

Meal prep pozwala:
- przygotować 2–3 dni jedzenia z góry,
- zaoszczędzić czas,
- ograniczyć sięganie po fast food.

## Najczęstsze błędy

❌ Robienie zakupów bez planu
❌ Kupowanie „na oko"
❌ Brak zamienników
❌ Zbyt skomplikowane przepisy

Im prostszy system, tym większa skuteczność.

## Jak pomaga dieta online?

Nowoczesny plan dietetyczny:
- zawiera dokładne gramatury,
- oferuje zamienniki posiłków,
- generuje listę zakupów,
- pozwala dostosować plan do stylu życia.

Dzięki temu nie musisz codziennie zastanawiać się, co zjeść.

## Czy planowanie działa przy redukcji?

Tak. Badania pokazują, że osoby planujące posiłki:
- rzadziej podjadają,
- mają lepszą kontrolę kalorii,
- osiągają stabilniejsze efekty.

To szczególnie ważne przy redukcji masy ciała.

## Podsumowanie

Planowanie tygodniowego jadłospisu i lista zakupów to nie ograniczenie — to narzędzie do odzyskania kontroli nad dietą.

Jeśli chcesz uprościć ten proces, dieta online z gotowym planem i listą zakupów może znacząco ułatwić organizację tygodnia.`,
    category: 'Porady',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 8,
    imageSrc: '/blog/images/planowanie_jadlospisu_i_zakupy.png',
    imageAlt:
      'Planowanie tygodniowego jadłospisu i lista zakupów w aplikacji dietetycznej',
    imageAltEn:
      'Planning a weekly meal schedule and shopping list in a diet application',
    published: true,
  },
  {
    slug: 'jak-gotowac-fit-posilki-thermomix-airfryer',
    title:
      'Jak gotować fit posiłki z Thermomixem i Airfryerem? Przepisy w diecie online',
    titleEn: 'How to Cook Healthy Meals with Thermomix and Airfryer',
    excerpt:
      'Thermomix i Airfryer to idealne narzędzia do szybkiego gotowania zdrowych posiłków. Sprawdź, jak wykorzystać je w diecie online i oszczędzać czas.',
    excerptEn:
      'Thermomix and Airfryer are perfect tools for preparing quick, healthy meals. See how to use them in your online diet and save time.',
    content: `Nowoczesna dieta online nie musi oznaczać godzin spędzonych w kuchni. Thermomix i Airfryer pozwalają przygotować pełnowartościowe, niskokaloryczne i szybkie posiłki nawet w 20–30 minut.

Dlatego coraz więcej osób wybiera plan żywieniowy dopasowany do tych urządzeń.

## Dlaczego Thermomix i Airfryer sprawdzają się w diecie?

### Thermomix
- szybkie zupy krem i sosy,
- koktajle białkowe,
- gotowanie na parze,
- automatyczne programy.

### Airfryer
- chrupiące dania z minimalną ilością tłuszczu,
- szybkie obiady wysokobiałkowe,
- zdrowe wersje klasyków (np. frytki z batata, nuggets).

Oba urządzenia znacząco skracają czas przygotowania posiłków.

## Czy dieta online może być dopasowana do sprzętu?

Tak. W planie dietetycznym możesz:
- wybrać opcję Thermomix,
- wybrać opcję Airfryer,
- otrzymać przepisy dostosowane do konkretnego urządzenia.

To szczególnie przydatne, gdy:
- masz mało czasu,
- nie lubisz skomplikowanych przepisów,
- chcesz ograniczyć tłuszcz w diecie.

## Przykładowe dania z Thermomixa

- Zupa krem z pomidorów z soczewicą
- Risotto z warzywami i kurczakiem
- Domowe pesto wysokobiałkowe
- Koktajl proteinowy

## Przykładowe dania z Airfryera

- Pierś z kurczaka z warzywami
- Łosoś pieczony bez tłuszczu
- Frytki z batata
- Fit pulpeciki

## Zalety gotowania w Airfryerze

- mniej tłuszczu,
- krótszy czas pieczenia,
- mniejsze zużycie energii,
- mniej sprzątania.

## Czy warto dopłacić do opcji Thermomix / Airfryer?

Jeśli regularnie korzystasz z tych urządzeń, dopasowany plan:
- przyspiesza gotowanie,
- upraszcza przygotowanie,
- zwiększa szansę na utrzymanie diety.

To szczególnie ważne przy redukcji masy ciała, gdzie regularność ma kluczowe znaczenie.

## Dieta online + nowoczesna kuchnia

Połączenie:
- gotowego jadłospisu,
- listy zakupów,
- dopasowania do sprzętu,
- zamienników posiłków

pozwala realnie oszczędzać czas i utrzymać zdrowe nawyki.

## Podsumowanie

Thermomix i Airfryer to nie moda – to narzędzia, które mogą ułatwić zdrowe odżywianie. Jeśli korzystasz z nich regularnie, dieta online dopasowana do sprzętu znacząco zwiększa wygodę i skuteczność działania.`,
    category: 'Thermomix & Airfryer',
    author: 'dr Anna Kowalska',
    publishedAt: new Date('2026-03-01'),
    readTime: 8,
    imageSrc: '/blog/images/thermomix_airfryer_fit_posilki.png',
    imageAlt:
      'Zdrowe posiłki przygotowane w Thermomixie i Airfryerze w nowoczesnej kuchni',
    imageAltEn:
      'Healthy meals prepared in Thermomix and Airfryer in a modern kitchen',
    published: true,
  },
];

async function seedBlogPosts(): Promise<void> {
  console.log('Seeding blog posts...');
  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: post,
      create: post,
    });
  }
  console.log(`Seeded ${posts.length} blog posts.`);
}

async function seedFoodItems(): Promise<void> {
  const existing = await prisma.foodItem.count();
  if (existing > 0) {
    console.log(`Food items already seeded (${existing} items). Skipping.`);
    return;
  }

  console.log(`Seeding ${FOOD_SEED_DATA.length} food items...`);

  for (const item of FOOD_SEED_DATA) {
    await prisma.foodItem.create({
      data: {
        name: item.name,
        brand: item.brand,
        category: item.category,
        source: 'seed',
        nutrients: {
          create: {
            kcal: item.kcal,
            protein: item.protein,
            fat: item.fat,
            carbs: item.carbs,
            fiber: item.fiber,
            sugar: item.sugar,
          },
        },
        ...(item.allergens
          ? {
              allergens: {
                create: {
                  gluten: item.allergens.gluten ?? false,
                  lactose: item.allergens.lactose ?? false,
                  nuts: item.allergens.nuts ?? false,
                  soy: item.allergens.soy ?? false,
                  eggs: item.allergens.eggs ?? false,
                  fish: item.allergens.fish ?? false,
                  celery: item.allergens.celery ?? false,
                  mustard: item.allergens.mustard ?? false,
                  sesame: item.allergens.sesame ?? false,
                },
              },
            }
          : {}),
      },
    });
  }

  console.log(`Seeded ${FOOD_SEED_DATA.length} food items.`);
}

// ─── Meal Library seed (7.10.1) ───────────────────────────────────────────────

interface SeedMeal {
  name: string;
  description?: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'SUPPER';
  dietType: 'STANDARD' | 'VEGE' | 'VEGAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE';
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  hasGluten?: boolean;
  hasLactose?: boolean;
  hasNuts?: boolean;
  hasSoy?: boolean;
  hasEggs?: boolean;
  hasFish?: boolean;
  tags: string[];
}

const MEAL_SEED_DATA: SeedMeal[] = [
  // ── Śniadania ──
  {
    name: 'Owsianka z owocami i orzechami',
    mealType: 'BREAKFAST', dietType: 'VEGE',
    kcal: 420, proteinG: 14, fatG: 14, carbsG: 58,
    hasGluten: true, hasNuts: true, hasLactose: true,
    tags: ['owsianka', 'śniadanie', 'błonnik'],
  },
  {
    name: 'Jajecznica na maśle z chlebem żytnim',
    mealType: 'BREAKFAST', dietType: 'STANDARD',
    kcal: 480, proteinG: 22, fatG: 24, carbsG: 42,
    hasGluten: true, hasEggs: true, hasLactose: true,
    tags: ['jajka', 'śniadanie', 'białko'],
  },
  {
    name: 'Jogurt grecki z granolą i bananem',
    mealType: 'BREAKFAST', dietType: 'VEGE',
    kcal: 390, proteinG: 16, fatG: 8, carbsG: 64,
    hasLactose: true, hasGluten: true, hasNuts: true,
    tags: ['jogurt', 'śniadanie', 'szybkie'],
  },
  {
    name: 'Kanapki z avocado i jajkiem sadzonym',
    mealType: 'BREAKFAST', dietType: 'VEGE',
    kcal: 520, proteinG: 18, fatG: 28, carbsG: 46,
    hasGluten: true, hasEggs: true,
    tags: ['avocado', 'śniadanie', 'zdrowe tłuszcze'],
  },
  {
    name: 'Koktajl bananowo-szpinakowy z białkiem',
    mealType: 'BREAKFAST', dietType: 'VEGAN',
    kcal: 340, proteinG: 24, fatG: 6, carbsG: 48,
    hasSoy: true,
    tags: ['koktajl', 'śniadanie', 'białko roślinne'],
  },
  // ── Obiady ──
  {
    name: 'Pierś z kurczaka z ryżem i brokułami',
    mealType: 'LUNCH', dietType: 'STANDARD',
    kcal: 550, proteinG: 45, fatG: 10, carbsG: 68,
    tags: ['kurczak', 'obiad', 'wysoko białkowe'],
  },
  {
    name: 'Łosoś pieczony z ziemniakami i sałatą',
    mealType: 'LUNCH', dietType: 'GLUTEN_FREE',
    kcal: 580, proteinG: 38, fatG: 22, carbsG: 52,
    hasFish: true,
    tags: ['łosoś', 'obiad', 'omega-3'],
  },
  {
    name: 'Zupa krem z dyni z grzankami',
    mealType: 'LUNCH', dietType: 'VEGE',
    kcal: 320, proteinG: 8, fatG: 12, carbsG: 46,
    hasGluten: true, hasLactose: true,
    tags: ['zupa', 'obiad', 'dynia'],
  },
  {
    name: 'Makaron z sosem bolognese',
    mealType: 'LUNCH', dietType: 'STANDARD',
    kcal: 620, proteinG: 32, fatG: 18, carbsG: 82,
    hasGluten: true,
    tags: ['makaron', 'obiad', 'wołowina'],
  },
  {
    name: 'Tofu stir-fry z warzywami i ryżem',
    mealType: 'LUNCH', dietType: 'VEGAN',
    kcal: 480, proteinG: 22, fatG: 14, carbsG: 66,
    hasSoy: true,
    tags: ['tofu', 'obiad', 'roślinne'],
  },
  {
    name: 'Gulasz wołowy z kaszą gryczaną',
    mealType: 'LUNCH', dietType: 'GLUTEN_FREE',
    kcal: 590, proteinG: 40, fatG: 16, carbsG: 64,
    tags: ['wołowina', 'obiad', 'kasza'],
  },
  // ── Kolacje ──
  {
    name: 'Sałatka z tuńczykiem i jajkiem',
    mealType: 'DINNER', dietType: 'GLUTEN_FREE',
    kcal: 380, proteinG: 32, fatG: 14, carbsG: 28,
    hasFish: true, hasEggs: true,
    tags: ['sałatka', 'kolacja', 'lekka'],
  },
  {
    name: 'Twarożek z warzywami i pieczywem',
    mealType: 'DINNER', dietType: 'VEGE',
    kcal: 320, proteinG: 20, fatG: 8, carbsG: 40,
    hasLactose: true, hasGluten: true,
    tags: ['twarożek', 'kolacja', 'lekka'],
  },
  {
    name: 'Omlet z warzywami i serem feta',
    mealType: 'DINNER', dietType: 'VEGE',
    kcal: 420, proteinG: 26, fatG: 22, carbsG: 24,
    hasEggs: true, hasLactose: true,
    tags: ['omlet', 'kolacja', 'szybka'],
  },
  {
    name: 'Wrap z kurczakiem i warzywami',
    mealType: 'DINNER', dietType: 'STANDARD',
    kcal: 480, proteinG: 30, fatG: 14, carbsG: 58,
    hasGluten: true,
    tags: ['wrap', 'kolacja', 'kurczak'],
  },
  // ── Przekąski ──
  {
    name: 'Jabłko z masłem migdałowym',
    mealType: 'SNACK', dietType: 'VEGAN',
    kcal: 220, proteinG: 5, fatG: 12, carbsG: 26,
    hasNuts: true,
    tags: ['przekąska', 'owoce', 'zdrowe tłuszcze'],
  },
  {
    name: 'Garść orzechów mieszanych',
    mealType: 'SNACK', dietType: 'VEGAN',
    kcal: 180, proteinG: 5, fatG: 16, carbsG: 8,
    hasNuts: true,
    tags: ['przekąska', 'orzechy', 'szybka'],
  },
  {
    name: 'Serek wiejski z ogórkiem',
    mealType: 'SNACK', dietType: 'VEGE',
    kcal: 140, proteinG: 14, fatG: 2, carbsG: 10,
    hasLactose: true,
    tags: ['przekąska', 'serek', 'niskotłuszczowa'],
  },
  // ── Drugie śniadania ──
  {
    name: 'Bułka razowa z pastą jajeczną',
    mealType: 'SUPPER', dietType: 'VEGE',
    kcal: 360, proteinG: 16, fatG: 14, carbsG: 42,
    hasGluten: true, hasEggs: true, hasLactose: true,
    tags: ['drugie śniadanie', 'pasta jajeczna'],
  },
  {
    name: 'Ryż z jabłkiem i cynamonem',
    mealType: 'SUPPER', dietType: 'VEGAN',
    kcal: 310, proteinG: 6, fatG: 4, carbsG: 64,
    tags: ['drugie śniadanie', 'ryż', 'owoc'],
  },
  {
    name: 'Naleśniki owsiane z jagodami',
    mealType: 'SUPPER', dietType: 'VEGE',
    kcal: 400, proteinG: 14, fatG: 10, carbsG: 62,
    hasGluten: true, hasEggs: true, hasLactose: true,
    tags: ['drugie śniadanie', 'naleśniki', 'owies'],
  },
];

async function seedMeals(): Promise<void> {
  let created = 0;
  for (const meal of MEAL_SEED_DATA) {
    const existing = await prisma.meal.findFirst({ where: { name: meal.name } });
    if (!existing) {
      await prisma.meal.create({
        data: {
          name: meal.name,
          description: meal.description,
          mealType: meal.mealType,
          dietType: meal.dietType,
          kcal: meal.kcal,
          proteinG: meal.proteinG,
          fatG: meal.fatG,
          carbsG: meal.carbsG,
          hasGluten: meal.hasGluten ?? false,
          hasLactose: meal.hasLactose ?? false,
          hasNuts: meal.hasNuts ?? false,
          hasSoy: meal.hasSoy ?? false,
          hasEggs: meal.hasEggs ?? false,
          hasFish: meal.hasFish ?? false,
          tags: meal.tags,
          source: 'seed',
        },
      });
      created++;
    }
  }
  console.log(`Seeded ${created} meals (${MEAL_SEED_DATA.length - created} already existed).`);
}

// ─── Template Plans seed ──────────────────────────────────────────────────────

interface SeedTemplatePlan {
  name: string;
  description: string;
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  goal: string;
  dietType: string;
  mealCount: number;
}

const TEMPLATE_PLAN_SEED_DATA: SeedTemplatePlan[] = [
  {
    name: 'Redukcja 1600 kcal',
    description:
      'Szablon diety redukcyjnej o obniżonej kaloryczności. Wysoka zawartość białka pomaga zachować masę mięśniową podczas deficytu kalorycznego.',
    targetKcal: 1600,
    targetProteinG: 130,
    targetFatG: 55,
    targetCarbsG: 155,
    goal: 'WEIGHT_LOSS',
    dietType: 'STANDARD',
    mealCount: 4,
  },
  {
    name: 'Redukcja 1800 kcal',
    description:
      'Szablon diety redukcyjnej dla aktywnych osób. Umiarkowany deficyt kaloryczny z zachowaniem optymalnego rozkładu makroskładników.',
    targetKcal: 1800,
    targetProteinG: 140,
    targetFatG: 65,
    targetCarbsG: 175,
    goal: 'WEIGHT_LOSS',
    dietType: 'STANDARD',
    mealCount: 5,
  },
  {
    name: 'Utrzymanie 2000 kcal',
    description:
      'Szablon diety normokalorycznej. Zbilansowany rozkład makroskładników wspierający utrzymanie aktualnej masy ciała.',
    targetKcal: 2000,
    targetProteinG: 140,
    targetFatG: 72,
    targetCarbsG: 215,
    goal: 'MAINTENANCE',
    dietType: 'STANDARD',
    mealCount: 5,
  },
  {
    name: 'Utrzymanie 2300 kcal',
    description:
      'Szablon diety normokalorycznej dla bardziej aktywnych osób. Wyższa podaż węglowodanów wspiera energię i regenerację.',
    targetKcal: 2300,
    targetProteinG: 155,
    targetFatG: 80,
    targetCarbsG: 260,
    goal: 'MAINTENANCE',
    dietType: 'STANDARD',
    mealCount: 5,
  },
  {
    name: 'Masa 2500 kcal',
    description:
      'Szablon diety na masę mięśniową. Umiarkowana nadwyżka kaloryczna z wysoką podażą białka i węglowodanów.',
    targetKcal: 2500,
    targetProteinG: 175,
    targetFatG: 80,
    targetCarbsG: 295,
    goal: 'MUSCLE_GAIN',
    dietType: 'STANDARD',
    mealCount: 5,
  },
  {
    name: 'Masa 2800 kcal',
    description:
      'Szablon diety na masę mięśniową dla zaawansowanych. Wyższa nadwyżka kaloryczna wsparcie intensywnych treningów.',
    targetKcal: 2800,
    targetProteinG: 190,
    targetFatG: 95,
    targetCarbsG: 340,
    goal: 'MUSCLE_GAIN',
    dietType: 'STANDARD',
    mealCount: 6,
  },
  {
    name: 'Redukcja wegetariańska 1800 kcal',
    description:
      'Szablon diety redukcyjnej bez mięsa. Białko pochodzi z nabiału, jaj, roślin strączkowych i tofu.',
    targetKcal: 1800,
    targetProteinG: 120,
    targetFatG: 65,
    targetCarbsG: 195,
    goal: 'WEIGHT_LOSS',
    dietType: 'VEGE',
    mealCount: 5,
  },
  {
    name: 'Utrzymanie wegańskie 2000 kcal',
    description:
      'Szablon diety normokalorycznej w 100% roślinnej. Białko pochodzi z roślin strączkowych, tofu, tempehu i seitanu.',
    targetKcal: 2000,
    targetProteinG: 110,
    targetFatG: 70,
    targetCarbsG: 255,
    goal: 'MAINTENANCE',
    dietType: 'VEGAN',
    mealCount: 5,
  },
];

async function seedTemplatePlans(): Promise<void> {
  let created = 0;
  for (const plan of TEMPLATE_PLAN_SEED_DATA) {
    const existing = await prisma.templatePlan.findFirst({
      where: { name: plan.name, goal: plan.goal, dietType: plan.dietType as 'STANDARD' | 'VEGE' | 'VEGAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE' },
    });
    if (!existing) {
      await prisma.templatePlan.create({
        data: {
          name: plan.name,
          description: plan.description,
          targetKcal: plan.targetKcal,
          targetProteinG: plan.targetProteinG,
          targetFatG: plan.targetFatG,
          targetCarbsG: plan.targetCarbsG,
          goal: plan.goal,
          dietType: plan.dietType as 'STANDARD' | 'VEGE' | 'VEGAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE',
          mealCount: plan.mealCount,
          source: 'seed',
        },
      });
      created++;
    }
  }
  console.log(`Seeded ${created} template plans (${TEMPLATE_PLAN_SEED_DATA.length - created} already existed).`);
}

const BLOG_CATEGORY_SEED = [
  { name: 'Porady dietetyczne', slug: 'porady-dietetyczne' },
  { name: 'Odchudzanie',        slug: 'odchudzanie' },
  { name: 'Zdrowie i choroby',  slug: 'zdrowie-i-choroby' },
  { name: 'Przepisy',           slug: 'przepisy' },
  { name: 'AI i dietetyka',     slug: 'ai-i-dietetyka' },
  { name: 'Motywacja',          slug: 'motywacja' },
  { name: 'Subskrypcja',        slug: 'subskrypcja' },
  { name: 'Thermomix & Airfryer', slug: 'thermomix-airfryer' },
];

async function seedBlogCategories(): Promise<void> {
  let upserted = 0;
  for (const cat of BLOG_CATEGORY_SEED) {
    await prisma.blogCategoryConfig.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, isActive: true },
      create: { name: cat.name, slug: cat.slug, isActive: true },
    });
    upserted++;
  }
  console.log(`Seeded ${upserted} blog categories.`);
}

async function main(): Promise<void> {
  await seedBlogPosts();
  await seedFoodItems();
  await seedMeals();
  await seedTemplatePlans();
  await seedBlogCategories();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
