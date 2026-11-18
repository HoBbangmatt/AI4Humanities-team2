# George Eliot Archive Chronology Calendar

## Run locally
Extract the ZIP and open the Calendar_Updated_Source folder in VS Code. Open a terminal in that folder and run:

```powershell
py -m http.server 8000
```

Open http://localhost:8000. Keep the terminal open and press Ctrl+C to stop. If that port is in use, run `py -m http.server 8001` and visit http://localhost:8001. On systems without the `py` command, use `python` or `python3`. Do not double-click the HTML file because the CSV files need to load through a web server. Internet access is required for the existing jQuery and D3 CDN scripts and external archive links.

## Use the calendar
Each row shows a year, from 1818 through 1880. Each square represents a day, arranged by weekday and week, with month outlines. Colored dates identify chronology entries. Hover over a date for its tooltip or click a colored date to show its entries in the results panel. Type words in the search box and click Search. All entered words must occur in an event description, ignoring letter case. Search recolors matching dates and lists matching entries. Clear the box and click Search to match all event descriptions; refresh the page to return to the initial display.

When a matched source is available, its letter title is clickable. A Cross source is labelled with a Cross suffix. An entry with both supported sources can show both links. The link opens an archive window or tab; browser settings determine popup behavior. Unmatched references remain plain text. Source links depend on the archive remaining available. The presence of a link is not a guarantee that its historical interpretation is correct.

## GitHub and Omeka
Upload the extracted Calendar_Updated_Source folder and all files inside it to the root of your GitHub repository. Upload the files rather than the ZIP. With HoBbangmatt/AI4Humanities-team2 publishing from main and /(root), the preview address is:

https://hobbangmatt.github.io/AI4Humanities-team2/Calendar_Updated_Source/index.html

index.html is the original calendar page. Omeka displays it inside an iframe. Paste the following into the Omeka Simple Pages Text field with the visual HTML editor turned off:

```html
<iframe
  src="https://hobbangmatt.github.io/AI4Humanities-team2/Calendar_Updated_Source/index.html"
  title="George Eliot Archive Chronology Calendar"
  width="100%"
  height="900"
  style="display:block;width:100%;border:0;">
</iframe>
```

If you use a different repository or folder name, change the URL accordingly. Keep your test page unpublished while reviewing. Save and preview while signed in. Check search, dates, and source links. If the iframe is removed after saving, ask the administrator to check allowed HTML elements and attributes. Updating the GitHub files updates the embedded visualization after deployment. Refresh with Ctrl+Shift+R if old styles remain cached.

## How it is made
This is a static HTML, CSS, and JavaScript visualization. It does not require Django, a database, npm, or a build step. index.html contains the original controls, results panel, colors, and chart container. Its original code and layout are unchanged. bootstrap.css and bootstrap.min.js retain the original styling and tooltip support. jQuery 1.10.2 and D3 3.5.5 load over HTTPS from their existing CDN addresses.

calendermap.js draws the calendar with D3, reads the CSV files, filters event descriptions, and updates colors. citation-links.js reads prepared citation mappings, creates source-title links, and displays entries in the results panel. citation-config.js controls window behavior and enforces matching event and letter dates. Demo mode is off and must stay off in this package; demo pages are not included. LICENSE.txt preserves the source project's license.

## Data and updates
The package contains 2,506 chronology rows. data.csv is used for the initial calendar, and Events_date_weekday.csv is used for search. Both files are required by the existing code and contain the same prepared dataset. They include dates, event descriptions, and the prepared SourceLinks and RowSourceLinks fields. These link fields contain structured JSON with URLs, titles, source type, and matching date metadata. Do not replace them with plain URL text. The link helper checks the stored event and letter dates before displaying a link.

Update both CSV files together using the same column names and UTF-8 encoding. Keep dates in YYYY-MM-DD format and preserve valid JSON inside the link fields. The visualizer reads prepared links; it does not perform date/content matching itself. Matching and cleaning scripts, original workbooks, full letter source datasets, audit reports, demos, and test files are intentionally excluded from this runtime package. Keep those separately if you need to prepare new data. This cleanup does not recalculate or reverify the existing matches.

Only the runtime files, two required CSVs, one README, and the source license are included. The calendar retains the previous colors, layout, search, tooltips, and citation logic. All runtime files and both CSVs are byte-for-byte copies of the previous source package; only this README and the package contents have changed. Code and file-reference checks were performed; test the hosted page in your browser before publishing it publicly.
