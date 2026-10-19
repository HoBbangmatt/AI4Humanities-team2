import difflib
import re
import unicodedata
import pandas as pd

# ---------------------------------------------------------
# Helper Cleaning Functions
# ---------------------------------------------------------


def clean_text_field(val):
    """Strip ^^F, ^^M, ^^U annotations, whitespace, and bracket artifacts."""
    if pd.isna(val):
        return ""
    text = str(val)
    # Remove markers like ^^F, ^^M, ^^U, ^^F,M
    text = re.sub(r"\^\^[A-Za-z,]+", "", text)
    # Remove brackets
    text = re.sub(r"[\[\]]", "", text)
    # Normalize unicode accents
    text = (
        unicodedata.normalize("NFKD", text)
        .encode("ASCII", "ignore")
        .decode("utf-8")
    )
    return text.strip()


def normalize_creator(name):
    """Normalize aliases like GE / George Eliot."""
    cleaned = clean_text_field(name)
    lower = cleaned.lower()
    if lower in ["ge", "george eliot", "george eliot "]:
        return "george eliot"
    if lower in ["ghl", "george henry lewes"]:
        return "george henry lewes"
    return lower


def extract_normalized_date(date_val):
    """Extract standard YYYY-MM-DD or partial YYYY-MM from date strings,"""
    # ignoring surrounding brackets or annotations.
    if pd.isna(date_val):
        return ""
    s = str(date_val).strip()
    s = re.sub(r"[\[\]\?]", "", s).strip()
    match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", s)
    if match:
        return match.group(1)
    match_ym = re.search(r"\b(\d{4}-\d{2})\b", s)
    if match_ym:
        return match_ym.group(1)
    return s


def clean_identifier(identifier_val):
    """Extract clean identifier from Column P (Dublin Core:Identifier)."""
    if pd.isna(identifier_val):
        return ""
    val_str = str(identifier_val).strip()
    m = re.search(r"(\d+:\d+(?:-\d+)?)", val_str)
    if m:
        return m.group(1)
    return val_str.split("\n")[0].split("^")[0].strip()


def fuzzy_name_match(name1, name2, threshold=0.55):
    """Fuzzy comparison between recipients (Subject field).

    Handles variations like 'Cara Hennell Bray' vs 'Caroline [Mrs. Charles] Bray'.
    """
    if not name1 or not name2:
        return False

    n1 = clean_text_field(name1).lower()
    n2 = clean_text_field(name2).lower()

    if n1 == n2 or n1 in n2 or n2 in n1:
        return True

    titles = {
        "mr",
        "mrs",
        "miss",
        "ms",
        "sir",
        "lady",
        "dr",
        "rev",
        "revd",
        "messrs",
    }
    tokens1 = {t for t in re.split(r"\W+", n1) if t and t not in titles}
    tokens2 = {t for t in re.split(r"\W+", n2) if t and t not in titles}

    if tokens1 and tokens2:
        common = tokens1.intersection(tokens2)
        if common and (
            len(common) / min(len(tokens1), len(tokens2)) >= 0.5
            or any(len(t) > 4 for t in common)
        ):
            return True

    ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
    return ratio >= threshold


# ---------------------------------------------------------
# Main Execution Pipeline
# ---------------------------------------------------------


def match_and_update_datasets(
    cross_csv_path="CrossLetters-add_ref_to_Complete_Letters (1).csv",
    complete_csv_path="Complete_Letters_Dataset(see_column_P).csv",
    output_cross_path="CrossLetters_Matched.csv",
    output_complete_path="Complete_Letters_Matched.csv",
):
    print("Loading datasets...")
    df_cross = pd.read_csv(cross_csv_path)
    df_comp = pd.read_csv(complete_csv_path)

    # 1. Preprocess Complete Letters
    print("Pre-processing Complete Letters...")
    df_comp_clean = df_comp.copy()
    df_comp_clean["clean_creator"] = df_comp_clean["Dublin Core:Creator"].apply(
        normalize_creator
    )
    df_comp_clean["clean_subject"] = df_comp_clean["Dublin Core:Subject"].apply(
        clean_text_field
    )
    df_comp_clean["clean_date"] = df_comp_clean["Dublin Core:Date"].apply(
        extract_normalized_date
    )
    df_comp_clean["clean_identifier"] = df_comp_clean[
        "Dublin Core:Identifier"
    ].apply(clean_identifier)

    # 2. Preprocess Cross Letters
    print("Pre-processing Cross Letters...")
    df_cross_clean = df_cross.copy()
    df_cross_clean["clean_creator"] = df_cross_clean[
        "Dublin Core:Creator"
    ].apply(normalize_creator)
    df_cross_clean["clean_subject"] = df_cross_clean[
        "Dublin Core:Subject"
    ].apply(clean_text_field)
    df_cross_clean["clean_date"] = df_cross_clean["Dublin Core:Date"].apply(
        extract_normalized_date
    )

    # Index complete letters by clean_date for fast lookups
    date_to_comp = {}
    for idx, row in df_comp_clean.iterrows():
        d = row["clean_date"]
        if d:
            date_to_comp.setdefault(d, []).append(idx)

    # Tracking structures for both sides
    cross_match_found = []
    cross_complete_ids = []

    comp_cross_relation = ["" for _ in range(len(df_comp))]
    comp_match_found = [False for _ in range(len(df_comp))]

    print("Matching Cross Letters <-> Complete Letters...")
    for x_idx, cross_row in df_cross_clean.iterrows():
        cross_date = cross_row["clean_date"]
        cross_creator = cross_row["clean_creator"]
        cross_subject = cross_row["clean_subject"]

        matched = False
        matched_id = ""

        candidate_indices = date_to_comp.get(cross_date, [])

        for c_idx in candidate_indices:
            cand_comp = df_comp_clean.iloc[c_idx]
            cand_creator = cand_comp["clean_creator"]

            creator_matches = (
                (not cross_creator)
                or (not cand_creator)
                or (cross_creator == cand_creator)
                or (cross_creator in cand_creator)
                or (cand_creator in cross_creator)
            )

            if not creator_matches:
                continue

            if fuzzy_name_match(cross_subject, cand_comp["clean_subject"]):
                matched = True
                matched_id = cand_comp["clean_identifier"]

                # Populate Complete Letters side with Cross relation
                comp_match_found[c_idx] = True
                cross_rel = cross_row.get("Dublin Core:Relation")
                if pd.notna(cross_rel):
                    comp_cross_relation[c_idx] = str(cross_rel).strip()
                break

        cross_match_found.append(matched)
        cross_complete_ids.append(matched_id)

    # 3. Export new Cross Letters dataset
    df_cross_out = df_cross.copy()
    df_cross_out["Match_Found"] = cross_match_found
    df_cross_out["Complete_Identifier"] = cross_complete_ids
    df_cross_out.to_csv(output_cross_path, index=False)

    # 4. Export new Complete Letters dataset
    df_comp_out = df_comp.copy()
    df_comp_out["Match_Found"] = comp_match_found
    df_comp_out["Cross_Relation"] = comp_cross_relation
    df_comp_out.to_csv(output_complete_path, index=False)

    print("\nProcessing complete!")
    print(
        f"Cross Letters matched: {sum(cross_match_found)} / {len(df_cross_out)}"
    )
    print(
        f"Complete Letters matched: {sum(comp_match_found)} / {len(df_comp_out)}"
    )
    print(f"Generated file 1: {output_cross_path}")
    print(f"Generated file 2: {output_complete_path}")


if __name__ == "__main__":
    match_and_update_datasets()