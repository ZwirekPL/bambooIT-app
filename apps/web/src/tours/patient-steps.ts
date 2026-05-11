import type { MultiPageTourStep } from '@/hooks/useMultiPageTour';

/**
 * Comprehensive patient tour — ~55 steps across 8+ pages.
 * Covers ALL features visible to a patient user.
 */
export const PATIENT_TOUR_STEPS: MultiPageTourStep[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD (/dashboard) — 14 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard',
    popover: {
      title: 'Witamy w Twoim panelu! 👋',
      description: 'Pokażemy Ci WSZYSTKIE funkcje aplikacji. Tour potrwa ok. 4-5 minut. Możesz go przerwać w dowolnym momencie klikając X.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="patient-nav-home"]',
    popover: {
      title: 'Strona główna',
      description: 'Twój centralny panel z podsumowaniem: status planu diety, dzisiejsze posiłki, przypomnienia o check-inie, postęp, wiadomości od dietetyka i skróty.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="patient-plan-status"]',
    popover: {
      title: 'Status planu diety',
      description: 'Aktualny status Twojego planu: Szkic AI (generowany automatycznie) → Oczekuje weryfikacji (dietetyk sprawdza) → Zweryfikowany → Wysłany → Opublikowany (dostępny dla Ciebie). Kliknij "Plan diety" aby zobaczyć szczegóły.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-subscription-status"]',
    popover: {
      title: 'Status subskrypcji',
      description: 'Szybki podgląd Twojej aktywnej subskrypcji: typ planu (miesięczny/roczny), status (trial/aktywna), data następnego odnowienia.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-checkin-reminder"]',
    popover: {
      title: 'Przypomnienie o check-inie',
      description: 'System przypomina Ci o regularnym check-inie (co tydzień). Check-in to: aktualna waga, compliance z dietą, poziom głodu, energii, snu i aktywności. Regularne check-iny pomagają dietetykowi lepiej dopasować plan.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-today-meals"]',
    popover: {
      title: 'Dzisiejsze posiłki',
      description: 'Podgląd posiłków zaplanowanych na dzisiaj — bez otwierania pełnego planu. Widoczne nazwy dań i kalorie. Kliknij aby rozwinąć szczegóły.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-weight-progress"]',
    popover: {
      title: 'Pasek postępu wagi',
      description: 'Wizualny postęp od wagi startowej do celu. Pokazuje ile kilogramów zostało i procentowy postęp. Aktualizuje się automatycznie po każdym check-inie z wagą.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-milestones"]',
    popover: {
      title: 'Kamienie milowe',
      description: 'Osiągnięcia wagowe: -1kg, -3kg, -5kg, -10kg itd. Każdy osiągnięty kamień milowy zaświeci się na zielono. Motywacja do dalszego działania!',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-dietitian-messages"]',
    popover: {
      title: 'Wiadomości od dietetyka',
      description: 'Twój dietetyk może wysyłać Ci notatki i wskazówki dotyczące diety, suplementacji i stylu życia. Nowe wiadomości pojawiają się tutaj z datą i treścią.',
      side: 'top',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="patient-shortcuts"]',
    popover: {
      title: 'Szybkie skróty',
      description: '4 karty prowadzące do najczęściej używanych sekcji: Profil zdrowotny, Wywiad, Plan diety, Historia. Kliknij kartę, aby przejść do danej sekcji.',
      side: 'top',
      align: 'center',
    },
  },
  {
    page: '/dashboard',
    element: '[data-tour="pt-referral"]',
    popover: {
      title: 'Program poleceń',
      description: 'Poleć aplikację znajomym — udostępnij swój kod polecający. Każda osoba, która się zarejestruje z Twoim kodem, pomaga Ci budować społeczność zdrowia.',
      side: 'top',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFIL (/dashboard/profil) — 9 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/profil',
    element: '[data-tour="patient-nav-profile"]',
    popover: {
      title: 'Twój profil zdrowotny',
      description: 'Zarządzaj danymi osobowymi i zdrowotnymi. Im więcej informacji podasz, tym lepiej dopasowany będzie Twój plan diety.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/profil',
    element: '[data-tour="pt-profile-form"]',
    popover: {
      title: 'Dane osobowe i zdrowotne',
      description: 'Uzupełnij: imię, nazwisko, płeć, rok urodzenia, wzrost (cm), wagę (kg). Te dane służą do obliczenia BMR, TDEE i docelowych makroskładników. Waga aktualizuje się też automatycznie z check-inów.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard/profil',
    element: '[data-tour="pt-dietitian-code"]',
    popover: {
      title: 'Połączenie z dietetykiem',
      description: 'Wpisz kod dietetyka, aby się z nim połączyć. Kod otrzymasz od dietetyka (np. "DIET-ABC123"). Po połączeniu dietetyk będzie mógł przeglądać Twój wywiad i tworzyć plany diety. Możesz też się odłączyć.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard/profil',
    element: '[data-tour="pt-notifications"]',
    popover: {
      title: 'Ustawienia powiadomień',
      description: 'Włącz/wyłącz powiadomienia email o: nowym planie diety, przypomnieniach o check-inie, wiadomościach od dietetyka. Kontroluj jakie maile otrzymujesz.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard/profil',
    element: '[data-tour="pt-change-password"]',
    popover: {
      title: 'Zmiana hasła',
      description: 'Zmień hasło do swojego konta. Hasło musi mieć min. 12 znaków, zawierać literę i cyfrę.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard/profil',
    element: '[data-tour="pt-data-privacy"]',
    popover: {
      title: 'Prywatność danych (RODO)',
      description: 'Zgodnie z RODO możesz: pobrać wszystkie swoje dane (Art. 15), sprawdzić jakie zgody udzieliłeś, zobaczyć historię zmian zgód. Twoje dane medyczne są szyfrowane (AES-256-GCM).',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard/profil',
    element: '[data-tour="pt-delete-account"]',
    popover: {
      title: 'Usunięcie konta',
      description: 'Prawo do bycia zapomnianym (RODO Art. 17). Możesz trwale usunąć konto i wszystkie dane osobowe. Operacja jest nieodwracalna — dane zostaną zanonimizowane.',
      side: 'bottom',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WYWIAD (/dashboard/wywiad) — 4 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/wywiad',
    element: '[data-tour="patient-nav-interview"]',
    popover: {
      title: 'Wywiad zdrowotny',
      description: 'Fundament Twojej diety. Na podstawie odpowiedzi AI generuje spersonalizowany plan uwzględniający choroby, alergie, preferencje i cele.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/wywiad',
    popover: {
      title: '6 etapów wywiadu',
      description: '1) Cel i waga docelowa • 2) Aktywność fizyczna (typ, częstotliwość, czas) • 3) Choroby przewlekłe i leki • 4) Alergie, nietolerancje, preferencje żywieniowe • 5) Styl życia (posiłki, czas gotowania, budżet, suplementy) • 6) Status hormonalny i sen.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/wywiad',
    popover: {
      title: 'Wywiad żywieniowy',
      description: 'Wywiad żywieniowy zbiera informacje o Twoim celu, aktywności fizycznej, chorobach, alergiach, preferencjach, rytmie posiłków i zdrowiu hormonalnym. Im więcej uzupełnisz, tym lepszy plan otrzymasz.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/wywiad',
    popover: {
      title: 'Co dzieje się po wysłaniu?',
      description: 'Po wysłaniu wywiadu: 1) System oblicza cele żywieniowe (kcal, B/T/W) na podstawie Twoich danych. 2) AI generuje 7-dniowy plan diety. 3) System kliniczny waliduje plan (reguły POLICY + Red Flags). 4) Dietetyk weryfikuje i zatwierdza plan. 5) Otrzymujesz gotowy plan!',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAN DIETY (/dashboard/plan) — 7 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/plan',
    element: '[data-tour="patient-nav-plan"]',
    popover: {
      title: 'Plan diety',
      description: 'Tutaj znajdziesz swój aktualny plan diety po zatwierdzeniu przez dietetyka. Plan obejmuje 7 dni z pełnymi posiłkami, przepisami i wartościami odżywczymi.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/plan',
    popover: {
      title: 'Widok 7-dniowy',
      description: 'Nawiguj między dniami tygodnia. Każdy dzień zawiera 4-6 posiłków: śniadanie, II śniadanie, obiad, podwieczorek, kolacja, opcjonalna przekąska.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/plan',
    popover: {
      title: 'Posiłki i przepisy',
      description: 'Każdy posiłek pokazuje: nazwę dania, składniki z gramaturami, kalorie i makro (B/T/W). Rozwiń posiłek, aby zobaczyć pełny przepis krok po kroku, czas przygotowania i porady.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/plan',
    popover: {
      title: 'Makroskładniki dzienne',
      description: 'Na górze dnia widzisz podsumowanie: łączne kcal, białko, tłuszcze, węglowodany. Porównaj z Twoimi celami żywieniowymi. Zielone = w normie, żółte = blisko limitu, czerwone = przekroczone.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/plan',
    popover: {
      title: 'Zamiana posiłku',
      description: 'Nie podoba Ci się posiłek? Kliknij ikonę zamiany — system zaproponuje alternatywę o podobnych makroskładnikach. Liczba zamian tygodniowo jest limitowana (np. 3 zamiany/tydzień).',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/plan',
    popover: {
      title: 'Ocenianie posiłków',
      description: 'Oceń każdy posiłek gwiazdkami (1-5) i dodaj komentarz. Twoje oceny pomagają dietetykowi zrozumieć co Ci smakuje, a co nie. Najlepiej oceniane przepisy będą częściej proponowane.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/plan',
    popover: {
      title: 'Warianty przygotowania',
      description: 'Niektóre przepisy mają warianty: Thermomix, Airfryer. Jeśli masz takie urządzenie, kliknij odpowiednią zakładkę, aby zobaczyć zmodyfikowane kroki przygotowania.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ZAKUPY (/dashboard/zakupy) — 3 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/zakupy',
    element: '[data-tour="patient-nav-shopping"]',
    popover: {
      title: 'Lista zakupów',
      description: 'Automatycznie wygenerowana lista zakupów na cały tydzień na podstawie Twojego planu diety.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/zakupy',
    popover: {
      title: 'Kategorie produktów',
      description: 'Lista podzielona na kategorie: nabiał, mięso/ryby, warzywa, owoce, pieczywo, produkty suche, przyprawy itd. Łatwiej kupować gdy produkty są pogrupowane.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/zakupy',
    popover: {
      title: 'Odhaczanie i kopiowanie',
      description: 'Odhaczaj kupione produkty — zapisuje się w przeglądarce (nie zniknie po zamknięciu). Przycisk "Kopiuj" kopiuje całą listę do schowka (np. do wysłania SMSem). "Resetuj" odznacza wszystkie odhaczenia.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POSTĘP (/dashboard/postep) — 5 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/postep',
    element: '[data-tour="patient-nav-progress"]',
    popover: {
      title: 'Postęp i check-iny',
      description: 'Regularnie rejestruj wagę i samopoczucie. Im częściej robisz check-in, tym lepiej dietetyk widzi Twoje postępy i może reagować.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/postep',
    popover: {
      title: 'Formularz check-inu',
      description: 'Wpisz: aktualną wagę (kg), compliance z dietą (0-100% — jak bardzo trzymałeś się planu), poziom głodu, energii, jakości snu i aktywności fizycznej (suwaki 1-10), opcjonalną notatkę dla dietetyka.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/postep',
    popover: {
      title: 'Wykresy trendów',
      description: 'Po 2+ check-inach zobaczysz interaktywne wykresy: trend wagi w czasie, średnie oceny (głód, energia, sen), compliance. Pomagają zaobserwować postępy i wzorce.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/postep',
    popover: {
      title: 'Historia check-inów',
      description: 'Lista wszystkich Twoich check-inów z datami, wagą, compliance i ocenami. Możesz przeglądać jak zmieniały się Twoje parametry w czasie.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/postep',
    popover: {
      title: 'Adaptacja diety',
      description: 'System automatycznie analizuje Twoje check-iny. Jeśli compliance jest niskie lub waga się nie zmienia, dietetyk otrzyma alert i może dostosować plan. Regularne check-iny = lepsza dieta!',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIA (/dashboard/historia) — 2 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/historia',
    element: '[data-tour="patient-nav-history"]',
    popover: {
      title: 'Historia planów',
      description: 'Archiwum wszystkich Twoich planów diety — od pierwszego do aktualnego.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/historia',
    popover: {
      title: 'Porównywanie planów',
      description: 'Kliknij dowolny poprzedni plan, aby go otworzyć. Możesz porównać makroskładniki, składniki i posiłki między różnymi wersjami. Każdy plan zachowuje pełną historię.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPINIA (/dashboard/opinia) — 2 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/opinia',
    element: '[data-tour="patient-nav-testimonial"]',
    popover: {
      title: 'Twoja opinia',
      description: 'Podziel się swoim doświadczeniem z platformą e-dietetyk.com.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/opinia',
    popover: {
      title: 'Wystaw opinię',
      description: 'Oceń usługi gwiazdkami (1-5) i napisz komentarz. Twoja opinia może być wyświetlona na stronie głównej (po zatwierdzeniu). Możesz ją później edytować lub usunąć.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSKRYPCJA (/dashboard/subskrypcja) — 5 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/subskrypcja',
    element: '[data-tour="patient-nav-subscription"]',
    popover: {
      title: 'Subskrypcja',
      description: 'Zarządzaj swoim abonamentem: sprawdź status, datę odnowienia, historię płatności.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dashboard/subskrypcja',
    element: '[data-tour="pt-subscription-card"]',
    popover: {
      title: 'Aktywna subskrypcja',
      description: 'Karta z aktualnym planem (miesięczny/roczny), statusem (Trial 7 dni / Aktywna / Zaległa / Anulowana), datą następnego odnowienia. Cena zależy od planu: 129 zł/mies. lub 99 zł/mies. (roczny).',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dashboard/subskrypcja',
    popover: {
      title: 'Anulowanie subskrypcji',
      description: 'Możesz anulować subskrypcję w dowolnym momencie. Dostęp pozostaje aktywny do końca opłaconego okresu. W okresie trial (7 dni) — anulowanie jest natychmiastowe i bezpłatne.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/subskrypcja',
    popover: {
      title: 'Prawo odstąpienia (14 dni)',
      description: 'Zgodnie z polskim prawem konsumenckim masz prawo odstąpić od umowy w ciągu 14 dni od zakupu (Art. 27 ustawy o prawach konsumenta). Zwrot środków następuje w ciągu 14 dni roboczych.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dashboard/subskrypcja',
    element: '[data-tour="pt-orders-table"]',
    popover: {
      title: 'Historia zamówień',
      description: 'Tabela zamówień: data, produkt (plan miesięczny/roczny/konsultacja), kwota, status płatności (opłacona/oczekująca/zwrócona). Pełna historia Twoich transakcji.',
      side: 'top',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ZAKOŃCZENIE — 1 step
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dashboard/subskrypcja',
    popover: {
      title: 'Tour zakończony! 🎉',
      description: 'Znasz już wszystkie funkcje! Zacznij od wypełnienia profilu zdrowotnego i wywiadu — na tej podstawie powstanie Twój spersonalizowany plan diety. Możesz uruchomić tour ponownie w ustawieniach profilu. Powodzenia!',
      side: 'over',
      align: 'center',
    },
  },
];
