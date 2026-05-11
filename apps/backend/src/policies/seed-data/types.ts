import type { RuleCondition } from '../condition-evaluator';
import type { PolicyEffect } from '../types';

export interface RuleSeed {
  name: string;
  description: string;
  type: 'POLICY' | 'RED_FLAG';
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  priority: number;
  conditions: RuleCondition;
  effects: PolicyEffect[] | { message: string };
  source?: string;
  version?: string;
  category?: string;
  sources?: Array<{ ref: string; url?: string; year?: number }>;
  conflictsWith?: string[];
}
