# Earth geography source data

Acquired / verified: 2026-09-26. This is an isolated source checkpoint, not a
completed land-fraction dataset, validated climate solver or connected UI.
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

## Next generation gate

Generate the 18×36 fractional mask from vector polygons with a pinned builder,
equal-area subcell sampling uniform in sin(latitude) and longitude, and record
quadrature parameters plus output hash. Check holes, antimeridian, polar cells,
major land/ocean locations, coast fractions, total area and sampling refinement.
No generated mask exists at this checkpoint; there is no output checksum yet.
This coarse dataset misses small islands and does not distinguish inland lakes
or ice as separate thermal materials. Source version alone is not model provenance:
the grid, builder, quadrature, output hash and solver version must also be included.
