# backend/main.py
from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.responses import JSONResponse
from typing import Any, Dict
import uuid
import time
import os
import logging
from dotenv import load_dotenv
from utils import now_ms, make_id
from call_genai_json import call_genai_json
# Your pydantic / dataclass request models
from ProjectMeta import ProjectMeta
from GenerateRequest import GenerateRequest
from RegenerateRequest import RegenerateRequest
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
import re
# NEW: google-genai client import (modern SDK)
# Install: pip install google-genai
from google import genai  # modern import path per Google GenAI SDK docs
import strictjson

# Load environment
load_dotenv()
GENAI_API_KEY = os.getenv("GENAI_API_KEY")
GENAI_MODEL = os.getenv("GENAI_MODEL", "gemini-2.5-flash")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Logging setup
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("paradocs-gen")

# Initialize genai client (modern SDK). If key missing, keep server running but warn.
genai_client = None
try:
    if not GENAI_API_KEY:
        logger.warning("GENAI_API_KEY not set. GenAI client will not be initialized.")
    else:
        # genai.Client picks up API key if provided here (or via env). See docs for Client usage.
        genai_client = genai.Client(api_key=GENAI_API_KEY)
        logger.info("Initialized google-genai client.")
except Exception as e:
    logger.exception("Failed to initialize google-genai client: %s", e)
    genai_client = None

app = FastAPI(title="Paradocs AI - Generation API", version="0.0.1")

# CORS middleware - allow dev origins. For development you may temporarily use ["*"]
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

def normalize_slide_object(obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize and enforce the minimal JSON schema for a slide/section item.
    """
    out: Dict[str, Any] = {}
    out["id"] = int(obj.get("id") or make_id())
    out["type"] = str(obj.get("type") or "slide")
    out["layout"] = str(obj.get("layout") or obj.get("template") or "title+bullets")
    out["title"] = str(obj.get("title") or "").strip()

    # bullets -> list[str]
    bullets = obj.get("bullets") or []
    if isinstance(bullets, str):
        bullets = [bullets]
    out["bullets"] = [str(b).strip() for b in bullets] if bullets else []

    # notes -> list[str]
    notes = obj.get("notes") or obj.get("speaker_notes") or []
    if isinstance(notes, str):
        notes = [notes]
    out["notes"] = [str(n).strip() for n in notes] if notes else []

    # images -> list[str]
    images = obj.get("images") or []
    if isinstance(images, str):
        images = [images]
    out["images"] = [str(i).strip() for i in images] if images else []

    meta = obj.get("meta") or {}
    out["meta"] = meta if isinstance(meta, dict) else {}

    return out

# ---------------------- Endpoints -----------------------------------------
# add near the other imports at top of main.py
try:
    from strictjson.llm import gemini_sync
    from strictjson import convert_schema_to_pydantic
    STRICTJSON_AVAILABLE = True
    logger.info("StrictJSON available - will try structured output path for /generate")
except Exception:
    STRICTJSON_AVAILABLE = False
    logger.info("StrictJSON not installed; falling back to call_genai_json path for /generate")

# compact StrictJSON slide schema used for structured outputs
_STRICT_SLIDE_SCHEMA = {
    "id": "Slide ID, int",
    "type": "Item type, str",
    "layout": "Layout name, str",
    "title": "Slide title, str",
    "bullets": ["Bullet text, str"],
    "notes": ["Speaker note text, str"],
    "images": ["Image URL or path, str"],
    "meta": {"generator": "LLM model name, str"}
}

# replace your generate_raw function with this
@app.post("/generate", response_model=Dict[str, Any])
async def generate_raw(request: Request, body: Dict[str, Any] = Body(...)):
    logger.info("Raw /generate body received: %s", str(body)[:1000])

    user_id = body.get("userId") or body.get("user_id")
    project_id = body.get("projectId") or body.get("project_id") or body.get("projectIdDraft")
    doc_type = body.get("docType") or body.get("doc_type")
    main_topic = body.get("mainTopic") or body.get("main_topic") or ""
    outline_item = body.get("outlineItem") or body.get("scaffold") or body.get("outline_item")

    projects_field = body.get("projects") or body.get("project")
    project_object = None
    if isinstance(projects_field, dict):
        if project_id and projects_field.get(project_id):
            project_object = projects_field.get(project_id)
        else:
            if "docType" in projects_field or "mainTopic" in projects_field or "main_topic" in projects_field:
                project_object = projects_field
            else:
                first_key = next(iter(projects_field), None)
                if first_key:
                    project_object = projects_field[first_key]

    if project_object:
        doc_type = doc_type or project_object.get("docType") or project_object.get("doc_type")
        main_topic = main_topic or project_object.get("mainTopic") or project_object.get("main_topic")

    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required")
    if not doc_type:
        raise HTTPException(status_code=422, detail="projects.docType is required (or provide docType at top-level)")
    if not main_topic:
        raise HTTPException(status_code=422, detail="projects.mainTopic is required (or provide mainTopic at top-level)")

    scaffold = outline_item or {}
    hints = body.get("hints", {}) or {}
    temperature = body.get("temperature", 0.2)

    # Build a concise prompt to send to the LLM
    prompt = (
        f"Project docType: {doc_type}\n"
        f"Main topic: {main_topic}\n"
        f"Scaffold (outline item): {scaffold}\n"
        f"Hints: {hints}\n\n"
        "Return a single strictly JSON object only with the following keys: id, type, layout, title, bullets, notes, images, meta. "
        "Keep bullets concise unless hints request otherwise. Make sure to include all necessary delimeters for proper JSON. DO NOT MISS ANY DELIMETERS. For `meta`, include generator metadata keys only. "
        "If you cannot supply images, set images to an empty array. No commentary — JSON only."
    )

    # Example: if you want the model to examine an image uploaded earlier, use this local path (you provided this file):
    # NOTE: the path is local to your environment and will be transformed by your tooling into a usable URL where necessary.
    example_image_path = "/mnt/data/acf0b352-cd27-467f-91ed-53d3ab1e2dde.png"

    # 1) If StrictJSON is available, prefer structured StrictJSON call (gemini_sync)
    if STRICTJSON_AVAILABLE:
        try:
            # include the example image as part of the user prompt when relevant
            user_prompt = prompt
            # only add image hint if scaffold or hints mention images or if you want multimodal extraction:
            user_prompt += f"\n\nOptional image for context: <<{example_image_path}>>"

            # call gemini_sync with the compact slide schema -> returns typed python dict
            res = gemini_sync(
                system_prompt="Return exactly one JSON object that conforms to the requested schema. Do not include commentary or extra text.",
                user_prompt=user_prompt,
                output_format=_STRICT_SLIDE_SCHEMA,
                model=GENAI_MODEL,
                temperature=temperature,
            )
            # gemini_sync should return a python dict consistent with schema
            # If it returns a pydantic-like object, convert to dict
            parsed = res if isinstance(res, dict) else (res.model_dump() if hasattr(res, "model_dump") else dict(res))
            logger.debug("StrictJSON gemini_sync returned: %s", str(parsed)[:800])
        except Exception as e:
            logger.warning("StrictJSON gemini_sync failed, falling back to call_genai_json. Error: %s", e)
            # fallback to call_genai_json below
            parsed = None
    else:
        parsed = None

    # 2) Fallback: call the resilient parser (call_genai_json)
        if parsed is None:
            try:
                parsed = call_genai_json(prompt, temperature=temperature, max_output_tokens=1200)
            except ValueError as e:
                logger.error("Model output parse error: %s", e)
                raise HTTPException(status_code=502, detail=str(e))
            except Exception as e:
                logger.exception("LLM call failed")
                raise HTTPException(status_code=502, detail="LLM call failed") from e

    # Normalize / enforce shape
    item = normalize_slide_object(parsed)

    item_meta = item.get("meta", {})
    item_meta.update({
        "generated_at": now_ms(),
        "generator": GENAI_MODEL,
        "raw_response_preview": (str(parsed)[:200])
    })
    item["meta"] = item_meta

    return JSONResponse(status_code=200, content=item)


@app.post("/regenerate", response_model=Dict[str, Any])
async def regenerate(reg_req: RegenerateRequest = None, request: Request = None):
    """
    Robust regenerate handler: accepts either a Pydantic RegenerateRequest (reg_req)
    or a raw JSON body. Finds the original generated item, builds a prompt using
    user feedback, calls the LLM (via call_genai_json) and returns a normalized item.
    """
    body = None
    original_item = None
    feedback = ""
    temperature = 0.2
    project_obj = None
    item_id = None

    try:
        # If FastAPI gave us a pydantic model, convert it to a dict first (support v2/v1)
        if reg_req is not None:
            try:
                if hasattr(reg_req, "model_dump"):
                    body = reg_req.model_dump()
                elif hasattr(reg_req, "dict"):
                    body = reg_req.dict()
                else:
                    body = getattr(reg_req, "__dict__", {}) or {}
            except Exception:
                body = getattr(reg_req, "__dict__", {}) or {}

            item_id = body.get("item_id") or body.get("itemId") or body.get("item")
            project_obj = body.get("project") or body.get("projectObj") or body.get("projects")
            feedback = body.get("feedback_text") or body.get("feedbackText") or body.get("feedback") or ""
            temperature = body.get("temperature", 0.2)
            original_item = body.get("originalItem") or body.get("original_item") or body.get("item")
        else:
            # raw request.json() path
            body = await request.json()
            try:
                preview = {k: (type(v).__name__ if v is not None else "null") for k, v in (body.items() if isinstance(body, dict) else [])}
                logger.debug("Regenerate request body keys/types: %s", preview)
            except Exception:
                logger.debug("Regenerate request body type: %s", type(body))

            item_id = body.get("item_id") or body.get("itemId") or body.get("item")
            feedback = body.get("feedback_text") or body.get("feedbackText") or body.get("feedback") or ""
            temperature = body.get("temperature", 0.2)
            project_obj = body.get("project") or body.get("projectObj") or body.get("projects")
            original_item = body.get("originalItem") or body.get("original_item") or body.get("item")

            if not original_item:
                outline_item = body.get("outlineItem") or body.get("outline_item")
                if isinstance(outline_item, dict):
                    content = outline_item.get("content")
                    if isinstance(content, dict) and content.get("generated"):
                        original_item = content.get("generated")
                    else:
                        if outline_item.get("id") or outline_item.get("title"):
                            original_item = outline_item
    except Exception as e:
        logger.exception("Failed to parse regenerate body/model: %s", e)
        raise HTTPException(status_code=400, detail="Invalid regenerate request body")

    # Deep-search helper
    def deep_search_for_generated(o):
        if not isinstance(o, dict):
            return None
        if o.get("generated") and isinstance(o.get("generated"), dict):
            return o.get("generated")
        for v in o.values():
            if isinstance(v, dict):
                found = deep_search_for_generated(v)
                if found:
                    return found
            elif isinstance(v, list):
                for e in v:
                    if isinstance(e, dict):
                        f = deep_search_for_generated(e)
                        if f:
                            return f
        return None

    # Try deep search if not found yet
    try:
        if original_item is None and isinstance(body, dict):
            found = deep_search_for_generated(body)
            if found:
                original_item = found
    except Exception:
        pass

    # Try to locate by item_id within supplied project outline
    try:
        if original_item is None and item_id is not None:
            try:
                norm_id = str(item_id)
            except Exception:
                norm_id = item_id

            if project_obj is None and isinstance(body, dict):
                project_obj = body.get("project") or body.get("projects") or body.get("projectObj")

            def match_outline_for_id(pobj):
                if not isinstance(pobj, dict):
                    return None
                outline = pobj.get("outline") or []
                if not isinstance(outline, list):
                    return None
                for it in outline:
                    if not isinstance(it, dict):
                        continue
                    for candidate in (it.get("id"), it.get("item_id"), it.get("slide_id")):
                        if candidate is None:
                            continue
                        try:
                            if str(candidate) == norm_id:
                                if isinstance(it.get("content"), dict) and it["content"].get("generated"):
                                    return it["content"].get("generated")
                                return it
                        except Exception:
                            continue
                return None

            if isinstance(project_obj, dict):
                original_item = match_outline_for_id(project_obj)

            if original_item is None and isinstance(body, dict):
                projects_field = body.get("projects") or {}
                if isinstance(projects_field, dict):
                    for v in projects_field.values():
                        if isinstance(v, dict):
                            found = match_outline_for_id(v)
                            if found:
                                original_item = found
                                break
    except Exception as e:
        logger.exception("Error searching for item by id: %s", e)

    # If still not found — return helpful debug
    if not original_item:
        debug_preview = {}
        try:
            if isinstance(body, dict):
                for k in ("originalItem", "original_item", "outlineItem", "project", "projects", "item_id", "item", "feedback"):
                    if k in body:
                        v = body[k]
                        if v is None:
                            debug_preview[k] = None
                        elif isinstance(v, (str, int, float, bool)):
                            s = str(v)
                            debug_preview[k] = s if len(s) < 300 else (s[:300] + "...")
                        else:
                            if isinstance(v, dict):
                                debug_preview[k] = {"type": "dict", "keys": list(v.keys())[:12]}
                            elif isinstance(v, list):
                                debug_preview[k] = {"type": "list", "len": len(v)}
                            else:
                                debug_preview[k] = {"type": type(v).__name__}
            else:
                debug_preview["body_type"] = type(body).__name__
        except Exception:
            debug_preview["error"] = "failed to build preview"

        logger.debug("Regenerate original_item not found. Debug preview: %s", debug_preview)
        raise HTTPException(
            status_code=400,
            detail=f"originalItem not found in request. Provide originalItem / item / outlineItem with generated content OR include item_id and project.outline containing that id. DebugPreview: {debug_preview}"
        )

    # Unwrap if wrapped in generated
    if isinstance(original_item, dict) and original_item.get("generated") and isinstance(original_item["generated"], dict):
        original_item = original_item["generated"]

    # Build prompt and call LLM
    prompt = (
        "You are given a JSON object representing a slide/section. Return a single JSON object ONLY that preserves the same top-level keys "
        "and the same `id`, but updates the values according to the user's feedback. Do not wrap the JSON in text.\n\n"
        f"Original: {original_item}\n\n"
        f"User feedback: {feedback}\n\n"
        "Apply minimal changes necessary to satisfy the feedback. Keep bullets concise."
    )

    try:
        # call_genai_json will extract/repair JSON as needed
        parsed = call_genai_json(prompt, temperature=temperature, max_output_tokens=1200)
        logger.debug("Regenerate parsed result type=%s keys=%s", type(parsed).__name__, (list(parsed.keys()) if isinstance(parsed, dict) else "list"))
    except ValueError as e:
        logger.error("Model output parse error on regenerate: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        logger.exception("LLM regenerate runtime error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("LLM regenerate failed: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM call failed: {str(e)}")

    # Ensure id stays same
    try:
        orig_id = None
        if isinstance(original_item, dict):
            orig_id = original_item.get("id") or original_item.get("item_id") or original_item.get("slide_id")
        if orig_id is None:
            parsed["id"] = parsed.get("id") or make_id()
        else:
            try:
                parsed["id"] = int(orig_id)
            except Exception:
                parsed["id"] = parsed.get("id") or make_id()
    except Exception:
        parsed["id"] = parsed.get("id") or make_id()

    item = normalize_slide_object(parsed)
    item_meta = item.get("meta", {})
    item_meta.update({
        "regenerated_at": now_ms(),
        "regeneration_feedback": feedback,
        "generator": GENAI_MODEL,
        "raw_response_preview": str(parsed)[:200],
    })
    item["meta"] = item_meta

    return JSONResponse(status_code=200, content=item)
