-- Ticket numbers are human-facing references (#1000+). Start the autoincrement
-- sequence at 1000 so the first ticket reads "#1000" instead of "#1" (§9 decision).
-- Guarded: only restart when no tickets exist yet, so this stays a no-op on
-- environments that already issued numbers.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Ticket") THEN
    ALTER SEQUENCE "Ticket_number_seq" RESTART WITH 1000;
  END IF;
END $$;
