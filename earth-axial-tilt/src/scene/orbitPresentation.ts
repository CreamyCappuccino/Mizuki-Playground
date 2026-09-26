/** Display-only policy for short stacked orbit views; scientific geometry is unchanged. */
export function compactOrbitViewport(width: number, height: number): boolean {
  return width < 600 && height < 300;
}

const shortSeasons: Readonly<Record<string, string>> = {
  'Northern spring': 'Spring', 'Northern summer': 'Summer',
  'Northern autumn': 'Autumn', 'Northern winter': 'Winter',
};

export function orbitLabelKey(key: string, compact: boolean): string {
  return compact ? shortSeasons[key] ?? key : key;
}

export function orbitViewportFov(base: number, width: number, height: number, orbit: boolean): number {
  return orbit && compactOrbitViewport(width, height) ? base * 0.72 : base;
}
