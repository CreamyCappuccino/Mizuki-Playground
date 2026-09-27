# Reproducing the independent synthesis audit

From earth-axial-tilt with locked Node dependencies and Python NumPy:

```sh
python audits/synthesis/oracle.py --output /tmp/earth-synthesis-audit
```

The script invokes run-production.mjs on actual TypeScript, recording its
SHA256 module hashes. Independent Python bisection and direct angle-domain
sunlight are compared with 365-day and 72-angle series. Much finer angular
integration checks energy/time weighting separately. No candidate-generated
expected golden is adopted. Outputs are rejected inside the project directory.

This is validation of the stated astronomical experiment, not climate accuracy
or a reconstructed orbital history. See docs/V1.5.md and its verification record.
