# Seedance 2.0 delivery settings

Higgsfield's public Seedance help was rechecked **30 October 2026**. The fal schemas and other surface observations below are retained from **29 October 2026**, not newly inspected during the performance revision. Availability varies by provider, mode, region and account. Recheck the selected surface before a generation. This skill authors prompts; it does not provide model access, credits or a generation tool.

## 4K is a control, not a prompt adjective

Higgsfield's official changelog describes Seedance 2.0 4K generation without a separate upscale. Its documented route is **Video → Seedance 2.0 → resolution 4K**. Its help page lists 4–15 seconds and 480p through 4K for 2.0; Fast and Mini have different limits. This is a provider-supported generation route, not an independent audit of the model's architecture.

The reviewed public project also includes Seedance 2 cards labeled 4k, High bitrate and 4032×1728. Those wide-frame dimensions should not be called 3840×2160. Keep the actual output size, aspect ratio and provider's resolution tier distinct.

Cinema Studio and a connector catalog are separate surfaces. During research, Cinema Studio v4 exposed only 480p/720p/1080p, while the connector returned 2.5 in its model search. Neither establishes the direct Seedance 2.0 tool's limits. If the selected surface lacks 4K or 2.0, say so and offer the documented direct route. Do not quietly select 2.5.

Sources: [Higgsfield changelog](https://higgsfield.ai/creator-hub/changelog), [Higgsfield Seedance help](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-seedance).

## Choose the correct mode

Do not transfer the video model's controls to a still-image tool. Verify the image model/mode separately when preparing a location or first frame. Motion-reference support is not equivalent to exact performance transfer or motion capture; scope what the clip should guide and inspect the result.

- **Text-to-video:** no supplied starting image; describe the opening arrangement clearly.
- **Image-to-video:** an approved image anchors the starting composition; an optional supported end frame can constrain the destination. Do not treat this as an arbitrary identity-reference slot.
- **Reference-to-video:** separate images, clips or audio guide identity, style, location, motion or voice. Assign explicit roles and use the host's actual syntax.

Higgsfield help documents up to nine images, three videos and three audio references for Seedance 2.0. Confirm the current combined limits, file constraints and named-reference UI there; do not assume fal's exact rules apply to every host.

## Verified fal routes

| Route | Endpoint |
|---|---|
| Text-to-video | `bytedance/seedance-2.0/text-to-video` |
| Image-to-video, inspected US variant | `bytedance/seedance-2.0/us/image-to-video` |
| Reference-to-video | `bytedance/seedance-2.0/reference-to-video` |

The inspected schemas expose `resolution`: `480p`, `720p`, `1080p`, `4k`; duration `auto` or whole seconds 4–15; aspect ratio `auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`; audio choice, `bitrate_mode` standard/high and codec auto/H264/H265. Use the exact schema for the actual endpoint—enterprise, fast, regional or newer-model routes may differ.

The inspected image-to-video variant requires `image_url` and supports `end_image_url`. This is not the same input contract as reference-to-video.

For the inspected reference-to-video endpoint:

- Image references: up to nine, maximum 30 MB each; prompt syntax `@Image1`, `@Image2`, etc.
- Video references: up to three; combined duration 2–15 seconds, combined size under 50 MB, MP4/MOV. Check the current schema's dimension constraints before uploading.
- Audio references: up to three; combined duration at most 15 seconds, maximum 15 MB each, MP3/WAV; requires at least one image or video reference.
- Combined total across modalities: at most **12 files**, not 9+3+3 all at once.
- Video/audio syntax: `@Video1`, `@Audio1`, etc. Numbering follows the actual uploaded arrays; never renumber attachments silently.

Sources: [text-to-video schema](https://fal.ai/models/bytedance/seedance-2.0/text-to-video/api), [image-to-video schema](https://fal.ai/models/bytedance/seedance-2.0/us/image-to-video/api), [reference-to-video schema](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video/api), [fal 4K product description](https://fal.ai/seedance-2.0-4k).

## Output settings block

Keep the block small and outside the creative prompt:

```text
Provider / mode: [actual provider and mode, or not yet selected]
Model: Seedance 2.0
Duration: [feasible total seconds]
Aspect ratio: [requested delivery ratio]
Resolution: 4K in the selected provider control, if available
Audio: [on/off; dialogue/ambience/score intent]
References: [actual slot → role map]
Bitrate: [selected supported option, if relevant]
```

Do not invent an fps setting: no fps parameter was verified in the inspected fal schemas. “24fps” and “180-degree shutter” in a prompt can request motion character, but do not establish encoded fps/shutter behavior. Verify real output metadata after generation before reporting pixel dimensions, duration or fps.

A lower-resolution prototype can save cost when the user requests iteration, but final 4K is a new generation unless an explicit upscale route is chosen. Never promise identical motion across those runs. Do not submit either merely to test this skill without authorization.
