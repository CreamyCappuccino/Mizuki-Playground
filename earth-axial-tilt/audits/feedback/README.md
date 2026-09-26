# Independent actual-source feedback audit

`oracle.py` uses independently assembled latitude geometry, orbital bisection,
daily sunlight and a SciPy direct banded system. `run-production.mjs` executes
actual current TypeScript source by in-memory compilation, records its hashes
and writes full Float64 arrays to the supplied output directory. Neither copies
production solver code into the reference implementation. This validates the
specified discrete model, not real climate accuracy.

Run from `earth-axial-tilt` with locked Node dependencies and Python NumPy/SciPy:

```sh
python audits/feedback/oracle.py --output /tmp/earth-feedback-audit
```

The output directory must be outside the repository. Compare all six complete
fields against max absolute difference <1e-5°C. Never widen this criterion or
update a baseline to make an unexplained mismatch pass. The source contract and
limits are in `docs/V1.4.md`.
