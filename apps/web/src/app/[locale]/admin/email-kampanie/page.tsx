'use client';

// TODO(K9-cleanup): Email campaigns placeholder after K5c drop.
// Original page (~1319 LOC) was a full UI for diet-specific email campaigns
// (WEEKLY_SUMMARY, DIETITIAN_SUMMARY, TRIGGER_PLATEAU, TRIGGER_MILESTONE,
// TRIGGER_INACTIVE, TRIGGER_PLAN_EXPIRY) with patient-targeted template
// variables. EmailCampaign + EmailSend models were dropped in K5c.
// Rebuild bambooIT email campaigns in faza 4 — likely scope:
// newsletter, satisfaction surveys, package-renewal reminders, onboarding
// drip campaigns for new B2B clients.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function EmailKampaniePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Kampanie email</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Kampanie email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Moduł kampanii email — w przebudowie. Nowy zestaw kampanii dla
            bambooIT (newsletter, ankiety satysfakcji, przypomnienia o
            przedłużeniu pakietu, onboarding drip) wracający w fazie 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
