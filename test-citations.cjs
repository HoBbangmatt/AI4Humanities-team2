// Tests run with Node; no extra packages needed.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this._text = ''; }
  appendChild(c) { this.children.push(c); }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
}
const panel = new Element('section'), input = {value:'Letters'};
const rows = [{Date:'1850-01-01',Event:'Letters 1: 23; Cross 2: 45'}, {Date:'1850-01-02',Event:'Unrelated event'}];
const rect = {filter() { return this; },attr() { return this; }};
const ctx = {URL, console, rect, document:{getElementById(id){return id==='myInput'?input:panel;}, createElement(t){return new Element(t);}, createTextNode(t){const e=new Element('text');e.textContent=t;return e;}}};
ctx.d3 = {csv(name,cb){assert.equal(name.split('?')[0],'Events_date_weekday.csv');cb(null,rows);},max(){return 0;},nest(){return {key(){return this;},rollup(){return this;},map(){return {};}};}};
vm.createContext(ctx);
for(const n of ['citation-config.js','citation-links.js']) vm.runInContext(fs.readFileSync(__dirname+'/'+n,'utf8'),ctx);
ctx.CITATION_REQUIRE_DATE=false; // Legacy unit fixtures below deliberately omit date metadata.
function render(text,row={}) {const el=new Element('p');ctx.appendCitationText(el,{Event:text,...row});return el;}
function links(el){return el.children.filter(c=>c.tag==='a');}
ctx.CITATION_DEMO_MODE=true;
assert.equal(links(render(rows[0].Event)).length,2);
assert.match(links(render('Letters 1: 23'))[0].href,/citation-demo.html/);
ctx.CITATION_DEMO_MODE=false;
assert.equal(links(render('Letters 1: 23')).length,0);
ctx.CITATION_URLS={'Letters 1: 23':['https://example.org/a','https://example.org/b']};
assert.equal(links(render('Letters 1: 23')).length,2);
assert.equal(links(render('Letters 1: 23'))[0].target,'_blank');
ctx.CITATION_URLS={'letters1:23':'javascript:alert(1)'};
assert.equal(links(render('Letters 1: 23')).length,0);
assert.equal(links(render('Cross 2: 45',{SourceLinks:JSON.stringify({'cross2:45':'https://example.org/source'})}))[0].href,'https://example.org/source');
assert.equal(render('<img src=x onerror=alert(1)>').textContent,'<img src=x onerror=alert(1)>');
ctx.CITATION_URLS={'letters1:23':'https://example.org/a'};
assert.equal(links(render('Letters 1: 23 and Letters 1: 23')).length,2);
vm.runInContext(fs.readFileSync(__dirname+'/calendermap.js','utf8').split('function searchCalendar()')[1].replace(/^/, 'function searchCalendar()'),ctx);
ctx.searchCalendar();
assert.match(panel.textContent,/Search Results \(1\)/);
assert.equal(rows[0].Color,'#623216');assert.equal(rows[1].Color,'#B4B782');
assert.ok(panel.children.some(e=>links(e).length===1));
input.value='no matches';ctx.searchCalendar();assert.match(panel.textContent,/No matching events/);
// NEW: object-form links {url,label}, labels, multiple same-day letters
ctx.CITATION_URLS={};
let el=render('See Cross 3: 237.',{SourceLinks:JSON.stringify({'cross3:237':[{url:'https://georgeeliotarchive.org/items/show/1',label:'GE to A, 1874-07-01'},{url:'https://georgeeliotarchive.org/items/show/2',label:'GE to B, 1874-07-01'}]})});
assert.equal(links(el).length,2);
assert.equal(links(el)[0].textContent,'GE to A, 1874-07-01');
assert.equal(links(el)[1].textContent,'GE to B, 1874-07-01');
el=render('Cross 1: 52-3',{SourceLinks:JSON.stringify({'cross1:52-3':[{url:'https://georgeeliotarchive.org/items/show/622',label:'GE to Maria Lewis, 1839-03-16'}]})});
assert.equal(links(el)[0].textContent,'GE to Maria Lewis, 1839-03-16');
assert.equal(links(el)[0].href,'https://georgeeliotarchive.org/items/show/622');
// NEW: unmapped citations stay plain text with demo off; unsafe object URLs rejected
ctx.CITATION_DEMO_MODE=false;
assert.equal(links(render('Cross 9: 999')).length,0);
assert.equal(links(render('Cross 1: 1',{SourceLinks:JSON.stringify({'cross1:1':[{url:'javascript:alert(1)',label:'x'}]})})).length,0);
// NEW: popup window mode
let opened=[];
ctx.window={open(u,n,f){opened.push([u,n,f]);return {focus(){}};}};
ctx.CITATION_OPEN_MODE='window';
el=render('Cross 1: 52-3',{SourceLinks:JSON.stringify({'cross1:52-3':'https://example.org/l'})});
assert.equal(links(el)[0].onclick(),false);
assert.equal(opened.length,1);assert.equal(opened[0][0],'https://example.org/l');assert.match(opened[0][2],/width=/);
ctx.window={open(){return null;}};
assert.equal(links(el)[0].onclick(),true); // popup blocked -> normal new-tab link proceeds
ctx.CITATION_OPEN_MODE='tab';
assert.equal(links(el)[0].onclick(),true);
console.log('PASS: demo/live resolution, multiple/repeated links, new-tab attributes, unsafe URL rejection, dynamic mappings, literal text, original search matching/colors and no results.');
// Row-level links are safe and deduplicated; candidate matches are explicit.
let rowEl=new Element('p');
ctx.appendRowSources(rowEl,{RowSourceLinks:JSON.stringify([{url:'https://example.org/a',label:'Stuart edition'},{url:'https://example.org/a'},{url:'javascript:alert(1)'}])});
assert.equal(links(rowEl).length,1);
assert.equal(links(rowEl)[0].target,'_blank');
assert.equal(links(rowEl)[0].rel,'noopener noreferrer');
el=render('Letters 1: 23',{SourceLinks:JSON.stringify({'letters1:23':[{url:'https://example.org/a',method:'volume/page candidate'}]})});
assert.equal(links(el)[0].textContent,'Open letter');
console.log('PASS: row-level sources, deduplication, unsafe URL rejection and candidate labels.');

ctx.CITATION_REQUIRE_DATE=true;
ctx.CITATION_DEMO_MODE=false;
ctx.CITATION_URLS={};
assert.equal(links(render('Letters 2: 424',{Date:'1866-02-12',SourceLinks:JSON.stringify({'letters2:424':[{url:'https://example.org/wrong',letterDate:'1858-01-21',eventDate:'1866-02-12'}]})})).length,0);
assert.equal(links(render('Letters 2: 424',{Date:'1866-02-12',SourceLinks:JSON.stringify({'letters2:424':[{url:'https://example.org/old'}]})})).length,0);
assert.equal(links(render('Letters 2: 424',{Date:'1866-02-12',SourceLinks:JSON.stringify({'letters2:424':[{url:'https://example.org/right',letterDate:'1866-02-12',eventDate:'1866-02-12'}]})})).length,1);
let guarded=new Element('p');
ctx.appendRowSources(guarded,{Date:'1866-02-12',RowSourceLinks:JSON.stringify([{url:'https://example.org/wrong',letterDate:'1858-01-21',eventDate:'1866-02-12'}])});
assert.equal(links(guarded).length,0);
console.log('PASS: browser date guard rejects wrong-date and stale metadata links.');

// Both source families render titles while retaining their own destinations.
const eventRow={Date:'1846-02-14',SourceLinks:JSON.stringify({
 'letters1:206':[{url:'https://georgeeliotarchive.org/items/show/95555',label:'Caroline Bray to Sara Hennell',source:'letters',letterDate:'1846-02-14',eventDate:'1846-02-14'}],
 'cross1:139':[{url:'https://georgeeliotarchive.org/items/show/685',label:'Cara Hennell Bray to Sara Hennell',source:'cross',letterDate:'1846-02-14',eventDate:'1846-02-14'}]
})};
el=render('Example (Letters 1: 206; Cross 1: 139).',eventRow);
assert.equal(links(el).length,2);
assert.equal(links(el)[0].textContent,'Caroline Bray to Sara Hennell');
assert.equal(links(el)[1].textContent,'Cara Hennell Bray to Sara Hennell (Cross)');
assert.match(links(el)[0].href,/95555$/);assert.match(links(el)[1].href,/685$/);
assert.ok(!el.textContent.includes('1: 206'));assert.ok(!el.textContent.includes('1: 139'));
assert.match(links(el)[0].title,/Letters 1: 206/);
console.log('PASS: title labels, separate Letters/Cross URLs and both links per event.');
