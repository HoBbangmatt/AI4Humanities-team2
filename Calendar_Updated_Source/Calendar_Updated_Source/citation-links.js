// ADDED: normalize citation keys; dates are never used to guess a source.
function citationKey(text) {
  return String(text).toLowerCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
}

// ADDED: resolve configured links now, or row-specific SourceLinks JSON later.
function citationDestinations(citation, row) {
  var mapping = {};
  Object.keys(CITATION_URLS).forEach(function(k) { mapping[citationKey(k)] = CITATION_URLS[k]; });
  if (row.SourceLinks) {
    try {
      var dynamic = JSON.parse(row.SourceLinks);
      Object.keys(dynamic).forEach(function(k) { mapping[citationKey(k)] = dynamic[k]; });
    } catch (e) { console.warn('Invalid SourceLinks JSON for ' + row.Date); }
  }
  var urls = mapping[citationKey(citation)] || [];
  if (!Array.isArray(urls)) urls = [urls];
  // ADDED: entries may be plain URLs or {url, label} objects (label = letter title from the archive).
  var entries = urls.map(function(u) { return (u && typeof u === 'object') ? u : {url:u}; });
  // ADDED: only allow web URLs; do not execute URL schemes supplied by data.
  entries = entries.filter(function(e) {
    try { return typeof e.url === 'string' && /^https?:$/.test(new URL(e.url).protocol); }
    catch (err) { return false; }
  });
  if (typeof CITATION_REQUIRE_DATE === 'undefined' || CITATION_REQUIRE_DATE) {
    entries = entries.filter(function(e) { return e.letterDate === row.Date && e.eventDate === row.Date && /^\d{4}-\d{2}-\d{2}$/.test(row.Date); });
  }
  if (entries.length) return entries.map(function(e) { return {url:e.url, label:e.label ? String(e.label) : '', source:e.source || '', method:e.method || '', letterDate:e.letterDate || '', demo:false}; });
  // ADDED: this local placeholder is explicitly marked and contains no purported letter.
  return CITATION_DEMO_MODE ? [{url:'citation-demo.html?citation=' + encodeURIComponent(citation), label:'', demo:true}] : [];
}

// ADDED: open a citation in a separate window when configured; returns true to let the normal link proceed.
function openCitation(url) {
  if (typeof CITATION_OPEN_MODE === 'undefined' || CITATION_OPEN_MODE !== 'window' || typeof window === 'undefined' || !window.open) return true;
  var w = window.open(url, CITATION_WINDOW_NAME, CITATION_WINDOW_FEATURES);
  if (!w) return true; // popup blocked: fall back to the link's own new-tab behaviour
  try { w.opener = null; w.focus(); } catch (e) {}
  return false;
}

// ADDED: render text safely and link each explicit Letters/Cross volume:page reference.
function appendCitationText(parent, row) {
  var text = String(row.Event || ''), start = 0, match;
  var pattern = /\b(?:Letters|Cross)\s+\d+\s*:\s*\d+(?:\s*[-–—]\s*\d+)?/gi;
  while ((match = pattern.exec(text)) !== null) {
    parent.appendChild(document.createTextNode(text.slice(start, match.index)));
    var links = citationDestinations(match[0], row);
    if (!links.length) parent.appendChild(document.createTextNode(match[0]));
    links.forEach(function(link, i) {
      if (i) parent.appendChild(document.createTextNode(' / '));
      var a = document.createElement('a');
      // ADDED: when several letters share one date, label each so the reader can tell them apart.
      var shown = link.label || (link.demo ? match[0] : 'Open letter');
      a.textContent = shown + (link.source === 'cross' ? ' (Cross)' : '') + (link.demo ? ' [demo]' : '');
      a.href = link.url;
      a.title = match[0] + (link.letterDate ? ' | Letter date: ' + link.letterDate : '') + ' | ' + (link.method || 'Open source');
      a.onclick = function() { return openCitation(link.url); };
      // ADDED: open separately; browser preferences determine tab versus window.
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      parent.appendChild(a);
    });
    start = pattern.lastIndex;
  }
  parent.appendChild(document.createTextNode(text.slice(start)));
}

// Row-level sources and verified alternate editions have no invented citation association.
function appendRowSources(parent, row) {
  var entries;
  try { entries = JSON.parse(row.RowSourceLinks || '[]'); } catch (e) { return; }
  if (!Array.isArray(entries)) return;
  var seen = {};
  entries.forEach(function(link) {
    if (!link || typeof link.url !== 'string' || seen[link.url]) return;
    if ((typeof CITATION_REQUIRE_DATE === 'undefined' || CITATION_REQUIRE_DATE) && (link.letterDate !== row.Date || link.eventDate !== row.Date || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date))) return;
    try { if (!/^https?:$/.test(new URL(link.url).protocol)) return; } catch (e) { return; }
    seen[link.url] = true;
    var a = document.createElement('a');
    a.textContent = (link.label || 'Open letter') + (link.source === 'cross' ? ' (Cross)' : '');
    a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.title = link.method || 'Supplied source';
    a.onclick = function() { return openCitation(link.url); };
    parent.appendChild(document.createTextNode(' | ')); parent.appendChild(a);
  });
}

// ADDED: the panel supplements the original search coloring and hover tooltips.
function showCitationResults(rows, title) {
  var panel = document.getElementById('citation-results');
  panel.textContent = '';
  var h = document.createElement('h2'); h.textContent = title + ' (' + rows.length + ')'; panel.appendChild(h);
  if (CITATION_DEMO_MODE) {
    var note = document.createElement('p'); note.textContent = 'Demo mode: links marked [demo] open placeholders, not actual letters.'; panel.appendChild(note);
  }
  if (!rows.length) {
    var empty = document.createElement('p'); empty.textContent = 'No matching events.'; panel.appendChild(empty);
  }
  rows.forEach(function(row) {
    var p = document.createElement('p');
    var date = document.createElement('strong'); date.textContent = row.Date + ': ';
    p.appendChild(date); appendCitationText(p, row); appendRowSources(p, row); panel.appendChild(p);
  });
}

// ADDED: namespaced events preserve existing calendar handlers and all rows on a date.
function attachCitationDates(rows) {
  rect.filter(function(date) { return rows.some(function(row) { return row.Date === date; }); })
    .style('cursor', 'pointer').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', function(date) { return 'View sources for ' + date; })
    .on('click.citations', function(date) {
      showCitationResults(rows.filter(function(row) { return row.Date === date; }), 'Events for ' + date);
    })
    .on('keydown.citations', function(date) {
      if (d3.event.key === 'Enter' || d3.event.key === ' ') {
        d3.event.preventDefault();
        showCitationResults(rows.filter(function(row) { return row.Date === date; }), 'Events for ' + date);
      }
    });
}
