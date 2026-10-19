Use this prompt whenever the user provides an image and asks you to generate a JSON prompt that reconstructs or describes that image. Always output the final JSON prompt inside a code block so it is easy to copy and paste.

________________



Prompt:


Your task is to convert the provided image into a machine-readable, fully exhaustive
JSON file that contains every discernible element required to recreate the image with
maximal fidelity inside of generative-image engines (e.g., Nano Banana, flux, DALL·E,
etc.).
This JSON must encode every visible detail, regardless of size, prominence, or
relevance.
If it exists visually, it must exist in your JSON.
Do not summarize.
Do not provide interpretations.
Do not omit micro-details.
Do not output text descriptions outside the JSON.
Return a single JSON object ONLY.
PRE-ANALYSIS PROTOCOL (MANDATORY)
Before generating JSON, silently perform three internal scans (do NOT output these
steps):
1. Macro Sweep
Identify:
•
Full scene type
•
Overall layout
•
Lighting environment
•
Color distribution
•
Perspective
•
Atmosphere
•
Foreground / background separation
2. Micro Sweep
Scan for:
•
Texture patterns
•
Material type
•
Reflections + highlights
•
Dust, scratches, wear
•
Stitching, seams, imperfections
•
Shadows (hard/soft, direction, gradation)
•
OCR text and typography (exact styles, sizes, case)
3. Relationship Sweep
Map:
•
•
•
•
•
Spatial placement of all objects
Orientation
Occlusions
Overlaps
Hierarchy of visual attention
•
Connections (e.g., “object A resting on object B”)
⸻
OUTPUT FORMAT (STRICT)
Produce one valid JSON object using the following schema structure.
Expand arrays and objects as required so that all details in the image are captured.
JSON STRUCTURE TEMPLATE
{
"meta": {
"image_quality": "Low/Medium/High/Very High",
"image_type": "Photo/Illustration/Diagram/Screenshot/etc",
"resolution_estimation": "Approximate resolution if discernable",
"file_characteristics": {
"compression_artifacts": "None/Low/Medium/High",
"noise_level": "None/Low/Medium/High",
"lens_type_estimation": "If inferable (e.g., wide/tele/macro)"
}
},
"global_context": {
"scene_description": "Comprehensive paragraph describing entire scene exactly as
visible",
"environment_type": "Indoor/Outdoor/Studio/Virtual/Unknown",
"time_of_day": "If discernable: Day/Night/Golden hour/etc",
"weather_atmosphere": "Foggy/Clear/Hazy/Rainy/Chaotic/Serene/etc",
"lighting": {
"source": "Sunlight/Artificial/Mixed/Backlit/etc",
"direction": "Top-down/Side/Back/etc",
"quality": "Hard/Soft/Diffused",
"color_temperature": "Warm/Cool/Neutral (in Kelvin if inferable)"
},
"color_palette": {
"dominant_hex_estimates": ["#RRGGBB", "..."],
"accent_colors": ["#RRGGBB", "..."],
"contrast_level": "Low/Medium/High"
}
},
"composition": {
"camera_angle": "Eye-level/High-angle/Low-angle/Macro/etc",
"framing": "Close-up/Medium/Wide/Extreme/etc",
"depth_of_field": "Shallow/Medium/Deep",
"focal_point": "Primary element pulling visual attention",
"symmetry_type": "None/Horizontal/Vertical/Radial/etc",
"rule_of_thirds_alignment": "If objects align with thirds intersections"
},
"objects": [
{
"id": "obj_001",
"label": "Object name or classification",
"category": "Person/Vehicle/Furniture/Text/Screen/UI elements/etc",
"location": {
"relative_position": "Top-left/Center-right/etc",
"bounding_box_percentage": {
"x": 0.0,
"y": 0.0,
"width": 0.0,
"height": 0.0
}
},
"dimensions_relative": "Large/Medium/Small relative to frame",
"distance_from_camera": "Near/Mid/Far",
"pose_orientation": "Facing direction, tilt, rotation, posture data",
"material": "Wood/Metal/Glass/Plastic/Fabric/etc",
"surface_properties": {
"texture": "Smooth/Rough/Glossy/Matte/Patterned/etc",
"reflectivity": "None/Low/Medium/High",
"micro_details": "Scratches/Scuffs/Dust/Stains/Print patterns/etc",
"wear_state": "New/Worn/Damaged/Dirty/etc"
},
"color_details": {
"base_color_hex": "#RRGGBB",
"secondary_colors": ["#RRGGBB"],
"gradient_or_pattern": "Describe if present"
},
"interaction_with_light": {
"shadow_casting": "Direction/Sharpness/Occlusion areas",
"highlight_zones": "Where light hits strongest",
"translucency": "If applicable"
},
"text_content": {
"raw_text": "Exact OCR extraction",
"font_style": "Sans-serif/Serif/Monospace/etc",
"font_weight": "Light/Regular/Bold/etc",
"text_case": "Uppercase/Lowercase/Mixed",
"alignment": "Left/Center/Right",
"color_hex": "#RRGGBB"
},
"relationships": [
{
"type": "next_to/overlapping/attached/holding/etc",
"target_object_id": "obj_002"
}
]
}
],
"background_details": {
"texture": "Wall/sky/clouds/fabric/etc",
"patterns": "Stripes/speckled/no pattern/etc",
"lighting_behavior": "How background receives light",
"additional_elements": ["Any secondary or subtle elements"]
},
"foreground_elements": {
"particles": "Dust/smoke/bokeh debris etc if present",
"artifacts": "Lens flare, chromatic aberration, reflections"
},
"reconstruction_notes": {
"mandatory_elements_for_recreation": "List must-have items",
"sensitivity_factors": "Details that strongly influence resemblance",
"ambiguities": "Anything not fully verifiable"
}
}