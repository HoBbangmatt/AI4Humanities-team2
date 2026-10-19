/* Shared UTC scale; one view state drives all tracks, the overview and the list.
   D3 7.9.0 is bundled locally. No framework, build tool or remote API is needed. */
'use strict';
(() => {
  const DAY = 86400000, PAGE_SIZE = 40;
  const tracks = ['life', 'reading', 'letters'];
  const names = {life:'Life Events', reading:'Reading', letters:'Letters'};
  const colors = {life:'#705080', reading:'#28766a', letters:'#b65b2e'};
  const $ = id => document.getElementById(id);
  const state = {records:[], enabled:new Set(tracks), query:'', view:null, full:null,
    selected:null, page:0, unplaced:false, overviewBusy:false};
  const fmt = d3.utcFormat('%d %b %Y');
  const iso = d3.utcFormat('%Y-%m-%d');
  const el = (tag, cls, text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  let brush, overviewSvg, overviewScale, zoom, timelineSvg, zoomBase, zoomBusy=false;
  let wheelFrame;

  function matches(r) {return state.enabled.has(r.track) && (!state.query || r.search.includes(state.query));}
  function inView(r) {return r.a!==null && r.a<state.view[1] && r.b>=state.view[0];}
  function selectedOverlap(r) {const s=state.selected;return s&&s.a!==null&&r.a!==null&&r.a<=s.b&&r.b>=s.a;}
  function visibleRecords() {return state.records.filter(r=>matches(r) && (state.unplaced?r.a===null:inView(r)));}
  function clampView(a,b) {
    let span=Math.max(DAY,Math.min(b-a,state.full[1]-state.full[0]));
    a=Math.max(state.full[0],Math.min(a,state.full[1]-span));
    return [a,a+span];
  }
  function setView(a,b,{syncZoom=true,syncBrush=true}={}) {
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return;
    state.view=clampView(a,b);state.page=0;
    $('from').value=iso(new Date(state.view[0]));$('to').value=iso(new Date(state.view[1]-1));
    renderChart();renderList();
    if(syncBrush)syncOverview();
    if(syncZoom)syncZoomTransform();
  }
  function setError(text='') {$('error').textContent=text;$('error').hidden=!text;}
  function selectRecord(r) {
    state.selected=r;renderDetails(r);renderChart();renderList();
    if(window.innerWidth<761)$('details').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function renderDetails(r) {
    const box=$('details');box.replaceChildren();
    box.append(el('p','eyebrow','RECORD DETAILS'),el('span','badge '+r.track,names[r.track]),el('h2','',r.title));
    box.append(el('p','detail-meta',`${r.original_date||'Date not provided'} · ${r.precision}${r.uncertain?' · qualified or uncertain':''}`));
    if(r.a!==null){
      const compare=el('button','secondary','Compare this period');
      compare.onclick=()=>{state.unplaced=false;$('unplaced').checked=false;setView(r.a-7*DAY,r.b+8*DAY);};box.append(compare);
    }
    if(r.creator)box.append(el('p','detail-meta',r.creator));
    if(r.publication_date)box.append(el('p','detail-meta','Publication metadata: '+r.publication_date));
    if(r.date_note)box.append(el('p','detail-note',r.date_note));
    box.append(el('p','detail-meta',r.reference||''));
    if(r.links.length){
      box.append(el('p','eyebrow',r.track==='life'?'CITATION CANDIDATES — CHECK SOURCE':'SOURCE LINKS'));
      r.links.forEach(link=>{
        const a=el('a','source-link',link.label+' ↗');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);
        if(link.note)box.append(el('p','source-note',link.note));
      });
    }else box.append(el('p','detail-note','No confirmed source URL is available for this record.'));
    box.append(el('p','description',r.description||'No description supplied.'));
    box.append(el('p','detail-note','Other records highlighted in this period share a date or overlapping date range. This does not establish a causal relationship.'));
  }

  function renderList() {
    const list=visibleRecords();const total=list.length;const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    state.page=Math.min(state.page,pages-1);
    $('results-title').textContent=state.unplaced?'Records with unplaced dates':'Records in view';
    const overlap=state.selected?list.filter(selectedOverlap).length:0;
    $('results-summary').textContent=`${total.toLocaleString()} records${state.query?' matching “'+$('search').value+'”':''}. Reading items can have several dated occurrences.${state.selected?' '+overlap+' overlap the selected record’s period.':''}`;
    const fragment=document.createDocumentFragment();
    list.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE).forEach(r=>{
      const button=el('button','record-row'+(state.selected?.id===r.id?' selected':''));
      button.dataset.id=r.id;
      button.append(el('span','track-name '+r.track,names[r.track]),el('span','record-date',r.original_date||'Unplaced'),el('span','record-title',r.title),el('span','arrow','↗'));
      button.onclick=()=>selectRecord(r);fragment.append(button);
    });
    if(!total)fragment.append(el('p','detail-note','No records match this view. Try a wider date range, another search, or enable another track.'));
    $('records').replaceChildren(fragment);
    $('page-label').textContent=`Page ${state.page+1} of ${pages}`;
    $('previous').disabled=state.page===0;$('next').disabled=state.page>=pages-1;
    const allMatches=state.records.filter(matches);
    $('status').textContent=`${allMatches.filter(r=>r.a!==null).length.toLocaleString()} dated occurrences · ${allMatches.filter(r=>r.a===null).length} unplaced`;
  }

  function renderChart() {
    const node=$('timeline');const width=Math.max(310,node.clientWidth),height=282;
    const left=90,right=14,top=17,laneH=71;
    const x=d3.scaleUtc().domain(state.view.map(v=>new Date(v))).range([left,width-right]);
    const g=timelineSvg.attr('viewBox',`0 0 ${width} ${height}`).select('.drawing');g.selectAll('*').remove();
    const broad=state.view[1]-state.view[0]>3*365.25*DAY;
    const period=state.view[1]-state.view[0]>12*365.25*DAY?d3.utcYear:d3.utcMonth;
    const data=state.records.filter(r=>matches(r)&&inView(r));
    const tickCount=Math.max(3,Math.floor((width-left)/95));
    g.append('g').attr('class','axis').attr('transform',`translate(0,${top+3*laneH+9})`).call(d3.axisBottom(x).ticks(tickCount).tickSizeOuter(0));
    g.append('g').selectAll('line').data(x.ticks(tickCount)).join('line').attr('x1',x).attr('x2',x).attr('y1',top).attr('y2',top+3*laneH).attr('stroke','#eeede6');
    const selected=state.selected;
    if(selected?.a!==null&&selected?.a!==undefined){
      const a=Math.max(left,x(new Date(selected.a))),b=Math.min(width-right,x(new Date(selected.b+DAY)));
      if(b>=a)g.append('rect').attr('x',a).attr('width',Math.max(2,b-a)).attr('y',top).attr('height',laneH*3).attr('fill','#252a3a').attr('opacity',.065);
    }
    tracks.forEach((track,i)=>{
      const y=top+i*laneH;const items=data.filter(r=>r.track===track);
      const enabled=state.enabled.has(track);
      g.append('text').attr('class','lane-label').attr('x',0).attr('y',y+24).attr('fill',enabled?colors[track]:'#aaa').text(names[track]);
      g.append('text').attr('class','lane-count').attr('x',0).attr('y',y+42).text(enabled?`${items.length.toLocaleString()} records`:'Hidden');
      g.append('line').attr('x1',left).attr('x2',width-right).attr('y1',y+laneH-5).attr('y2',y+laneH-5).attr('stroke','#deddd5');
      const lane=g.append('g').attr('clip-path','url(#plot-clip)');
      if(broad){
        // Count each occurrence once in the bin containing its interval start.
        const bins=d3.rollups(items.filter(r=>r.a>=state.view[0]),v=>v.length,r=>+period.floor(new Date(r.a))).sort((a,b)=>a[0]-b[0]);
        const max=d3.max(bins,b=>b[1])||1;
        const h=d3.scaleSqrt().domain([0,max]).range([0,48]);
        lane.selectAll('rect').data(bins).join('rect').attr('class','mark density-bar').attr('data-track',track)
          .attr('x',d=>x(new Date(d[0]))+1).attr('width',d=>Math.max(2,x(period.offset(new Date(d[0]),1))-x(new Date(d[0]))-2))
          .attr('y',d=>y+laneH-6-h(d[1])).attr('height',d=>Math.max(2,h(d[1]))).attr('rx',1).attr('fill',colors[track]).attr('opacity',.83)
          .on('click',(event,d)=>{event.stopPropagation();setView(d[0],+period.offset(new Date(d[0]),1));})
          .append('title').text(d=>`${names[track]} · ${fmt(new Date(d[0]))}: ${d[1]} interval starts. Click to explore.`);
        if(bins.length)g.append('text').attr('x',width-right).attr('y',y+10).attr('text-anchor','end').attr('font-size',9).attr('fill','#818188').text(`peak ${max} / ${period===d3.utcYear?'year':'month'}`);
      }else{
        items.forEach((r,j)=>{
          const row=j%4,cy=y+15+row*12;
          const ranged=r.precision!=='day';const selectedItem=selected?.id===r.id;
          const mark=lane.append(ranged?'rect':'circle').attr('class','mark event-mark').attr('data-id',r.id);
          if(ranged)mark.attr('x',x(new Date(r.a))).attr('y',cy-3).attr('width',Math.max(5,x(new Date(r.b+DAY))-x(new Date(r.a)))).attr('height',6).attr('rx',2);
          else mark.attr('cx',x(new Date(r.a+DAY/2))).attr('cy',cy).attr('r',selectedItem?5:3.5);
          mark.attr('fill',(r.uncertain||ranged)?'#fffefa':colors[track]).attr('stroke',selectedItem?'#171722':colors[track]).attr('stroke-width',selectedItem?2.5:1.3)
            .attr('opacity',selected&&selectedOverlap(r)?1:.8).on('click',event=>{event.stopPropagation();selectRecord(r);})
            .append('title').text(`${r.original_date}: ${r.title}`);
        });
      }
    });
    timelineSvg.select('#plot-clip rect').attr('x',left).attr('y',top).attr('width',width-left-right).attr('height',3*laneH);
    zoom.extent([[left,0],[width-right,height]]).translateExtent([[left,-Infinity],[width-right,Infinity]]);
    zoomBase=d3.scaleUtc().domain(state.full.map(v=>new Date(v))).range([left,width-right]);
    $('range-label').textContent=`${fmt(new Date(state.view[0]))} — ${fmt(new Date(state.view[1]-1))}`;
    $('view-mode').textContent=broad?'Record counts · each track has its own height scale':'Individual records · use the list to reach overlapping marks';
  }

  function drawOverview() {
    const width=Math.max(310,$('overview').clientWidth),height=65,left=90,right=14;
    overviewScale=d3.scaleUtc().domain(state.full.map(v=>new Date(v))).range([left,width-right]);
    overviewSvg=d3.select('#overview').selectAll('svg').data([0]).join('svg').attr('viewBox',`0 0 ${width} ${height}`);
    overviewSvg.selectAll('*').remove();
    overviewSvg.append('text').attr('x',0).attr('y',20).attr('font-size',10).attr('fill','#74747b').text('Full period');
    const items=state.records.filter(r=>r.a!==null&&matches(r));
    const bins=d3.rollups(items,v=>v.length,r=>+d3.utcYear.floor(new Date(r.a)));
    const h=d3.scaleSqrt().domain([0,d3.max(bins,d=>d[1])||1]).range([0,27]);
    overviewSvg.append('g').selectAll('rect').data(bins).join('rect').attr('x',d=>overviewScale(new Date(d[0])))
      .attr('y',d=>31-h(d[1])).attr('height',d=>h(d[1])).attr('width',d=>Math.max(1,overviewScale(d3.utcYear.offset(new Date(d[0]),1))-overviewScale(new Date(d[0]))-1)).attr('fill','#a8a89d');
    overviewSvg.append('g').attr('class','axis').attr('transform','translate(0,36)').call(d3.axisBottom(overviewScale).ticks(Math.max(3,Math.floor((width-left)/100))).tickSizeOuter(0));
    brush=d3.brushX().extent([[left,0],[width-right,34]]).on('brush end',event=>{
      if(state.overviewBusy)return;
      if(event.selection){const [a,b]=event.selection.map(overviewScale.invert).map(Number);if(b-a>=DAY)setView(a,b,{syncBrush:false});}
      else if(event.type==='end')syncOverview();
    });
    overviewSvg.append('g').attr('class','brush').call(brush);syncOverview();
  }
  function syncOverview(){if(!overviewSvg||!brush)return;state.overviewBusy=true;overviewSvg.select('.brush').call(brush.move,state.view.map(v=>overviewScale(new Date(v))));state.overviewBusy=false;}
  function syncZoomTransform(){if(!zoomBase)return;const [l,r]=zoomBase.range();const a=zoomBase(new Date(state.view[0])),b=zoomBase(new Date(state.view[1]));const k=(r-l)/(b-a);zoomBusy=true;timelineSvg.call(zoom.transform,d3.zoomIdentity.translate(l-k*a,0).scale(k));zoomBusy=false;}
  function refresh(){state.page=0;renderChart();renderList();drawOverview();syncZoomTransform();}

  async function init(){
    try{
      const response=await fetch('data/timeline.json');if(!response.ok)throw Error(`Dataset returned HTTP ${response.status}`);
      const payload=await response.json();
      state.records=payload.records.map(r=>({...r,a:r.start?Date.parse(r.start+'T00:00:00Z'):null,b:r.end?Date.parse(r.end+'T00:00:00Z'):null,
        search:[r.title,r.description,r.creator,r.reference,r.original_date].join(' ').toLocaleLowerCase()}));
      state.records.sort((a,b)=>(a.a??Infinity)-(b.a??Infinity)||a.id.localeCompare(b.id));
      const dated=state.records.filter(r=>r.a!==null);const min=d3.min(dated,r=>r.a),max=d3.max(dated,r=>r.b);
      state.full=[+d3.utcYear.floor(new Date(min)),+d3.utcYear.offset(d3.utcYear.floor(new Date(max)),1)];
      state.view=[...state.full];
      timelineSvg=d3.select('#timeline').append('svg').attr('role','img').attr('aria-label','Synchronized timeline. All records are also available in the keyboard-accessible list below.');
      timelineSvg.append('defs').append('clipPath').attr('id','plot-clip').append('rect');timelineSvg.append('g').attr('class','drawing');
      zoom=d3.zoom().scaleExtent([1,(state.full[1]-state.full[0])/DAY])
        .on('zoom',event=>{if(zoomBusy||!zoomBase)return;const domain=event.transform.rescaleX(zoomBase).domain().map(Number);cancelAnimationFrame(wheelFrame);wheelFrame=requestAnimationFrame(()=>setView(...domain,{syncZoom:false}));})
        .on('end',()=>{
          if(zoomBusy)return;
          cancelAnimationFrame(wheelFrame);
          const domain=d3.zoomTransform(timelineSvg.node()).rescaleX(zoomBase).domain().map(Number);
          // A stationary mouse click also ends a D3 zoom gesture. Do not redraw
          // its target before the subsequent click event reaches that mark.
          if(domain.some((v,i)=>Math.abs(v-state.view[i])>1))setView(...domain);
        });
      timelineSvg.call(zoom).on('dblclick.zoom',null);
      let searchTimer;
      $('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=$('search').value.trim().toLocaleLowerCase();refresh();},180);});
      document.querySelectorAll('input[name=track]').forEach(input=>input.onchange=()=>{input.checked?state.enabled.add(input.value):state.enabled.delete(input.value);refresh();});
      $('apply').onclick=()=>{const a=Date.parse($('from').value+'T00:00:00Z'),b=Date.parse($('to').value+'T00:00:00Z')+DAY;if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){setError('Enter a valid start date on or before the end date.');return;}setError();setView(a,b);};
      $('reset').onclick=()=>{state.query='';state.enabled=new Set(tracks);state.selected=null;state.unplaced=false;$('search').value='';$('unplaced').checked=false;document.querySelectorAll('input[name=track]').forEach(n=>n.checked=true);setError();$('details').replaceChildren(el('p','eyebrow','RECORD DETAILS'),el('h2','','Select a record'),el('p','','Choose a record in the timeline or list to view its details and source links.'));drawOverview();setView(...state.full);};
      $('unplaced').onchange=()=>{state.unplaced=$('unplaced').checked;state.page=0;renderList();};
      $('previous').onclick=()=>{state.page--;renderList();};$('next').onclick=()=>{state.page++;renderList();};
      $('zoom-in').onclick=()=>{const [a,b]=state.view,d=(b-a)/4;setView(a+d,b-d);};
      $('zoom-out').onclick=()=>{const [a,b]=state.view,d=(b-a)/2;setView(a-d,b+d);};
      $('pan-left').onclick=()=>{const [a,b]=state.view,d=(b-a)/3;setView(a-d,b-d);};
      $('pan-right').onclick=()=>{const [a,b]=state.view,d=(b-a)/3;setView(a+d,b+d);};
      drawOverview();setView(...state.full);
      let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderChart();drawOverview();syncZoomTransform();},100);}).observe($('timeline'));
    }catch(error){setError('Could not load the timeline. Open this folder in VS Code, run “py -m http.server 8000”, then visit http://localhost:8000. '+error.message);$('status').textContent='Dataset unavailable';console.error(error);}
  }
  init();
})();
