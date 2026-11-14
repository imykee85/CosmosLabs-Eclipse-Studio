---
name: cinematic-location-scout
description: Find real film locations and deliver verified reference photos, a preview sheet, source credits, and cinematic prompts. Use for location scouting and consistent settings across AI-generated shots.
---

# Cinematic Location Scout

Turn a scene idea or a named place into a useful photographic reference pack and a coherent shot plan. Select locations for story, visible detail, and usable photo coverage. A photogenic place with no interior coverage may be a poor choice for an interior scene.

This skill supplies a workflow and a local helper. Web search and file execution must be available in the host. It does not add browser access, grant image rights, submit generations, or spend credits. If a tool is unavailable, complete the supported stages and identify the missing stage honestly.

## Find the setting

Use the user's scene, region, period, atmosphere, character action, and existing references. Ask only for choices that change the result substantially. For a broad idea, shortlist about three real places; for a specific location, start there. Rank candidates by scene suitability, identifying details, coverage of needed angles, reference quality, and reuse terms. Verify the name and region through source pages; do not present search suggestions as inspected locations.

Search publicly accessible location resources and photograph collections. Wikimedia Commons is the helper's built-in source; other sources can be imported after their specific terms are checked. Google Maps/Street View links can help the user explore a location. Do not screenshot, download, or automatically extract Street View imagery. An API key does not remove a provider's reuse restrictions.

For each verified location, include an official Google Maps link in the response and, where available, an official Street View link for users to explore. Use verified coordinates to construct the links and check Street View availability when practical. A coordinate-based Street View link can open a nearby panorama; if availability or the angle was not checked, say so. If verified coordinates are unavailable, use a name-and-region Maps search link labeled for confirmation and say Street View availability is unknown. Do not represent either link as a downloadable reference or as proof of current conditions.

For a specific location, verify its coordinates and use the helper's geographic radius search alongside text or category search. Geocoded results are candidates, not proof of the subject's location; files without coordinates will be missed. Verify the place and inspect the photographs.

Use a concise preview to let the user choose when the choice is consequential. If the user asks you to proceed autonomously, select the best-supported candidate and explain the choice. Do not manufacture missing views to make a candidate seem complete.

## Collect and inspect actual photographs

Read [the helper guide](references/helper-guide.md) before using `scripts/location_refs.py`. It can search Commons, resolve original files and metadata, download selected licensed photographs, and assemble the finished pack. Read [sources and rights](references/sources.md) when selecting a new provider or interpreting a license.

Prefer original photographs with clear provenance and suitable reuse terms. Include verified CC BY-SA along with CC0/public-domain and CC BY by default, without requiring an opt-in. Clearly identify share-alike images and their terms to the user, retain credits and license links, and indicate changes; share-alike conditions apply to adaptations as specified by the individual license. If the user needs to avoid those conditions, exclude share-alike and find alternatives. Exclude noncommercial, no-derivatives, unclear, or incompatible licenses unless the user has a separate permission that covers the intended use. Do not infer permission from a download button, a government domain, a tourism press page, or a stock subscription.

Download only the selected images. Preserve originals unchanged, record the source page, creator, license, capture date when known, upload date separately, and the evidence for the location. Respect access denials and rate limits. If a service is unavailable, use another permitted source or manually verified records; do not bypass the block. A search result, metadata description, or filename is not visual inspection.

Inspect every delivered image. Assign each one a job: establishing geography, interior layout, reverse view, sign/landmark, material detail, or lighting reference. Record visible observations, details to preserve, uncertainties, and any planned creative changes. Check photos belong to the same place and flag mixed dates or renovations. For nature, verify the region, season where known, terrain, and vegetation visible in the actual references.

## Direct the original scene

Keep the few identifying details that make the place particular: sign wording, façade, window/door relationship, pavement, road markings, actual landmark visibility, terrain, or vegetation. Distinguish these from proposed camera positions, lighting, weather, characters, and invented interiors. Do not claim exact measurements, unseen surfaces, or current conditions from an old photograph. Street View panoramas and still photographs are not a complete 3D reconstruction.

Build a short sequence around an action: an arrival, conversation, pursuit, departure, or journey. Maintain entrances, recurring landmarks, direction of travel, and character positions across cuts. A new angle must be supported by a reference or clearly labeled an interpretation. Keep foreground/background and screen-left/right explicit when needed.

Return a copy-ready still prompt and, when requested, a video prompt for each planned shot. State which real attached image supplies which information and what it must not contribute. A practical default is location photos plus a character reference → approved cinematic still → video. Do not invent model upload tokens. Put resolution, duration, and other provider controls outside the prompt and verify them before generation.

For an unspecified cinematic look, suggest restrained anamorphic character, fine grain, controlled highlights, and light motivated by the location. Warm light is appropriate when there is a source for it. Direct an observable actor action and plausible environmental motion; do not substitute a list of lens names for a scene. Inspect generated results for architecture drift, invented signage, and incorrect landmark positions. Exact text may need a finishing edit.

## Deliver the pack

Use the helper's `download` stage before image inspection, then update the resulting manifest and use `pack`. A finished pack contains:

- Original reference files, unchanged, with stable image IDs.
- A labeled contact sheet and an HTML preview with roles and credits.
- A source/credit record including capture versus upload dates, license links, and uncertainties.
- A reference-role map and usable still/video prompts, with observations separate from creative choices.
- A downloadable ZIP containing only the selected references and associated deliverables.

Always provide real file links the host can expose. Do not call a collection of remote links a downloaded pack, claim inspection based on metadata alone, or claim an output was generated when only its prompt was prepared. If a mandatory view is missing, say so and recommend another candidate or a separately authorized reference photo.
