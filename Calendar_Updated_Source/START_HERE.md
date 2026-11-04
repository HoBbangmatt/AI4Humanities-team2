For GitHub Pages and Omeka iframe setup, read IFRAME_SETUP.md first.

# Calendar with letter titles and separate Cross links

## Run
Extract into a fresh folder. Open Calendar_Updated_Source in VS Code and run:

    py start_server.py

Open http://localhost:8001. The calendar has no yellow build banner. Linked citations display the actual letter title.
Stop an older server on 8001 with Ctrl+C before starting. Press Ctrl+F5 after updating.
Internet access is required for the original jQuery/D3 libraries and archive pages.

## What changed
Matched Letters and Cross citations now display the actual letter title instead of the volume/page number. The original citation and date remain available in the link tooltip. Original event text is preserved in the CSV.

Letters references open the Complete Letters record's Item URI. Cross references open the Cross record's own Item URI, with (Cross) after its title. If both references appear and both pass matching, both titles appear as separate links. Multiple references within one family additionally require a supporting identifier to avoid assigning the same event-level match to every citation.

Unmatched references stay plain text because the data does not establish a reliable destination or title. No placeholder archive URL is invented. Events without citations may still have a supported complete-letter title displayed after the event.

## Date and content requirements
All 2,506 events are processed. Candidates must have exactly the event's ISO date. The code then checks an exact normalized quotation of at least six words, or the recipient name plus substantial content overlap. It accepts only a unique supported candidate for the requested source.

The Cross workbook contains titles and URLs but no letter body. Its Verified, Verified with note or Firm match record must point to exactly one complete-letter record with the same date. That linked record supplies content evidence, while the URL and title displayed come from Cross. A conflicting or missing edition mapping remains unlinked. This relies on the team's reviewed mapping and is not independent verification of Cross's remote letter text.

For example, the workbook maps Cross item 622 (1839-03-16) to Complete Letters item 92914 (1839-09-04). This date conflict is rejected. The program does not substitute a complete-letter URL under a Cross title.

Stuart source data is retained for reference and is not added to results in this update.

## Current output
247 events have links. There are 172 complete-letter link placements, including event-level links, and 99 Cross citation links. 23 events show both editions. These are coverage counts, not accuracy percentages or unique-letter counts.

match_audit.csv lists the candidate edition, displayed title, destination URL, content-source URL and match evidence. removed_links.csv lists supplied URLs that were not accepted as destinations for the requested edition. data_report.json summarizes the run.

Example to check: 1853-08-09 / Letters 2:113 displays “GE to Charles Bray, St. Leonard's, 9 August [1853]” from the complete-letter metadata. The event itself says Cara Bray; that metadata discrepancy remains for scholarly review. The code uses the supplied archive title without changing it.

Example with both editions: 1846-02-14 displays the Complete Letters title for item 95555 and the Cross title for item 685 as separate links.

## Rebuild
Update source_data/Chronology_with_Cross_URI_updated.csv, source_data/Complete_Letters_Matched.csv and the Cross workbook, retaining their filenames and columns. Run:

    py build_citation_data.py

The script rebuilds data.csv and Events_date_weekday.csv identically. SourceLinks stores citation-specific title/URL objects. RowSourceLinks stores supported event-level links. Both include letterDate and eventDate, which the browser checks before rendering.

## Modified files
build_citation_data.py matches the two editions separately.
citation-links.js displays titles and the Cross edition label.
index.html, calendermap.js and start_server.py identify the current version and avoid stale cached resources.
data.csv and Events_date_weekday.csv contain the rebuilt mappings.
ADDITIONS.diff compares changed code with the original uploaded versions.

## Verification
Run `py -m unittest test_data.py` and `node test-citations.cjs`.
11 Python tests passed, including source-specific URLs, all output dates/content/title checks, preserved events, conflicting Cross dates and both-edition output. JavaScript tests passed for title rendering, two distinct edition links, popup behavior, unsafe URLs and the browser date guard. Full browser visual testing and exhaustive live destination checks were not performed.
