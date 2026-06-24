"""
Conversational AI module — Azure OpenAI (GPT-5.4-nano) with deterministic fallback.

Public API:
  compose_checkin(reason, hour, memory) -> {"script": str, "source": "llm"|"fallback"}
  interpret_reply(transcript, reason, memory) -> {"verdict": "reassuring"|"worrying"|"no_answer",
                                                   "rationale": str, "source": "llm"|"fallback"}

Never raises. If the Azure key is absent, quota is hit, or any error occurs, returns fallback output.
"""

import json, logging, os
from brain.memory import memory_brief

log = logging.getLogger(__name__)

# Azure OpenAI config (set via environment)
_AZURE_ENDPOINT    = os.getenv("AZURE_OPENAI_ENDPOINT",    "https://openaiservices-dev.openai.azure.com/")
_AZURE_API_KEY     = os.getenv("AZURE_OPENAI_KEY",         "")
_AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
_AZURE_DEPLOYMENT  = os.getenv("AZURE_OPENAI_DEPLOYMENT",  "gpt-5.4-nano")
_LLM_TIMEOUT       = float(os.getenv("VENE_LLM_TIMEOUT",  "10"))

def _client():
    from openai import AzureOpenAI
    return AzureOpenAI(
        api_version=_AZURE_API_VERSION,
        azure_endpoint=_AZURE_ENDPOINT,
        api_key=_AZURE_API_KEY,
    )

def _llm_available() -> bool:
    return bool(_AZURE_API_KEY)

# ─────────────────────────── fallback scripted lines ────────────────────────

def _fallback_script(reason: str, hour: int, stability: str) -> str:
    drift_note = " I've also noticed your routine has been a bit different the past few days." \
                 if stability == "regime_shift" else ""
    if "Bathroom" in reason and hour < 6:
        return f"Hi Mary, I noticed you've been up quite a bit tonight. Feeling okay?{drift_note}"
    if "Kitchen" in reason and 6 <= hour <= 10:
        return f"Good morning Mary, just checking in — looks like a slow start today. Everything alright?{drift_note}"
    if "FrontDoor" in reason:
        return f"Hi Mary, I noticed the front door a moment ago. Just wanted to make sure everything is okay.{drift_note}"
    return f"Hi Mary, just checking in on you.{drift_note}"

def _fallback_verdict(transcript: str) -> dict:
    if not transcript or transcript.strip() in ("", "…", "..."):
        return {"verdict": "no_answer", "rationale": "No response received.", "source": "fallback"}
    t = transcript.lower()
    worrying_words = {"hurt", "pain", "dizzy", "help", "can't", "cant", "fell", "fall",
                      "sick", "nausea", "vomit", "chest", "breath", "confused", "bad"}
    reassuring_words = {"fine", "okay", "ok", "good", "alright", "no", "nothing", "well"}
    if any(w in t for w in worrying_words):
        return {"verdict": "worrying",
                "rationale": "Resident described symptoms of concern.", "source": "fallback"}
    if any(w in t for w in reassuring_words):
        return {"verdict": "reassuring",
                "rationale": "Resident confirmed they are okay.", "source": "fallback"}
    return {"verdict": "reassuring",
            "rationale": "No clear distress signals detected.", "source": "fallback"}

# ─────────────────────────── public API ─────────────────────────────────────

def compose_checkin(reason: str, hour: int, memory: dict,
                    stability: str = "stable") -> dict:
    """Compose a personalised phone check-in script for the resident."""
    if not _llm_available():
        log.warning("AZURE_OPENAI_KEY not set — using fallback check-in script.")
        return {"script": _fallback_script(reason, hour, stability), "source": "fallback"}

    brief = memory_brief(memory)
    name  = memory.get("name", "the resident")
    time_desc = f"{hour:02d}:00"

    system = (
        "You are Vene, a warm, calm AI companion that cares for elderly people living at home. "
        "You are about to make a short phone call to check in on the resident because their routine "
        "monitoring system detected something unusual. "
        "Your tone is friendly, unhurried, and reassuring — never alarming. "
        "You know this person well."
    )
    user = (
        f"Resident profile:\n{brief}\n\n"
        f"Trigger: {reason} at {time_desc}.\n\n"
        "Write exactly ONE spoken sentence (≤40 words) that Vene would say when the resident picks up "
        "the phone. Use their first name. Reference a personal detail if it feels natural. "
        "Do not include any preamble, explanation, or quotation marks — just the sentence itself."
    )

    try:
        resp = _client().chat.completions.create(
            model=_AZURE_DEPLOYMENT,
            messages=[{"role": "system", "content": system},
                      {"role": "user",   "content": user}],
            max_completion_tokens=80,
            timeout=_LLM_TIMEOUT,
        )
        script = resp.choices[0].message.content.strip().strip('"').strip("'")
        return {"script": script, "source": "llm"}
    except Exception as e:
        log.warning(f"compose_checkin LLM error: {e}. Using fallback.")
        return {"script": _fallback_script(reason, hour, stability), "source": "fallback"}


def interpret_reply(transcript: str, reason: str, memory: dict) -> dict:
    """Classify the resident's reply as reassuring, worrying, or no_answer."""
    if not transcript or transcript.strip() in ("", "…", "..."):
        return {"verdict": "no_answer", "rationale": "No response received.", "source": "fallback"}

    if not _llm_available():
        log.warning("AZURE_OPENAI_KEY not set — using fallback reply interpretation.")
        return _fallback_verdict(transcript)

    brief = memory_brief(memory)
    system = (
        "You are a clinical triage assistant. You will read a short verbal reply from an elderly "
        "resident who was called by an AI companion. Classify the reply into exactly one of three "
        "categories:\n"
        "  - reassuring: resident sounds okay, no immediate concern\n"
        "  - worrying: resident sounds unwell, in pain, confused, or describes a problem\n"
        "  - no_answer: no intelligible response, silence, or ambiguous non-answer\n\n"
        "Return ONLY valid JSON with keys 'verdict' and 'rationale'. No other text."
    )
    user = (
        f"Resident profile:\n{brief}\n\n"
        f"Context of the call: {reason}\n\n"
        f"Resident's reply: \"{transcript}\"\n\n"
        "Classify this reply."
    )

    try:
        resp = _client().chat.completions.create(
            model=_AZURE_DEPLOYMENT,
            messages=[{"role": "system", "content": system},
                      {"role": "user",   "content": user}],
            max_completion_tokens=120,
            timeout=_LLM_TIMEOUT,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content.strip()
        parsed = json.loads(raw)
        verdict = parsed.get("verdict", "reassuring")
        if verdict not in ("reassuring", "worrying", "no_answer"):
            verdict = "reassuring"
        return {"verdict": verdict,
                "rationale": parsed.get("rationale", ""),
                "source": "llm"}
    except Exception as e:
        log.warning(f"interpret_reply LLM error: {e}. Using fallback.")
        return _fallback_verdict(transcript)
