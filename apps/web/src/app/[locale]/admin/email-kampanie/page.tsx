'use client';

// TODO(4-cleanup): backend route /email-campaigns removed in K2c.
// This admin page will show fetch error until rebuilt in phase 4.
// Generic email campaign infrastructure (newsletter, satisfaction
// surveys) needs new design — current diet workflow (TRIGGER_PLATEAU,
// PLAN_EXPIRY etc.) was 100% diet-specific.

import { useState, useEffect, useRef } from 'react';
import {
  Mail, Plus, Play, FlaskConical, Trash2, ToggleLeft, ToggleRight,
  Loader2, Power, ChevronUp, ChevronDown, Eye, EyeOff, X, HelpCircle, History,
  Copy, BookOpen, Bold, Italic, Link,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Tooltip helper ─────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: React.ReactNode }) {
  return (
    <span className="relative group inline-flex items-center">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help ml-1 shrink-0" />
      <span className="pointer-events-none absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block
                       w-64 rounded-lg border bg-white px-3 py-2 text-xs text-gray-700 shadow-lg whitespace-pre-line leading-relaxed">
        {content}
      </span>
    </span>
  );
}

// ─── Campaign interface ──────────────────────────────────────────────────────

interface Campaign {
  id: string;
  type: string;
  name: string;
  subject: string;
  subjectVariantB: string | null;
  schedule: string | null;
  segmentation: string | null;
  enabled: boolean;
  lastSentAt: string | null;
  variantASent: number;
  variantAOpened: number;
  variantBSent: number;
  variantBOpened: number;
  _count: { sends: number };
}

// ─── Campaign type info ──────────────────────────────────────────────────────

const TYPE_INFO: Record<string, { label: string; description: string; detail: string }> = {
  WEEKLY_SUMMARY: {
    label: 'Podsumowanie tygodnia',
    description: 'Automatyczny email z postępami pacjenta: waga, kalorie, adherencja do planu.',
    detail: 'Wysyłany automatycznie do pacjentów wg harmonogramu.\n\nZawiera: trend wagi, % adherencji do planu, osiągnięcia tygodnia, spersonalizowaną poradę.\n\nDostępne zmienne:\n{{patientName}}, {{weightTrend}}, {{compliance}}, {{tip}}, {{achievement}}',
  },
  DIETITIAN_SUMMARY: {
    label: 'Raport dietetyka',
    description: 'Tygodniowy raport dla dietetyka z przeglądem aktywności pacjentów.',
    detail: 'Wysyłany do dietetyków (segment: Dietetycy) wg harmonogramu.\n\nZawiera: liczba aktywnych pacjentów, średnia adherencja, lista pacjentów z niską adherencją i nieaktywnych.\n\nDostępne zmienne:\n{{patientName}} (imię dietetyka)',
  },
  TRIGGER_PLATEAU: {
    label: 'Trigger: Plateau',
    description: 'Wysyłany automatycznie gdy pacjent nie traci wagi przez 2+ tygodnie.',
    detail: 'Trigger automatyczny — wysyłany gdy pacjent ma brak zmiany wagi przez 3+ kolejne check-iny.\n\nWysyłany jednorazowo na epizod plateau (nie spamuje).\n\nDostępne zmienne:\n{{patientName}}, {{tip}}',
  },
  TRIGGER_MILESTONE: {
    label: 'Trigger: Kamień milowy',
    description: 'Gratulacje gdy pacjent osiągnie cel (np. -5kg, 4 tyg. streak).',
    detail: 'Trigger automatyczny — wysyłany przy osiągnięciu kamieni milowych: -5kg, -10kg, -15kg, -20kg lub streak 4 tygodnie.\n\nDostępne zmienne:\n{{patientName}}, {{achievement}}',
  },
  TRIGGER_INACTIVE: {
    label: 'Trigger: Nieaktywny',
    description: 'Przypomnienie dla pacjentów nieaktywnych przez 7+ dni.',
    detail: 'Trigger automatyczny — wysyłany gdy pacjent nie dodał check-inu przez 14–21 dni.\n\nWysyłany jednorazowo na epizod braku aktywności.\n\nDostępne zmienne:\n{{patientName}}, {{tip}}',
  },
  TRIGGER_PLAN_EXPIRY: {
    label: 'Trigger: Plan wygasa',
    description: 'Powiadomienie że plan dietetyczny wygasa za 3 dni.',
    detail: 'Trigger automatyczny — wysyłany gdy aktywny plan dietetyczny ma 25–30 dni i wkrótce wygaśnie.\n\nDostępne zmienne:\n{{patientName}}',
  },
  MOTIVATION: {
    label: 'Motywacja (bloki)',
    description: 'Motywacyjny email z własną treścią — edytor blokowy.',
    detail: 'Kampania manualna z własną treścią budowaną w edytorze blokowym.\n\nPrzeznaczenie: motywacyjne wiadomości, przypomnienia, akcje sezonowe.\n\nWymaga co najmniej jednego bloku treści.\n\nDostępne zmienne:\n{{patientName}}, {{weightTrend}}, {{compliance}}, {{tip}}, {{achievement}}',
  },
  CUSTOM: {
    label: 'Własny (bloki)',
    description: 'Dowolna kampania z własną treścią — edytor blokowy.',
    detail: 'Kampania manualna z pełną swobodą treści w edytorze blokowym.\n\nMożna użyć: nagłówków, akapitów, list, przycisków CTA, separatorów, obrazków i filmów.\n\nWymaga co najmniej jednego bloku treści.\n\nDostępne zmienne:\n{{patientName}}, {{weightTrend}}, {{compliance}}, {{tip}}, {{achievement}}',
  },
};

const SEG_INFO: Record<string, { label: string; description: string }> = {
  all: { label: 'Wszyscy pacjenci', description: 'Wszyscy aktywni pacjenci z zweryfikowanym emailem.' },
  active: { label: 'Aktywni pacjenci', description: 'Pacjenci z check-inem w ostatnich 14 dniach.' },
  lose_weight: { label: 'Odchudzanie', description: 'Pacjenci z celem: redukcja masy ciała.' },
  maintenance: { label: 'Utrzymanie', description: 'Pacjenci z celem: utrzymanie aktualnej wagi.' },
  muscle_gain: { label: 'Masa', description: 'Pacjenci z celem: budowa masy mięśniowej.' },
  dietitians: { label: 'Dietetycy', description: 'Wszyscy aktywni dietetycy.' },
};

const TEMPLATE_VARS = [
  { var: '{{patientName}}', label: 'Imię pacjenta',   description: 'Imię i nazwisko pacjenta z profilu użytkownika.',              example: 'Jan Kowalski' },
  { var: '{{weightTrend}}', label: 'Trend wagi',       description: 'Zmiana wagi z ostatniego tygodnia (z znakiem + lub -).',        example: '-0.8kg' },
  { var: '{{compliance}}',  label: 'Adherencja %',     description: 'Średni procent realizacji planu diety z ostatnich 4 check-inów.', example: '85' },
  { var: '{{tip}}',         label: 'Porada tygodnia',  description: 'Rotowana porada dietetyczna dopasowana do celu pacjenta.',      example: 'Pij szklankę wody przed każdym posiłkiem.' },
  { var: '{{achievement}}', label: 'Osiągnięcie',      description: 'Tekst osiągniętego kamienia milowego (np. schudnięcie 5kg).',  example: '5kg stracone!' },
];

// ─── Cron helpers ────────────────────────────────────────────────────────────

const DAY_LABELS = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
const DAY_LABELS_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

function buildCron(days: number[], hour: number, minute: number): string {
  if (days.length === 0) return `${minute} ${hour} * * *`;
  return `${minute} ${hour} * * ${days.join(',')}`;
}

function parseCron(cron: string): { days: number[]; hour: number; minute: number } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, dom, mon, dow] = parts;
  if (dom !== '*' || mon !== '*') return null;
  const minute = parseInt(minStr, 10);
  const hour = parseInt(hourStr, 10);
  if (isNaN(minute) || isNaN(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  let days: number[] = [];
  if (dow !== '*') {
    days = dow.split(',').map(Number);
    if (days.some(isNaN)) return null;
  }
  return { days, hour, minute };
}

function formatSchedulePreview(days: number[], hour: number, minute: number): string {
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (days.length === 0) return `Codziennie o ${timeStr}`;
  if (days.length === 7) return `Codziennie o ${timeStr}`;
  const dayNames = days.map((d) => DAY_LABELS_FULL[d]).join(', ');
  return `${dayNames} o ${timeStr}`;
}

// ─── Email Block types (mirroring backend templateRenderer.ts) ───────────────

interface HeadingBlock     { type: 'HEADING';     text: string; size?: 'h1' | 'h2' | 'h3'; }
interface TextBlock        { type: 'TEXT';        text: string; }
interface ListBlock        { type: 'LIST';        items: string[]; }
interface CtaBlock         { type: 'CTA';         label: string; url: string; color?: 'green' | 'blue' | 'gray'; }
interface DividerBlock     { type: 'DIVIDER'; }
interface ImageBlock       { type: 'IMAGE';       url: string; alt?: string; linkUrl?: string; width?: number; }
interface VideoBlock       { type: 'VIDEO';       videoUrl: string; thumbnailUrl?: string; caption?: string; }
interface UnsubscribeBlock { type: 'UNSUBSCRIBE'; text?: string; }
type EmailBlock = HeadingBlock | TextBlock | ListBlock | CtaBlock | DividerBlock | ImageBlock | VideoBlock | UnsubscribeBlock;

const BLOCK_COLORS: Record<NonNullable<CtaBlock['color']>, string> = {
  green: '#16a34a', blue: '#2563eb', gray: '#6b7280',
};

// ─── Frontend preview renderer (mirrors backend renderBlocksToHtml) ──────────

function interpolatePreview(text: string): string {
  const SAMPLE: Record<string, string> = {
    patientName: 'Jan Kowalski',
    weightTrend: '-0.8kg',
    compliance: '85',
    tip: 'Pij szklankę wody przed każdym posiłkiem.',
    achievement: '5kg stracone!',
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE[key] ?? `{{${key}}}`);
}

function renderPreviewHtml(blocks: EmailBlock[]): string {
  const body = blocks.map((block) => {
    switch (block.type) {
      case 'HEADING': {
        const t = interpolatePreview(block.text);
        const fs = block.size === 'h1' ? '24px' : block.size === 'h3' ? '16px' : '20px';
        return `<div style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:18px 24px;border-radius:8px;margin:0 0 20px;"><p style="margin:0;font-size:${fs};font-weight:bold;line-height:1.3;">${t}</p></div>`;
      }
      case 'TEXT': {
        const paragraphs = interpolatePreview(block.text).split('\n').filter(Boolean)
          .map((p) => `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px;">${renderRichText(p)}</p>`).join('');
        return `<div style="margin:0 0 16px;">${paragraphs}</div>`;
      }
      case 'LIST': {
        const items = block.items.filter(Boolean).map((item) => {
          const t = interpolatePreview(item);
          return `<li style="padding:8px 0 8px 28px;position:relative;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;list-style:none;"><span style="position:absolute;left:0;color:#16a34a;font-weight:bold;">✓</span>${t}</li>`;
        }).join('');
        return `<ul style="padding:0;margin:0 0 20px;">${items}</ul>`;
      }
      case 'CTA': {
        const label = interpolatePreview(block.label);
        const color = BLOCK_COLORS[block.color ?? 'green'];
        return `<p style="text-align:center;margin:24px 0;"><a href="${block.url}" style="background-color:${color};color:#fff;padding:13px 30px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">${label}</a></p>`;
      }
      case 'DIVIDER':
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />`;
      case 'IMAGE': {
        if (!block.url) return `<div style="margin:0 0 20px;text-align:center;padding:24px;background:#f9fafb;border:2px dashed #d1d5db;border-radius:8px;color:#9ca3af;font-size:13px;">🖼️ Obrazek — wpisz URL powyżej</div>`;
        const w = block.width ? `${block.width}px` : '100%';
        const img = `<img src="${block.url}" alt="${block.alt ?? ''}" style="max-width:100%;width:${w};height:auto;display:block;border-radius:6px;margin:0 auto;" />`;
        const wrapped = block.linkUrl ? `<a href="${block.linkUrl}" style="display:block;">${img}</a>` : img;
        return `<div style="margin:0 0 20px;text-align:center;">${wrapped}</div>`;
      }
      case 'VIDEO': {
        const caption = block.caption ? `<p style="text-align:center;font-size:13px;color:#6b7280;margin:8px 0 0;">${block.caption}</p>` : '';
        const btn = `<p style="text-align:center;margin:12px 0 0;"><a href="${block.videoUrl || '#'}" style="background-color:#dc2626;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">&#9654;&nbsp;Obejrzyj film</a></p>`;
        if (block.thumbnailUrl) {
          return `<div style="margin:0 0 20px;text-align:center;"><a href="${block.videoUrl || '#'}"><img src="${block.thumbnailUrl}" alt="Miniatura wideo" style="max-width:100%;border-radius:8px;display:block;margin:0 auto;" /></a>${btn}${caption}</div>`;
        }
        if (!block.videoUrl) return `<div style="margin:0 0 20px;text-align:center;padding:24px;background:#f9fafb;border:2px dashed #d1d5db;border-radius:8px;color:#9ca3af;font-size:13px;">🎬 Film — wpisz URL wideo powyżej</div>`;
        return `<div style="margin:0 0 20px;">${btn}${caption}</div>`;
      }
      case 'UNSUBSCRIBE': {
        const label = block.text || 'Zrezygnuj z powiadomień';
        return `<p style="text-align:center;margin:24px 0 0;"><a href="#" style="font-size:12px;color:#9ca3af;text-decoration:underline;">${label}</a></p>`;
      }
    }
  }).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
<tr><td style="background:linear-gradient(135deg,#15803d,#166534);padding:24px 32px;">
  <p style="margin:0;font-size:20px;font-weight:bold;color:#fff;">🌿 e-dietetyk.com</p>
  <p style="margin:4px 0 0;font-size:13px;color:#bbf7d0;">Twój osobisty asystent żywieniowy</p>
</td></tr>
<tr><td style="padding:28px 32px;">${body}</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── Block editor helper: insert var into focused textarea ───────────────────

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  getValue: () => string,
  setValue: (v: string) => void,
) {
  if (!el) { setValue(getValue() + text); return; }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const newVal = el.value.slice(0, start) + text + el.value.slice(end);
  setValue(newVal);
  setTimeout(() => {
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  }, 0);
}

// ─── Rich text rendering (mirrors backend renderRichText) ────────────────────

function renderRichText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#16a34a;text-decoration:underline;">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

// ─── Block template library (localStorage) ───────────────────────────────────

interface BlockTemplate {
  id: string;
  name: string;
  blocks: EmailBlock[];
}

const TEMPLATES_KEY = 'email_block_templates_v1';

function loadStoredTemplates(): BlockTemplate[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? '[]') as BlockTemplate[]; }
  catch { return []; }
}

function saveStoredTemplates(templates: BlockTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  interface SendRecord {
    id: string;
    recipientEmail: string;
    variant: string;
    openedAt: string | null;
    clickedAt: string | null;
    sentAt: string;
  }

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [sendHistory, setSendHistory] = useState<Record<string, SendRecord[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // Template library
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');

  async function apiFetch(path: string, opts?: RequestInit) {
    const res = await fetch(`/api/proxy${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
    return res.json();
  }

  async function loadData() {
    const [statusRes, listRes] = await Promise.all([
      apiFetch('/email-campaigns/status'),
      apiFetch('/email-campaigns'),
    ]);
    if (statusRes.ok) setSystemEnabled(statusRes.enabled);
    if (listRes.ok) setCampaigns(listRes.campaigns);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    setTemplates(loadStoredTemplates());
  }, []);

  async function toggleSystem() {
    setToggling(true);
    const res = await apiFetch('/email-campaigns/toggle-system', { method: 'POST' });
    if (res.ok) setSystemEnabled(res.enabled);
    setToggling(false);
  }

  async function toggleCampaign(id: string, enabled: boolean) {
    await apiFetch(`/email-campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !enabled }) });
    loadData();
  }

  async function executeCampaignAction(id: string) {
    setExecuting(id);
    const res = await apiFetch(`/email-campaigns/${id}/execute`, { method: 'POST' });
    setExecuting(null);
    if (res.ok) alert(`Wysłano: ${res.sent}, pominięto: ${res.skipped}, błędy: ${res.errors}`);
    loadData();
  }

  async function testCampaign(id: string) {
    const res = await apiFetch(`/email-campaigns/${id}/send-test`, { method: 'POST' });
    if (res.ok) alert(`[DRY RUN] Wysłanoby do: ${res.sent} odbiorców, pominięto: ${res.skipped}, błędy: ${res.errors ?? 0}`);
    else alert('Błąd podczas testu kampanii.');
  }

  async function toggleHistory(id: string) {
    if (expandedHistory === id) {
      setExpandedHistory(null);
      return;
    }
    setExpandedHistory(id);
    if (sendHistory[id]) return; // already loaded
    setLoadingHistory(id);
    const res = await apiFetch(`/email-campaigns/${id}/sends`);
    if (res.ok) setSendHistory((prev) => ({ ...prev, [id]: res.sends }));
    setLoadingHistory(null);
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Na pewno usunąć kampanię?')) return;
    await apiFetch(`/email-campaigns/${id}`, { method: 'DELETE' });
    loadData();
  }

  async function duplicateCampaign(id: string) {
    setDuplicating(id);
    const res = await apiFetch(`/email-campaigns/${id}/duplicate`, { method: 'POST' });
    setDuplicating(null);
    if (res.ok) loadData();
  }

  function saveAsTemplate() {
    if (!templateSaveName.trim() || blocks.length === 0) return;
    const tmpl: BlockTemplate = { id: Date.now().toString(), name: templateSaveName.trim(), blocks };
    const updated = [...templates, tmpl];
    setTemplates(updated);
    saveStoredTemplates(updated);
    setTemplateSaveName('');
    setShowSaveTemplate(false);
  }

  function applyTemplate(tmpl: BlockTemplate) {
    if (blocks.length > 0 && !confirm(`Zastąpić aktualne bloki (${blocks.length}) szablonem "${tmpl.name}"?`)) return;
    setBlocks(tmpl.blocks.map((b) => ({ ...b } as EmailBlock)));
    setShowTemplates(false);
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveStoredTemplates(updated);
  }

  function applyRichFormat(blockIdx: number, format: 'bold' | 'italic' | 'link') {
    const el = focusedField;
    const block = blocks[blockIdx];
    if (!block || block.type !== 'TEXT') return;
    const currentText = block.text;
    const start = el ? (el.selectionStart ?? currentText.length) : currentText.length;
    const end = el ? (el.selectionEnd ?? currentText.length) : currentText.length;
    const selected = currentText.slice(start, end);
    let replacement = '';
    if (format === 'bold') replacement = `**${selected || 'tekst'}**`;
    else if (format === 'italic') replacement = `_${selected || 'tekst'}_`;
    else if (format === 'link') {
      const url = prompt('Adres URL:', 'https://');
      if (!url) return;
      replacement = `[${selected || 'tekst'}](${url})`;
    }
    const newText = currentText.slice(0, start) + replacement + currentText.slice(end);
    updateBlock(blockIdx, { text: newText } as Partial<EmailBlock>);
    setTimeout(() => { el?.focus(); el?.setSelectionRange(start + replacement.length, start + replacement.length); }, 0);
  }

  function openRate(c: Campaign): string {
    const total = c.variantASent + c.variantBSent;
    const opened = c.variantAOpened + c.variantBOpened;
    if (total === 0) return '-';
    return `${Math.round((opened / total) * 100)}%`;
  }

  // ─── Form state ─────────────────────────────────────────────────────────

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'WEEKLY_SUMMARY',
    name: '',
    subject: '',
    subjectVariantB: '',
    segmentation: 'all',
  });
  const [scheduleDays, setScheduleDays] = useState<number[]>([1]);
  const [scheduleHour, setScheduleHour] = useState(8);
  const [scheduleMinute, setScheduleMinute] = useState(0);

  // Block editor state (CUSTOM / MOTIVATION only)
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [focusedField, setFocusedField] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [focusedBlockIdx, setFocusedBlockIdx] = useState<number | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const isBlockType = form.type === 'CUSTOM' || form.type === 'MOTIVATION';

  function resetForm() {
    setForm({ type: 'WEEKLY_SUMMARY', name: '', subject: '', subjectVariantB: '', segmentation: 'all' });
    setScheduleDays([1]);
    setScheduleHour(8);
    setScheduleMinute(0);
    setBlocks([]);
    setShowPreview(false);
  }

  function toggleDay(day: number) {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function insertTemplateVar(v: string) {
    if (focusedField) {
      // Insert into last focused block field
      const el = focusedField;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const newVal = el.value.slice(0, start) + v + el.value.slice(end);
      // Dispatch a synthetic change so React state updates
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(el, newVal);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + v.length, start + v.length);
      }, 0);
    } else {
      // Fallback: insert into subject
      insertAtCursor(
        subjectRef.current,
        v,
        () => form.subject,
        (val) => setForm({ ...form, subject: val }),
      );
    }
  }

  // Block manipulation helpers
  function addBlock(type: EmailBlock['type']) {
    const newBlock: EmailBlock = (() => {
      switch (type) {
        case 'HEADING':  return { type, text: '', size: 'h2' } satisfies HeadingBlock;
        case 'TEXT':     return { type, text: '' } satisfies TextBlock;
        case 'LIST':     return { type, items: [''] } satisfies ListBlock;
        case 'CTA':      return { type, label: '', url: 'https://e-dietetyk.com', color: 'green' } satisfies CtaBlock;
        case 'DIVIDER':      return { type } satisfies DividerBlock;
        case 'IMAGE':        return { type, url: '', alt: '' } satisfies ImageBlock;
        case 'VIDEO':        return { type, videoUrl: '', thumbnailUrl: '', caption: '' } satisfies VideoBlock;
        case 'UNSUBSCRIBE':  return { type, text: '' } satisfies UnsubscribeBlock;
      }
    })();
    setBlocks((prev) => [...prev, newBlock]);
  }

  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function updateBlock(idx: number, patch: Partial<EmailBlock>) {
    setBlocks((prev) => prev.map((b, i) => i === idx ? { ...b, ...patch } as EmailBlock : b));
  }

  function updateListItem(blockIdx: number, itemIdx: number, value: string) {
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== blockIdx || b.type !== 'LIST') return b;
      const items = [...b.items];
      items[itemIdx] = value;
      return { ...b, items };
    }));
  }

  function addListItem(blockIdx: number) {
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== blockIdx || b.type !== 'LIST') return b;
      return { ...b, items: [...b.items, ''] };
    }));
  }

  function removeListItem(blockIdx: number, itemIdx: number) {
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== blockIdx || b.type !== 'LIST') return b;
      const items = b.items.filter((_, ii) => ii !== itemIdx);
      return { ...b, items: items.length > 0 ? items : [''] };
    }));
  }

  async function createCampaign() {
    const schedule = buildCron(scheduleDays, scheduleHour, scheduleMinute);
    const bodyTemplate = isBlockType && blocks.length > 0
      ? JSON.stringify({ version: 1, blocks })
      : undefined;
    const body = {
      ...form,
      schedule,
      bodyTemplate,
      subjectVariantB: form.subjectVariantB || undefined,
    };
    const res = await apiFetch('/email-campaigns', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      setShowForm(false);
      resetForm();
      loadData();
    }
  }

  const canCreate = form.name && form.subject && (!isBlockType || blocks.length > 0);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Kampanie email
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant={systemEnabled ? 'default' : 'outline'}
            size="sm"
            className={`gap-2 ${systemEnabled ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={toggleSystem}
            disabled={toggling}
          >
            {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {systemEnabled ? 'System ON' : 'System OFF'}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Nowa kampania
          </Button>
        </div>
      </div>

      {!systemEnabled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3">
            <p className="text-sm text-amber-800">
              System kampanii email jest wyłączony. Kliknij przycisk &quot;System OFF&quot; powyżej aby go włączyć.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Create form ─────────────────────────────────────────────────── */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Nowa kampania</CardTitle></CardHeader>
          <CardContent className="space-y-4">

            {/* 1. Type + Segmentation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium flex items-center mb-1">
                  Typ kampanii
                  <InfoTooltip content={TYPE_INFO[form.type]?.detail ?? TYPE_INFO[form.type]?.description ?? ''} />
                </label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={form.type}
                  onChange={(e) => {
                    setForm({ ...form, type: e.target.value });
                    setBlocks([]);
                    setShowPreview(false);
                  }}
                >
                  {Object.entries(TYPE_INFO).map(([val, info]) => (
                    <option key={val} value={val}>{info.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {TYPE_INFO[form.type]?.description}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium flex items-center mb-1">
                  Grupa docelowa
                  <InfoTooltip content={SEG_INFO[form.segmentation]?.description ?? ''} />
                </label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={form.segmentation}
                  onChange={(e) => setForm({ ...form, segmentation: e.target.value })}
                >
                  {Object.entries(SEG_INFO).map(([val, info]) => (
                    <option key={val} value={val}>{info.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {SEG_INFO[form.segmentation]?.description}
                </p>
              </div>
            </div>

            {/* 2. Name */}
            <div>
              <label className="text-xs font-medium block mb-1">Nazwa kampanii</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="np. Podsumowanie tygodnia"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* 3. Subject + template hints */}
            <div>
              <label className="text-xs font-medium block mb-1">Temat emaila (wariant A)</label>
              <input
                ref={subjectRef}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="np. {{patientName}}, Twoje podsumowanie tygodnia"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[11px] text-muted-foreground">Wstaw zmienną:</span>
                {TEMPLATE_VARS.map((tv) => (
                  <span key={tv.var} className="relative group inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => insertTemplateVar(tv.var)}
                      className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {tv.var}
                    </button>
                    <span className="pointer-events-none absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block w-56 rounded-lg border bg-white px-3 py-2 text-xs text-gray-700 shadow-lg">
                      <span className="font-medium block mb-0.5">{tv.label}</span>
                      {tv.description}
                      <span className="block mt-1 text-gray-400">Przykład: {tv.example}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* 4. Subject variant B */}
            <div>
              <label className="text-xs font-medium block mb-1">
                Temat wariant B <span className="font-normal text-muted-foreground">(opcjonalny — test A/B)</span>
              </label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Zostaw puste aby wyłączyć test A/B"
                value={form.subjectVariantB}
                onChange={(e) => setForm({ ...form, subjectVariantB: e.target.value })}
              />
            </div>

            {/* ─── Block Editor (CUSTOM / MOTIVATION only) ──────────────── */}
            {isBlockType && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Treść emaila — edytor blokowy</p>
                  <div className="flex items-center gap-2">
                    {/* Templates button */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setShowTemplates((v) => !v); setShowSaveTemplate(false); }}
                    >
                      <BookOpen className="h-3 w-3" />
                      Szablony{templates.length > 0 ? ` (${templates.length})` : ''}
                    </Button>
                    {blocks.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => setShowPreview((v) => !v)}
                      >
                        {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showPreview ? 'Ukryj podgląd' : 'Podgląd emaila'}
                      </Button>
                    )}
                    {/* Add block dropdown */}
                    <div className="relative group">
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Dodaj blok
                      </Button>
                      <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:flex group-focus-within:flex flex-col bg-white border rounded-lg shadow-lg min-w-[180px] py-1">
                        {(['HEADING', 'TEXT', 'LIST', 'CTA', 'DIVIDER', 'IMAGE', 'VIDEO', 'UNSUBSCRIBE'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                            onClick={() => addBlock(t)}
                          >
                            {t === 'HEADING'     && '📌 Nagłówek'}
                            {t === 'TEXT'        && '📝 Tekst / Akapit'}
                            {t === 'LIST'        && '✅ Lista punktowana'}
                            {t === 'CTA'         && '🔘 Przycisk / CTA'}
                            {t === 'DIVIDER'     && '➖ Separator'}
                            {t === 'IMAGE'       && '🖼️ Obrazek'}
                            {t === 'VIDEO'       && '🎬 Film (link)'}
                            {t === 'UNSUBSCRIBE' && '🔕 Link wypisania się'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block list */}
                {blocks.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-3">
                    Kliknij &quot;Dodaj blok&quot; aby zbudować treść emaila.
                  </p>
                )}

                {blocks.map((block, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg bg-white p-3 space-y-2 ${focusedBlockIdx === idx ? 'ring-1 ring-green-400' : ''}`}
                  >
                    {/* Block header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {block.type === 'HEADING'     && '📌 Nagłówek'}
                        {block.type === 'TEXT'        && '📝 Tekst'}
                        {block.type === 'LIST'        && '✅ Lista'}
                        {block.type === 'CTA'         && '🔘 Przycisk'}
                        {block.type === 'DIVIDER'     && '➖ Separator'}
                        {block.type === 'IMAGE'       && '🖼️ Obrazek'}
                        {block.type === 'VIDEO'       && '🎬 Film (link)'}
                        {block.type === 'UNSUBSCRIBE' && '🔕 Link wypisania się'}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                        <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                        <button type="button" onClick={() => removeBlock(idx)}
                          className="p-1 rounded hover:bg-red-50 text-red-500"><X className="h-3 w-3" /></button>
                      </div>
                    </div>

                    {/* Block fields */}
                    {block.type === 'HEADING' && (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          placeholder="Tekst nagłówka (np. Cześć {{patientName}}!)"
                          value={block.text}
                          onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                        />
                        <select
                          className="border rounded px-2 py-1 text-sm w-20"
                          value={block.size ?? 'h2'}
                          onChange={(e) => updateBlock(idx, { size: e.target.value as HeadingBlock['size'] })}
                        >
                          <option value="h1">Duży</option>
                          <option value="h2">Średni</option>
                          <option value="h3">Mały</option>
                        </select>
                      </div>
                    )}

                    {block.type === 'TEXT' && (
                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <button
                            type="button"
                            title="Pogrubienie (**tekst**)"
                            className="flex items-center justify-center w-6 h-6 border rounded hover:bg-muted text-xs font-bold"
                            onClick={() => applyRichFormat(idx, 'bold')}
                          ><Bold className="h-3 w-3" /></button>
                          <button
                            type="button"
                            title="Kursywa (_tekst_)"
                            className="flex items-center justify-center w-6 h-6 border rounded hover:bg-muted text-xs"
                            onClick={() => applyRichFormat(idx, 'italic')}
                          ><Italic className="h-3 w-3" /></button>
                          <button
                            type="button"
                            title="Link ([tekst](url))"
                            className="flex items-center justify-center w-6 h-6 border rounded hover:bg-muted text-xs"
                            onClick={() => applyRichFormat(idx, 'link')}
                          ><Link className="h-3 w-3" /></button>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            <code className="bg-muted px-0.5 rounded">**pogrubienie**</code>
                            {' '}<code className="bg-muted px-0.5 rounded">_kursywa_</code>
                            {' '}<code className="bg-muted px-0.5 rounded">[tekst](url)</code>
                          </span>
                        </div>
                        <textarea
                          className="w-full border rounded px-2 py-1.5 text-sm resize-y min-h-[72px]"
                          placeholder="Treść akapitu. Nowa linia = nowy akapit. Użyj {{patientName}}, **pogrubienie**, _kursywa_, [link](url)"
                          value={block.text}
                          onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                        />
                      </div>
                    )}

                    {block.type === 'LIST' && (
                      <div className="space-y-1.5">
                        {block.items.map((item, ii) => (
                          <div key={ii} className="flex gap-1.5">
                            <input
                              className="flex-1 border rounded px-2 py-1 text-sm"
                              placeholder={`Punkt ${ii + 1}`}
                              value={item}
                              onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                              onChange={(e) => updateListItem(idx, ii, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeListItem(idx, ii)}
                              className="p-1 rounded hover:bg-red-50 text-red-400"
                            ><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addListItem(idx)}
                          className="text-[11px] text-green-700 hover:underline"
                        >+ Dodaj punkt</button>
                      </div>
                    )}

                    {block.type === 'CTA' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Tekst przycisku"
                          value={block.label}
                          onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                          onChange={(e) => updateBlock(idx, { label: e.target.value })}
                        />
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="URL (https://...)"
                          value={block.url}
                          onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                          onChange={(e) => updateBlock(idx, { url: e.target.value })}
                        />
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={block.color ?? 'green'}
                          onChange={(e) => updateBlock(idx, { color: e.target.value as CtaBlock['color'] })}
                        >
                          <option value="green">Zielony</option>
                          <option value="blue">Niebieski</option>
                          <option value="gray">Szary</option>
                        </select>
                      </div>
                    )}

                    {block.type === 'DIVIDER' && (
                      <p className="text-[11px] text-muted-foreground">
                        ➖ Pozioma linia oddzielająca sekcje.
                      </p>
                    )}

                    {block.type === 'UNSUBSCRIBE' && (
                      <div className="space-y-1.5">
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Tekst linku (domyślnie: Zrezygnuj z powiadomień)"
                          value={block.text ?? ''}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Link wypisania się jest automatycznie wstawiany w stopce każdego emaila. Użyj tego bloku aby dodać dodatkowy widoczny link w treści.
                        </p>
                      </div>
                    )}

                    {block.type === 'IMAGE' && (
                      <div className="space-y-2">
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="URL obrazka (https://...)"
                          value={block.url}
                          onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                          onChange={(e) => updateBlock(idx, { url: e.target.value })}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="Tekst alternatywny (alt)"
                            value={block.alt ?? ''}
                            onChange={(e) => updateBlock(idx, { alt: e.target.value })}
                          />
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="Link po kliknięciu (opcjonalny)"
                            value={block.linkUrl ?? ''}
                            onChange={(e) => updateBlock(idx, { linkUrl: e.target.value })}
                          />
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={block.width ?? ''}
                            onChange={(e) => updateBlock(idx, { width: e.target.value ? Number(e.target.value) : undefined })}
                          >
                            <option value="">Szerokość: auto (100%)</option>
                            <option value="300">300px</option>
                            <option value="400">400px</option>
                            <option value="500">500px</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {block.type === 'VIDEO' && (
                      <div className="space-y-2">
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="URL wideo (YouTube, Vimeo, ...)"
                          value={block.videoUrl}
                          onFocus={(e) => { setFocusedField(e.target); setFocusedBlockIdx(idx); }}
                          onChange={(e) => updateBlock(idx, { videoUrl: e.target.value })}
                        />
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="URL miniaturki (opcjonalny — jeśli podany, wyświetli się jako klikalne zdjęcie)"
                          value={block.thumbnailUrl ?? ''}
                          onChange={(e) => updateBlock(idx, { thumbnailUrl: e.target.value })}
                        />
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Podpis pod filmem (opcjonalny)"
                          value={block.caption ?? ''}
                          onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Emaile nie obsługują odtwarzania wideo — zostanie wstawiony przycisk ▶ lub klikalna miniaturka prowadząca do URL.
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Variables hint */}
                {blocks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">Wstaw zmienną do aktywnego pola:</span>
                    {TEMPLATE_VARS.map((tv) => (
                      <span key={tv.var} className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => insertTemplateVar(tv.var)}
                          className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded border border-dashed border-green-400 text-green-700 hover:bg-green-50 transition-colors"
                        >
                          {tv.var}
                        </button>
                        <span className="pointer-events-none absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block w-56 rounded-lg border bg-white px-3 py-2 text-xs text-gray-700 shadow-lg">
                          <span className="font-medium block mb-0.5">{tv.label}</span>
                          {tv.description}
                          <span className="block mt-1 text-gray-400">Przykład: {tv.example}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Template library panel */}
                {showTemplates && (
                  <div className="border rounded-lg bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" /> Biblioteka szablonów
                      </p>
                      <button type="button" onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Save current blocks as template */}
                    {blocks.length > 0 && (
                      <div>
                        {!showSaveTemplate ? (
                          <button
                            type="button"
                            className="text-[11px] text-green-700 hover:underline"
                            onClick={() => setShowSaveTemplate(true)}
                          >
                            + Zapisz aktualne bloki jako szablon
                          </button>
                        ) : (
                          <div className="flex gap-1.5">
                            <input
                              className="flex-1 border rounded px-2 py-1 text-xs"
                              placeholder="Nazwa szablonu"
                              value={templateSaveName}
                              onChange={(e) => setTemplateSaveName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveAsTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false); }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              disabled={!templateSaveName.trim()}
                              onClick={saveAsTemplate}
                            >Zapisz</button>
                            <button type="button" className="px-2 py-1 text-xs border rounded hover:bg-muted" onClick={() => setShowSaveTemplate(false)}>
                              Anuluj
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Saved templates list */}
                    {templates.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground py-1">Brak zapisanych szablonów.</p>
                    ) : (
                      <div className="space-y-1">
                        {templates.map((tmpl) => (
                          <div key={tmpl.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 group">
                            <span className="text-xs flex-1 min-w-0 truncate">{tmpl.name}
                              <span className="text-muted-foreground ml-1">({tmpl.blocks.length} bloków)</span>
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="text-[11px] text-green-700 hover:underline px-1"
                                onClick={() => applyTemplate(tmpl)}
                              >Wczytaj</button>
                              <button
                                type="button"
                                className="text-[11px] text-red-500 hover:text-red-700 px-1"
                                onClick={() => deleteTemplate(tmpl.id)}
                              >Usuń</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Preview */}
                {showPreview && blocks.length > 0 && (
                  <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
                    <p className="text-[10px] text-muted-foreground px-2 py-1 bg-muted border-b">
                      Podgląd z przykładowymi danymi (Jan Kowalski, -0.8kg, 85% adherencja)
                    </p>
                    <iframe
                      srcDoc={renderPreviewHtml(blocks)}
                      className="w-full"
                      style={{ height: 458 }}
                      title="Podgląd emaila"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 5. Schedule */}
            <div>
              <label className="text-xs font-medium block mb-1">Harmonogram wysyłki</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                        scheduleDays.includes(i)
                          ? 'bg-brand-green text-white border-brand-green font-semibold'
                          : 'bg-background text-muted-foreground border-input hover:bg-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">o</span>
                  <select
                    className="border rounded px-1.5 py-1 text-sm w-16"
                    value={scheduleHour}
                    onChange={(e) => setScheduleHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-sm font-medium">:</span>
                  <select
                    className="border rounded px-1.5 py-1 text-sm w-16"
                    value={scheduleMinute}
                    onChange={(e) => setScheduleMinute(Number(e.target.value))}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {formatSchedulePreview(scheduleDays, scheduleHour, scheduleMinute)}
              </p>
            </div>

            {isBlockType && blocks.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Typ &quot;{TYPE_INFO[form.type]?.label}&quot; wymaga co najmniej jednego bloku treści.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={createCampaign} disabled={!canCreate}>Utwórz kampanię</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Anuluj</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Campaign list ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id} className={!c.enabled ? 'opacity-60' : ''}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">{TYPE_INFO[c.type]?.label ?? c.type}</Badge>
                    {c.segmentation && c.segmentation !== 'all' && (
                      <Badge variant="outline" className="text-[10px]">{SEG_INFO[c.segmentation]?.label ?? c.segmentation}</Badge>
                    )}
                    {c.subjectVariantB && <Badge variant="outline" className="text-[10px] bg-purple-50">A/B</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Temat: {c.subject}</p>
                  <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
                    <span>Wysłano: {c._count.sends}</span>
                    <span>Open rate: {openRate(c)}</span>
                    {c.schedule && <span>Harmonogram: {(() => {
                      const parsed = parseCron(c.schedule);
                      return parsed ? formatSchedulePreview(parsed.days, parsed.hour, parsed.minute) : c.schedule;
                    })()}</span>}
                    {c.lastSentAt && <span>Ostatnio: {new Date(c.lastSentAt).toLocaleDateString('pl-PL')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => toggleCampaign(c.id, c.enabled)} title={c.enabled ? 'Wyłącz' : 'Włącz'}>
                    {c.enabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleHistory(c.id)} title="Historia wysyłek" className={expandedHistory === c.id ? 'text-blue-600' : ''}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => testCampaign(c.id)} title="Test (dry run — nie wysyła emaili)">
                    <FlaskConical className="h-4 w-4" />
                    <span className="ml-1 text-xs hidden sm:inline">Test</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => executeCampaignAction(c.id)} disabled={executing === c.id || !systemEnabled} title="Wyślij teraz">
                    {executing === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    <span className="ml-1 text-xs hidden sm:inline">Wyślij</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicateCampaign(c.id)} disabled={duplicating === c.id} title="Duplikuj kampanię">
                    {duplicating === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteCampaign(c.id)} title="Usuń" className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Historia wysyłek */}
              {expandedHistory === c.id && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">Historia wysyłek (ostatnie 50)</p>
                  {loadingHistory === c.id ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Ładowanie...
                    </div>
                  ) : (sendHistory[c.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Brak wysyłek dla tej kampanii.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border/50">
                            <th className="text-left pb-1 pr-3 font-medium">Email</th>
                            <th className="text-left pb-1 pr-3 font-medium">Wariant</th>
                            <th className="text-left pb-1 pr-3 font-medium">Wysłano</th>
                            <th className="text-left pb-1 pr-3 font-medium">Otwarto</th>
                            <th className="text-left pb-1 font-medium">Kliknięto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sendHistory[c.id] ?? []).map((s) => (
                            <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20">
                              <td className="py-1 pr-3 truncate max-w-[180px]">{s.recipientEmail}</td>
                              <td className="py-1 pr-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.variant === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {s.variant}
                                </span>
                              </td>
                              <td className="py-1 pr-3 text-muted-foreground">
                                {new Date(s.sentAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-1 pr-3">
                                {s.openedAt ? (
                                  <span className="text-green-600">✓</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-1">
                                {s.clickedAt ? (
                                  <span className="text-blue-600">✓</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Brak kampanii. Kliknij &quot;Nowa kampania&quot; aby dodać pierwszą.
          </p>
        )}
      </div>
    </div>
  );
}
