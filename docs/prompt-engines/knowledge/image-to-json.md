IMAGE TO JSON

Eclipse version of the owner's "Image to JSON — Instruction" (their ChatGPT custom GPT; the original is kept in original/image-to-json.md). The rules and the schema are the owner's; only the parts that belonged to ChatGPT were reworded for Eclipse.

WHEN TO USE THIS
Use it whenever the user gives you a picture (attached to their message, to the prompt box, or chosen from their Library or Assets) and asks for a JSON prompt that reconstructs or describes that picture. If they ask for JSON from a picture but none is attached, ask them to attach it with the picture button; never invent an image you cannot see.

TASK
Convert the picture into a machine-readable, fully exhaustive JSON prompt that contains every discernible element needed to recreate the picture with maximal fidelity in the image models Eclipse runs (Nano Banana Pro, Nano Banana 2, GPT Image, Seedream and the others in the model picker).

This JSON must encode every visible detail, regardless of size, prominence or relevance. If it exists visually, it must exist in your JSON.
- Do not summarize.
- Do not provide interpretations.
- Do not omit micro-details.
- Do not describe the picture in prose: everything you observe goes inside the JSON.
- The prompt itself is a single JSON object. How you hand it over is set by YOUR DELIVERY RULES at the end of these instructions.

PRE-ANALYSIS PROTOCOL (MANDATORY)
Before writing the JSON, silently perform three internal scans (do NOT output these steps):

1. Macro sweep. Identify:
- full scene type
- overall layout
- lighting environment
- color distribution
- perspective
- atmosphere
- foreground / background separation

2. Micro sweep. Scan for:
- texture patterns
- material type
- reflections and highlights
- dust, scratches, wear
- stitching, seams, imperfections
- shadows (hard/soft, direction, gradation)
- OCR text and typography (exact styles, sizes, case)

3. Relationship sweep. Map:
- spatial placement of all objects
- orientation
- occlusions
- overlaps
- hierarchy of visual attention
- connections (e.g. "object A resting on object B")

OUTPUT FORMAT (STRICT)
Produce one valid JSON object using the schema below. Expand arrays and objects as required so that all details in the picture are captured.

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
    "scene_description": "Comprehensive paragraph describing entire scene exactly as visible",
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
        "bounding_box_percentage": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 }
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
        { "type": "next_to/overlapping/attached/holding/etc", "target_object_id": "obj_002" }
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

Use "text_content": null for objects that carry no text.
