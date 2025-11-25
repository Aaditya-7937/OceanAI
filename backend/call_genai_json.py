# /mnt/data/call_genai_json.py
import json
import logging
import os
from typing import Any, Dict, List
from dotenv import load_dotenv
import strictjson


load_dotenv()
GENAI_API_KEY = os.getenv("GENAI_API_KEY")
GENAI_MODEL = os.getenv("GENAI_MODEL", "gemini-2.5-flash")
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()

logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("paradocs-gen")

# Try importing StrictJSON first ----------------------------------------
STRICTJSON_AVAILABLE = False
try:
    from strictjson.llm import gemini_sync
    from strictjson import convert_schema_to_pydantic
    STRICTJSON_AVAILABLE = True
    logger.debug("StrictJSON detected – using structured output mode.")
except Exception:
    logger.debug("StrictJSON not installed; falling back to raw JSON mode.")

# google-genai fallback client ------------------------------------------
client = None
try:
    from google import genai as _genai
    client = _genai.Client(api_key=GENAI_API_KEY)
    logger.debug("Initialized fallback genai.Client")
except Exception as e:
    logger.exception("Failed to init google-genai fallback client: %s", e)
    client = None


# StrictJSON schema to enforce slide structure --------------------------
_slide_schema = {
    "id": "Slide id, int",
    "type": "Slide type, str",
    "layout": "Layout type, str",
    "title": "Title text, str",
    "bullets": ["Bullet text, str"],
    "notes": ["Note text, str"],
    "images": ["Image URL or path, str"],
    "meta": {"generator": "Model name, str"},
}

if STRICTJSON_AVAILABLE:
    try:
        SlideModel = convert_schema_to_pydantic(_slide_schema)
    except Exception as e:
        logger.warning("StrictJSON: Failed to convert schema → Pydantic: %s", e)
        SlideModel = None


# ----------------------------------------------------------------------
# FINAL CLEAN VERSION OF call_genai_json
# ----------------------------------------------------------------------
def call_genai_json(prompt: str,
                    temperature: float = 0.2,
                    max_output_tokens: int = 800) -> Dict[str, Any]:

    # ------------------------------------------------------------------
    # STRICTJSON mode: fully structured, no repairing needed
    # ------------------------------------------------------------------
    if STRICTJSON_AVAILABLE and SlideModel is not None:
        logger.debug("Using StrictJSON structured output path.")
        try:
            res = gemini_sync(
                system_prompt=(
                    "Return exactly ONE JSON object. No explanations. "
                    "It MUST conform to the provided schema."
                ),
                user_prompt=prompt,
                output_format=_slide_schema,
                model=GENAI_MODEL,
                temperature=temperature
            )

            # Validate + convert to dict
            validated = SlideModel(**res)
            return validated.model_dump()

        except Exception as e:
            logger.error("StrictJSON failed unexpectedly: %s", e)
            # fallback is allowed, continue below


    # ------------------------------------------------------------------
    # FALLBACK MODE (no StrictJSON)
    # Expect the model to return valid JSON text only.
    # NO repair, NO regex cleanup.
    # ------------------------------------------------------------------
    if client is None:
        raise RuntimeError(
            "StrictJSON unavailable and google-genai client not initialized."
        )

    logger.debug("StrictJSON unavailable → using raw fallback mode.")

    try:
        resp = client.models.generate_content(
            model=GENAI_MODEL,
            contents=[prompt]
        )

        # best-effort extraction: resp.text, resp.output, or stringify
        if hasattr(resp, "text") and resp.text:
            raw = resp.text
        elif hasattr(resp, "output") and resp.output:
            raw = str(resp.output)
        else:
            raw = str(resp)

        # assume JSON is EXACTLY the string returned
        parsed = json.loads(raw)
        return parsed

    except Exception as e:
        logger.exception("Fallback JSON mode failed: %s", e)
        raise RuntimeError(f"LLM call failed: {str(e)}")





