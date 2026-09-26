import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fractionalMask, parsePolygonShapefile } from './geographyPolygons.mjs';

export const ARCHIVE_SHA256 = '1926c621afd6ac67c3f36639bb1236134a48d82226dc675d3e3df53d02d2a3de';
export const COMPONENT_HASHES = Object.freeze({
  'README.html': '631fd1579d3da3e480c1082695508784ae295bf53b8e1248455b22bb6b6d24d2',
  'VERSION.txt': '0874a8fe36effb87780f431845b5a7d85be657f2bd998ce8eeace717860d3b78',
  cpg: '3ad3031f5503a4404af825262ee8232cc04d4ea6683d42c5dd0a2f2a27ac9824',
  dbf: 'db7cf6d2de2811df09bd7fcc6f243ab78a715b83571a0cb7b36b4e2af3297caa',
  prj: '3259f0e55290a82b1350646f604e8a7ee1e2136c0320a40fad838ab40819fff8',
  shp: '8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de',
  shx: '2719254764a70262a34333581d582d503b8af5d6626e6da4eb2b5f86e7316faa',
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const archive = fileURLToPath(new URL('../data/sources/ne_110m_land-4.1.0.zip', import.meta.url));
const destination = new URL('../data/land-fractions.json', import.meta.url);

/** Extract to memory only; pins every member before any geometry is used. */
export function loadPinnedPolygons() {
  if (sha256(readFileSync(archive)) !== ARCHIVE_SHA256) throw new Error('Source archive hash mismatch');
  const members = {};
  for (const [suffix, expected] of Object.entries(COMPONENT_HASHES)) {
    const bytes = execFileSync('unzip', ['-p', archive, `ne_110m_land.${suffix}`]);
    if (sha256(bytes) !== expected) throw new Error(`Source component hash mismatch: ${suffix}`);
    members[suffix] = bytes;
  }
  if (members['VERSION.txt'].toString().trim() !== '4.1.0' || !members.prj.toString().includes('GCS_WGS_1984')) {
    throw new Error('Source version/CRS mismatch');
  }
  const polygons = parsePolygonShapefile(members.shp);
  if (polygons.length !== 127) throw new Error('Unexpected source feature count');
  return polygons;
}

export function buildMaskDocument() {
  const polygons = loadPinnedPolygons();
  const mask = fractionalMask(polygons);
  const bytes = Buffer.alloc(mask.fractions.length * 8);
  mask.fractions.forEach((f, k) => bytes.writeDoubleLE(f, k * 8));
  const builderHashes = {};
  for (const file of ['buildGeographyMask.mjs', 'geographyPolygons.mjs']) {
    builderHashes[file] = sha256(readFileSync(new URL(file, import.meta.url)));
  }
  return {
    schema: 1, source: { dataset: 'Natural Earth 1:110m land', version: '4.1.0',
      url: 'https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip',
      license: 'public domain', crs: 'WGS84 longitude/latitude degrees',
      archiveSha256: ARCHIVE_SHA256, componentSha256: COMPONENT_HASHES },
    grid: { id: 'phi-midpoint-18x36-v1', nlat: 18, nlon: 36,
      order: 'south-to-north rows, west-to-east columns',
      firstLatitude: -85, firstLongitude: -175, angularSpacingDegrees: 10 },
    quadrature: { method: 'sin(phi)/longitude midpoint', samplesPerAxis: 64 },
    geometry: { fillRule: 'even-odd within feature; union across features',
      interpolation: 'straight edges in source longitude/latitude',
      normalization: 'none; preserve self-intersecting feature 78' },
    builderSha256: builderHashes, fractionsFloat64LESha256: sha256(bytes), ...mask,
  };
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('npm run data:geography -- [--check]\nOffline pinned archive → 18×36 land fractions, 64×64 equal-area midpoint samples/cell.\n--check verifies exact regeneration without writing. Requires Node >=22.12 and unzip.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Expected no arguments or --check; see --help');
  const text = JSON.stringify(buildMaskDocument(), null, 2) + '\n';
  if (args[0] === '--check') {
    if (readFileSync(destination, 'utf8') !== text) throw new Error('Generated mask differs; regenerate and review');
  } else writeFileSync(destination, text);
  const result = JSON.parse(text);
  console.log(JSON.stringify({ status: args[0] === '--check' ? 'exact' : 'generated', cells: result.fractions.length,
    globalLandFraction: result.globalLandFraction, fractionsFloat64LESha256: result.fractionsFloat64LESha256,
    outputSha256: sha256(text) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
