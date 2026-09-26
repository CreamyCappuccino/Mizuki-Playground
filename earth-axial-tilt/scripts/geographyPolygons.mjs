/** Minimal, bounded Polygon (shape type 5) reader; no source geometry repair. */
export function parsePolygonShapefile(bytes) {
  const fail = () => { throw new Error('Invalid/unsupported Polygon shapefile'); };
  if (bytes.length < 100 || bytes.readInt32BE(0) !== 9994 ||
      bytes.readInt32LE(28) !== 1000 || bytes.readInt32LE(32) !== 5 ||
      bytes.readInt32BE(24) * 2 !== bytes.length) fail();
  const polygons = [];
  for (let offset = 100; offset < bytes.length;) {
    if (offset + 8 > bytes.length) fail();
    const length = bytes.readInt32BE(offset + 4) * 2;
    offset += 8;
    if (length < 44 || offset + length > bytes.length || bytes.readInt32LE(offset) !== 5) fail();
    const parts = bytes.readInt32LE(offset + 36), points = bytes.readInt32LE(offset + 40);
    if (parts < 1 || points < 4 || parts > points || 44 + parts * 4 + points * 16 !== length) fail();
    const vertices = offset + 44 + parts * 4, rings = [];
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    let previous = -1;
    for (let part = 0; part < parts; part += 1) {
      const start = bytes.readInt32LE(offset + 44 + part * 4);
      const end = part + 1 < parts ? bytes.readInt32LE(offset + 48 + part * 4) : points;
      if (start <= previous || (part === 0 && start !== 0) || end > points || end - start < 4) fail();
      previous = start;
      const ring = [], ringBounds = [Infinity, Infinity, -Infinity, -Infinity];
      for (let p = start; p < end; p += 1) {
        const lon = bytes.readDoubleLE(vertices + p * 16), lat = bytes.readDoubleLE(vertices + p * 16 + 8);
        // Source has 180.00000000000014 / -90.00000000000003. Preserve these
        // roundoff-scale coordinates, not a clamp/geometry normalization.
        if (!Number.isFinite(lon) || !Number.isFinite(lat) ||
            Math.abs(lon) > 180 + 1e-9 || Math.abs(lat) > 90 + 1e-9) fail();
        ring.push([lon, lat]);
        ringBounds[0] = Math.min(ringBounds[0], lon); ringBounds[1] = Math.min(ringBounds[1], lat);
        ringBounds[2] = Math.max(ringBounds[2], lon); ringBounds[3] = Math.max(ringBounds[3], lat);
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) fail();
      bounds[0] = Math.min(bounds[0], ringBounds[0]); bounds[1] = Math.min(bounds[1], ringBounds[1]);
      bounds[2] = Math.max(bounds[2], ringBounds[2]); bounds[3] = Math.max(bounds[3], ringBounds[3]);
      rings.push({ points: ring, bounds: ringBounds });
    }
    polygons.push({ index: polygons.length, rings, bounds });
    offset += length;
  }
  return polygons;
}

function insideBounds(lon, lat, bounds) {
  return lon >= bounds[0] && lon <= bounds[2] && lat >= bounds[1] && lat <= bounds[3];
}

/** Even-odd per feature (holes independent of winding), union across features.
 * Edges are straight in source lon/lat. Ray crossings use half-open Y intervals.
 * Self-intersections are interpreted by this fill rule, never buffer/repaired.
 */
export function polygonContains(polygon, lon, lat) {
  if (!insideBounds(lon, lat, polygon.bounds)) return false;
  let inside = false;
  for (const ring of polygon.rings) {
    if (!insideBounds(lon, lat, ring.bounds)) continue;
    const points = ring.points;
    for (let i = 1; i < points.length; i += 1) {
      const [x1, y1] = points[i - 1], [x2, y2] = points[i];
      if ((y1 > lat) !== (y2 > lat) && lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1)) inside = !inside;
    }
  }
  return inside;
}

export function landAtPoint(polygons, longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError('Invalid geographic point');
  }
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  return polygons.some(p => polygonContains(p, lon, latitude));
}

// A latitude is shared by all longitude samples in a row. Intersect edges
// once, then use the same strict ray parity via binary search for each point.
function crossingsAtLatitude(polygon, latitude) {
  const crossings = [];
  for (const { points, bounds } of polygon.rings) {
    if (latitude < bounds[1] || latitude > bounds[3]) continue;
    for (let i = 1; i < points.length; i += 1) {
      const x1 = points[i - 1][0], y1 = points[i - 1][1], x2 = points[i][0], y2 = points[i][1];
      if ((y1 > latitude) !== (y2 > latitude)) crossings.push(x1 + (latitude - y1) * (x2 - x1) / (y2 - y1));
    }
  }
  return crossings.sort((a, b) => a - b);
}

function crossingsContain(crossings, longitude) {
  let lo = 0, hi = crossings.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (crossings[mid] <= longitude) lo = mid + 1;
    else hi = mid;
  }
  return (crossings.length - lo) % 2 === 1;
}

/** Midpoint quadrature uniform in sin(phi) and lambda, not uniform latitude. */
export function fractionalMask(polygons, nlat = 18, nlon = 36, samples = 64) {
  for (const [value, max] of [[nlat, 180], [nlon, 360], [samples, 256]]) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw new RangeError('Invalid quadrature/grid count');
  }
  const fractions = [], weight = [];
  for (let row = 0; row < nlat; row += 1) {
    const south = -90 + row * 180 / nlat, north = -90 + (row + 1) * 180 / nlat;
    const sinSouth = Math.sin(south * Math.PI / 180), sinNorth = Math.sin(north * Math.PI / 180);
    weight.push(sinNorth - sinSouth);
    const latitudes = Array.from({ length: samples }, (_, k) =>
      Math.asin(sinSouth + (k + 0.5) / samples * (sinNorth - sinSouth)) * 180 / Math.PI);
    const scanlines = latitudes.map(lat => polygons.filter(p => lat >= p.bounds[1] && lat <= p.bounds[3])
      .map(p => ({ bounds: p.bounds, crossings: crossingsAtLatitude(p, lat) })));
    for (let column = 0; column < nlon; column += 1) {
      const west = -180 + column * 360 / nlon, east = west + 360 / nlon;
      let count = 0;
      for (const scanline of scanlines) {
        const rowCandidates = scanline.filter(p => p.bounds[0] < east && p.bounds[2] > west);
        for (let x = 0; x < samples; x += 1) {
          const lon = west + (x + 0.5) / samples * (east - west);
          if (rowCandidates.some(p => lon >= p.bounds[0] && lon <= p.bounds[2] && crossingsContain(p.crossings, lon))) count += 1;
        }
      }
      fractions.push(count / samples ** 2);
    }
  }
  const globalLandFraction = fractions.reduce((sum, f, k) => sum + f * weight[Math.floor(k / nlon)], 0) / (2 * nlon);
  return { fractions, globalLandFraction };
}
