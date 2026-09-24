import type { AnnualPoint } from '../physics/climate';

export type ChartMetric = 'temperature' | 'insolation' | 'daylight';

interface ChartOptions {
  metric: ChartMetric;
  activeDay: number;
  reference?: AnnualPoint[];
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function renderAnnualChart(
  container: HTMLElement,
  points: AnnualPoint[],
  options: ChartOptions,
): void {
  const width = 720;
  const height = 190;
  const pad = { left: 34, right: 18, top: 18, bottom: 28 };

  const values = [...points, ...(options.reference ?? [])].map((point) => point[options.metric]);
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (options.metric === 'daylight') {
    min = 0;
    max = 24;
  } else if (options.metric === 'insolation') {
    min = 0;
    max = Math.max(600, Math.ceil(max / 100) * 100);
  } else {
    min = Math.floor((min - 2) / 5) * 5;
    max = Math.ceil((max + 2) / 5) * 5;
  }

  if (max - min < 1) max = min + 1;

  const x = (day: number) => pad.left + ((day - 1) / 364) * (width - pad.left - pad.right);
  const y = (value: number) =>
    pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.day).toFixed(2)} ${y(point[options.metric]).toFixed(2)}`)
    .join(' ');

  const referencePath = (options.reference ?? []).map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${x(point.day).toFixed(2)} ${y(point[options.metric]).toFixed(2)}`).join(' ');
  container.setAttribute('aria-label', `Annual ${options.metric} profile${options.reference ? '; solid: selected tilt, dashed: Earth 23.44 degrees using the same model' : ''}`);

  const area = `${path} L ${x(points.at(-1)?.day ?? 365)} ${height - pad.bottom} L ${x(1)} ${height - pad.bottom} Z`;
  const activeX = x(Math.min(365, options.activeDay));

  const monthLabels = MONTHS.map((month, index) => {
    const monthX = pad.left + ((index + 0.5) / 12) * (width - pad.left - pad.right);
    return `<text x="${monthX}" y="${height - 8}" text-anchor="middle" class="chart-month">${month}</text>`;
  }).join('');

  const grid = [0, 0.5, 1]
    .map((fraction) => {
      const gy = pad.top + fraction * (height - pad.top - pad.bottom);
      const value = max - fraction * (max - min);
      return `
        <line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" class="chart-grid" />
        <text x="${pad.left - 7}" y="${gy + 4}" text-anchor="end" class="chart-axis">${formatAxis(value, options.metric)}</text>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.32" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#chart-fill)" />
      ${referencePath ? `<path d="${referencePath}" class="chart-reference" />` : ''}
      <path d="${path}" class="chart-line" />
      <line x1="${activeX}" y1="${pad.top}" x2="${activeX}" y2="${height - pad.bottom}" class="chart-active" />
      ${monthLabels}
    </svg>
  `;
}

function formatAxis(value: number, metric: ChartMetric): string {
  if (metric === 'temperature') return `${Math.round(value)}°`;
  if (metric === 'daylight') return `${Math.round(value)}h`;
  return `${Math.round(value)}`;
}

/** Playback moves only the cursor; the annual curves need not be rebuilt. */
export function updateChartDay(container: HTMLElement, day: number): void {
  const x = 34 + ((Math.min(365, day) - 1) / 364) * (720 - 34 - 18);
  const line = container.querySelector('.chart-active');
  line?.setAttribute('x1', String(x));
  line?.setAttribute('x2', String(x));
}
