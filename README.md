# Developer Notes

This README documents the code included in the current development report. The descriptions focus on implementation and current development status. Some features are prototypes and have not completed final data integration or testing.

## `verify_cross_letters.py` — Data Matching and Validation

Python is used to assist with matching records across two related CSV datasets. The script uses Pandas, regular expressions, Unicode normalization, and string-similarity comparisons to standardize dates, creator names, recipient information, and identifiers. This preprocessing helps address differences in metadata formatting while retaining the original source columns in the exported files.

The matching process identifies candidate records with matching normalized dates, checks creator information, and compares recipient names using fuzzy matching. This comparison accounts for variations in names, abbreviations, and titles. The script records matching results in separate output CSV files, including fields such as `Match_Found`, `Complete_Identifier`, and `Cross_Relation`. The initial automated results require manual verification, especially for unmatched, ambiguous, or potentially incorrect matches; the script does not independently establish the historical accuracy of every suggested match.

## `calendermap.js` — Existing Visualization Improvements

Development of the existing chronology visualization includes a prototype feature that adds clickable links to related letter records in the search results. Previously, search results displayed event information as plain text and did not provide direct access to the corresponding source records.

The prototype allows a user to select a letter link from the search results and open its associated record in a separate browser tab or window. This behavior was demonstrated during prototype testing. However, final integration with the updated and verified dataset, together with testing of the resulting links, remains incomplete. 

## `timeline.js` — Multi-Stream Parallel Timeline Prototype

JavaScript and D3.js are being used to implement selected features of a multi-stream parallel timeline prototype. The code is designed to load structured JSON records for three types of information—life events, reading, and letters—and place them on a shared UTC time scale in synchronized tracks.

The visualization code uses D3.js to draw the timeline and support navigation through different date ranges. For wider time spans, records are grouped into monthly or yearly intervals and represented by density bars to reduce visual clutter. For narrower time spans, the code displays individual events as points or date-range markers. A shared application state coordinates updates to the timeline, overview, and record list when the selected range changes.

The source also includes functions for searching, filtering tracks, selecting records, and displaying detailed information with links to source records. Date precision and uncertainty indicators are included in the detail display to distinguish exact dates from estimated or incomplete dates. These functions represent initial implementation work, not a completed or fully validated prototype. Further integration, testing, and refinement remain necessary.

## Development Status

The data-matching script and visualization code represent work completed or started during the current development cycle. The clickable-link enhancement is at the prototype stage and still needs integration with the verified dataset. Development of the multi-stream timeline has begun, but only selected features have been implemented; the overall visualization is not complete. Additional testing and review are planned before final deployment.

**Publication note:** Before committing source files or sample data to a public repository, confirm that filenames, comments, links, embedded metadata, and datasets are approved for public release.
