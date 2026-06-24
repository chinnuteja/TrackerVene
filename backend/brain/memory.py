import json, os, pathlib
from datetime import datetime

_DEFAULT_PATH = pathlib.Path(__file__).parent.parent / "data" / "resident.json"

# When VENE_PERSIST_INCIDENTS is not set (or "0"), incidents are kept in-memory
# only — resident.json is never modified during a demo run, so repeated takes
# don't accumulate junk. Set VENE_PERSIST_INCIDENTS=1 to restore old behaviour.
_PERSIST = os.getenv("VENE_PERSIST_INCIDENTS", "0").strip() not in ("", "0", "false", "False")

def load_memory(path=None) -> dict:
    p = pathlib.Path(path) if path else _DEFAULT_PATH
    return json.loads(p.read_text(encoding="utf-8"))

def save_memory(mem: dict, path=None):
    p = pathlib.Path(path) if path else _DEFAULT_PATH
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(mem, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, p)

def add_incident(mem: dict, incident: dict, path=None, persist: bool | None = None):
    """Append incident to the in-memory dict.

    Writes to disk only when persist is True (or the VENE_PERSIST_INCIDENTS env
    flag is set). By default the flag is OFF so demo runs don't dirty the file.
    """
    should_persist = persist if persist is not None else _PERSIST
    ts = incident.get("ts") or datetime.utcnow().isoformat()
    record = {
        "ts":         ts,
        "kind":       incident.get("kind", "unknown"),
        "summary":    incident.get("summary", ""),
        "action":     incident.get("action", ""),
        "resolution": incident.get("resolution", ""),
    }
    mem.setdefault("prior_incidents", []).append(record)
    mem["prior_incidents"] = mem["prior_incidents"][-50:]
    if should_persist:
        save_memory(mem, path)

def memory_brief(mem: dict) -> str:
    name     = mem.get("name", "the resident")
    age      = mem.get("age", "")
    baseline = mem.get("baseline_summary", "")
    details  = mem.get("personal_details", [])
    incidents = mem.get("prior_incidents", [])[-3:]

    detail_str = "; ".join(details) if details else "none on record"

    incident_str = ""
    if incidents:
        parts = []
        for inc in incidents:
            ts_short = inc.get("ts", "")[:10]
            parts.append(
                f"{ts_short}: {inc.get('summary','')} "
                f"(action: {inc.get('action','')}, resolution: {inc.get('resolution','')})"
            )
        incident_str = " Recent incidents: " + " | ".join(parts) + "."

    return (
        f"{name}, {age} years old. Daily routine: {baseline} "
        f"Personal details: {detail_str}.{incident_str}"
    )
