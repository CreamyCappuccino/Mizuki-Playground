import type { DiurnalPoint } from '../physics/diurnal';

const LEFT = 44;
const RIGHT = 702;
const TOP = 18;
const BOTTOM = 162;
const x = (hour: number) => LEFT + hour / 24 * (RIGHT - LEFT);

export function updateSolarCursor(container: HTMLElement, hour: number): void {
  const cursor = container.querySelector('.day-chart-active');
  cursor?.setAttribute('x1', String(x(hour)));
  cursor?.setAttribute('x2', String(x(hour)));
}

export function renderDayChart(
  container: HTMLElement, points: DiurnalPoint[], mean: number, activeHour: number, meridianDefined: boolean,
): void {
  const maximum = Math.max(200, Math.ceil(Math.max(...points.map(p => p.insolation)) / 200) * 200);
  const y = (value: number) => BOTTOM - value / maximum * (BOTTOM - TOP);
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(2)} ${y(p.insolation).toFixed(2)}`).join(' ');
  const grid = [0, 0.5, 1].map(t => `
    <line x1="${LEFT}" y1="${y(t * maximum)}" x2="${RIGHT}" y2="${y(t * maximum)}" class="chart-grid"/>
    <text x="${LEFT - 7}" y="${y(t * maximum) + 4}" text-anchor="end" class="chart-axis">${t * maximum}</text>`).join('');
  const ticks = [0, 6, 12, 18, 24].map(hour => `<text x="${x(hour)}" y="183" text-anchor="middle" class="chart-month">${hour === 0 || hour === 24 ? `${hour}:00` : `${String(hour).padStart(2, '0')}:00`}</text>`).join('');
  container.setAttribute('aria-label', `One day of top-of-atmosphere insolation in watts per square metre. Daily mean ${mean.toFixed(1)}. ${meridianDefined ? 'Local apparent solar hours' : 'Nominal rotation hours; solar meridian undefined'}.`);
  container.innerHTML = `<svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true">
    ${grid}
    <path d="${path} L ${RIGHT} ${BOTTOM} L ${LEFT} ${BOTTOM} Z" fill="currentColor" opacity=".1"/>
    <path d="${path}" class="day-chart-line chart-line"/>
    <line x1="${LEFT}" x2="${RIGHT}" y1="${y(mean)}" y2="${y(mean)}" class="day-chart-mean"/>
    <line x1="${x(activeHour)}" x2="${x(activeHour)}" y1="${TOP}" y2="${BOTTOM}" class="day-chart-active chart-active"/>
    ${ticks}
  </svg>`;
}
