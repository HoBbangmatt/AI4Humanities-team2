// ADDED: demo mode is OFF now that real archive links are in data.csv (SourceLinks column).
// Set true only for testing: unmapped Letters/Cross references then open a clearly marked placeholder page.
var CITATION_DEMO_MODE = false;

// ADDED: how a clicked citation opens.
//   'window' = separate popup window (falls back to a new tab if the browser blocks popups)
//   'tab'    = ordinary new browser tab
var CITATION_OPEN_MODE = 'window';
// ADDED: 'citation-source' reuses one popup for every click; use '_blank' for a fresh window each time.
var CITATION_WINDOW_NAME = '_blank';
var CITATION_WINDOW_FEATURES = 'popup=yes,width=1000,height=800,scrollbars=yes,resizable=yes';

// ADDED: optional manual overrides for individual citations (a row's SourceLinks in the CSV wins over these).
// Shape: "letters1:23": ["https://verified-url"]  or  [{"url": "https://...", "label": "text"}]
// Most links now come from data.csv; regenerate them with:  python3 build_citation_data.py
var CITATION_URLS = {};

// Block legacy links lacking matching event and letter dates.
var CITATION_REQUIRE_DATE = true;
