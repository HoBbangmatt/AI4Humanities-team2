"""Date/content matching regression tests. Run: py -m unittest test_data.py"""
import csv,json,unittest
from pathlib import Path
import build_citation_data as b
ROOT=Path(__file__).resolve().parent
class DataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw=b.csv_rows('Chronology_with_Cross_URI_updated.csv')
        cls.complete=b.csv_rows('Complete_Letters_Matched.csv')
        cls.cross=b.xlsx_rows('CrossLetters_Verified_updated final edit JB.xlsx')
        cls.indexes,cls.freq=b.source_indexes(cls.complete,cls.cross)
        cls.lookup={r['Item URI']:r for r in cls.complete}
        cls.cross_lookup={r['Item URI']:r for rs in cls.indexes['cross'].values() for r in rs}
        with (ROOT/'data.csv').open(encoding='utf-8') as f:cls.rows=list(csv.DictReader(f))
    def entries(self,r):
        return [e for group in json.loads(r['SourceLinks'] or '{}').values() for e in group]+json.loads(r['RowSourceLinks'] or '[]')
    def test_events_preserved(self):
        self.assertEqual(len(self.raw),len(self.rows))
        for raw,out in zip(self.raw,self.rows):
            for k in ['Date','Year','Month','Day','Weekday','Event']:self.assertEqual(raw[k],out[k])
    def test_every_link_passes_date_and_content(self):
        for row in self.rows:
            entries=self.entries(row)
            for e in entries:
                r=(self.cross_lookup if e['source']=='cross' else self.lookup)[e['url']]
                self.assertEqual(e['letterDate'],row['Date'])
                self.assertEqual(e['eventDate'],row['Date'])
                self.assertEqual(b.exact_date(r['Dublin Core:Date']),row['Date'])
                self.assertEqual(e['label'],b.clean(r['Dublin Core:Title']))
                self.assertTrue(b.evidence(row['Event'],r,self.freq)['accepted'])
                if e['source']=='cross':
                    self.assertEqual(self.lookup[e['contentSourceURL']]['Dublin Core:Date'].strip(),row['Date'])
            for citation,group in json.loads(row['SourceLinks'] or '{}').items():
                for e in group:self.assertTrue(citation.startswith(e['source']))
    def test_known_wrong_links_corrected(self):
        expected={'1866-02-12':'93936','1853-08-09':'92174'}
        for d,item in expected.items():
            row=next(r for r in self.rows if r['Date']==d)
            self.assertEqual([e.get('contentSourceURL',e['url']) for e in self.entries(row)],['https://georgeeliotarchive.org/items/show/'+item])
    def test_conflicting_cross_mapping_withheld(self):
        # Cross 622 says 1839-03-16 but its workbook target 92914 says 1839-09-04.
        # Do not silently substitute a complete-edition URL for a Cross citation.
        row=next(r for r in self.rows if r['Date']=='1839-03-16')
        self.assertEqual(self.entries(row),[])
    def test_search_and_calendar_identical(self):
        self.assertEqual((ROOT/'data.csv').read_bytes(),(ROOT/'Events_date_weekday.csv').read_bytes())
    def test_date_alone_not_enough(self):
        r={'Dublin Core:Description':'A wholly unrelated account of travel and weather.','Dublin Core:Subject':'Maria Lewis'}
        f=b.prepare_records([r]);chosen,_=b.choose('Writes to Maria Lewis.',[r],f)
        self.assertIsNone(chosen)
    def test_ambiguous_quotes_not_linked(self):
        rs=[{'Dublin Core:Description':'The garden contains beautiful flowers in every season.'} for _ in range(2)]
        f=b.prepare_records(rs);chosen,_=b.choose("She writes, 'The garden contains beautiful flowers in every season.'",rs,f)
        self.assertIsNone(chosen)
    def test_partial_invalid_dates_not_guessed(self):
        for d in ['1840','1840-01','[1840-01-14]','1840-02-31','']:self.assertIsNone(b.exact_date(d))
    def test_same_recipient_without_content_not_enough(self):
        r={'Dublin Core:Description':'Maria Lewis reports that the weather is fine.','Dublin Core:Subject':'Maria Lewis'}
        f=b.prepare_records([r]);self.assertFalse(b.evidence('Writes to Maria Lewis about philosophical readings and religious doubts.',r,f)['accepted'])
    def test_both_citations_open_separate_editions(self):
        row=next(r for r in self.rows if r['Date']=='1846-02-14')
        m=json.loads(row['SourceLinks'])
        self.assertEqual(m['letters1:206'][0]['url'],'https://georgeeliotarchive.org/items/show/95555')
        self.assertEqual(m['cross1:139'][0]['url'],'https://georgeeliotarchive.org/items/show/685')
    def test_cross_wrong_date_or_unverified_excluded(self):
        letter={'Item URI':'https://example.org/letter','Dublin Core:Date':'1850-01-01','Dublin Core:Description':'Some letter content'}
        cross={'Item URI':'https://example.org/cross','Complete_Item_URI':letter['Item URI'],'Dublin Core:Date':'1850-01-02','Verification_Status':'Verified'}
        index,_=b.source_indexes([letter],[cross]);self.assertFalse(index['cross'])
        cross['Dublin Core:Date']='1850-01-01';cross['Verification_Status']='Not found'
        index,_=b.source_indexes([letter],[cross]);self.assertFalse(index['cross'])
if __name__=='__main__':unittest.main()
