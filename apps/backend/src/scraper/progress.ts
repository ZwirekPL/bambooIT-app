/**
 * JSON-based pipeline progress tracker for resumability.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PipelineProgress, SiteName, SiteProgress } from './types';
import { PIPELINE_CONFIG } from './config';

const progressPath = path.resolve(__dirname, '..', '..', PIPELINE_CONFIG.progressFile);

function emptyProgress(): PipelineProgress {
  const now = new Date().toISOString();
  return {
    currentStep: 0,
    scraped: {
      aniagotuje: { total: 0, completed: [] },
      kwestiasmaku: { total: 0, completed: [] },
      dietetykpowszechny: { total: 0, completed: [] },
      jadlonomia: { total: 0, completed: [] },
      paleosmak: { total: 0, completed: [] },
    },
    normalized: 0,
    mapped: 0,
    metaGenerated: 0,
    flagsDetected: 0,
    scored: 0,
    deduplicated: 0,
    saved: 0,
    startedAt: now,
    lastUpdatedAt: now,
  };
}

export function loadProgress(): PipelineProgress {
  try {
    if (fs.existsSync(progressPath)) {
      const raw = fs.readFileSync(progressPath, 'utf-8');
      return JSON.parse(raw) as PipelineProgress;
    }
  } catch {
    console.warn('[progress] Could not load progress file, starting fresh.');
  }
  return emptyProgress();
}

export function saveProgress(progress: PipelineProgress): void {
  progress.lastUpdatedAt = new Date().toISOString();
  const dir = path.dirname(progressPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
}

export function resetProgress(): PipelineProgress {
  const p = emptyProgress();
  saveProgress(p);
  return p;
}

export function markSiteUrl(
  progress: PipelineProgress,
  site: SiteName,
  url: string,
): void {
  const sp = progress.scraped[site];
  if (!sp.completed.includes(url)) {
    sp.completed.push(url);
    sp.lastUrl = url;
  }
}

export function isSiteUrlDone(
  progress: PipelineProgress,
  site: SiteName,
  url: string,
): boolean {
  return progress.scraped[site].completed.includes(url);
}

export function updateStep(progress: PipelineProgress, step: number): void {
  progress.currentStep = step;
  saveProgress(progress);
}
