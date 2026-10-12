"""Unit tests for candidate export (CSV and IVOA VOTable 1.4) (Phase C6)."""

import xml.etree.ElementTree as ET
from app.services.export import export_candidates_to_csv, export_candidates_to_votable


def test_export_candidates_to_csv():
    rows = [
        {
            "id": "e5f6a7b8-1111-2222-3333-444455556666",
            "subject_id": "a1b2c3d4-1111-2222-3333-444455556666",
            "category": "asteroid_neo",
            "status": "confirmed",
            "n_classifications": 7,
            "mean_reliability": 0.72,
            "motion_arcsec_per_epoch": 12.4,
            "motion_pa_deg": 265.3,
            "cluster_dispersion_arcsec": 4.1,
            "epoch_1_ra": 180.00245,
            "epoch_1_dec": -2.49870,
            "epoch_2_ra": 180.00312,
            "epoch_2_dec": -2.49848,
            "epoch_3_ra": None,
            "epoch_3_dec": None,
            "epoch_4_ra": None,
            "epoch_4_dec": None,
        }
    ]
    csv_str = export_candidates_to_csv(rows)
    lines = csv_str.strip().splitlines()
    assert len(lines) == 2
    header = lines[0]
    assert "candidate_id" in header
    assert "motion_arcsec_per_epoch" in header
    assert "epoch_1_ra" in header
    assert "epoch_4_dec" in header

    data = lines[1]
    assert "e5f6a7b8-1111-2222-3333-444455556666" in data
    assert "180.00245" in data
    assert "12.4" in data


def test_export_candidates_to_votable():
    rows = [
        {
            "id": "e5f6a7b8-1111-2222-3333-444455556666",
            "subject_id": "a1b2c3d4-1111-2222-3333-444455556666",
            "category": "asteroid_neo",
            "status": "confirmed",
            "n_classifications": 7,
            "mean_reliability": 0.72,
            "motion_arcsec_per_epoch": 12.4,
            "motion_pa_deg": 265.3,
            "cluster_dispersion_arcsec": 4.1,
            "epoch_1_ra": 180.00245,
            "epoch_1_dec": -2.49870,
            "epoch_2_ra": 180.00312,
            "epoch_2_dec": -2.49848,
            "epoch_3_ra": None,
            "epoch_3_dec": None,
            "epoch_4_ra": None,
            "epoch_4_dec": None,
        }
    ]
    xml_str = export_candidates_to_votable(rows)
    assert xml_str.startswith('<?xml version="1.0" encoding="UTF-8"?>')

    # Parse XML and validate structure
    root = ET.fromstring(xml_str.replace('<?xml version="1.0" encoding="UTF-8"?>', "").strip())
    assert root.tag.endswith("VOTABLE")
    assert root.attrib.get("version") == "1.4"

    ns = {"v": "http://www.ivoa.net/xml/VOTable/v1.3"}
    resource = root.find("v:RESOURCE", ns) or root.find("RESOURCE")
    assert resource is not None
    table = resource.find("v:TABLE", ns) or resource.find("TABLE")
    assert table is not None
    assert table.attrib.get("name") == "candidates"

    fields = table.findall("v:FIELD", ns) or table.findall("FIELD")
    field_names = [f.attrib.get("name") for f in fields]
    assert "candidate_id" in field_names
    assert "motion_arcsec_per_epoch" in field_names
    assert "epoch_1_ra" in field_names

    # Check UCD attributes
    ucds = {f.attrib.get("name"): f.attrib.get("ucd") for f in fields}
    assert ucds["candidate_id"] == "meta.id;meta.main"
    assert ucds["motion_arcsec_per_epoch"] == "pos.pm"
    assert ucds["epoch_1_ra"] == "pos.eq.ra"

    data = table.find("v:DATA", ns) or table.find("DATA")
    assert data is not None
    tabledata = data.find("v:TABLEDATA", ns) or data.find("TABLEDATA")
    assert tabledata is not None
    tr = tabledata.find("v:TR", ns) or tabledata.find("TR")
    assert tr is not None
    tds = tr.findall("v:TD", ns) or tr.findall("TD")
    assert len(tds) == len(fields)
    assert tds[0].text == "e5f6a7b8-1111-2222-3333-444455556666"
    assert tds[2].text == "asteroid_neo"
    assert tds[6].text == "12.4"

