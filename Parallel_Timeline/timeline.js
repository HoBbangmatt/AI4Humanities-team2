/* Shared UTC scale; one view state drives all three tracks.
   D3 7.9.0 is bundled locally. No framework, build tool or remote API is needed. */
'use strict';
(() => {
  const DAY = 86400000;
  const tracks = ['life', 'reading', 'letters'];
  const names = {life:'Life Events', reading:'Reading', letters:'Letters'};
  const colors = {life:'#705080', reading:'#28766a', letters:'#b65b2e'};
  const $ = id => document.getElementById(id);
  const state = {records:[], enabled:new Set(tracks), query:'', view:null, full:null,
    selected:null, work:null, samePeriod:false, works:[]};
  const fmt = d3.utcFormat('%d %b %Y');
  const iso = d3.utcFormat('%Y-%m-%d');
  const el = (tag, cls, text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  let zoom, timelineSvg, zoomBase, zoomBusy=false;
  let wheelFrame;

  function relation(r) {
    if(!state.work)return 'all';
    if((r.work_mentions||[]).includes(state.work.id))return 'mention';
    const year=r.start?Number(r.start.slice(0,4)):null;
    return state.samePeriod && year!==null && year>=state.work.window[0] && year<=state.work.window[1] ? 'period' : null;
  }
  function matches(r) {return state.enabled.has(r.track) && (!state.query || r.search.includes(state.query)) && relation(r)!==null;}
  function clearDetails(){state.selected=null;$('details').replaceChildren(el('h2','','Select a record'),el('p','','Choose a record to view details and source links.'));}
  function workControls(){
    $('same-period').disabled=!state.work;
    document.querySelectorAll('[data-work]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.work===(state.work?.id||'all'))));
    $('work-note').textContent=state.work?`${state.work.title}: publication ${state.work.publication.join('–')}; same-period window ${state.work.window.join('–')}. A mention is a keyword match, not proof of a relationship.`:'Choose a work to find mentions across all three tracks.';
  }
  function chooseWork(work){
    state.work=work;clearDetails();setError();
    if(!work){state.samePeriod=false;$('same-period').checked=false;}
    workControls();
    if(work)setView(Date.UTC(work.publication[0]-1,0,1),Date.UTC(work.publication[1]+2,0,1));
    else setView(...state.full);
  }

  function inView(r) {return r.a!==null && r.a<state.view[1] && r.b>=state.view[0];}
  function selectedOverlap(r) {const s=state.selected;return s&&s.a!==null&&r.a!==null&&r.a<=s.b&&r.b>=s.a;}
  function clampView(a,b) {
    let span=Math.max(DAY,Math.min(b-a,state.full[1]-state.full[0]));
    a=Math.max(state.full[0],Math.min(a,state.full[1]-span));
    return [a,a+span];
  }
  function setView(a,b,{syncZoom=true}={}) {
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return;
    state.view=clampView(a,b);
    $('from').value=iso(new Date(state.view[0]));$('to').value=iso(new Date(state.view[1]-1));
    renderChart();updateStatus();
    if(syncZoom)syncZoomTransform();
  }
  function setError(text='') {$('error').textContent=text;$('error').hidden=!text;}
  function selectRecord(r) {
    state.selected=r;renderDetails(r);renderChart();updateStatus();
    if(window.innerWidth<761)$('details').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function renderDetails(r) {
    const box=$('details');box.replaceChildren();
    box.append(el('p','eyebrow','RECORD DETAILS'),el('span','badge '+r.track,names[r.track]),el('h2','',r.title));
    if(state.work){
      const kind=relation(r);
      box.append(el('p','work-relation',kind==='mention'?'Mentions '+state.work.title:'Same period'));
      box.append(el('p','detail-note',kind==='mention'?'Matched terms: '+(r.work_match_terms?.[state.work.id]||[]).join(', ')+'. A keyword match does not prove that this record is about the work.':'This record does not mention '+state.work.title+'. Its date falls within the writing-to-publication period. This does not establish a connection to the work.'));
    }
    box.append(el('p','detail-meta',`${r.original_date||'Date not provided'} · ${r.precision}${r.uncertain?' · qualified or uncertain':''}`));
    if(r.creator)box.append(el('p','detail-meta',r.creator));
    if(r.publication_date)box.append(el('p','detail-meta','Publication metadata: '+r.publication_date));
    if(r.date_note)box.append(el('p','detail-note',r.date_note));
    box.append(el('p','detail-meta',r.reference||''));
    if(r.links.length){
      box.append(el('p','eyebrow',r.track==='life'?'CITATION CANDIDATES — CHECK SOURCE':'SOURCE LINKS'));
      r.links.forEach(link=>{
        const a=el('a','source-link',(r.track==='letters'?r.title:link.label)+' ↗');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);
        if(link.note)box.append(el('p','source-note',link.note));
      });
    }else box.append(el('p','detail-note','No confirmed source URL is available for this record.'));
    box.append(el('p','description',r.description||'No description supplied.'));
    box.append(el('p','detail-note','Other records highlighted in this period share a date or overlapping date range. This does not establish a causal relationship.'));
  }

  function updateStatus() {
    const allMatches=state.records.filter(matches);
    $('work-summary').textContent=state.work?tracks.map(t=>{
      const rows=allMatches.filter(r=>r.track===t),mentions=rows.filter(r=>relation(r)==='mention').length;
      return `${names[t]}: ${mentions} mentions${state.samePeriod?' + '+(rows.length-mentions)+' same period':''}`;
    }).join(' · ')+`. Counts cover all dates after search/track filters; ${allMatches.filter(inView).length} records overlap the visible period.`:'';
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
          mark.attr('tabindex',0).attr('role','button').attr('aria-label',`${r.original_date}: ${r.title}`).on('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRecord(r);}}).attr('fill',(r.uncertain||ranged)?'#fffefa':colors[track]).attr('stroke',selectedItem?'#171722':colors[track]).attr('stroke-width',selectedItem?2.5:1.3)
            .attr('opacity',selected&&selectedOverlap(r)?1:.8).on('click',event=>{event.stopPropagation();selectRecord(r);})
            .append('title').text(`${r.original_date}: ${r.title}`);
        });
      }
    });
    timelineSvg.select('#plot-clip rect').attr('x',left).attr('y',top).attr('width',width-left-right).attr('height',3*laneH);
    zoom.extent([[left,0],[width-right,height]]).translateExtent([[left,-Infinity],[width-right,Infinity]]);
    zoomBase=d3.scaleUtc().domain(state.full.map(v=>new Date(v))).range([left,width-right]);
    $('range-label').textContent=`${fmt(new Date(state.view[0]))} — ${fmt(new Date(state.view[1]-1))}`;
  }

  function syncZoomTransform(){if(!zoomBase)return;const [l,r]=zoomBase.range();const a=zoomBase(new Date(state.view[0])),b=zoomBase(new Date(state.view[1]));const k=(r-l)/(b-a);zoomBusy=true;timelineSvg.call(zoom.transform,d3.zoomIdentity.translate(l-k*a,0).scale(k));zoomBusy=false;}
  function refresh(){if(state.selected&&!matches(state.selected))clearDetails();renderChart();updateStatus();syncZoomTransform();}

  async function init(){
    try{
      const response=await fetch('data/timeline.json');if(!response.ok)throw Error(`Dataset returned HTTP ${response.status}`);
      const payload=await response.json();
      state.works=payload.works||[];
      [null,...state.works].forEach(work=>{const b=el('button','',work?work.title:'All works');b.type='button';b.dataset.work=work?work.id:'all';b.onclick=()=>chooseWork(work);$('work-buttons').append(b);});
      workControls();
      $('same-period').onchange=()=>{state.samePeriod=$('same-period').checked;clearDetails();refresh();};
      state.records=payload.records.map(r=>({...r,a:r.start?Date.parse(r.start+'T00:00:00Z'):null,b:r.end?Date.parse(r.end+'T00:00:00Z'):null,
        search:[r.title,r.description,r.creator,r.reference,r.original_date].join(' ').toLocaleLowerCase()}));
      state.records.sort((a,b)=>(a.a??Infinity)-(b.a??Infinity)||a.id.localeCompare(b.id));
      const dated=state.records.filter(r=>r.a!==null);const min=d3.min(dated,r=>r.a),max=d3.max(dated,r=>r.b);
      state.full=[+d3.utcYear.floor(new Date(min)),+d3.utcYear.offset(d3.utcYear.floor(new Date(max)),1)];
      state.view=[...state.full];
      timelineSvg=d3.select('#timeline').append('svg').attr('role','img').attr('aria-label','Synchronized timeline of life events, reading, and letters.');
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
      $('reset').onclick=()=>{state.work=null;state.samePeriod=false;$('same-period').checked=false;workControls();state.query='';state.enabled=new Set(tracks);state.selected=null;$('search').value='';document.querySelectorAll('input[name=track]').forEach(n=>n.checked=true);setError();$('details').replaceChildren(el('p','eyebrow','RECORD DETAILS'),el('h2','','Select a record'),el('p','','Choose a record in the timeline to view its details and source links.'));setView(...state.full);};
      $('reset-view').onclick=()=>{setError();setView(...state.full);};
      $('zoom-in').onclick=()=>{const [a,b]=state.view,d=(b-a)/4;setView(a+d,b-d);};
      $('zoom-out').onclick=()=>{const [a,b]=state.view,d=(b-a)/2;setView(a-d,b+d);};
      $('pan-left').onclick=()=>{const [a,b]=state.view,d=(b-a)/3;setView(a-d,b-d);};
      $('pan-right').onclick=()=>{const [a,b]=state.view,d=(b-a)/3;setView(a+d,b+d);};
      setView(...state.full);
      let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderChart();syncZoomTransform();},100);}).observe($('timeline'));
    }catch(error){setError('Could not load the timeline. Open this folder in VS Code, run “py -m http.server 8000”, then visit http://localhost:8000. '+error.message);$('status').textContent='Dataset unavailable';console.error(error);}
  }
  init();
})();
