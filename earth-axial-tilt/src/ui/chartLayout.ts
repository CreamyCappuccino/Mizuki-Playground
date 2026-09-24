/** Layout is expressed in CSS pixels, so SVG labels do not shrink on a phone. */
export interface ChartLayout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  fontSize: number;
}

export function createChartLayout(width: number, height: number, fontSize = 14): ChartLayout {
  if (![width, height, fontSize].every(Number.isFinite) || width <= 0 || height <= 0 || fontSize <= 0) {
    throw new RangeError('Chart dimensions and label size must be positive and finite.');
  }
  // Leave room for four-digit irradiance labels and the rightmost 24:00 tick.
  const left = Math.min(fontSize * 3.7 + 6, width * 0.3);
  const right = width - Math.min(fontSize * 2.1 + 4, width * 0.15);
  const top = Math.min(fontSize + 10, height * 0.2);
  const bottom = height - Math.min(fontSize * 2 + 12, height * 0.3);
  return { width, height, left, right, top, bottom, fontSize };
}

const layouts = new WeakMap<HTMLElement, ChartLayout>();

export function measureChart(container: HTMLElement): ChartLayout {
  const box = container.getBoundingClientRect();
  const layout = createChartLayout(Math.max(1, box.width), Math.max(1, box.height),
    parseFloat(getComputedStyle(container).fontSize) || 14);
  layouts.set(container, layout);
  return layout;
}

export function getChartLayout(container: HTMLElement): ChartLayout {
  return layouts.get(container) ?? measureChart(container);
}

export function chartX(value: number, minimum: number, maximum: number, layout: ChartLayout): number {
  const fraction = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
  return layout.left + fraction * (layout.right - layout.left);
}

/** Convert viewport coordinates into plot values, including after scrolling/resizing. */
export function chartValueAtClientX(
  clientX: number, rectLeft: number, rectWidth: number, layout: ChartLayout,
  minimum: number, maximum: number,
): number | null {
  if (![clientX, rectLeft, rectWidth, minimum, maximum].every(Number.isFinite)
    || rectWidth <= 0 || maximum <= minimum) return null;
  const svgX = (clientX - rectLeft) / rectWidth * layout.width;
  const fraction = Math.min(1, Math.max(0, (svgX - layout.left) / (layout.right - layout.left)));
  return minimum + fraction * (maximum - minimum);
}
