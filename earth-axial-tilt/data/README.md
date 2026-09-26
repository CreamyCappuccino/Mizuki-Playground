# Earth geography source data

Acquired / generated / independently reviewed: 2026-09-26. This is an isolated
reviewed mask, not a validated annual climate solver or connected UI.
The implementation contract is [the geography design](../docs/DESIGN-v1.3-earth-geography.md).

## Layout and pinned source

`sources/ne_110m_land-4.1.0.zip` is the unmodified 69,700-byte source archive.
It is intentionally retained in Git to make future mask builds independent
of an unversioned remote download. No network access will be needed at runtime.

- Dataset: Natural Earth, 1:110m physical land polygons.
- Download: https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip
- Landing page: https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/
- Actual included `ne_110m_land.VERSION.txt`: **4.1.0** (CRLF). The page says
  4.0.0; use the archive version and hash, not that page label.
- Archive SHA-256: `1926c621afd6ac67c3f36639bb1236134a48d82226dc675d3e3df53d02d2a3de`.
- License: public domain, checked at https://www.naturalearthdata.com/about/terms-of-use/.
  The archived README is retained inside the zip. Made with Natural Earth.
- CRS: `.prj` declares `GCS_WGS_1984`, `D_WGS_1984`, Greenwich and degree units;
  coordinates are longitude / latitude, not projected metres.

## Component SHA-256

Hashes are over exact uncompressed bytes, including original line endings.

| Archive member | SHA-256 |
|---|---|
| `ne_110m_land.README.html` | `631fd1579d3da3e480c1082695508784ae295bf53b8e1248455b22bb6b6d24d2` |
| `ne_110m_land.VERSION.txt` | `0874a8fe36effb87780f431845b5a7d85be657f2bd998ce8eeace717860d3b78` |
| `ne_110m_land.cpg` | `3ad3031f5503a4404af825262ee8232cc04d4ea6683d42c5dd0a2f2a27ac9824` |
| `ne_110m_land.dbf` | `db7cf6d2de2811df09bd7fcc6f243ab78a715b83571a0cb7b36b4e2af3297caa` |
| `ne_110m_land.prj` | `3259f0e55290a82b1350646f604e8a7ee1e2136c0320a40fad838ab40819fff8` |
| `ne_110m_land.shp` | `8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de` |
| `ne_110m_land.shx` | `2719254764a70262a34333581d582d503b8af5d6626e6da4eb2b5f86e7316faa` |

Inspect without modifying the archive:

```sh
shasum -a 256 data/sources/ne_110m_land-4.1.0.zip
unzip -p data/sources/ne_110m_land-4.1.0.zip ne_110m_land.VERSION.txt
unzip -p data/sources/ne_110m_land-4.1.0.zip ne_110m_land.prj
```

## Reproducible mask candidate

`land-fractions.json` contains 648 fractions, south-to-north rows and
west-to-east columns (latitudes −85…85°, longitudes −175…175°). Generate/check
from the project directory with Node >=22.12 and `unzip`, without network:

```sh
npm run data:geography
npm run data:geography -- --check
npm run data:geography -- --help
```

The builder verifies the archive and all seven component hashes, reads Polygon
shape-type 5 directly, and uses 64×64 midpoint samples per cell, uniform in
sin(latitude) and longitude. Edges are straight in the source lon/lat plane.
Fill is **even-odd within each feature, union across features**, independent of
ring winding. Ray crossings use half-open latitude intervals; boundaries are
measure-zero, not a reliable point coastline classifier. Source coordinates
that overshoot 180°/−90° by floating roundoff (<1e-9°) are accepted unchanged.
No feature is removed, buffered, union-normalized or repaired. In particular,
feature index 78's reported self-intersection near −132.7100°, 54.0400° remains
interpreted by the declared even-odd rule. An independent repaired/union oracle
may differ there; compare the affected cells before considering any change.

Builder file hashes and source/grid/quadrature identity are embedded in the
JSON; fraction payload hash is over 648 Float64 values encoded little-endian:
`09462b795716c3a3ce747bcf0835b089b38be8028d09b75cc1cdd196b2567084`.
Entire generated JSON SHA-256:
`d9e50b8fcec281c898af983e303fd982fcbe64e6a52c0eccb181be71da9a2e89`.

The 64×64 candidate global land fraction is 0.28866904568519103, versus the
independent clipped-edge oracle's reported 0.28869879277471266. Row 11,
column 30 (20–30°N, 120–130°E) is 0.07470703125 vs reported 0.0741207605927434.
Taipei's point itself is land: this fraction describes the **surrounding coarse
cell**, not whether that city is ocean. Sahara/Australia/Amazon cells are 1,
the Pacific reference cell is 0. Tests cover area sampling, winding/holes,
feature union, self-intersections, periodic seam, polar cap, full-world area,
locations and 32/64/128 sampling refinement. Full 648-cell independent area
comparison was subsequently completed in CX-MSG0220, described below.

Local refinement (32 / 64 / 128 samples per axis): global fractions
0.2887587704291773 / 0.28866904568519103 / 0.2886988767623647.
64→128 maximum cell difference is 0.00299072265625 and global area RMS is
0.0005125171951266894 (fraction units). Taipei's cell at 128 is 0.0743408203125;
the cell containing source feature 78 (50–60°N, 140–130°W) changes from
0.247314453125 to 0.24810791015625. These quantify quadrature sensitivity,
not a comparison of every cell against the independent exact-area oracle.

## Independent acceptance (CX-MSG0220)

Chat-side Mizuki reviewed `f4efae55`, regenerated JSON byte-exactly offline,
verified every hash, and matched **all 648 fractions exactly** against a separate
Python scanline q64 implementation. Against independent Shapely clipping and
spherical line integration, max cell error is 0.003036385764141891, global
area RMS 0.00046561603838309805, and global land-fraction difference
−0.00002974708952234919. Feature 78's cell is 0.247314453125 vs exact-area
0.2477044444853129 (difference −0.0003899913603129), consistent with this
quadrature approximation without modifying source rings. This is designer-
reported independent review acceptance, not a local Shapely implementation.
Mask/source/grid are accepted **within this declared approximation**. Solver
errors must be evaluated using this same fixed mask, separately from mask
approximation error; other exact-area-mask prototypes do not certify our solver.

This coarse dataset misses small islands and does not distinguish inland lakes
or ice as separate thermal materials. Polygon holes are respected, but inland
lake coverage follows the source polygons, not a separate lake dataset.
Source version alone is not model provenance:
the grid, builder, quadrature, output hash and solver version must also be included.
