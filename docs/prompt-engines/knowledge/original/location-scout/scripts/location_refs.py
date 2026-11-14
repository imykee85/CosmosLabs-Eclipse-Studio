#!/usr/bin/env python3
"""Search, download, inspect, and package real-location photo references.

Python 3.10+. Network stages use the standard library. Pillow is required only
for `pack` (contact sheet and file verification). No API key is needed for Commons.
"""
from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import html
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = os.environ.get("LOCATION_SCOUT_USER_AGENT", "CinematicLocationScout/1.0 (local photo-reference research; https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)")
MAX_BYTES = 64 * 1024 * 1024
MIME_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/tiff": ".tif"}
# Proxy-only DNS is permitted only for these fixed Wikimedia endpoints. Arbitrary
# manifest URLs must still resolve locally so private targets can be rejected.
PROXY_DNS_HOSTS = frozenset({"commons.wikimedia.org", "upload.wikimedia.org"})


class ScoutError(Exception):
    pass


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def clean(value):
    return html.unescape(re.sub(r"<[^>]+>", " ", str(value or ""))).strip()


def source_date(value):
    text = " ".join(clean(value).split())
    if text.casefold() in ("", "unknown", "unknown date", "date unknown", "undated", "not known", "not specified", "n/a"):
        return None
    return text


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_url(url, *, resolve=True):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ScoutError("Only public HTTPS URLs without embedded credentials are accepted.")
    if parsed.port not in (None, 443):
        raise ScoutError("Only the default HTTPS port is accepted.")
    if parsed.hostname.endswith(("googleusercontent.com", "googleapis.com")) or parsed.hostname == "maps.google.com":
        raise ScoutError("Google mapping imagery is not an export source for this helper.")
    if any(k.lower() in {"key", "api_key", "token", "access_token", "signature"} for k, _ in urllib.parse.parse_qsl(parsed.query)):
        raise ScoutError("Credential-bearing URLs must not be stored in a public reference manifest.")
    try:
        literal = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        literal = None
    if literal is not None and not literal.is_global:
        raise ScoutError("Private, local, and reserved network destinations are not accepted.")
    if resolve:
        try:
            addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
        except OSError as exc:
            # The configured proxy must actually handle this destination. Do not
            # grant this exception to redirects or user-provided hosts generally.
            proxies = urllib.request.getproxies()
            if (parsed.hostname in PROXY_DNS_HOSTS and proxies.get("https")
                    and not urllib.request.proxy_bypass(parsed.netloc)):
                return parsed
            raise ScoutError(f"Cannot resolve source host {parsed.hostname}: {type(exc).__name__}") from exc
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ScoutError("Private, local, and reserved network destinations are not accepted.")
    return parsed


class CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def get_bytes(url, *, max_bytes=MAX_BYTES):
    parsed = validate_url(url)
    opener = urllib.request.build_opener(CheckedRedirect())
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,image/*;q=0.9,*/*;q=0.1"})
            with opener.open(req, timeout=30) as response:
                length = response.headers.get("Content-Length")
                if length and int(length) > max_bytes:
                    raise ScoutError(f"Source file exceeds the {max_bytes // (1024*1024)} MB limit.")
                data = response.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise ScoutError("Source file exceeds the download limit.")
                return data, response.headers.get_content_type(), response.geturl()
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < 2:
                delay = 2 ** attempt
                retry_after = exc.headers.get("Retry-After", "") if exc.headers else ""
                if retry_after:
                    try:
                        advised = float(retry_after)
                    except ValueError:
                        try:
                            advised = (email.utils.parsedate_to_datetime(retry_after) - dt.datetime.now(dt.timezone.utc)).total_seconds()
                        except (ValueError, TypeError):
                            advised = 0
                    delay = max(delay, advised)
                if delay > 20:
                    raise ScoutError(f"{parsed.hostname} requests a longer retry delay; stop and retry later rather than ignoring its rate limit.") from exc
                time.sleep(delay)
                continue
            raise ScoutError(f"{parsed.hostname} returned HTTP {exc.code}; no access workaround attempted. Try another permitted source or a verified manual record.") from exc
        except urllib.error.URLError as exc:
            raise ScoutError(f"Network request to {parsed.hostname} failed ({type(exc.reason).__name__}). Check host/network access; no download was claimed.") from exc
    raise ScoutError("Request failed.")


def api_call(params):
    query = {"action": "query", "format": "json", "formatversion": "2", **params}
    data, _, _ = get_bytes(API + "?" + urllib.parse.urlencode(query), max_bytes=8 * 1024 * 1024)
    result = json.loads(data)
    if "error" in result:
        raise ScoutError("Commons API error: " + str(result["error"].get("code", "unknown")))
    return result


def license_class(record):
    """Conservative classifier; a source review is still required before download."""
    label = str(record.get("license", "")).upper().strip()
    url = str(record.get("license_url", "")).lower()
    if any(x in label for x in ("-NC", "-ND", "NONCOMMERCIAL", "NO DERIVATIVES")) or re.search(r"/by-(?:nc|nd)", url):
        return "restricted"
    if "CC0" in label or "/publicdomain/zero/" in url:
        return "cc0"
    if label in ("PUBLIC DOMAIN", "PUBLIC-DOMAIN", "PD") or "/publicdomain/mark/" in url:
        return "public-domain"
    if re.fullmatch(r"CC BY-SA(?: \d(?:\.\d)?)?", label) or re.search(r"creativecommons\.org/licenses/by-sa/", url):
        return "cc-by-sa"
    if re.fullmatch(r"CC BY(?: \d(?:\.\d)?)?", label) or re.search(r"creativecommons\.org/licenses/by/", url):
        return "cc-by"
    if label in ("USER-PROVIDED", "OWNED", "PERMISSION", "SEPARATELY LICENSED"):
        return "permission"
    return "unknown"


def check_rights(record, allow_sharealike=True):
    if record.get("rights_verified") is not True:
        raise ScoutError(f"{record.get('id', 'Image')}: set rights_verified:true only after reading the source's actual license or permission.")
    if not record.get("source_page") or not record.get("license_evidence"):
        raise ScoutError("Every image needs source_page and license_evidence.")
    cls = license_class(record)
    if record.get("authorization_note"):
        if not record.get("permission_evidence"):
            raise ScoutError("A separate permission requires permission_evidence.")
        return "separate-permission"
    if cls == "cc-by-sa" and not allow_sharealike:
        raise ScoutError("Share-alike image excluded by the selected license policy; choose another image or allow share-alike.")
    if cls not in ("cc0", "public-domain", "cc-by", "cc-by-sa"):
        raise ScoutError(f"Unsupported or unclear license ({cls}); supply separately verified permission or choose another photo.")
    if cls in ("cc-by", "cc-by-sa") and (not record.get("creator") or not record.get("license_url")):
        raise ScoutError("Attribution licenses require creator and license_url.")
    return cls


def record_from_page(page, index):
    infos = page.get("imageinfo", [])
    if not infos:
        return None
    info = infos[0]
    meta = info.get("extmetadata", {})
    def val(key):
        return clean(meta.get(key, {}).get("value"))
    title = page.get("title", "Unknown")
    return {
        "id": f"R{index:02d}", "title": title,
        "source_page": info.get("descriptionurl") or "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
        "download_url": info.get("url", ""), "mime": info.get("mime", ""),
        "width": info.get("width"), "height": info.get("height"),
        "creator": val("Artist"), "credit_line": val("Credit"),
        "license": val("LicenseShortName"), "license_url": val("LicenseUrl"),
        "license_evidence": "Commons file page and API extmetadata (review before use)",
        "rights_verified": False,
        "date_captured": source_date(val("DateTimeOriginal")),
        "date_uploaded": source_date(info.get("timestamp")),
        "date_uploaded_basis": "Latest Commons file revision timestamp",
        "location": {"name": "", "latitude": val("GPSLatitude") or None, "longitude": val("GPSLongitude") or None, "confidence": "unverified", "evidence": ""},
        "source_description": val("ImageDescription"),
        "role": "", "visual_inspected": False, "observations": [], "preserve": [], "unknowns": [], "proposed_changes": [],
    }


def candidate_manifest(pages, brief=""):
    records = []
    for page in pages:
        r = record_from_page(page, len(records) + 1)
        if r and r["mime"] in MIME_EXT:
            r["license_classification"] = license_class(r)
            records.append(r)
    return {"schema_version": 1, "name": "Location reference candidates", "brief": brief, "created_utc": now(), "status": "candidates-uninspected", "location": {}, "images": records}


def validate_manifest(manifest):
    images = manifest.get("images")
    if not isinstance(images, list) or not images:
        raise ScoutError("Manifest must contain a nonempty images array.")
    if len(images) > 40:
        raise ScoutError("A reference pack is limited to 40 selected images; split larger projects by location.")
    seen = set()
    for record in images:
        rid = record.get("id", "")
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", rid):
            raise ScoutError("Image IDs must be 1–64 letters, digits, underscores or hyphens, starting with a letter/digit.")
        if rid.lower() in seen:
            raise ScoutError("Duplicate image ID.")
        seen.add(rid.lower())
    return images


def signature_mime(data):
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "image/tiff"
    raise ScoutError("Source is not a supported raster photo (JPEG, PNG, WebP, TIFF).")


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def output_file(root, rel):
    root = Path(root).resolve()
    if "\\" in str(rel) or "\x00" in str(rel):
        raise ScoutError("Pack paths cannot contain backslashes or null bytes.")
    rel = Path(rel)
    if rel.is_absolute() or ".." in rel.parts:
        raise ScoutError("Pack paths must be relative and stay inside the output directory.")
    target = root / rel
    if not target.resolve().is_relative_to(root) or target.is_symlink():
        raise ScoutError("A pack path escapes the output directory or is a symlink.")
    return target


def download(manifest, root, allow_sharealike=True):
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    images = validate_manifest(manifest)
    # Validate the entire batch before making any request.
    for record in images:
        check_rights(record, allow_sharealike)
    for record in images:
        existing = record.get("file")
        if existing and record.get("sha256"):
            path = output_file(root, existing)
            if path.is_file() and digest(path) == record["sha256"]:
                continue
        if record.get("local_path"):
            source = Path(record["local_path"]).expanduser()
            if source.stat().st_size > MAX_BYTES:
                raise ScoutError("Local image exceeds the size limit.")
            data = source.read_bytes()
            resolved_url = None
        else:
            url = record.get("download_url", "")
            validate_url(url)
            data, _, resolved_url = get_bytes(url)
        mime = signature_mime(data)
        rel = "Originals/" + record["id"] + MIME_EXT[mime]
        path = output_file(root, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and digest(path) != hashlib.sha256(data).hexdigest():
            raise ScoutError(f"{rel} already exists with different content. Use a new output directory or image ID.")
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(path)
        record.update({"file": rel, "mime": mime, "bytes": len(data), "sha256": digest(path), "downloaded_utc": now(), "original_unchanged": True})
        if resolved_url:
            record["resolved_download_url"] = resolved_url
        record.pop("local_path", None)
        manifest["status"] = "downloaded-awaiting-inspection"
        write_json(root / "Manifest.json", manifest)
    write_json(root / "Manifest.json", manifest)
    return manifest


def ref_text(record):
    lines = [f"{record['id']} — {record.get('title', '')}", f"Role: {record.get('role', '')}"]
    for key, label in (("observations", "Observed"), ("preserve", "Preserve"), ("unknowns", "Unknown / not evidenced"), ("proposed_changes", "Creative changes")):
        if record.get(key):
            lines.append(label + ": " + "; ".join(record[key]))
    return "\n".join(lines)


def make_prompt_text(manifest):
    refs = "\n\n".join(ref_text(r) for r in manifest["images"])
    prompt_map = manifest.get("prompts", {})
    if prompt_map:
        if not isinstance(prompt_map, dict) or not all(isinstance(v, str) for v in prompt_map.values()):
            raise ScoutError("prompts must map shot/prompt names to complete prompt strings.")
        prompts = "\n\n".join(f"{name}\n{text}" for name, text in prompt_map.items())
        state = "Complete agent-authored prompts; review references and model controls before generation."
    else:
        prompts = ("STILL PROMPT TEMPLATE — COMPLETE BEFORE GENERATING\n"
                   "Create an original cinematic still of [character and single observable action] at [chosen location/time]. "
                   "Use the attached numbered references according to the role map above. Preserve the listed identifying details and spatial relationships. "
                   "[Specify framing, a feasible camera position, motivated lighting, and only the creative changes intended.] "
                   "Treat unobserved geometry as a proposed interpretation, not documentary evidence.\n\n"
                   "VIDEO PROMPT TEMPLATE — COMPLETE AFTER APPROVING THE STILL\n"
                   "Use [approved cinematic still] as the starting frame. [State the actor's objective, one feasible action and its consequence.] "
                   "[Specify one camera behavior, plausible environmental movement, and motivated sounds.] "
                   "Preserve location landmarks, sign wording, entrance/window placement, character identity and prop ownership. "
                   "[State the final position and direction of travel.]\n\n"
                   "SETTINGS\nProvider/model, duration, image size, aspect ratio and reference-upload syntax must be verified separately.")
        state = "Templates only: the agent has not supplied complete shot prompts."
    return f"{manifest.get('name', 'Location reference pack')}\n{manifest.get('brief', '')}\n\n{state}\n\nREFERENCE ROLES\n{refs}\n\n{prompts}\n"


def exploration_links(manifest):
    """Build Google exploration links from verified coordinates or a named search."""
    location = manifest.get("location")
    if not isinstance(location, dict):
        return []
    def name_search():
        name, region = location.get("name"), location.get("region")
        if not isinstance(name, str) or not name.strip() or not isinstance(region, str) or not region.strip():
            return []
        query = f"{name.strip()}, {region.strip()}"
        maps = "https://www.google.com/maps/search/?" + urllib.parse.urlencode({"api": "1", "query": query})
        return [("Search Google Maps for location; confirm result", maps)]
    if location.get("coordinates_verified") is not True or not location.get("coordinate_evidence"):
        return name_search()
    try:
        raw_lat, raw_lon = location["latitude"], location["longitude"]
        if isinstance(raw_lat, bool) or isinstance(raw_lon, bool):
            return name_search()
        lat, lon = float(raw_lat), float(raw_lon)
    except (KeyError, TypeError, ValueError, OverflowError):
        return name_search()
    if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        return name_search()
    point = f"{lat},{lon}"
    maps = "https://www.google.com/maps/search/?" + urllib.parse.urlencode({"api": "1", "query": point})
    links = [("Open location in Google Maps", maps)]
    if location.get("street_view_available") is not False:
        street = "https://www.google.com/maps/@?" + urllib.parse.urlencode({"api": "1", "map_action": "pano", "viewpoint": point})
        label = "Open Street View near location" if location.get("street_view_available") is True and location.get("street_view_evidence") else "Try Street View near location; availability unverified"
        links.append((label, street))
    return links


def credits_text(manifest):
    lines = [manifest.get("name", "Location reference pack"), "Original reference photographs are unchanged. Preview thumbnails are resized for display.", ""]
    links = exploration_links(manifest)
    if links:
        lines += ["LOCATION EXPLORATION (Street View links, when provided, may select a nearby panorama)"]
        lines += [f"{label}: {url}" for label, url in links]
        lines += [""]
    if any(license_class(r) == "cc-by-sa" and not r.get("authorization_note") for r in manifest["images"]):
        lines += ["This pack includes CC BY-SA images. Follow each image's linked license, including attribution, a license link and indication of changes; share-alike terms apply to adaptations as specified by that license.", ""]
    for r in manifest["images"]:
        lines += [r["id"] + " — " + r.get("title", ""), "Creator: " + r.get("creator", "Unknown"), "Source: " + r["source_page"], "License: " + r.get("license", "") + " " + r.get("license_url", ""), "Captured: " + str(r.get("date_captured") or "Unknown"), "Uploaded: " + str(r.get("date_uploaded") or "Unknown"), "Location evidence: " + json.dumps(r.get("location", {}), ensure_ascii=False)]
        if r.get("authorization_note"):
            lines += ["Separate permission: " + r["authorization_note"], "Permission evidence: " + str(r.get("permission_evidence", ""))]
        if r.get("unknowns"):
            lines += ["Uncertainties: " + "; ".join(r["unknowns"])]
        lines += [""]
    lines += ["Reuse of originals and adaptations must meet the recorded license/permission conditions. Generated interpretations are not location photographs."]
    return "\n".join(lines) + "\n"


def font(size):
    from PIL import ImageFont
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf", "C:/Windows/Fonts/arial.ttf"):
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def wrapped_lines(draw, text, face, max_width, max_lines):
    words = text.split()
    lines = []
    while words and len(lines) < max_lines:
        line = words.pop(0)
        while words and draw.textlength(line + " " + words[0], font=face) <= max_width:
            line += " " + words.pop(0)
        while draw.textlength(line, font=face) > max_width and len(line) > 1:
            line = line[:-1]
        lines.append(line)
    if words and lines:
        while draw.textlength(lines[-1] + "…", font=face) > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] += "…"
    return lines


def make_sheet(manifest, root):
    try:
        from PIL import Image, ImageDraw, ImageOps
    except ImportError as exc:
        raise ScoutError("Contact-sheet rendering needs Pillow. Install with `python -m pip install Pillow`, or use an existing Python environment with Pillow.") from exc
    count = len(manifest["images"])
    width, pad, gap, cardw, cardh = 1440, 48, 24, 660, 620
    rows = (count + 1) // 2
    sheet = Image.new("RGB", (width, 150 + rows * (cardh + gap) + 30), "#111719")
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 32), manifest.get("name", "Location reference pack")[:70], font=font(34), fill="#f3eee5")
    draw.text((pad, 88), f"{count} original references · numbered roles · source credits in Sources.txt", font=font(20), fill="#abb7b5")
    for i, r in enumerate(manifest["images"]):
        x, y = pad + (i % 2) * (cardw + gap), 150 + (i // 2) * (cardh + gap)
        draw.rounded_rectangle((x, y, x + cardw, y + cardh), 12, fill="#1d2729")
        with Image.open(output_file(root, r["file"])) as im:
            im.verify()
        with Image.open(output_file(root, r["file"])) as im:
            r["verified_width"], r["verified_height"] = im.size
            thumb = ImageOps.contain(ImageOps.exif_transpose(im).convert("RGB"), (cardw - 24, 352))
            sheet.paste(thumb, (x + (cardw - thumb.width)//2, y + 12 + (352 - thumb.height)//2))
        for n, line in enumerate(wrapped_lines(draw, r["id"] + " · " + r["role"], font(22), cardw - 36, 2)):
            draw.text((x + 18, y + 380 + n * 28), line, font=font(22), fill="#e9c88a")
        line_y = y + 447
        summary = "; ".join(r.get("preserve") or r.get("observations") or [])
        for line in wrapped_lines(draw, summary, font(17), cardw - 36, 4):
            draw.text((x + 18, line_y), line, font=font(17), fill="#f1eee8")
            line_y += 24
        credit = f"{r.get('creator', '')} · {r.get('license', '')}"
        credit_line = wrapped_lines(draw, credit, font(14), cardw - 36, 1)[0]
        draw.text((x + 18, y + cardh - 35), credit_line, font=font(14), fill="#aab6b4")
    sheet.save(Path(root) / "Contact-Sheet.jpg", quality=92)


def make_html(manifest, *, include_download=True):
    esc = lambda x: html.escape(str(x or ""), quote=True)
    cards = []
    download_link = '<a href="Reference-Pack.zip">Download complete ZIP</a>' if include_download else ""
    links = exploration_links(manifest)
    exploration = ""
    if links:
        anchors = " · ".join(f'<a href="{esc(url)}" target="_blank" rel="noopener">{esc(label)}</a>' for label, url in links)
        exploration = f'<p class="intro"><b>Explore location:</b> {anchors}. Street View may open a nearby panorama.</p>'
    for r in manifest["images"]:
        source = r["source_page"]
        valid_link = urllib.parse.urlsplit(source).scheme in ("https", "http")
        anchor = f'<a href="{esc(source)}" target="_blank" rel="noopener">Source photograph</a>' if valid_link else esc(source)
        sections = []
        for key, label in (("observations", "Observed"), ("preserve", "Preserve"), ("unknowns", "Uncertain"), ("proposed_changes", "Proposed")):
            if r.get(key):
                sections.append(f'<p><b>{label}</b> {esc(" · ".join(r[key]))}</p>')
        cards.append(f'<article><a href="{esc(r["file"])}"><img src="{esc(r["file"])}" alt="{esc(r.get("title"))}"></a><div class="body"><span>{esc(r["id"])} / {esc(r["role"])}</span><h2>{esc(r.get("title"))}</h2>{"".join(sections)}<footer>{esc(r.get("creator"))} · {esc(r.get("license"))}<br>Captured: {esc(r.get("date_captured") or "unknown")} · Uploaded: {esc(r.get("date_uploaded") or "unknown")}<br>{anchor}</footer></div></article>')
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(manifest.get("name"))}</title><style>body{{margin:0;background:#111719;color:#f3eee5;font:16px/1.55 system-ui,sans-serif}}main{{max-width:1440px;margin:auto;padding:42px}}h1{{font-size:40px;line-height:1.1}}.intro{{max-width:900px;color:#b4c0be}}nav{{display:flex;gap:24px;flex-wrap:wrap;margin:28px 0}}a{{color:#e9c88a}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}}article{{background:#1d2729;border-radius:12px;overflow:hidden}}img{{width:100%;height:340px;object-fit:contain;background:#090d0e}}.body{{padding:22px}}span{{color:#e9c88a;font-size:13px;text-transform:uppercase;letter-spacing:.06em}}h2{{font-size:19px}}p{{font-size:14px}}footer{{font-size:12px;color:#aab6b4;border-top:1px solid #3c4849;padding-top:14px}}@media(max-width:600px){{main{{padding:20px}}h1{{font-size:30px}}img{{height:240px}}}}</style><main><div class="intro">CINEMATIC LOCATION SCOUT · REAL PHOTOGRAPHIC REFERENCES</div><h1>{esc(manifest.get("name"))}</h1><p class="intro">{esc(manifest.get("brief"))}</p>{exploration}<nav>{download_link}<a href="Contact-Sheet.jpg">Contact sheet</a><a href="Prompts.txt">Reference roles & prompts</a><a href="Sources.txt">Sources & credits</a><a href="Manifest.json">Metadata</a></nav><section class="grid">{"".join(cards)}</section></main></html>'''


def pack(manifest, root, allow_sharealike=True):
    root = Path(root).resolve()
    images = validate_manifest(manifest)
    for r in images:
        check_rights(r, allow_sharealike)
        if r.get("visual_inspected") is not True or not r.get("role") or not r.get("observations"):
            raise ScoutError(f"{r['id']}: pack requires visual_inspected:true, a role, and actual observations.")
        for key in ("observations", "preserve", "unknowns", "proposed_changes"):
            if not isinstance(r.get(key, []), list) or not all(isinstance(v, str) for v in r.get(key, [])):
                raise ScoutError(f"{r['id']}: {key} must be a list of strings.")
        if not r.get("file") or not r.get("sha256"):
            raise ScoutError(f"{r['id']}: run download first so the original file and checksum exist.")
        path = output_file(root, r["file"])
        if not path.is_file() or digest(path) != r["sha256"]:
            raise ScoutError(f"{r['id']}: original missing or changed; the pack was not built.")
    make_sheet(manifest, root)
    manifest["status"] = "inspected-reference-pack"
    manifest["packaged_utc"] = now()
    manifest["prompt_status"] = "authored" if manifest.get("prompts") else "templates-only"
    write_json(root / "Manifest.json", manifest)
    (root / "Sources.txt").write_text(credits_text(manifest), encoding="utf-8")
    (root / "Prompts.txt").write_text(make_prompt_text(manifest), encoding="utf-8")
    (root / "Preview.html").write_text(make_html(manifest), encoding="utf-8")
    paths = [r["file"] for r in images] + ["Manifest.json", "Sources.txt", "Prompts.txt", "Contact-Sheet.jpg", "Preview.html"]
    with zipfile.ZipFile(root / "Reference-Pack.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for rel in paths:
            if rel == "Preview.html":
                z.writestr(rel, make_html(manifest, include_download=False))
            else:
                z.write(output_file(root, rel), arcname=rel)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("search", help="Search Commons original-image candidates; no photos downloaded.")
    p.add_argument("--query", required=True); p.add_argument("--out", required=True); p.add_argument("--limit", type=int, default=12)
    p = sub.add_parser("geo-search", help="Search geotagged Commons files within a radius; no photos downloaded.")
    p.add_argument("--latitude", type=float, required=True, help="Center latitude in decimal degrees (-90 to 90).")
    p.add_argument("--longitude", type=float, required=True, help="Center longitude in decimal degrees (-180 to 180).")
    p.add_argument("--radius", type=int, default=500, help="Radius in meters (10 to 10000; default 500).")
    p.add_argument("--limit", type=int, default=12)
    p.add_argument("--out", required=True)
    p = sub.add_parser("resolve", help="Resolve Commons File: titles to original URLs and metadata.")
    p.add_argument("--titles-file", required=True); p.add_argument("--out", required=True)
    for name in ("download", "pack"):
        p = sub.add_parser(name)
        p.add_argument("--manifest", required=True); p.add_argument("--out-dir", required=True)
        licensing = p.add_mutually_exclusive_group()
        licensing.add_argument("--allow-sharealike", dest="allow_sharealike", action="store_true", help="Include reviewed CC BY-SA images (the default).")
        licensing.add_argument("--exclude-sharealike", dest="allow_sharealike", action="store_false", help="Exclude CC BY-SA images.")
        p.set_defaults(allow_sharealike=True)
    args = parser.parse_args(argv)
    if args.command in ("search", "geo-search", "resolve"):
        base = {"prop": "imageinfo", "iiprop": "url|size|mime|timestamp|extmetadata", "iiextmetadatafilter": "Artist|Credit|LicenseShortName|LicenseUrl|DateTimeOriginal|ImageDescription|GPSLatitude|GPSLongitude", "iiextmetadatalanguage": "en"}
        if args.command == "search":
            if not 1 <= args.limit <= 40:
                raise ScoutError("--limit must be between 1 and 40.")
            base.update({"generator": "search", "gsrsearch": args.query, "gsrnamespace": 6, "gsrlimit": args.limit})
        elif args.command == "geo-search":
            if not math.isfinite(args.latitude) or not -90 <= args.latitude <= 90:
                raise ScoutError("--latitude must be a finite number between -90 and 90.")
            if not math.isfinite(args.longitude) or not -180 <= args.longitude <= 180:
                raise ScoutError("--longitude must be a finite number between -180 and 180.")
            if not 10 <= args.radius <= 10000:
                raise ScoutError("--radius must be between 10 and 10000 meters.")
            if not 1 <= args.limit <= 40:
                raise ScoutError("--limit must be between 1 and 40.")
            base.update({"generator": "geosearch", "ggscoord": f"{args.latitude}|{args.longitude}", "ggsradius": args.radius, "ggsnamespace": 6, "ggsprimary": "all", "ggslimit": args.limit})
        else:
            titles = [x.strip() for x in Path(args.titles_file).read_text(encoding="utf-8").splitlines() if x.strip()]
            if not 1 <= len(titles) <= 40 or any(not x.startswith("File:") for x in titles):
                raise ScoutError("Provide 1–40 exact Commons File: titles, one per line.")
            base["titles"] = "|".join(titles)
        response = api_call(base)
        pages = response.get("query", {}).get("pages", [])
        pages.sort(key=lambda p: p.get("index", 99999))
        manifest = candidate_manifest(pages, getattr(args, "query", ""))
        if args.command == "geo-search":
            manifest["search"] = {"method": "commons-geosearch", "latitude": args.latitude, "longitude": args.longitude, "radius_meters": args.radius, "limit": args.limit, "note": "Geocoded results are candidates only. Coordinates can identify the camera or subject and may be inaccurate; verify each image and location. Search by text or category as well because not all files are geocoded."}
        if response.get("continue"):
            manifest["search_incomplete"] = True
            manifest["search_note"] = "Commons returned a continuation; results may be incomplete. Narrow the search or check Commons directly."
        write_json(args.out, manifest)
        print(json.dumps({"status": manifest["status"], "images": len(manifest["images"]), "manifest": str(Path(args.out).resolve())}))
    else:
        manifest = read_json(args.manifest)
        result = (download if args.command == "download" else pack)(manifest, args.out_dir, args.allow_sharealike)
        print(json.dumps({"status": result["status"], "images": len(result["images"]), "output": str(Path(args.out_dir).resolve()), "prompt_status": result.get("prompt_status")}))


if __name__ == "__main__":
    try:
        main()
    except (ScoutError, OSError, ValueError, KeyError) as exc:
        print("Location Scout: " + str(exc), file=sys.stderr)
        sys.exit(1)
