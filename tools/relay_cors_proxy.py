#!/usr/bin/env python3
"""给 rkpp 抓包 relay 加 CORS 的小代理（浏览器直连 8765 会被跨域/PNA 挡住）。

用法：
    python relay_cors_proxy.py                 # 8766 -> 127.0.0.1:8765
    python relay_cors_proxy.py --port 8766 --target 127.0.0.1:8765
"""
from __future__ import annotations

import argparse
import http.client
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SKIP = {"connection", "keep-alive", "transfer-encoding", "content-length",
        "access-control-allow-origin", "access-control-allow-headers",
        "access-control-allow-methods", "access-control-allow-private-network"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    target_host = "127.0.0.1"
    target_port = 8765

    def log_message(self, fmt, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        conn = http.client.HTTPConnection(self.target_host, self.target_port, timeout=3600)
        try:
            conn.request("GET", self.path)
            resp = conn.getresponse()
            stream = "events" in self.path
            if not stream:
                body = resp.read()
                self.send_response(resp.status)
                self._cors()
                self.send_header("Content-Type", resp.getheader("Content-Type") or "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_response(resp.status)
            self._cors()
            self.send_header("Content-Type", resp.getheader("Content-Type") or "application/x-ndjson")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            while True:
                line = resp.readline()
                if not line:
                    break
                self.wfile.write(b"%x\r\n" % len(line) + line + b"\r\n")
                self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            try:
                body = ("proxy error: %s" % exc).encode()
                self.send_response(502)
                self._cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                pass
        finally:
            conn.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--target", default="127.0.0.1:8765")
    a = ap.parse_args()
    host, _, port = a.target.partition(":")
    Handler.target_host = host or "127.0.0.1"
    Handler.target_port = int(port or 8765)
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    srv.daemon_threads = True
    print(f"[proxy] http://{a.host}:{a.port} -> http://{a.target} (CORS + PNA)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
