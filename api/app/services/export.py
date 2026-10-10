"""Candidate export service — stub.

Export formats:
- CSV: standard columns (see ARCHITECTURE.md §4.4)
- VOTable: IVOA-compliant VOTable 1.4 XML with UCDs:
  - pos.eq.ra (degrees)
  - pos.eq.dec (degrees)
  - pos.pm (motion per epoch)
  - meta.id (candidate ID)

Generation should use astropy.io.votable for spec compliance.
Validate with `stilts tpipe` in CI.

See ARCHITECTURE.md §4.4 for full VOTable structure.
[VERIFY: OQ-9] VOTable xmlns version string for 1.4 compliance.
"""
