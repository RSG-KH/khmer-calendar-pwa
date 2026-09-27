"""Build compact GeoNames ADM1/ADM2/ADM3 assets from an official gazetteer ZIP.

Usage: py -3 scripts/build-geonames-divisions.py path/to/allCountries.zip
"""

import hashlib
import json
import math
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
import gzip

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "birthplaces"
ZIP_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if ZIP_PATH is None or not ZIP_PATH.is_file():
    raise SystemExit("Pass a saved GeoNames allCountries.zip path")

names = {country["code"]: country["name"] for country in json.loads(
    (ROOT / "scripts" / "geonames-country-names.json").read_text(encoding="utf-8"))}
with ZIP_PATH.open("rb") as source_file:
    source_hash = hashlib.file_digest(source_file, "sha256").hexdigest()
records = defaultdict(dict)
duplicate_codes = 0
with zipfile.ZipFile(ZIP_PATH) as archive:
    with archive.open("allCountries.txt") as stream:
        for raw in stream:
            # Reject non-administrative records before decoding millions of place names.
            fields = raw.rstrip(b"\r\n").split(b"\t")
            if len(fields) < 18 or fields[6] != b"A" or fields[7] not in (b"ADM1", b"ADM2", b"ADM3"):
                continue
            code = fields[8].decode("ascii", "ignore")
            if code not in names or code == "KH":
                continue
            level = int(fields[7][-1:])
            path = tuple(fields[10 + i].decode("utf-8") for i in range(level))
            if not all(path):
                continue
            key = (level, path)
            try:
                latitude, longitude = float(fields[4]), float(fields[5])
                ident = int(fields[0])
            except ValueError:
                continue
            if not (math.isfinite(latitude) and math.isfinite(longitude)
                    and -90 <= latitude <= 90 and -180 <= longitude <= 180):
                continue
            record = {"id": ident, "parentId": None, "level": level,
                      "code": path[-1], "name": fields[1].decode("utf-8"),
                      "latitude": latitude, "longitude": longitude,
                      "timeZone": fields[17].decode("utf-8")}
            if key in records[code]:
                duplicate_codes += 1
                # A code collision is ambiguous. Keep the lower stable GeoNames ID.
                if records[code][key]["id"] < ident:
                    continue
            records[code][key] = record

countries = []
stats = {"byLevel": [0, 0, 0], "withoutTimeZone": 0, "missingParents": 0,
         "duplicateCodes": duplicate_codes, "countriesWithoutDivisions": []}
for code, name in names.items():
    if code == "KH":
        continue
    source = records[code]
    included = {}
    for level in (1, 2, 3):
        for (record_level, path), record in sorted(source.items()):
            if record_level != level:
                continue
            parent = included.get((level - 1, path[:-1])) if level > 1 else None
            if level > 1 and parent is None:
                stats["missingParents"] += 1
                continue
            record["parentId"] = parent["id"] if parent else None
            included[(level, path)] = record
            stats["byLevel"][level - 1] += 1
            if not record["timeZone"]:
                stats["withoutTimeZone"] += 1
    if not included:
        stats["countriesWithoutDivisions"].append(code)
    divisions = list(included.values())
    document = {"schemaVersion": 3, "countryCode": code,
                "datasetVersion": source_hash, "divisions": divisions}
    raw = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.GzipFile(OUTPUT / "countries" / f"{code}.json.gz", "wb", compresslevel=9, mtime=0) as target:
        target.write(raw)
    countries.append({"code": code, "name": name, "divisionCount": len(divisions)})

kh_divisions = 1898
countries.append({"code": "KH", "name": names["KH"], "divisionCount": kh_divisions})
countries.sort(key=lambda country: country["code"])
included_codes = {country["code"] for country in countries if country["code"] != "KH"}
for old_asset in (OUTPUT / "countries").glob("??.json.gz"):
    if old_asset.stem.split(".")[0] not in included_codes:
        old_asset.unlink()
index = {"schemaVersion": 3, "source": "GeoNames ADM1–ADM3 and Cambodia divisions",
         "datasetVersion": source_hash, "countries": countries,
         "statistics": stats}
(OUTPUT / "country-index.json").write_text(json.dumps(index, ensure_ascii=False,
    separators=(",", ":")) + "\n", encoding="utf-8")
cambodia = json.loads(gzip.decompress((OUTPUT / "cambodia.json.gz").read_bytes()))
(OUTPUT / "provenance.json").write_text(json.dumps({
    "schemaVersion": 3,
    "geonames": {"source": "GeoNames allCountries.zip", "sourceUrl":
        "https://download.geonames.org/export/dump/allCountries.zip",
        "sourceSha256": source_hash, "sourceBytes": ZIP_PATH.stat().st_size,
        "includedFeatureCodes": ["ADM1", "ADM2", "ADM3"],
        "statistics": stats},
    "cambodia": {"source": "Wikipedia-referenced Cambodia divisions with supplemental CambodiaPostalCode records, Open Admin Data and additional coordinate points",
        "sourceVersion": cambodia["sourceVersion"],
        "sourceSha256": cambodia["sourceSha256"],
        "datasetVersion": cambodia["datasetVersion"],
        "divisions": len(cambodia["divisions"]),
        "withCoordinates": sum(division["latitude"] is not None for division in cambodia["divisions"]),
        "coordinateFill": cambodia["coordinateFill"],
        "sourceNotice": "See ATTRIBUTION.txt and the source dataset NOTICE.md"}},
    ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"countries": len(countries), **stats}, ensure_ascii=False))
