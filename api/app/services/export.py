"""Candidate export service.

Generates:
1. CSV export (ARCHITECTURE.md §4.4)
2. IVOA-compliant VOTable 1.4 XML (ARCHITECTURE.md §4.4) without heavy astropy dependency.
"""

from __future__ import annotations

import csv
import io
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Sequence


def export_candidates_to_csv(rows: Sequence[dict[str, Any]]) -> str:
    """Generate CSV string matching ARCHITECTURE.md §4.4 contract."""
    output = io.StringIO()
    fieldnames = [
        "candidate_id",
        "subject_id",
        "category",
        "status",
        "n_classifications",
        "mean_reliability",
        "motion_arcsec_per_epoch",
        "motion_pa_deg",
        "cluster_dispersion_arcsec",
        "epoch_1_ra",
        "epoch_1_dec",
        "epoch_2_ra",
        "epoch_2_dec",
        "epoch_3_ra",
        "epoch_3_dec",
        "epoch_4_ra",
        "epoch_4_dec",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for r in rows:
        row_dict = {
            "candidate_id": str(r["id"]),
            "subject_id": str(r["subject_id"]),
            "category": r["category"],
            "status": r["status"],
            "n_classifications": r["n_classifications"],
            "mean_reliability": r["mean_reliability"],
            "motion_arcsec_per_epoch": r["motion_arcsec_per_epoch"] if r["motion_arcsec_per_epoch"] is not None else "",
            "motion_pa_deg": r["motion_pa_deg"] if r["motion_pa_deg"] is not None else "",
            "cluster_dispersion_arcsec": r["cluster_dispersion_arcsec"] if r["cluster_dispersion_arcsec"] is not None else "",
            "epoch_1_ra": r.get("epoch_1_ra", "") if r.get("epoch_1_ra") is not None else "",
            "epoch_1_dec": r.get("epoch_1_dec", "") if r.get("epoch_1_dec") is not None else "",
            "epoch_2_ra": r.get("epoch_2_ra", "") if r.get("epoch_2_ra") is not None else "",
            "epoch_2_dec": r.get("epoch_2_dec", "") if r.get("epoch_2_dec") is not None else "",
            "epoch_3_ra": r.get("epoch_3_ra", "") if r.get("epoch_3_ra") is not None else "",
            "epoch_3_dec": r.get("epoch_3_dec", "") if r.get("epoch_3_dec") is not None else "",
            "epoch_4_ra": r.get("epoch_4_ra", "") if r.get("epoch_4_ra") is not None else "",
            "epoch_4_dec": r.get("epoch_4_dec", "") if r.get("epoch_4_dec") is not None else "",
        }
        writer.writerow(row_dict)

    return output.getvalue()


def export_candidates_to_votable(rows: Sequence[dict[str, Any]]) -> str:
    """Generate IVOA-compliant VOTable 1.4 XML string matching ARCHITECTURE.md §4.4."""
    votable = ET.Element(
        "VOTABLE",
        {
            "version": "1.4",
            "xmlns": "http://www.ivoa.net/xml/VOTable/v1.3",
        },
    )
    resource = ET.SubElement(votable, "RESOURCE", {"name": "AstroBlink Candidates"})
    desc = ET.SubElement(resource, "DESCRIPTION")
    desc.text = "Citizen-science candidates from AstroBlink (SPHEREx blink comparator)"

    table = ET.SubElement(resource, "TABLE", {"name": "candidates"})

    # Define fields matching ARCHITECTURE.md §4.4
    fields_spec = [
        {"name": "candidate_id", "datatype": "char", "arraysize": "*", "ucd": "meta.id;meta.main"},
        {"name": "subject_id", "datatype": "char", "arraysize": "*", "ucd": "meta.id"},
        {"name": "category", "datatype": "char", "arraysize": "*", "ucd": "src.class"},
        {"name": "status", "datatype": "char", "arraysize": "*", "ucd": "meta.code.status"},
        {"name": "n_classifications", "datatype": "int", "ucd": "meta.number"},
        {"name": "mean_reliability", "datatype": "float", "ucd": "stat.likelihood"},
        {"name": "motion_arcsec_per_epoch", "datatype": "float", "unit": "arcsec", "ucd": "pos.pm"},
        {"name": "motion_pa_deg", "datatype": "float", "unit": "deg", "ucd": "pos.posAng"},
        {"name": "epoch_1_ra", "datatype": "double", "unit": "deg", "ucd": "pos.eq.ra"},
        {"name": "epoch_1_dec", "datatype": "double", "unit": "deg", "ucd": "pos.eq.dec"},
        {"name": "epoch_2_ra", "datatype": "double", "unit": "deg", "ucd": "pos.eq.ra"},
        {"name": "epoch_2_dec", "datatype": "double", "unit": "deg", "ucd": "pos.eq.dec"},
        {"name": "epoch_3_ra", "datatype": "double", "unit": "deg", "ucd": "pos.eq.ra"},
        {"name": "epoch_3_dec", "datatype": "double", "unit": "deg", "ucd": "pos.eq.dec"},
        {"name": "epoch_4_ra", "datatype": "double", "unit": "deg", "ucd": "pos.eq.ra"},
        {"name": "epoch_4_dec", "datatype": "double", "unit": "deg", "ucd": "pos.eq.dec"},
    ]

    for f in fields_spec:
        ET.SubElement(table, "FIELD", f)

    data_el = ET.SubElement(table, "DATA")
    tabledata = ET.SubElement(data_el, "TABLEDATA")

    for r in rows:
        tr = ET.SubElement(tabledata, "TR")

        def add_td(val: Any) -> None:
            td = ET.SubElement(tr, "TD")
            td.text = str(val) if val is not None else ""

        add_td(str(r["id"]))
        add_td(str(r["subject_id"]))
        add_td(r["category"])
        add_td(r["status"])
        add_td(r["n_classifications"])
        add_td(r["mean_reliability"])
        add_td(r["motion_arcsec_per_epoch"])
        add_td(r["motion_pa_deg"])
        add_td(r.get("epoch_1_ra"))
        add_td(r.get("epoch_1_dec"))
        add_td(r.get("epoch_2_ra"))
        add_td(r.get("epoch_2_dec"))
        add_td(r.get("epoch_3_ra"))
        add_td(r.get("epoch_3_dec"))
        add_td(r.get("epoch_4_ra"))
        add_td(r.get("epoch_4_dec"))

    xml_decl = '<?xml version="1.0" encoding="UTF-8"?>\n'
    return xml_decl + ET.tostring(votable, encoding="utf-8").decode("utf-8")
