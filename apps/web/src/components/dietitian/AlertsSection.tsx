'use client';

import { Link } from '@/i18n/navigation';
import type { DietitianAlert, AlertSeverity, AlertType } from '@/types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  TrendingDown,
  UserX,
  Pill,
  ChevronRight,
} from 'lucide-react';

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: 'border-red-300 bg-red-50',
  high: 'border-orange-300 bg-orange-50',
  moderate: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  moderate: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
};

const ALERT_ICONS: Record<AlertType, React.ElementType> = {
  plans_awaiting_review: Clock,
  red_flag_plans: ShieldAlert,
  dropout_risk: UserX,
  rapid_weight_loss: TrendingDown,
  micronutrient_deficiency: Pill,
};

interface AlertsSectionProps {
  alerts: DietitianAlert[];
  labels: {
    title: string;
    noAlerts: string;
    types: Record<AlertType, string>;
    severities: Record<AlertSeverity, string>;
    viewPatient: string;
  };
}

function patientName(p: { firstName: string | null; lastName: string | null }): string {
  if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`;
  if (p.firstName) return p.firstName;
  return '—';
}

export function AlertsSection({ alerts, labels }: AlertsSectionProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold">{labels.title}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {alerts.map((alert) => {
          const Icon = ALERT_ICONS[alert.type];
          return (
            <Card
              key={alert.type}
              className={`border ${SEVERITY_STYLES[alert.severity]}`}
            >
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0 opacity-70" />
                    <span className="text-sm font-medium">
                      {labels.types[alert.type]}
                    </span>
                  </div>
                  <Badge className={`text-xs pointer-events-none ${SEVERITY_BADGE[alert.severity]}`}>
                    {alert.count}
                  </Badge>
                </div>

                {alert.patients.length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {alert.patients.slice(0, 5).map((p) => (
                      <li key={p.patientId} className="flex items-center justify-between">
                        <Link
                          href={`/dietetyk/pacjenci/${p.patientId}`}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <span>{patientName(p)}</span>
                          {p.detail && (
                            <span className="text-muted-foreground/70">({p.detail})</span>
                          )}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </li>
                    ))}
                    {alert.patients.length > 5 && (
                      <li className="text-muted-foreground/60">
                        +{alert.patients.length - 5} ...
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
