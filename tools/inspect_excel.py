from __future__ import annotations

import json
import sys
from datetime import date, datetime, time
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


def clean(value: Any) -> Any:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, str):
        value = " ".join(value.split())
        return value[:240]
    return value


def nonempty_rows(sheet, limit: int = 14, max_columns: int = 20) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for raw in sheet.iter_rows(values_only=True):
        row = [clean(value) for value in raw[:max_columns]]
        while row and row[-1] is None:
            row.pop()
        if any(value not in (None, "") for value in row):
            rows.append(row)
            if len(rows) >= limit:
                break
    return rows


def inspect(path: Path) -> dict[str, Any]:
    workbook = load_workbook(path, read_only=True, data_only=True, keep_vba=path.suffix.lower() == ".xlsm")
    sheets = []
    for sheet in workbook.worksheets:
        sheets.append(
            {
                "name": sheet.title,
                "max_row": sheet.max_row,
                "max_column": sheet.max_column,
                "sample": nonempty_rows(sheet),
            }
        )
    workbook.close()
    return {"file": str(path), "sheets": sheets}


def main() -> None:
    payload = [inspect(Path(argument)) for argument in sys.argv[1:]]
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
