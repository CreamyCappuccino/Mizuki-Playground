import { t as tr, getLanguage } from './i18n';
import type { AnnualPoint } from '../physics/climate';
import { chartX, getChartLayout, measureChart } from './chartLayout';

export type ChartMetric = 'temperature' | 'insolation' | 'daylight';
interface ChartOptions { metric: ChartMetric; activeDay: number; reference?: AnnualPoint[] }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];

export function formatModelDate(day: number): string {
  const bounded = Math.min(365, Math.max(1, Math.floor(day)));
  const month = STARTS.findIndex((start, i) => bounded >= start && bounded < STARTS[i + 1]);
  return getLanguage() === 'ja' ? `${month + 1}月${bounded - STARTS[month] + 1}日` : `${MONTHS[month]} ${bounded - STARTS[month] + 1}`;
}

export function renderAnnualChart(container: HTMLElement, points: AnnualPoint[], options: ChartOptions): void {
  const layout = measureChart(container);
  const { width, height, left, right, top, bottom, fontSize } = layout;
  const values = [...points, ...(options.reference ?? [])].map(point => point[options.metric]);
  let min = Math.min(...values), max = Math.max(...values);
  if (options.metric === 'daylight') { min = 0; max = 24; }
  else if (options.metric === 'insolation') { min = 0; max = Math.max(600, Math.ceil(max / 100) * 100); }
  else { min = Math.floor((min - 2) / 5) * 5; max = Math.ceil((max + 2) / 5) * 5; }
  if (max - min < 1) max = min + 1;
  const x = (day: number) => chartX(day, 1, 365, layout);
  const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const pathFor = (series: AnnualPoint[]) => series.map((point, i) =>
    `${i ? 'L' : 'M'} ${x(point.day).toFixed(2)} ${y(point[options.metric]).toFixed(2)}`).join(' ');
  const path = pathFor(points);
  const referencePath = options.reference ? pathFor(options.reference) : '';
  const stride = [1, 2, 3, 4, 6, 12].find(step => (right - left) * step / 12 >= fontSize * 2.35) ?? 12;
  const labels = MONTHS.map((month, i) => i % stride ? '' :
    `<text x="${x((STARTS[i] + STARTS[i + 1] - 1) / 2)}" y="${height - 10}" text-anchor="middle" class="chart-month">${tr(month)}</text>`).join('');
  const grid = [0, 0.5, 1].map(fraction => {
    const value = max - fraction * (max - min);
    return `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" class="chart-grid"/>
      <text x="${left - 9}" y="${y(value) + fontSize * 0.34}" text-anchor="end" class="chart-axis">${formatAxis(value, options.metric)}</text>`;
  }).join('');
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="currentColor" stop-opacity=".28"/>
      <stop offset="100%" stop-color="currentColor" stop-opacity=".01"/>
    </linearGradient></defs>
    ${grid}<path d="${path} L ${x(points.at(-1)?.day ?? 365)} ${bottom} L ${x(1)} ${bottom} Z" fill="url(#chart-fill)"/>
    ${referencePath ? `<path d="${referencePath}" class="chart-reference"/>` : ''}
    <path d="${path}" class="chart-line"/>
    <line x1="${x(options.activeDay)}" x2="${x(options.activeDay)}" y1="${top}" y2="${bottom}" class="chart-active"/>
    ${labels}
  </svg>`;
}

function formatAxis(value: number, metric: ChartMetric): string {
  return `${Math.round(value)}${metric === 'temperature' ? '°' : metric === 'daylight' ? 'h' : ''}`;
}

/** Layout and curve are retained during playback; only the selected date moves. */
export function updateChartDay(container: HTMLElement, day: number): void {
  const x = chartX(day, 1, 365, getChartLayout(container));
  const cursor = container.querySelector('.chart-active');
  cursor?.setAttribute('x1', String(x));
  cursor?.setAttribute('x2', String(x));
}
