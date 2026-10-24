"""Eclone media worker: runs the tested ALTER scripts (ffmpeg, numpy, Pillow) for the Eclipse app.

The app never sends a command line. It names one of the TOOLS below, gives the arguments, and gives signed links:
inputs are downloaded to a temporary folder, outputs are uploaded to signed upload links when the tool finishes.
Jobs run in the background; the app polls GET /jobs/<id>. Every request must carry the shared secret.

Environment: WORKER_SECRET (required), WORKER_TIMEOUT_S (default 900), WORKER_MAX_JOBS (default 2).
"""
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, "scripts")
TOOLS = {
    "probe": "alter_probe.py", "prep": "alter_prep.py", "frame": "alter_frame.py", "check": "alter_check.py",
    "finish": "alter_finish.py", "versions": "alter_versions.py", "split": "alter_split.py", "assemble": "alter_assemble.py",
}
MAX_BYTES = 600 * 1024 * 1024
SECRET = os.environ.get("WORKER_SECRET", "")
TIMEOUT = int(os.environ.get("WORKER_TIMEOUT_S", "900"))
JOBS: dict = {}
LOCK = threading.Lock()
SLOTS = threading.BoundedSemaphore(int(os.environ.get("WORKER_MAX_JOBS", "2")))
NAME = re.compile(r"^[a-z][a-z0-9_]{0,30}$")


def authorised(header: str) -> bool:
    return bool(SECRET) and header.startswith("Bearer ") and hmac.compare_digest(header[7:], SECRET)


def fetch(url: str, dest: str) -> None:
    with urllib.request.urlopen(url, timeout=120) as r, open(dest, "wb") as f:
        total = 0
        while chunk := r.read(1 << 20):
            total += len(chunk)
            if total > MAX_BYTES:
                raise ValueError("input is larger than 600 MB")
            f.write(chunk)


def push(url: str, path: str, content_type: str) -> None:
    with open(path, "rb") as f:
        req = urllib.request.Request(url, data=f.read(), method="PUT", headers={"Content-Type": content_type})
    urllib.request.urlopen(req, timeout=300).close()


def run_job(job_id: str, body: dict) -> None:
    job = JOBS[job_id]
    work = tempfile.mkdtemp(prefix="eclone-")
    try:
        with SLOTS:
            job["state"] = "running"
            # Arguments name files as "in:<name>" (an input) or "out:<name>" (an output); everything else is a plain value.
            paths = {}
            for name, url in body["inputs"].items():
                paths[f"in:{name}"] = os.path.join(work, f"in_{name}")
                fetch(url, paths[f"in:{name}"])
            for name in body.get("outputs", {}):
                paths[f"out:{name}"] = os.path.join(work, f"out_{name}")
            args = [paths.get(a, a) for a in body["args"]]
            proc = subprocess.run([sys.executable, os.path.join(SCRIPTS, TOOLS[body["tool"]]), *args], cwd=work, capture_output=True, text=True, timeout=TIMEOUT)
            job.update(returncode=proc.returncode, stdout=proc.stdout[-4000:], stderr=proc.stderr[-4000:])
            if proc.returncode != 0:
                job["state"] = "failed"
                return
            for name, spec in body.get("outputs", {}).items():
                path = paths[f"out:{name}"]
                if not os.path.exists(path):
                    raise FileNotFoundError(f"{body['tool']} did not write output {name}")
                push(spec["url"], path, spec.get("contentType", "application/octet-stream"))
            job["state"] = "done"
    except subprocess.TimeoutExpired:
        job.update(state="failed", error="timed out")
    except Exception as err:  # the reason is kept for the owner; the app shows a plain message
        job.update(state="failed", error=str(err)[:500])
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if not authorised(self.headers.get("Authorization", "")):
            return self._json(401, {"error": "unauthorised"})
        if self.path != "/jobs":
            return self._json(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
        except ValueError:
            return self._json(400, {"error": "bad json"})
        if body.get("tool") not in TOOLS or not isinstance(body.get("args"), list) or not isinstance(body.get("inputs"), dict):
            return self._json(400, {"error": "unknown tool or bad body"})
        outs = body.get("outputs", {})
        if not isinstance(outs, dict) or not all(isinstance(v, dict) and isinstance(v.get("url"), str) for v in outs.values()):
            return self._json(400, {"error": "outputs need a signed url each"})
        if not all(NAME.match(k) for k in list(body["inputs"]) + list(outs)):
            return self._json(400, {"error": "bad file name"})
        job_id = uuid.uuid4().hex
        with LOCK:
            JOBS[job_id] = {"state": "queued", "created": time.time()}
        threading.Thread(target=run_job, args=(job_id, body), daemon=True).start()
        return self._json(202, {"id": job_id, "state": "queued"})

    def do_GET(self):
        if not authorised(self.headers.get("Authorization", "")):
            return self._json(401, {"error": "unauthorised"})
        m = re.fullmatch(r"/jobs/([0-9a-f]{32})", self.path)
        if not m or m.group(1) not in JOBS:
            return self._json(404, {"error": "not found"})
        return self._json(200, JOBS[m.group(1)])


if __name__ == "__main__":
    if not SECRET:
        sys.exit("WORKER_SECRET is not set")
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
