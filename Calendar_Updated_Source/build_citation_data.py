"""Build calendar links from the four current sources. Run: py build_citation_data.py.
Exact dates select candidates; quotation/content evidence selects a unique letter.
Supplied URLs and volume/page ranges are not evidence of a match.
"""
import csv, json, re, html, zipfile
from collections import defaultdict, Counter
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'source_data'
CITATION = re.compile(r'\b(?:Letters|Cross)\s+\d+\s*:\s*\d+(?:\s*[-–—]\s*\d+)?', re.I)

def key(text):
    return re.sub('[–—]', '-', re.sub(r'\s+', '', text.lower()))

def clean(text):
    return html.unescape(re.sub('<[^>]+>', '', str(text or ''))).strip()

def urls(text):
    result=[]
    for value in re.split(r'[;|\s]+', str(text or '')):
        p=urlparse(value)
        if p.scheme in ('http','https') and p.netloc and value not in result: result.append(value)
    return result

def refs(text):
    result=set()
    for m in re.finditer(r'(\d+)\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?', clean(text)):
        v,a,b=m.groups(); a=int(a)
        if b and int(b)<a: b=str(a)[:-len(b)]+b
        b=int(b or a)
        if a<=b<=a+100:
            result.update((int(v),p) for p in range(a,b+1))
    return result

def csv_rows(name):
    with (SOURCE/name).open(encoding='utf-8-sig',newline='') as f: return list(csv.DictReader(f))

def xlsx_rows(filename):
    """Read the first worksheet, including shared/inline strings, without pip."""
    path = SOURCE / filename
    if not path.exists():
        return []
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in si.iterfind('.//s:t', ns))
                       for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        table = []
        for row in sheet.findall('.//s:sheetData/s:row', ns):
            cells = {}
            for cell in row.findall('s:c', ns):
                col = re.match(r'[A-Z]+', cell.attrib['r'])[0]
                idx = 0
                for c in col:
                    idx = idx * 26 + ord(c) - 64
                v = cell.find('s:v', ns)
                value = v.text if v is not None else ''
                if cell.get('t') == 's':
                    value = strings[int(value)]
                elif cell.get('t') == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.findall('.//s:t', ns))
                cells[idx - 1] = value or ''
            if cells:
                table.append(cells)
        if not table:
            return []
        headers = table[0]
        return [{key: row.get(i, '') for i, key in headers.items()} for row in table[1:]]

# Conservative, transparent text rules. These scores are not probabilities.
STOP=set('the and that this with from have been were their they them which when what would could should shall will your yours dear very much more some into about than then there these those such only also does did had has was are for not but you she her his him our out all may can who how its yet one two any letter writes write tells sends sent says said george eliot evans letters cross'.split())

def words(s):
    import unicodedata
    s=unicodedata.normalize('NFKD',clean(s)).encode('ascii','ignore').decode().lower()
    return re.findall(r'[a-z]+',s)

def normalize(s): return ' '.join(words(s))

def exact_date(value):
    from datetime import date
    value=str(value or '').strip()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value): return None
    try:return date.fromisoformat(value).isoformat()
    except ValueError:return None

def prepare_records(records):
    freq=Counter()
    for r in records:
        # Body only: exclude the first title line and bibliographic fields/footnotes.
        description=clean(r.get('Dublin Core:Description',''))
        lines=description.splitlines()
        if lines and normalize(lines[0])==normalize(r.get('Dublin Core:Title','')): lines=lines[1:]
        body='\n'.join(lines)+'\n'+clean(r.get('Item Type Metadata:Text',''))+'\n'+clean(r.get('Item Type Metadata:Transcription',''))
        r['_body']=normalize(body)
        r['_tokens']=set(words(body))-STOP
        freq.update(r['_tokens'])
    return freq

def evidence(event,r,freq):
    text=CITATION.sub('',event)
    # Apostrophes inside words are not quote delimiters; ellipses split quote pieces.
    quotes=re.findall(r'(?<!\w)[\'\u2018\u201c\"](.+?)[\'\u2019\u201d\"](?!\w)',text)
    phrases=[]
    for q in quotes:
        for piece in re.split(r'(?:\.\s*){3,}|…',q):
            tokens=words(piece)
            if len(tokens)>=6 and len(set(tokens)-STOP)>=2:
                phrase=' '.join(tokens)
                if ' '+phrase+' ' in ' '+r['_body']+' ': phrases.append(phrase)
    people=clean(r.get('Dublin Core:Subject','')).split('^^')[0]
    name=[w for w in words(people) if w not in {'mrs','mr','miss','dr','sir','lady','george','eliot'}]
    event_tokens=set(words(text))
    person=len(name)>=2 and name[-1] in event_tokens and sum(w in event_tokens for w in name)>=2
    specific={w for w in event_tokens-STOP-set(name) if len(w)>=4 and freq[w]<=200}
    shared=sorted(specific & r['_tokens'])
    coverage=len(shared)/max(1,len(specific))
    if phrases:
        return {'accepted':True,'reason':'exact date and quotation','quote':max(phrases,key=len),'terms':shared}
    if person and len(shared)>=4 and coverage>=0.6:
        return {'accepted':True,'reason':'exact date, named recipient and content overlap','quote':'','terms':shared}
    return {'accepted':False,'reason':'insufficient quotation or recipient/content evidence','quote':'','terms':shared}

def choose(event,candidates,freq):
    scored=[(r,evidence(event,r,freq)) for r in candidates]
    good=[(r,e) for r,e in scored if e['accepted']]
    # Never pick a winner just because it has the highest score among weak matches.
    if len(good)==1:return good[0],scored
    return None,scored

def source_indexes(complete, cross):
    """Separate archive editions, both gated by exact event dates and content."""
    freq=prepare_records(complete)
    by_url={r['Item URI'].strip():r for r in complete}
    indexes={'letters':defaultdict(list),'cross':defaultdict(list)}
    for r in complete:
        d=exact_date(r.get('Dublin Core:Date'))
        if d and urls(r.get('Item URI')):indexes['letters'][d].append(r)
    for row in cross:
        if row.get('Verification_Status','').strip().lower() not in {'verified','verified with note','firm match'}:continue
        targets=urls(row.get('Complete_Item_URI'))
        if len(targets)!=1:continue
        target=by_url.get(targets[0]);d=exact_date(row.get('Dublin Core:Date'))
        if not target or not d or d!=exact_date(target.get('Dublin Core:Date')) or not urls(row.get('Item URI')):continue
        r=dict(row)
        # Cross metadata has no body. Its reviewed edition match supplies the content.
        r['_body']=target['_body'];r['_tokens']=target['_tokens']
        r['_content_url']=targets[0]
        indexes['cross'][d].append(r)
    return indexes,freq

def match_source(row,citation,kind,indexes,freq,require_reference=False):
    candidates=indexes[kind].get(exact_date(row['Date']),[])
    if require_reference:
        field='Dublin Core:Identifier' if kind=='letters' else 'Dublin Core:Relation'
        candidates=[r for r in candidates if refs(citation)&refs(r.get(field,''))]
    return choose(row['Event'],candidates,freq),candidates

def main():
    chronology=csv_rows('Chronology_with_Cross_URI_updated.csv')
    complete=csv_rows('Complete_Letters_Matched.csv')
    cross=xlsx_rows('CrossLetters_Verified_updated final edit JB.xlsx')
    indexes,freq=source_indexes(complete,cross)
    output=[];audit=[];removed=[];stats=Counter()
    for num,row in enumerate(chronology,2):
        citations=list(dict.fromkeys(m.group() for m in CITATION.finditer(row['Event'])))
        mapping={};extra=[];selected_urls=set();families=set()
        jobs=[(c,'cross' if c.lower().startswith('cross') else 'letters') for c in citations]
        if not jobs:jobs=[('', 'letters')]
        for citation,kind in jobs:
            multiple=sum(k==kind for _,k in jobs)>1
            (selected,scored),candidates=match_source(row,citation,kind,indexes,freq,multiple)
            if selected:
                r,e=selected;u=r['Item URI'].strip()
                link={'url':u,'label':clean(r['Dublin Core:Title']),'source':kind,
                      'method':e['reason'],'letterDate':r['Dublin Core:Date'].strip(),'eventDate':row['Date']}
                if kind=='cross':link['contentSourceURL']=r['_content_url']
                if citation:mapping[key(citation)]=[link]
                else:extra.append(link)
                selected_urls.add(u);families.add(kind);stats[kind+'_references_linked']+=1
            else:stats[kind+'_references_unlinked']+=1
            if not scored:
                audit.append({'row':num,'date':row['Date'],'citation':citation,'source':kind,'event':row['Event'],'status':'review','candidate_url':'','candidate_title':'','content_source_url':'','evidence':'No eligible exact-date candidate or citation-specific mapping','quotation':'','shared_terms':''})
            for r,e in scored:
                accepted=bool(selected and selected[0] is r)
                audit.append({'row':num,'date':row['Date'],'citation':citation,'source':kind,'event':row['Event'],'status':'matched' if accepted else 'review','candidate_url':r['Item URI'],'candidate_title':clean(r['Dublin Core:Title']),'content_source_url':r.get('_content_url',r['Item URI']),'evidence':e['reason'] if accepted or not e['accepted'] else 'multiple supported candidates; review required','quotation':e['quote'],'shared_terms':'; '.join(e['terms'])})
        stats['rows_with_links']+=bool(selected_urls)
        stats['rows_with_both_editions']+=families=={'letters','cross'}
        old=set(urls(row.get('Complete Letters URI'))+urls(row.get('Cross Letters URI')))
        for u in sorted(old-selected_urls):removed.append({'row':num,'date':row['Date'],'removed_url':u,'reason':'Not a supported destination for the requested source edition'})
        out={k:row.get(k,'') for k in ['Date','Year','Month','Day','Weekday','Event']}
        out['SourceLinks']=json.dumps(mapping,ensure_ascii=False) if mapping else ''
        out['RowSourceLinks']=json.dumps(extra,ensure_ascii=False) if extra else ''
        output.append(out)
    for name in ['data.csv','Events_date_weekday.csv']:
        with (HERE/name).open('w',encoding='utf-8',newline='') as f:
            w=csv.DictWriter(f,fieldnames=list(output[0]));w.writeheader();w.writerows(output)
    for name,rows,fields in [('match_audit.csv',audit,['row','date','citation','source','event','status','candidate_url','candidate_title','content_source_url','evidence','quotation','shared_terms']),('removed_links.csv',removed,['row','date','removed_url','reason'])]:
        with (HERE/name).open('w',encoding='utf-8',newline='') as f:
            w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    report={'source_rows':len(chronology),'complete_letters':len(complete),'cross_rows':len(cross),**stats,'policy':'Date then content, separately for Letters and Cross. Titles replace matched citation numbers. Cross content comes from its verified same-date complete-letter match.'}
    (HERE/'data_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
