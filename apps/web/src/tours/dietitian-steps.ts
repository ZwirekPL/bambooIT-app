import type { MultiPageTourStep } from '@/hooks/useMultiPageTour';

/**
 * Comprehensive dietitian tour — ~60 steps across 8+ pages.
 * Covers ALL features visible to a dietitian user.
 */
export const DIETITIAN_TOUR_STEPS: MultiPageTourStep[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD (/dietetyk) — 12 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk',
    popover: {
      title: 'Witamy w panelu dietetyka! 👋',
      description: 'Przeprowadzimy Cię przez WSZYSTKIE funkcje aplikacji. Tour potrwa ok. 5-7 minut. Możesz go przerwać w dowolnym momencie klikając X.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="nav-home"]',
    popover: {
      title: 'Dashboard — Strona główna',
      description: 'Centralne miejsce z podsumowaniem: statystyki, alerty kliniczne, lista pacjentów i szybkie akcje. Tu zaczynasz każdy dzień pracy.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="dt-greeting"]',
    popover: {
      title: 'Powitanie',
      description: 'Twoje imię i personalizowany nagłówek. Obok znajdziesz przycisk do zapraszania pacjentów.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="invite-patient"]',
    popover: {
      title: 'Zapraszanie pacjentów',
      description: 'Wyślij zaproszenie e-mailem — pacjent otrzyma link do rejestracji z Twoim kodem dietetyka automatycznie wpisanym. Nie musi go znać ani wpisywać ręcznie.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="stats-cards"]',
    popover: {
      title: 'Statystyki na żywo',
      description: '4 karty: Łączna liczba pacjentów | Plany oczekujące na Twoją weryfikację | Szkice AI (wstępnie wygenerowane) | Plany opublikowane pacjentom. Aktualizują się w czasie rzeczywistym.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="dt-alerts"]',
    popover: {
      title: 'Alerty kliniczne',
      description: 'System automatycznie ostrzega o: planach wymagających weryfikacji, pacjentach z flagami klinicznymi (red flags), ryzyku porzucenia diety, gwałtownych zmianach wagi i niedoborach mikroelementów.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="dt-action-items"]',
    popover: {
      title: 'Wymagane działania',
      description: 'Szybkie linki do najważniejszych zadań: plany czekające na zatwierdzenie, pacjenci bez planu, plany z flagami klinicznymi wymagające ręcznej weryfikacji.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="dt-search-filter"]',
    popover: {
      title: 'Wyszukiwanie pacjentów',
      description: 'Wyszukaj pacjenta po imieniu lub emailu. Filtruj po statusie planu: Wszystkie, Brak planu, Szkic AI, Oczekujący na weryfikację, Opublikowany.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: '/dietetyk',
    element: '[data-tour="patient-list"]',
    popover: {
      title: 'Lista pacjentów',
      description: 'Tabela z danymi pacjentów: imię, email, status planu diety i data dołączenia. Kliknij pacjenta, aby zobaczyć profil zdrowotny, wywiad, plany i notatki.',
      side: 'top',
      align: 'center',
    },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // PACJENCI (/dietetyk/pacjenci) — 1 step (sidebar highlight)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/pacjenci',
    element: '[data-tour="nav-patients"]',
    popover: {
      title: 'Strona Pacjenci',
      description: 'Pełna lista pacjentów z wyszukiwaniem i filtrami. Kliknij pacjenta, aby zobaczyć: profil zdrowotny, wywiad, plany diety, notatki, rekomendowane produkty i cele żywieniowe. Stąd też generujesz plany AI i zarządzasz statusami.',
      side: 'right',
      align: 'start',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUKTY (/dietetyk/produkty) — 5 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/produkty',
    element: '[data-tour="nav-products"]',
    popover: {
      title: 'Baza produktów spożywczych',
      description: 'Polska baza ~6600 produktów z pełnym profilem odżywczym: makroskładniki, witaminy, minerały, aminokwasy, kwasy tłuszczowe. Źródła: dane naukowe + dane producentów.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/produkty',
    popover: {
      title: 'Typy produktów',
      description: 'Bazowe — z naukowych baz danych (USDA, tabele polskie). Sklepowe — konkretne produkty z kodami kreskowymi. Własne — dodane ręcznie przez Ciebie. Każdy produkt ma: kcal, białko, tłuszcze, węglowodany, błonnik, witaminy, minerały na 100g.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/produkty',
    popover: {
      title: 'Dane kliniczne produktów',
      description: 'Każdy produkt może mieć: indeks glikemiczny (GI), poziom FODMAP, stopień przetworzenia (NOVA), alergeny (EU14), flagi dietetyczne (diabeticFriendly, renalFriendly, lowSodium, ketoCompatible...), porcje z gramaturami.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/produkty',
    popover: {
      title: 'Filtrowanie i wyszukiwanie',
      description: 'Szukaj po nazwie. Filtruj po typie (Bazowe/Sklepowe/Własne) i kategorii (nabiał, mięso, warzywa...). Kliknij produkt, aby zobaczyć pełny profil z mikro- i makroskładnikami.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/produkty',
    popover: {
      title: 'Dodawanie własnych produktów',
      description: 'Kliknij "+" aby dodać własny produkt z ręcznymi wartościami odżywczymi. Pojawi się jako typ "Własny" (MANUAL) i będzie dostępny w kreatorze przepisów i planów.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRZEPISY (/dietetyk/przepisy) — 7 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/przepisy',
    element: '[data-tour="nav-recipes"]',
    popover: {
      title: 'Baza przepisów',
      description: 'Przepisy z makroskładnikami, alergenami, ocenami pacjentów, instrukcjami krok po kroku i zdjęciami. Automatycznie obliczane wartości odżywcze na podstawie składników.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/przepisy',
    element: '[data-tour="dt-recipes-filters"]',
    popover: {
      title: 'Zaawansowane filtry',
      description: 'Filtruj po: typie posiłku (śniadanie/obiad/kolacja...), kategorii (zupy/sałatki/dania główne), trudności (łatwy/średni/trudny), źródle (ręczne/AI), zakresie kalorii (min-max kcal). Przycisk "Meal prep" filtruje przepisy nadające się do przygotowania na zapas.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/przepisy',
    element: '[data-tour="dt-recipes-view-toggle"]',
    popover: {
      title: 'Widok tabela / kafelki',
      description: 'Przełączaj między widokiem tabeli (kompaktowy, z kolumnami makro B/T/W) a widokiem kafelkowym (wizualny, z kartami i makro na każdej karcie).',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    page: '/dietetyk/przepisy',
    popover: {
      title: 'Źródło przepisu: AI vs Manualne',
      description: 'Przepisy oznaczone "AI" zostały wygenerowane przez system AI podczas tworzenia planów. Przepisy ręczne/importowane to sprawdzone przepisy z bazy. Filtr "Manualne" ukrywa AI, filtr "AI" pokazuje tylko wygenerowane.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/przepisy',
    popover: {
      title: 'Oceny pacjentów',
      description: 'Pacjenci mogą oceniać przepisy gwiazdkami (1-5). W tabeli i kafelkach widzisz średnią ocenę i liczbę głosów. Sortuj po ocenie, aby znaleźć najpopularniejsze przepisy.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/przepisy',
    element: '[data-tour="dt-recipes-add"]',
    popover: {
      title: 'Kreator przepisów',
      description: 'Twórz własne przepisy w 4-krokowym kreatorze: 1) Podstawy (nazwa, kategoria, typ posiłku, trudność), 2) Składniki (z wyszukiwarką produktów + auto-przelicznik makro), 3) Kroki przygotowania (z fazami: przygotowanie/gotowanie), 4) Podsumowanie z wartościami odżywczymi.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    page: '/dietetyk/przepisy',
    popover: {
      title: 'Szczegóły przepisu',
      description: 'Kliknij przepis, aby zobaczyć: pełny opis, listę składników z gramaturami, kroki przygotowania, czas przygotowania/gotowania, wartości odżywcze (makro + mikro), alergeny, flagi dietetyczne, porady i notatki dietetyka.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SZABLONY (/dietetyk/szablony) — 3 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/szablony',
    element: '[data-tour="nav-templates"]',
    popover: {
      title: 'Szablony notatek',
      description: 'Gotowe szablony tekstowe do wielokrotnego użycia przy komunikacji z pacjentami. Oszczędzają czas przy pisaniu powtarzalnych wskazówek.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/szablony',
    popover: {
      title: 'Tworzenie szablonów',
      description: 'Nadaj szablonowi tytuł, kategorię i treść. Przykłady: "Wskazówki do diety low-FODMAP", "Przed wizytą kontrolną", "Pierwszy tydzień na diecie". Szablony można edytować i usuwać.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/szablony',
    popover: {
      title: 'Używanie szablonów',
      description: 'Przy pisaniu notatki do pacjenta kliknij "Wstaw szablon" — treść szablonu zostanie wklejona do pola tekstowego. Możesz ją potem zmodyfikować przed wysłaniem.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROTOKOŁY (/dietetyk/protokol) — 4 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/protokol',
    element: '[data-tour="nav-protocol"]',
    popover: {
      title: 'Protokoły żywieniowe',
      description: 'Konfiguracja zasad generowania planów AI. Każdy protokół definiuje: proporcje makroskładników, liczbę posiłków, ograniczenia i preferencje.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/protokol',
    popover: {
      title: 'Aktywny protokół',
      description: 'Protokół oznaczony jako "Aktywny" (zielony) jest używany automatycznie przy generowaniu nowych planów AI. Kliknij "Ustaw aktywny" aby zmienić domyślny protokół.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/protokol',
    popover: {
      title: 'Co definiuje protokół?',
      description: 'Każdy protokół zawiera: wzór BMR (Harris-Benedict/Mifflin), korekty kaloryczne (deficyt/nadwyżka), minimalne/maksymalne białko na kg masy ciała, rozkład posiłków (%), ograniczenia żywieniowe, złożoność przepisów i instrukcje dla AI.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/protokol',
    popover: {
      title: 'Automatyczne dopasowanie',
      description: 'System automatycznie proponuje protokoły na podstawie wywiadu pacjenta. Np. pacjent z cukrzycą T2 → protokół "Cukrzyca typ 2 / Insulinooporność". Możesz zaakceptować sugestię lub wybrać inny ręcznie.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RAPORTY (/dietetyk/raport) — 4 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/raport',
    element: '[data-tour="nav-report"]',
    popover: {
      title: 'Raporty miesięczne',
      description: 'Szczegółowe statystyki za wybrany miesiąc: ilu pacjentów, ile planów wygenerowałeś, jak idą postępy Twoich pacjentów.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/raport',
    popover: {
      title: 'Wybór okresu',
      description: 'Wybierz miesiąc i rok, kliknij "Załaduj" aby wygenerować raport. Możesz też eksportować raport do PDF.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/raport',
    popover: {
      title: 'Statystyki w raporcie',
      description: 'Karty podsumowania: nowi pacjenci, plany (wygenerowane/zweryfikowane/opublikowane), średni compliance pacjentów, liczba check-inów, postęp w celach wagowych. Poniżej tabela ze szczegółami per pacjent.',
      side: 'over',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/raport',
    popover: {
      title: 'Tabela szczegółowa',
      description: 'Dla każdego pacjenta widać: aktualną wagę, cel, zmianę wagi, compliance (%), liczbę check-inów i planów. Pomaga identyfikować pacjentów wymagających uwagi.',
      side: 'over',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFIL (/dietetyk/profil) — 6 steps
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/profil',
    element: '[data-tour="nav-profile"]',
    popover: {
      title: 'Twój profil',
      description: 'Zarządzaj danymi osobowymi, kodem dietetyka, QR kodem, hasłem i emailem.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: '/dietetyk/profil',
    element: '[data-tour="dt-profile-code"]',
    popover: {
      title: 'Kod dietetyka i QR',
      description: 'Twój unikalny kod — podaj go pacjentom lub udostępnij QR code. Pacjent skanuje QR → otwiera się rejestracja z Twoim kodem automatycznie wpisanym. Przycisk "Kopiuj" kopiuje kod do schowka.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/profil',
    element: '[data-tour="dt-profile-form"]',
    popover: {
      title: 'Dane osobowe',
      description: 'Edytuj imię i nazwisko. Te dane widzą Twoi pacjenci w swoich powiadomieniach i na stronie profilu.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/profil',
    element: '[data-tour="dt-profile-password"]',
    popover: {
      title: 'Zmiana hasła',
      description: 'Zmień hasło podając stare i nowe. Hasło musi mieć min. 12 znaków, zawierać literę i cyfrę.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: '/dietetyk/profil',
    element: '[data-tour="dt-profile-email"]',
    popover: {
      title: 'Zmiana email',
      description: 'Zmień adres email — wymaga potwierdzenia hasłem. Po zmianie otrzymasz email weryfikacyjny na nowy adres.',
      side: 'bottom',
      align: 'center',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ZAKOŃCZENIE — 1 step
  // ═══════════════════════════════════════════════════════════════════════════
  {
    page: '/dietetyk/profil',
    popover: {
      title: 'Tour zakończony! 🎉',
      description: 'Znasz już wszystkie funkcje panelu dietetyka! Pamiętaj: przy edycji planu diety pacjenta po prawej stronie pojawi się Przybornik Kliniczny z wytycznymi, flagami i celami żywieniowymi dopasowanymi do chorób pacjenta. Możesz uruchomić tour ponownie w ustawieniach profilu.',
      side: 'over',
      align: 'center',
    },
  },
];
