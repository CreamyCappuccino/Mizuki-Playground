import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildMaskDocument, loadPinnedPolygons } from '../scripts/buildGeographyMask.mjs';
import { fractionalMask, landAtPoint, parsePolygonShapefile, polygonContains } from '../scripts/geographyPolygons.mjs';

const polygons = loadPinnedPolygons();
const document = JSON.parse(readFileSync(new URL('../data/land-fractions.json', import.meta.url), 'utf8'));
const ring = points => ({ points, bounds: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
  Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] });
const polygon = rings => ({ rings: rings.map(ring), bounds: [Math.min(...rings.flat().map(p => p[0])),
  Math.min(...rings.flat().map(p => p[1])), Math.max(...rings.flat().map(p => p[0])), Math.max(...rings.flat().map(p => p[1]))] });
const rectangle = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n], [w, s]];
const cell = (lat, lon) => Math.floor((lat + 90) / 10) * 36 + Math.floor((lon + 180) / 10);

describe('pinned vector land-fraction builder (not UI)', () => {
  it('regenerates all 648 cells and provenance byte-exactly offline', () => {
    expect(buildMaskDocument()).toEqual(document);
    expect(document.fractions).toHaveLength(648);
    expect(document.fractions.every(f => Number.isFinite(f) && f >= 0 && f <= 1)).toBe(true);
    expect(polygons).toHaveLength(127);
  }, 30000);

  it('respects holes, winding, union across features and self-intersection fill rule', () => {
    const exterior = rectangle(0, 0, 10, 10), hole = rectangle(2, 2, 8, 8);
    const p = polygon([exterior, hole]);
    expect(polygonContains(p, 1, 1)).toBe(true);
    expect(polygonContains(p, 5, 5)).toBe(false);
    expect(polygonContains(polygon([exterior.toReversed(), hole.toReversed()]), 5, 5)).toBe(false);
    expect(landAtPoint([p, polygon([rectangle(4, 4, 6, 6)])], 5, 5)).toBe(true);
    const bowtie = polygon([[[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]]]);
    expect(polygonContains(bowtie, 1, 0.5)).toBe(true);
    expect(polygonContains(bowtie, 0.25, 1)).toBe(false);
    // Source feature 78 retained unchanged, including its audited small bounds.
    expect(polygons[78].bounds[0]).toBeCloseTo(-133.23966448, 7);
    expect(polygons[78].bounds[3]).toBeCloseTo(54.16997549, 7);
    expect(polygonContains(polygons[78], -132.8, 53)).toBe(false);
    expect(polygonContains(polygons[78], -131.5, 53.5)).toBe(false);
    expect(document.fractions[cell(55, -135)]).toBeGreaterThan(0);
  });

  it('treats split dateline polygons periodically and polar/world rectangles by area', () => {
    const seam = polygon([rectangle(-180, -10, -170, 10), rectangle(170, -10, 180, 10)]);
    expect(landAtPoint([seam], -175, 0)).toBe(true);
    expect(landAtPoint([seam], 185, 0)).toBe(true);
    expect(landAtPoint([seam], 175, 0)).toBe(true);
    expect(landAtPoint([seam], 0, 0)).toBe(false);
    const cap = fractionalMask([polygon([rectangle(-180, -90, 180, -80)])], 18, 36, 4);
    expect(cap.fractions.slice(0, 36)).toEqual(Array(36).fill(1));
    expect(cap.fractions.slice(36).every(f => f === 0)).toBe(true);
    expect(cap.globalLandFraction).toBeCloseTo((1 - Math.sin(80 * Math.PI / 180)) / 2, 12);
    expect(fractionalMask([polygon([rectangle(-180, -90, 180, 90)])], 18, 36, 4).globalLandFraction)
      .toBeCloseTo(1, 12);
    // Equal-area sample locations, not equally spaced latitude: half of each
    // hemisphere cell's x=sin(phi) measure is exactly half of its samples.
    const latitudeSplit = Math.asin((Math.sin(20 * Math.PI / 180) + Math.sin(30 * Math.PI / 180)) / 2) * 180 / Math.PI;
    const half = fractionalMask([polygon([rectangle(0, 20, 10, latitudeSplit)])], 18, 36, 8);
    expect(half.fractions[cell(25, 5)]).toBe(0.5);
  });

  it('preserves row/column phase and distinguishes Taipei point from surrounding cell', () => {
    expect(document.fractions[cell(25, 15)]).toBe(1); // Sahara
    expect(document.fractions[cell(25, -145)]).toBe(0); // Pacific
    expect(document.fractions[cell(-25, 135)]).toBe(1); // Australia
    expect(document.fractions[cell(-5, -65)]).toBe(1); // Amazon
    expect(landAtPoint(polygons, 121.5654, 25.033)).toBe(true);
    expect(document.fractions[11 * 36 + 30]).toBeCloseTo(0.0741207605927434, 2);
    // Independent clipped-edge oracle values from CX-MSG0218, not a full audit.
    expect(Math.abs(document.globalLandFraction - 0.28869879277471266)).toBeLessThan(1e-4);
  });

  it('has bounded sampling refinement error, including the self-intersection cell', () => {
    const coarse = fractionalMask(polygons, 18, 36, 32);
    const fine = fractionalMask(polygons, 18, 36, 128);
    let max = 0, squared = 0;
    fine.fractions.forEach((f, k) => {
      const error = document.fractions[k] - f;
      max = Math.max(max, Math.abs(error));
      const row = Math.floor(k / 36), w = Math.sin((-80 + 10 * row) * Math.PI / 180) - Math.sin((-90 + 10 * row) * Math.PI / 180);
      squared += w * error ** 2;
    });
    const rms = Math.sqrt(squared / 72);
    console.log(JSON.stringify({ maskRefinement: '64→128', max, areaRms: rms,
      land32: coarse.globalLandFraction, land64: document.globalLandFraction, land128: fine.globalLandFraction,
      taipei64: document.fractions[426], taipei128: fine.fractions[426],
      ring78Cell64: document.fractions[cell(55, -135)], ring78Cell128: fine.fractions[cell(55, -135)] }));
    expect(max).toBeLessThan(0.02);
    expect(rms).toBeLessThan(0.002);
    expect(Math.abs(fine.globalLandFraction - 0.28869879277471266)).toBeLessThan(1e-4);
    expect(Math.abs(document.fractions[cell(55, -135)] - fine.fractions[cell(55, -135)])).toBeLessThan(0.02);
  }, 30000);

  it('optimized scanline parity agrees with direct ray crossing for source feature 78', () => {
    const feature = polygons[78], n = 16;
    const mask = fractionalMask([feature], 18, 36, n);
    let count = 0;
    const south = Math.sin(50 * Math.PI / 180), north = Math.sin(60 * Math.PI / 180);
    for (let y = 0; y < n; y += 1) {
      const lat = Math.asin(south + (y + 0.5) / n * (north - south)) * 180 / Math.PI;
      for (let x = 0; x < n; x += 1) {
        if (polygonContains(feature, -140 + (x + 0.5) * 10 / n, lat)) count += 1;
      }
    }
    expect(mask.fractions[cell(55, -135)]).toBe(count / n ** 2);
  });

  it('rejects malformed shapefiles, points and quadrature counts explicitly', () => {
    expect(() => parsePolygonShapefile(Buffer.alloc(100))).toThrow();
    expect(() => fractionalMask(polygons, 18, 36, 0)).toThrow(RangeError);
    expect(() => landAtPoint(polygons, NaN, 0)).toThrow(RangeError);
    expect(() => landAtPoint(polygons, 0, 91)).toThrow(RangeError);
  });
});
