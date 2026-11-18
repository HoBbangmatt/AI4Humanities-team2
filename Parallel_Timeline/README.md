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
