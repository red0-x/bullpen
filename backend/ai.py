import asyncio
import json
import logging
import os
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

logger = logging.getLogger("bullpup.ai")
MODEL = ("openai", "gpt-5.4")
AI_TIMEOUT = 40


class AIError(Exception):
    pass


async def _run(system: str, text: str, image_b64: str | None = None) -> str:
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=str(uuid.uuid4()),
                   system_message=system).with_model(*MODEL)
    msg = UserMessage(text=text, file_contents=[ImageContent(image_base64=image_b64)] if image_b64 else None)
    out = []

    async def consume():
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                out.append(ev.content)
            elif isinstance(ev, StreamDone):
                break

    try:
        await asyncio.wait_for(consume(), timeout=AI_TIMEOUT)
    except asyncio.TimeoutError:
        raise AIError("timeout")
    except Exception as e:  # provider/network errors
        logger.warning("AI call failed: %s", e)
        raise AIError(str(e))
    return "".join(out)


def _json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise AIError("no json")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        raise AIError("bad json")


DIAG_SYSTEM = (
    "You help a short-term rental host figure out what broke from a photo and/or a note. "
    "Reply with ONLY a JSON object, no prose. Never invent people or prices."
)


async def diagnose(note: str, image_b64: str | None, properties: list, trades: list, today: str) -> dict:
    catalog = [{"property_id": p["id"], "property": p["name"], "city": p["city"],
                "amenities": [{"amenity_id": a["id"], "label": a["label"], "trade": a["trade"]} for a in p["amenities"]]}
               for p in properties]
    prompt = (
        f"Today is {today}. Host note: {note or '(none)'}\n"
        f"Host's properties and amenities: {json.dumps(catalog)}\n"
        f"Allowed trades: {json.dumps(trades)}\n"
        "Look closely at the photo for visible damage: cracks, leaks, water stains, rust, mold, broken parts, "
        "scorch marks, error lights, clogs, cloudy or green water, frayed wires.\n"
        "Return JSON with keys: can_tell (bool, false if the photo/note doesn't show a fixable problem), "
        "is_rental_issue (bool, false if it's a personal item like earbuds or a phone rather than part of a rental home), "
        "diagnosis (one or two plain sentences on what's wrong and the likely cause), "
        "fix_steps (array of 2-5 short plain steps: what the host can safely do right now, then how a pro fixes it), "
        "safety_note (one sentence if there is any risk like water damage, electrical, gas, injury; else null), "
        "diy ('yes' if a host can fix it alone safely, 'maybe', or 'no' if it needs a pro), "
        "trade (one of the allowed trades or null), "
        "urgency ('today' | 'this_week' | 'can_wait'; today if guests arrive within ~48h or it's unsafe), "
        "property_id (best guess from the list or null), amenity_id (best guess or null), "
        "guest_arrival (ISO 8601 local datetime like 2026-10-30T16:00 if the note mentions arrival, else null)."
    )
    data = _json(await _run(DIAG_SYSTEM, prompt, image_b64))
    if data.get("trade") not in trades:
        data["trade"] = None
    if data.get("urgency") not in ("today", "this_week", "can_wait"):
        data["urgency"] = None
    return data


DRAFT_SYSTEM = (
    "You write short, friendly text messages from a vacation rental host to a local contractor asking for help. "
    "Plain text, 2-4 sentences, under 420 characters, no emojis, no placeholders in brackets. "
    "Sign off with the host's first name."
)


async def draft_message(ctx: dict) -> str:
    text = await _run(DRAFT_SYSTEM, "Write the message from these facts:\n" + json.dumps(ctx))
    text = text.strip().strip('"')
    if not text:
        raise AIError("empty")
    return text[:800]


EXTRACT_SYSTEM = (
    "You pull contractor contact details out of messy pasted text (notes, texts, spreadsheets, emails). "
    "Reply with ONLY a JSON object. Never invent details that are not in the text."
)


async def extract_contractors(text: str, trades: list, cities: list) -> list:
    prompt = (
        f"Allowed trades: {json.dumps(trades)}\nHost's cities: {json.dumps(cities)}\n"
        f"Text:\n<<<\n{text}\n>>>\n"
        'Return {"contractors": [{"name": str, "business_name": str, "phone": str, "email": str, '
        '"trades": [allowed trades], "service_area": [city names], "notes": str, '
        '"unsure": [field names you guessed or could not find confidently, e.g. "trade", "service_area"]}]}. '
        "Map words like plumber->Plumbing, pool guy->Pool service, spa->Hot tub & spa, AC/furnace->HVAC, "
        "maid/turnover->Cleaning, fridge/dishwasher->Appliance repair, electrician->Electrical. "
        'If the trade is unclear leave trades empty and add "trade" to unsure. '
        "Use empty strings for missing fields. Return an empty list if there are no contractors."
    )
    data = _json(await _run(EXTRACT_SYSTEM, prompt))
    rows = data.get("contractors")
    if not isinstance(rows, list):
        raise AIError("bad shape")
    return rows


def template_message(ctx: dict) -> str:
    first = (ctx.get("contractor_name") or "there").split()[0]
    host = (ctx.get("host_name") or "").split()[0] or "your host"
    when = f" Guests arrive {ctx['guest_arrival']}." if ctx.get("guest_arrival") else ""
    return (f"Hi {first}, this is {host}. We have a problem at {ctx.get('address')}: "
            f"{ctx.get('problem')}.{when} Could you take a look? Let me know when you could come by. Thanks, {host}")
