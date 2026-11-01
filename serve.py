"""Run Sprite Studio on this computer, for working on it.

    python serve.py          (or: python serve.py 8080 for another port)

Then open http://localhost:8000 (the tests are at /tests/).

The page has to come from a web server, not from double-clicking
index.html, because browsers only load JavaScript modules from a server.
This is Python's built-in server, plus one change: it tells the browser not
to keep copies of the files, so refreshing always shows your latest edits.
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
FOLDER = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Some Windows computers have the wrong type for .js files in the
    # registry, which stops modules loading, so set the important ones here
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".html": "text/html",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=FOLDER)
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
    print("Sprite Studio is running at http://localhost:{}  (press Ctrl+C to stop)".format(PORT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
