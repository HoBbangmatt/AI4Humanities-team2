import argparse
import csv
import re
from pathlib import Path


# A citation may include more than one reference, for example:
# ``(Letters 1:13, 2:14)``.  Match that complete citation first, then extract
# each individual volume:page reference from it.
# Added: support shared-volume pages, comma followed by 'and', and em dashes.
CITATION_PATTERN = re.compile(
    r"""
    \b(?P<source>Letters|Cross)\s+
    (?P<references>
        \d+\s*:\s*\d+(?:\s*[-–—]\s*\d+)?
        (?:\s*(?:[,;]\s*(?:and\b\s*)?|\band\b\s*)
            (?:\d+\s*:\s*)?\d+(?:\s*[-–—]\s*\d+)?)*
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
# Added: capture the volume separately so a following page can reuse it.
REFERENCE_PATTERN = re.compile(
    r"(?:(?P<volume>\d+)\s*:\s*)?(?P<page>\d+(?:\s*[-–—]\s*\d+)?)"
)
# Keep citation-like references which cannot be handled by ``CITATION_PATTERN``
# for manual review.  These include Roman-numeral volumes, a comma in place of
# the volume/page colon, and the parenthetical format ``Letters 6 (2, 311)``.
OUTLIER_PATTERN = re.compile(
    r"""
    \b(?:Letters|Cross)\s+
    (?:
        [IVXLCDM]+\s*(?::\s*\d+(?:\s*[-–]\s*\d+)?|,\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)* )
        | \d+\s*,\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*
        | \d+\s*\(\s*\d+\s*,\s*\d+\s*\)
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
# Added: correct the output header and recognize the original misspelled header.
IDENTIFIER_COLUMN = "Dublin Core Identifier"
LEGACY_IDENTIFIER_COLUMN = "Dublin Core Identitifier"
CROSS_IDENTIFIER_COLUMN = "Dublin Core Cross Identifier"
OUTLIER_COLUMN = "Outlier"


# Added: detect suspicious text left immediately after a partial citation match.
def needs_review(event: str, citation: re.Match) -> bool:
    tail = event[citation.end():]
    return bool(
        re.match(r"^[\w:–—-]", tail)
        or re.match(r"^\s*[-–—:]", tail)
        or re.match(
            r"^\s*(?:[,;]\s*(?:and\b\s*)?|\band\b\s*)"
            r"(?:\d|[IVXLCDM]+\b|\(|notes?\b)",
            tail,
            re.IGNORECASE,
        )
        or re.match(r"^\s*(?:\(\s*)?notes?\b", tail, re.IGNORECASE)
    )


def extract_references(event: str) -> tuple[list[str], list[str]]:
    """Return all Letters and Cross references in the order they appear."""
    letters: list[str] = []
    cross: list[str] = []

    for citation in CITATION_PATTERN.finditer(event):
        # Added: leave uncertain citations for manual review instead of using a partial match.
        if needs_review(event, citation):
            continue

        # Added: reuse the latest volume for shorthand such as Letters 1:13, 14.
        references = []
        volume = None
        for reference in REFERENCE_PATTERN.finditer(citation.group("references")):
            volume = reference.group("volume") or volume
            page = re.sub(r"\s+", "", reference.group("page"))
            # Added: standardize range punctuation without expanding page ranges.
            page = page.replace("–", "-").replace("—", "-")
            references.append(f"{volume}:{page}")

        if citation.group("source").lower() == "letters":
            letters.extend(references)
        else:
            cross.extend(references)

    return letters, cross


def extract_outliers(event: str) -> list[str]:
    """Return citation-like Letters/Cross references not handled by the parser."""
    # Added: retain the original outlier matches before checking partial citations.
    outliers = [
        re.sub(r"\s+", " ", match.group(0)).strip()
        for match in OUTLIER_PATTERN.finditer(event)
    ]
    # Added: include the event text so editors can inspect an uncertain citation in context.
    if any(needs_review(event, citation) for citation in CITATION_PATTERN.finditer(event)):
        outliers.append("Review partial citation: " + re.sub(r"\s+", " ", event).strip())

    # Added: flag citation-like starts that neither of the original patterns recognizes.
    known_starts = {
        match.start()
        for pattern in (CITATION_PATTERN, OUTLIER_PATTERN)
        for match in pattern.finditer(event)
    }
    for match in re.finditer(
        r"\b(?:Letters|Cross)\s+(?=\d|[IVXLCDM]+\b|vol(?:ume)?\b|\()",
        event,
        re.IGNORECASE,
    ):
        if match.start() not in known_starts:
            outliers.append("Review citation format: " + re.sub(r"\s+", " ", event).strip())

    # Added: avoid repeating identical review entries while preserving their order.
    return list(dict.fromkeys(outliers))


def add_identifier_column(input_path: Path, output_path: Path) -> None:
    # Added: prevent overwriting the source, including symbolic links and hard links.
    if input_path.resolve() == output_path.resolve() or (
        output_path.exists() and input_path.samefile(output_path)
    ):
        raise ValueError("Input and output must be different files.")

    with input_path.open("r", newline="", encoding="utf-8-sig") as input_file:
        reader = csv.DictReader(input_file)
        if reader.fieldnames is None:
            raise ValueError("The input CSV does not contain a header row.")

        # Added: reject missing or duplicate headers before creating the output file.
        if "Event" not in reader.fieldnames:
            raise ValueError("The input CSV must contain a column named 'Event'.")
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("The input CSV contains duplicate column names.")

        fieldnames = [
            fieldname
            for fieldname in reader.fieldnames
            if fieldname
            # Added: replace the legacy misspelled column when regenerating identifiers.
            not in {IDENTIFIER_COLUMN, LEGACY_IDENTIFIER_COLUMN, CROSS_IDENTIFIER_COLUMN, OUTLIER_COLUMN}
        ]
        fieldnames.extend([IDENTIFIER_COLUMN, CROSS_IDENTIFIER_COLUMN, OUTLIER_COLUMN])

        # Added: keep 'w' for a separate complete output; append mode would duplicate CSV rows.
        with output_path.open("w", newline="", encoding="utf-8") as output_file:
            writer = csv.DictWriter(output_file, fieldnames=fieldnames)
            writer.writeheader()

            for row in reader:
                # Added: reject malformed rows instead of silently losing source fields.
                if None in row or any(value is None for value in row.values()):
                    raise ValueError(f"Incorrect number of fields near CSV line {reader.line_num}.")
                # Added: remove the old spelling before writing the corrected output header.
                row.pop(LEGACY_IDENTIFIER_COLUMN, None)
                event = row.get("Event", "") or ""
                letters, cross = extract_references(event)
                row[IDENTIFIER_COLUMN] = "\n".join(letters)
                row[CROSS_IDENTIFIER_COLUMN] = "\n".join(cross)
                row[OUTLIER_COLUMN] = "\n".join(extract_outliers(event))
                writer.writerow(row)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Add Dublin Core identifiers found in the Event column to a CSV."
    )
    parser.add_argument("input_csv", type=Path, help="Path to the source CSV")
    parser.add_argument("output_csv", type=Path, help="Path for the updated CSV")
    args = parser.parse_args()

    add_identifier_column(args.input_csv, args.output_csv)


if __name__ == "__main__":
    main()
