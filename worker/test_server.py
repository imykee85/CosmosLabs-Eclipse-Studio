"""Run with: python3 -m unittest worker/test_server.py (no ffmpeg needed: a fake tool script stands in for the real ones)."""
import http.client, json, os, sys, tempfile, threading, time, unittest
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ["WORKER_SECRET"] = "test-secret"
import server  # noqa: E402

STORE = {}


class Store(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(STORE.get(self.path, b""))

    def do_PUT(self):
        n = int(self.headers.get("Content-Length", "0")); STORE[self.path] = self.rfile.read(n)
        self.send_response(200); self.end_headers()


class WorkerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = ThreadingHTTPServer(("127.0.0.1", 0), Store)
        threading.Thread(target=cls.store.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.store.server_address[1]}"
        cls.worker = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.worker.serve_forever, daemon=True).start()
        cls.port = cls.worker.server_address[1]
        # a stand-in tool: copies its first argument to the second
        cls.tooldir = tempfile.mkdtemp()
        with open(os.path.join(cls.tooldir, "fake.py"), "w") as f:
            f.write("import shutil,sys\nshutil.copy(sys.argv[1], sys.argv[2])\n")
        server.SCRIPTS = cls.tooldir
        server.TOOLS["probe"] = "fake.py"

    def call(self, method, path, body=None, auth="Bearer test-secret"):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        headers = {"Authorization": auth} if auth else {}
        data = json.dumps(body).encode() if body is not None else None
        if data:
            headers["Content-Type"] = "application/json"
        c.request(method, path, body=data, headers=headers)
        r = c.getresponse()
        return r.status, json.loads(r.read() or b"{}")

    def wait(self, job_id):
        for _ in range(200):
            _, j = self.call("GET", f"/jobs/{job_id}")
            if j["state"] in ("done", "failed"):
                return j
            time.sleep(0.05)
        self.fail("job did not finish")

    def test_refuses_without_the_secret(self):
        self.assertEqual(self.call("POST", "/jobs", {"tool": "probe", "args": [], "inputs": {}}, auth="Bearer nope")[0], 401)

    def test_refuses_unknown_tools_and_bad_names(self):
        self.assertEqual(self.call("POST", "/jobs", {"tool": "rm", "args": [], "inputs": {}})[0], 400)
        self.assertEqual(self.call("POST", "/jobs", {"tool": "probe", "args": [], "inputs": {"../x": "http://x"}})[0], 400)

    def test_runs_a_tool_on_signed_inputs_and_uploads_the_output(self):
        STORE["/in/clip"] = b"VIDEO-BYTES"
        status, job = self.call("POST", "/jobs", {"tool": "probe", "args": ["in:clip", "out:copy"], "inputs": {"clip": f"{self.base}/in/clip"},
                                                  "outputs": {"copy": {"url": f"{self.base}/up/copy", "contentType": "video/mp4"}}})
        self.assertEqual(status, 202)
        done = self.wait(job["id"])
        self.assertEqual(done["state"], "done", done)
        self.assertEqual(STORE["/up/copy"], b"VIDEO-BYTES")

    def test_a_failed_tool_is_reported_not_uploaded(self):
        status, job = self.call("POST", "/jobs", {"tool": "probe", "args": ["in:missing", "out:x"], "inputs": {"clip": f"{self.base}/in/none"},
                                                  "outputs": {"x": {"url": f"{self.base}/up/none"}}})
        self.assertEqual(self.wait(job["id"])["state"], "failed")
        self.assertNotIn("/up/none", STORE)


if __name__ == "__main__":
    unittest.main()
