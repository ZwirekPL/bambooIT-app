'use client';

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
