from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


SOURCE = Path(r"C:\Users\User\Downloads\INVENTARIO 15-08-2026.xlsx")

CATEGORIES: dict[str, tuple[str, ...]] = {
    "Lijas": ("LIJA", "DISCO NORGRIP", "GOVA DIAMOND"),
    "Cintas": ("CINTA", "MASKING"),
    "Masillas": ("MASILLA", "MEGAX M1"),
    "Pinturas": ("PINTURA", "BASE POLIURETANO", "ESMALTE"),
    "Barnices": ("BARNIZ", "CLEAR COAT", "AUTOCLEAR"),
    "Catalizadores": ("CATALIZADOR", "HARDENER"),
    "Diluyentes": ("DILUYENTE", "THINNER"),
    "Adhesivos": ("ADHESIVO", "SIKA", "SELLADOR"),
    "Protección personal": ("BUZO", "GUANTE", "MASCARA", "RESPIRADOR", "LENTE", "CALZADO DE SEGURIDAD"),
}


def number(value: Any, fallback: float = 0) -> float:
    return float(value) if isinstance(value, (int, float)) else fallback


def main() -> None:
    workbook = load_workbook(SOURCE, read_only=True, data_only=True)
    sheet = workbook["MATRIZ GENERAL"]
    records = []
    for barcode, code, description, family, stock, cost, *_ in sheet.iter_rows(min_row=2, values_only=True):
        if not code or not description:
            continue
        records.append(
            {
                "barcode": str(barcode or ""),
                "code": str(code).strip(),
                "description": " ".join(str(description).split()),
                "family": " ".join(str(family or "").split()),
                "stock": number(stock),
                "cost": number(cost),
            }
        )

    chosen = []
    seen: set[str] = set()
    limits = {"Lijas": 7, "Cintas": 5, "Masillas": 4, "Pinturas": 5, "Barnices": 4, "Catalizadores": 4, "Diluyentes": 3, "Adhesivos": 4, "Protección personal": 4}
    for category, terms in CATEGORIES.items():
        matches = [
            record
            for record in records
            if record["code"] not in seen
            and record["stock"] > 0
            and record["cost"] > 0
            and any(term in record["description"].upper() for term in terms)
        ]
        matches.sort(key=lambda record: (-record["stock"], record["code"]))
        for record in matches[: limits[category]]:
            record["category"] = category
            chosen.append(record)
            seen.add(record["code"])

    workbook.close()
    print(json.dumps(chosen, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
