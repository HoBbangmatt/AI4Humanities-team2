"""Run the calendar on a separate port with caching disabled: py start_server.py"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(Path(__file__).resolve().parent),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-store, max-age=0')
        super().end_headers()
if __name__=='__main__':
    try: server=ThreadingHTTPServer(('127.0.0.1',8001),Handler)
    except OSError:
        raise SystemExit('Port 8001 is busy. Stop its server with Ctrl+C, then try again.')
    print('Calendar iframe preview: http://127.0.0.1:8001/docs/',flush=True)
    webbrowser.open('http://127.0.0.1:8001/docs/')
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
