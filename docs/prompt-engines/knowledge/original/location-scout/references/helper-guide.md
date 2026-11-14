# Photo search and pack helper

Run with Python 3.10 or newer. Search, metadata resolution, and downloads use the standard library; contact-sheet creation needs Pillow (`python -m pip install Pillow`, or use an already available environment). The host must permit network and filesystem access. No Commons API key is needed.

Run commands from this skill directory, or replace `scripts/location_refs.py` with its absolute path.

```bash
python scripts/location_refs.py search --query 'Empire Diner' --limit 12 --out candidates.json
python scripts/location_refs.py resolve --titles-file titles.txt --out candidates.json
```

`titles.txt` contains exact Commons file titles, one per line, starting with `File:`. Search is a discovery step: its results are uninspected and may depict other places. Metadata resolution does not prove current conditions or scene suitability.

## Geographic search

Once the target coordinates have been verified, search Commons around the point (latitude and longitude in decimal degrees, radius in meters):

```bash
python scripts/location_refs.py geo-search --latitude 41.385 --longitude 2.18 --radius 500 --limit 20 --out nearby.json
```

Radius must be 10–10,000 meters; limit is 1–40. The manifest records the requested center and radius. Search only finds files that Commons has geocoded. Coordinates can refer to the camera or the photographed subject and can be incorrect; they do not establish that the image depicts the requested place. Verify each source and inspect each image, and combine geographic discovery with text or category search to find files without coordinates. A `search_incomplete` flag means Commons indicated more results; narrow the search or check Commons directly.

When an HTTPS proxy is configured, proxy-side DNS can be used for `commons.wikimedia.org` and `upload.wikimedia.org` if local DNS fails and the host is not bypassed. Other download hosts still require local DNS. The proxy's DNS and network policies must be trusted; the client cannot verify the address the proxy ultimately contacts.

Review each selected file page and its actual license. Remove irrelevant/unsupported entries. Set `rights_verified` to true only after that review. Assign stable IDs such as `R01`. Rename the manifest and add the scene brief/location. Then download:

For links in `Preview.html` and `Sources.txt`, add the verified target's decimal `latitude` and `longitude` to the top-level `location`, set `coordinates_verified` to `true`, and supply a `coordinate_evidence` description or source URL. Do not treat the geographic search center or an image's GPS as verified target coordinates without checking. The helper builds official Google Maps and Street View links, labeling Street View availability unverified. To label it confirmed, check it yourself and record `street_view_available:true` plus `street_view_evidence`; set it to `false` if you have checked and there is no view. A Street View link may open a nearby panorama, not the exact building. If verified coordinates are missing, a name-and-region location gives a Maps search link labeled for confirmation; no Street View link is invented. In the response, also include links for each verified location, or explain when a link cannot be verified. These links are for browsing, not image downloads or screenshots. Google describes the URL format at https://developers.google.com/maps/documentation/urls/get-started.

```bash
python scripts/location_refs.py download --manifest selected.json --out-dir Location-Pack
```

The resulting `Location-Pack/Manifest.json` contains real local filenames and SHA-256 checksums. Inspect those files visually, then edit that manifest to assign roles, observations, details to preserve, uncertainties, and proposed changes. Do not set `visual_inspected` merely because a filename or webpage description appears relevant.

Add complete prompts to the manifest's `prompts` mapping. The helper preserves these verbatim and places the role map before them. If omitted, it labels the result as **templates-only**; the agent must finish the prompts before claiming a complete shot package.

```bash
python scripts/location_refs.py pack --manifest Location-Pack/Manifest.json --out-dir Location-Pack
```

Outputs: `Preview.html`, `Contact-Sheet.jpg`, `Originals/`, `Manifest.json`, `Sources.txt`, `Prompts.txt`, and `Reference-Pack.zip`. Original image bytes stay unchanged. Thumbnails are resized for browsing. ZIP contents are explicit; unrelated files in the directory are not swept into the package. Rerunning download reuses originals only when their checksum agrees.

Verified CC BY-SA is included by default. Identify it to the user and retain each creator, license link and applicable conditions in the pack, including notice of changes and share-alike terms for adaptations as specified by the license. If the user needs to exclude it, add `--exclude-sharealike` to both download and pack. The older `--allow-sharealike` flag remains accepted. Never reclassify an image to avoid its actual license.

## Manually verified sources and fallback

If Commons API access is unavailable, use accessible source pages or a different provider's authorized tools. Construct a manifest with the same schema from directly verified evidence. This is also the import path for Flickr, owned photos, or separately licensed photographs. Do not bypass a provider's access controls, invent a download URL, or use a thumbnail as an original without labeling it.

Minimal example (replace values with actual inspected source records):

```json
{
  "schema_version": 1,
  "name": "Chosen location — reference pack",
  "brief": "The user's scene and intended coverage.",
  "location": {
    "name": "Verified place name",
    "region": "City or region",
    "source_page": "https://example.org/place-information",
    "latitude": 41.385,
    "longitude": 2.18,
    "coordinates_verified": true,
    "coordinate_evidence": "Replace with the source used to verify this exact location."
  },
  "images": [{
    "id": "R01",
    "title": "Actual photograph title",
    "source_page": "https://example.org/photo-page",
    "download_url": "https://example.org/original-photo.jpg",
    "creator": "Photographer name",
    "license": "CC BY 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "license_evidence": "File page explicitly gives CC BY 4.0; checked YYYY-MM-DD.",
    "rights_verified": true,
    "date_captured": null,
    "date_uploaded": null,
    "location": {
      "name": "Verified place name",
      "confidence": "source-confirmed",
      "evidence": "The photographer's caption identifies the place."
    },
    "role": "exterior geography",
    "visual_inspected": false,
    "observations": [],
    "preserve": [],
    "unknowns": ["Capture date is not supplied."],
    "proposed_changes": []
  }],
  "prompts": {
    "Shot 01 — still": "Complete prompt with real reference roles, action, camera, light, and preserved details.",
    "Shot 01 — video": "Complete motion prompt based on the approved still; settings are specified separately."
  }
}
```

Dates must remain null when unknown. Preserve raw date wording if the source only supplies a year. `date_uploaded` is the file revision/upload timestamp, not the scene date. Never infer what is outside the photograph from GPS metadata alone.

For a user-supplied local photograph, replace `download_url` with an absolute `local_path`. Use `license:"USER-PROVIDED"`, and include `authorization_note` describing the user's permission and `permission_evidence` identifying where it was provided. For other separate permission, use the same two fields while retaining the source's original license label. These fields document actual permission; they are not a way to approve an unknown photo automatically.

## Limits and expected failures

- Maximum 40 chosen images per pack; 64 MB per original. Raster JPEG, PNG, WebP, and TIFF only.
- Public HTTPS sources only. No embedded URL credentials, private-network addresses, or Google mapping image export endpoints.
- Network timeouts are 30 seconds. Temporary HTTP 429/5xx failures receive two bounded retries; access denials stop clearly.
- The helper verifies files and records evidence but cannot decide whether two views show the same room. That requires the agent's inspection.
- A complete pack must have sources, verified rights, actual original checksums, inspected observations, and assigned roles. Missing image coverage remains a limitation, not a generated substitute labeled as photography.
