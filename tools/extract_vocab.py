import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(".vendor").resolve()))

import pymupdf


PDF_PATH = Path(r"C:\Users\bazz1\Downloads\Telegram Desktop\memmoread-oxford-3000-pdf.pdf")
OUT_PATH = Path("data/vocab.js")

# 1-based PDF pages. The PDF contains Oxford 3000 levels A1-B2.
LEVEL_PAGES = {
    "A1": (6, 22),
    "A2": (24, 40),
    "B1": (42, 58),
    "B2": (60, 73),
}

POS_TOKEN_RE = re.compile(r"^[A-Za-z().,/]+$")
THAI_PUA_MAP = str.maketrans(
    {
        "\uf701": "ิ",
        "\uf702": "ี",
        "\uf704": "ื",
        "\uf705": "่",
        "\uf706": "้",
        "\uf70a": "่",
        "\uf70b": "้",
        "\uf70c": "๊",
        "\uf70e": "์",
        "\uf710": "ั",
        "\uf712": "็",
        "\uf714": "้",
        "\uf718": "",
    }
)


def normalize_space(value):
    value = value.translate(THAI_PUA_MAP)
    value = unicodedata.normalize("NFC", value)
    return re.sub(r"\s+", " ", value).strip()


def block_text(tokens):
    return normalize_space(" ".join(token[4] for token in sorted(tokens, key=lambda t: t[0])))


def is_pos_text(text):
    return bool(text) and all(POS_TOKEN_RE.match(part) for part in text.split())


def parse_page(page, level):
    rows = cluster_rows(page.get_text("words"))
    entries = []

    for row in rows:
        word = block_text([t for t in row if t[0] < 145])
        pos = block_text([t for t in row if 145 <= t[0] < 235 and is_pos_text(t[4])])
        meaning = block_text([t for t in row if 235 <= t[0] < 335])
        if not word or not pos or not meaning:
            continue
        if word.lower().startswith("vocab"):
            continue
        entries.append(
            {
                "word": word,
                "pos": normalize_pos(pos),
                "meaning": meaning,
                "level": level,
            }
        )

    return entries


def token_center_y(token):
    return (token[1] + token[3]) / 2


def cluster_rows(tokens):
    rows = []
    for token in sorted(tokens, key=lambda t: token_center_y(t)):
        y = token_center_y(token)
        for row in rows:
            if abs(row["y"] - y) <= 4:
                row["tokens"].append(token)
                row["y"] = (row["y"] * (len(row["tokens"]) - 1) + y) / len(row["tokens"])
                break
        else:
            rows.append({"y": y, "tokens": [token]})
    return [row["tokens"] for row in rows]


def normalize_pos(pos):
    pos = normalize_space(pos)
    pos = pos.replace(",", "")
    fixes = {
        "n v.": "n. v.",
        "adj v.": "adj. v.",
        "adv prep.": "adv. prep.",
        "prep adv.": "prep. adv.",
        "det pron.": "det. pron.",
        "exclam n.": "exclam. n.",
    }
    return fixes.get(pos, pos)


def main():
    doc = pymupdf.open(str(PDF_PATH))
    entries = []
    seen = set()

    for level, (start_page, end_page) in LEVEL_PAGES.items():
        for page_number in range(start_page, end_page + 1):
            for entry in parse_page(doc[page_number - 1], level):
                key = (entry["word"].casefold(), entry["level"])
                if key in seen:
                    continue
                seen.add(key)
                entries.append(entry)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    OUT_PATH.write_text("window.VOCAB_DATA = " + payload + ";\n", encoding="utf-8")

    by_level = {}
    for entry in entries:
        by_level[entry["level"]] = by_level.get(entry["level"], 0) + 1

    print(f"Wrote {len(entries)} entries to {OUT_PATH}")
    print(by_level)
    print(entries[:10])


if __name__ == "__main__":
    main()
