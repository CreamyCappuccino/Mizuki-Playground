import { jaMessages } from './messages';

export type Language = 'en' | 'ja';
const listeners = new Set<() => void>();
let language: Language = 'en';
export function chooseLanguage(saved: unknown, browser = ''): Language {
  if (saved === 'en' || saved === 'ja') return saved;
  return /^ja(?:-|$)/i.test(browser) ? 'ja' : 'en';
}
if (typeof window !== 'undefined') {
  let saved: string | null = null;
  try { saved = localStorage.getItem('earth-lab:language'); } catch { /* display remains usable */ }
  language = chooseLanguage(saved, navigator.language);
}
export function getLanguage(): Language { return language; }
export function t(source: string): string { return language === 'ja' ? (jaMessages[source] ?? source) : source; }
/** Tagged messages never evaluate text or HTML and never translate simulation state. */
export function msg(parts: TemplateStringsArray, ...values: (string | number)[]): string {
  const key = parts.reduce((text, part, i) => text + (i ? `{${i - 1}}` : '') + part, '');
  return t(key).replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
}
export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
export function translateStatic(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n!); });
  for (const attribute of ['aria-label', 'title', 'content']) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach(el => {
      el.setAttribute(attribute, t(el.getAttribute(`data-i18n-${attribute}`)!));
    });
  }
}
export function setLanguage(next: Language): void {
  if (next !== 'en' && next !== 'ja') return;
  language = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    translateStatic();
    const select = document.getElementById('language') as HTMLSelectElement | null;
    if (select) select.value = next;
  }
  try { localStorage.setItem('earth-lab:language', next); } catch { /* session-only */ }
  listeners.forEach(listener => listener());
}
export function initLanguageControl(): () => void {
  document.documentElement.lang = language;
  translateStatic();
  const select = document.getElementById('language') as HTMLSelectElement;
  select.value = language;
  const change = () => setLanguage(select.value as Language);
  select.addEventListener('change', change);
  return () => select.removeEventListener('change', change);
}
export function solarClockLabel(value: string): string { return value === 'Undefined' ? t('Undefined') : value; }
