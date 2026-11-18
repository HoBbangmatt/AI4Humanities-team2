# George Eliot Archive Parallel Timeline

## Run on your computer
Extract the ZIP. Open the Parallel_Timeline folder in VS Code. Open Terminal > New Terminal and run:

```powershell
py -m http.server 8000
```

Open http://localhost:8000. If Python uses the `python` command on your computer, use `python -m http.server 8000`. Keep the terminal open. Press Ctrl+C to stop. If port 8000 is busy, use 8001 and open http://localhost:8001. Do not double-click the HTML files: the JSON data needs a web server.

## Use the timeline
The search box filters names, titles, chronology descriptions, reading descriptions, references, and original dates. It does not search full letter text in this package. Clear the search to show all records again. Use From and To, then Apply dates to select a period. The track checkboxes show or hide Life Events, Reading, and Letters.

Earlier and Later move the visible period. Zoom in and Zoom out change its size. Reset view returns to the full date range while keeping your search and track selections. Reset beside Apply dates clears the search, restores all tracks, clears the selected record, and returns to the full date range. You can also drag the chart to pan and use its zoom gesture.

At a wide date range, bars count records by year or month. Taller bars mean more records; each track has its own scale, so bar heights should not be compared across tracks. Click a bar to look closer. At a close date range, dots show records. Their vertical positions only help separate them. Extended outlined marks show partial or ranged dates, not necessarily the duration of an event. Click a record to show its details and source links. Source links open a new tab or window. Events happening near each other are not proof of a relationship.

Six records have no usable date and are counted as unplaced rather than plotted. Life-event source links are candidates from the older dataset and require review; this package does not redo the calendar's newer matching process.

## Put it on GitHub Pages and Omeka
Upload the whole Parallel_Timeline folder, including data and vendor, into your repository. For HoBbangmatt/AI4Humanities-team2 with Pages already publishing main and /(root), open:

https://hobbangmatt.github.io/AI4Humanities-team2/Parallel_Timeline/index.html

This address assumes the folder name is exactly Parallel_Timeline. If you rename it, change the URL too. Wait for the GitHub Pages deployment to finish and check the timeline loads.

index.html is a small iframe wrapper. timeline.html is the actual visualization. To avoid two nested frames in Omeka, embed timeline.html directly. In the Omeka Simple Pages editor, turn off the visual HTML editor and paste:

```html
<iframe
  src="https://hobbangmatt.github.io/AI4Humanities-team2/Parallel_Timeline/timeline.html"
  title="George Eliot Archive Parallel Timeline"
  width="100%"
  height="1000"
  style="display:block;width:100%;border:0;">
</iframe>
```

Keep your test page unpublished while reviewing it. Save and view it while signed in. Test search, navigation, and source links. If the iframe disappears after saving, ask the Omeka administrator to check whether iframe elements and their attributes are allowed. The visualization files are uploaded to GitHub; only the iframe code goes into Omeka. Localhost URLs do not work for other visitors.

## How it is made
This is a static HTML, CSS, and JavaScript application. It does not need Django, a database, npm, or a build step. D3 version 7 is bundled locally, so the chart does not download a library from another website. Archive links need an internet connection.

index.html provides the iframe preview. timeline.html contains the title, controls, chart area, and details panel. styles.css gives the page its simple layout and responsive design. timeline.js loads data/timeline.json, filters records, draws the three tracks with a shared UTC time axis, and handles navigation and details. vendor/d3.v7.min.js supplies D3, and vendor/LICENSE-d3.txt keeps its required license. .nojekyll tells GitHub Pages to serve the static files directly.

The JSON has a meta object and a records array. Each record includes id, track, title, description, creator, reference, links, start, end, precision, uncertain, and original_date. Dates used for plotting are YYYY-MM-DD, or null when unavailable. Each link includes a label and URL. Some reading records also include publication_date and date_note. Keep this structure when replacing data. Upload the changed JSON to the same path to update the hosted timeline.

The dataset contains 7,659 occurrences: 2,506 life events, 3,987 letters, and 1,166 reading occurrences from 923 source rows. Full letter transcriptions have been removed from this upload package; letter titles, dates, references, and archive links remain. Original source CSVs, spreadsheets, matching scripts, temporary files, and test files are not required to run this visualization and are excluded. This README is the only user guide; the D3 license is included separately as required.

## Milestone 4: Explore by Work
Search and Explore by Work share one control card. Choose Scenes of Clerical Life, Adam Bede, The Mill on the Floss, Silas Marner, Romola, Felix Holt, Middlemarch, or Daniel Deronda. The filter applies to all three tracks and combines with the search box and track checkboxes. Selection centres the chart on publication years with one year of padding on each side. Mentions outside the initial view are retained: pan, zoom out, or use Reset view to see them. The summary counts all matching records, including those outside the visible dates; it separately reports how many overlap the visible period.

Include same-period records adds non-mentioning records whose normalized start year is within the selected work's writing-to-publication window. The windows from the milestone report are Scenes 1856–1858, Adam Bede 1857–1859, Mill 1859–1860, Silas Marner 1860–1861, Romola 1861–1863, Felix Holt 1865–1866, Middlemarch 1869–1872, and Daniel Deronda 1874–1876. Mentions and additional same-period records have separate counts per track. Selecting a record displays either a Mentions label with matched terms or a Same period label explicitly stating that it does not mention the work. A record is never counted in both categories for the selected work. Unknown dates cannot qualify by period. For date ranges, the start year controls this rule.

All works removes the work filter and same-period extension and restores the full date range, keeping your text search and track selections. Reset clears everything, including the work choice. Reset view changes dates only. A date match only provides historical context and does not prove a connection to the work.

Work mentions were computed offline from the available original letter texts and metadata, chronology descriptions, and reading titles, creators, and descriptions. Matching ignores letter case, normalizes whitespace and apostrophes, and uses title phrase boundaries. Scenes also matches Amos Barton, Mr. Gilfil's Love Story (with or without the period after Mr), and Janet's Repentance. Only work IDs, matched title terms, and the matching basis are saved; full letter texts are not distributed. Ordinary search still searches the distributed metadata and descriptions, not letter bodies. The JSON works array records titles, terms, publication years, and period windows. Records contain work_mentions, work_match_terms, and work_match_basis. Recompute these offline if the underlying source texts change; changing displayed metadata alone does not recompute mentions.

This implements the report's features on this package's 7,659 occurrences. The PDF describes a different 4,403-record selection (including 976 letters), so its exact totals and its 961 Complete-letter link substitutions do not apply to this package. Existing source URLs are preserved, not rematched. The code does not claim to reproduce those report results.

## Complete CSV export
The data folder also contains Parallel_Timeline_Data_Points.csv with every one of the 7,659 occurrences, including six unplaced records. Open it in Excel to inspect track, top/middle/bottom placement, dates, date precision, title, creator, description, references, every available URL, mentioned works, exact matched title terms, matching basis, and qualifying same-period works that are not mentioned. Multiple links use numbered URL columns with corresponding labels and notes. Blank dates and URLs remain blank rather than being invented. A reading item may produce multiple dated occurrences, each with a separate data-point ID.

The visualization reads timeline.json. The CSV is a complete review export, not a second runtime input: editing it alone will not update the chart. Keep the CSV synchronized when replacing the JSON. The package contains only the runtime files, JSON, this CSV export, this README, and the required D3 license. The iframe URLs and GitHub/Omeka setup above remain the same.

## Background and outline
The timeline uses a light lavender outer background and a bordered lavender panel to separate it from the surrounding Omeka page. The chart remains white for readability. These colors are defined at the end of styles.css. This styling is inside the iframe, so no Omeka theme changes are needed.

## Semantic similarity pilot
The Suggested connections: 1869 pilot panel imports the supplied M4_Semantic_Similarity_Pilot_by-ChatGPT.xlsx workbook. Choose one of the 18 life events and click View event and suggestions. This clears search, work, and track filters, zooms to a period around the event, and opens its details. Scroll inside Record Details to inspect its five candidates. Clicking the same event on the chart also shows its suggestions.

Each candidate displays its workbook rank, collection, date, title, LSA cosine, TF-IDF cosine, review status, caution, and archive link. All 90 recommendations are unreviewed. LSA and TF-IDF scores are not probabilities and are not directly interchangeable. A shared date or quotation can inflate similarity. These suggestions remain separate from confirmed citations, work mentions, and same-period inclusion. Candidate dates can differ from the event date: this is exploratory similarity, not date-based source verification.

All Recommendations is the authoritative imported sheet. Middlemarch Focus is not imported again, avoiding duplicate suggestions. Each parent event was matched to the existing timeline by exact date and normalized event description; all 18 mapped uniquely. Candidate URLs and scores are preserved from the workbook without claiming historical validation. No new timeline events or letters were invented or added.

The original pilot used 42 source records (18 chronology, 13 reading, 11 letters), TF-IDF unigrams/bigrams with English stop words, truncated SVD with 20 components, and cosine similarity. These scores were computed for that small corpus, not the complete 7,659-record timeline. The workbook names M4_Semantic_Pilot_Run.py and M4_Pilot_Combined_1869_Aug_Sep.csv for reproduction; those inputs were not supplied with this workbook. This package displays the supplied results and does not recompute embeddings or similarity scores.

The 90 original rows plus Timeline_Event_ID are exported in data/Semantic_Pilot_Recommendations.csv. The complete point CSV now includes Semantic_Candidate_Count. Runtime suggestions live in each parent record's semantic_candidates array in timeline.json; editing the CSV alone does not update the visualization. Update the JSON and both CSV exports together to keep them consistent. New pilot events with a nonempty semantic_candidates array automatically appear in the selector. Review original sources before changing Manual_Review, and document the evidence and reviewer judgment. The workbook itself and private source texts are excluded from the runtime ZIP.

## Horizontal date scrollbar
A horizontal scrollbar below the chart moves the visible date range without changing its duration or filters. Zoom in first: the full-range view already shows every date and has no additional dates to scroll to. Drag the scrollbar, use a horizontal trackpad gesture, or focus it with Tab and use the arrow keys. The scrollbar stays synchronized with date filters, zoom, work selections, pilot selections, and Earlier/Later controls. Its thumb represents the visible fraction of the full date range. Browsers or operating systems that hide scrollbars may show the thumb only while scrolling.
