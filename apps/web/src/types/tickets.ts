// Ticketing — shared frontend types (TKT-3/4).

import type { Plan } from '@/types/ops';

export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketChannel = 'PORTAL' | 'PHONE' | 'EMAIL' | 'MANUAL';

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  internal: boolean;
  createdAt: string;
  author?: { id: string; email: string; role: string };
}

// Client list item (own tickets).
export interface MyTicketSummary {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface MyTicketDetail {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

// Admin queue row.
export interface AdminTicketRow {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  channel: TicketChannel;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    companyName: string | null;
    contactFirstName: string | null;
    contactLastName: string | null;
  };
  assignee: { id: string; email: string } | null;
  _count: { messages: number };
}

export interface AdminTicketTimeEntry {
  id: string;
  date: string;
  minutes: number;
  description: string;
  billable: boolean;
  createdBy?: { email: string };
}

export interface AdminTicketDetail {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  channel: TicketChannel;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalMinutes: number;
  company: {
    id: string;
    companyName: string | null;
    contactFirstName: string | null;
    contactLastName: string | null;
    servicePlan: Plan | null;
    user: { email: string };
  };
  createdBy: { id: string; email: string; role: string };
  assignee: { id: string; email: string } | null;
  messages: TicketMessage[];
  timeEntries: AdminTicketTimeEntry[];
}

export interface TicketStats {
  byStatus: Record<TicketStatus, number>;
  open: number;
  slaBreached: number;
}
