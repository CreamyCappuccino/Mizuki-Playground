import type { DiurnalPoint } from '../physics/diurnal';
import { chartX, getChartLayout, measureChart } from './chartLayout';

export function updateSolarCursor(container: HTMLElement, hour: number): void {
  const x = chartX(hour, 0, 24, getChartLayout(container));
  const cursor = container.querySelector('.day-chart-active');
  cursor?.setAttribute('x1', String(x));
  cursor?.setAttribute('x2', String(x));
}

export function renderDayChart(
  container: HTMLElement, points: DiurnalPoint[], mean: number, activeHour: number, meridianDefined: boolean,
): void {
  const layout = measureChart(container);
  const { width, height, left, right, top, bottom, fontSize } = layout;
  const maximum = Math.max(200, Math.ceil(Math.max(...points.map(p => p.insolation)) / 200) * 200);
  const x = (hour: number) => chartX(hour, 0, 24, layout);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(2)} ${y(p.insolation).toFixed(2)}`).join(' ');
  const grid = [0, 0.5, 1].map(t => `
    <line x1="${left}" y1="${y(t * maximum)}" x2="${right}" y2="${y(t * maximum)}" class="chart-grid"/>
    <text x="${left - 9}" y="${y(t * maximum) + fontSize * .34}" text-anchor="end" class="chart-axis">${t * maximum}</text>`).join('');
  const hours = (right - left) / 4 >= fontSize * 3.3 ? [0, 6, 12, 18, 24] : [0, 12, 24];
  const ticks = hours.map(hour => `<text x="${x(hour)}" y="${height - 10}" text-anchor="middle" class="chart-month">${String(hour).padStart(2, '0')}:00</text>`).join('');
  // This data attribute describes the graph without replacing the slider's accessible name.
  container.dataset.timeBasis = meridianDefined ? 'solar' : 'nominal';
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    ${grid}
    <path d="${path} L ${right} ${bottom} L ${left} ${bottom} Z" fill="currentColor" opacity=".1"/>
    <path d="${path}" class="day-chart-line chart-line"/>
    <line x1="${left}" x2="${right}" y1="${y(mean)}" y2="${y(mean)}" class="day-chart-mean"/>
    <line x1="${x(activeHour)}" x2="${x(activeHour)}" y1="${top}" y2="${bottom}" class="day-chart-active chart-active"/>
    ${ticks}
  </svg>`;
}
