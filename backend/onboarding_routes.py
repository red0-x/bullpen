"""Property onboarding: address (Google geocoding), room-by-room scans (AR or photo/video), and an item inventory.

Room.scan_data holds whatever the capture produced, with the same shape for every path:
  frames:   [{path, url}]                  photos / video frames (photo path)
  geometry: {method, json_path, usdz_path, summary}  RoomPlan (iOS LiDAR) export refs
  ar:       {method, planes, floor_area_m2, anchors}  ARKit/ARCore plane + anchor summary
  suggested:{type, items}                  automatic suggestion (RoomPlan objects or AI on a photo)
"""
import base64
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, List, Literal, Optional, Union

import httpx
import requests
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ai import AIError, _json, _run
from server import DocBase, Property, current_host, db, now_utc, ser

router = APIRouter(prefix="/api")
log = logging.getLogger("bullpen.onboarding")
logging.getLogger("httpx").setLevel(logging.WARNING)  # request URLs carry the Maps key; keep them out of the logs

# ---------- Object storage (Emergent managed) ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "bullpen"
_storage_key: Optional[str] = None
MAX_UPLOAD = 25 * 1024 * 1024
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/json": "json",
       "model/vnd.usdz+zip": "usdz", "application/octet-stream": "bin", "video/mp4": "mp4"}


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    for attempt in (0, 1):
        key = init_storage(force=attempt == 1)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code == 503 and attempt == 0:
            continue
        if resp.status_code == 402:
            raise HTTPException(402, "Photo storage is out of credits right now. Try again later.")
        resp.raise_for_status()
        return resp.json()
    raise HTTPException(503, "Storage is busy. Try again.")


def get_object(path: str) -> tuple:
    for attempt in (0, 1):
        key = init_storage(force=attempt == 1)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
        if resp.status_code == 503 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    raise HTTPException(503, "Storage is busy. Try again.")


@router.post("/upload")
async def upload(file: UploadFile = File(...), host: dict = Depends(current_host)):
    data = await file.read()
    if not data or len(data) > MAX_UPLOAD:
        raise HTTPException(413, "That file is empty or too big.")
    ctype = (file.content_type or "application/octet-stream").split(";")[0]
    name = file.filename or "upload"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else EXT.get(ctype, "bin")
    path = f"{APP_NAME}/uploads/{host['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await run_in_threadpool(put_object, path, data, ctype)
    except HTTPException:
        raise
    except Exception as e:
        log.warning("upload failed: %s", e)
        raise HTTPException(502, "Couldn't save that file. Try again.")
    await db.files.insert_one({"id": str(uuid.uuid4()), "host_id": host["id"], "path": result["path"], "content_type": ctype,
                               "original_name": name, "size": len(data), "is_deleted": False, "created_at": now_utc()})
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@router.get("/files/{path:path}")
async def get_file(path: str, host: dict = Depends(current_host)):
    rec = await db.files.find_one({"path": path, "host_id": host["id"], "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    data, ctype = await run_in_threadpool(get_object, path)
    return Response(data, media_type=rec.get("content_type") or ctype, headers={"Cache-Control": "private, max-age=86400"})


# ---------- Data model ----------
class Room(DocBase):
    property_id: str
    type: str
    label: str = ""
    status: Literal["in_progress", "complete"] = "in_progress"
    scan_data: dict = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=now_utc)


class Item(DocBase):
    room_id: str
    property_id: str
    name: str
    category: str = "other"  # free text (appliance / fixture / other / anything); later linked to maintenance tickets
    photo_url: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    position: Optional[dict] = None  # AR world position {x, y, z} in meters
    frame_point: Optional[dict] = None  # {x, y} normalized point on the photo
    source: Literal["ar", "photo", "manual"] = "photo"
    notes: str = ""


class GeocodeIn(BaseModel):
    address: str = Field(min_length=5, max_length=300)


class PropertyIn(BaseModel):
    name: str = Field("", max_length=80)
    address: str = Field(min_length=5, max_length=300)
    geocode: dict


class RoomIn(BaseModel):
    type: str = Field(min_length=1, max_length=40)
    label: str = Field("", max_length=80)


class RoomPatch(BaseModel):
    type: Optional[str] = Field(None, min_length=1, max_length=40)
    label: Optional[str] = Field(None, max_length=80)
    status: Optional[Literal["in_progress", "complete"]] = None
    scan_data: Optional[dict] = None  # merged key-by-key into the existing scan_data


class FramePoint(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field("other", min_length=1, max_length=40)
    photo_url: Optional[str] = Field(None, max_length=400)
    brand: Optional[str] = Field(None, max_length=80)
    model: Optional[str] = Field(None, max_length=80)
    position: Optional[Dict[str, Union[float, str]]] = None  # AR world position (x, y, z meters) + anchor_id / distance_m
    frame_point: Optional[FramePoint] = None
    source: Literal["ar", "photo", "manual"] = "photo"
    notes: str = Field("", max_length=500)


class ItemPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    category: Optional[str] = Field(None, min_length=1, max_length=40)
    brand: Optional[str] = Field(None, max_length=80)
    model: Optional[str] = Field(None, max_length=80)
    notes: Optional[str] = Field(None, max_length=500)


class SuggestIn(BaseModel):
    photo: str = Field(min_length=5, max_length=400)  # storage path or /api/files/... url


async def onboarding_property(host_id: str) -> Optional[dict]:
    return await db.properties.find_one({"host_id": host_id, "onboarding": True}, {"_id": 0})


async def owned(coll: str, doc_id: str, host_id: str) -> dict:
    doc = await db[coll].find_one({"id": doc_id, "host_id": host_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


def blank(v: Optional[str]) -> Optional[str]:
    return v.strip() or None if isinstance(v, str) else v


# ---------- Address ----------
def component(components: list, *types: str, short: bool = False) -> str:
    for t in types:
        for c in components:
            if t in c.get("types", []):
                return c["short_name" if short else "long_name"]
    return ""


@router.post("/onboarding/geocode")
async def geocode(body: GeocodeIn, host: dict = Depends(current_host)):
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        raise HTTPException(503, "Address lookup isn't set up yet.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            r = await client.get("https://maps.googleapis.com/maps/api/geocode/json",
                                 params={"address": body.address, "language": "en", "key": key})
        r.raise_for_status()
        payload = r.json()
    except httpx.HTTPError as e:
        log.warning("geocode failed: %s", type(e).__name__)
        raise HTTPException(503, "Address lookup is unavailable. Try again in a moment.")
    status = payload.get("status")
    if status == "ZERO_RESULTS" or (status == "OK" and not payload.get("results")):
        raise HTTPException(422, "We couldn't find that address. Check the street, city and zip.")
    if status != "OK":
        log.warning("geocode status %s: %s", status, payload.get("error_message", "")[:200])
        if status == "REQUEST_DENIED":
            raise HTTPException(503, "Address lookup isn't switched on yet. You can save the address as typed.")
        raise HTTPException(502, "Address lookup returned an error. Try again.")
    out = []
    for res in payload["results"][:3]:
        comps = res.get("address_components", [])
        loc = res["geometry"]["location"]
        out.append({
            "formatted_address": res["formatted_address"], "lat": loc["lat"], "lng": loc["lng"],
            "location_type": res["geometry"].get("location_type", "UNKNOWN"), "place_id": res.get("place_id"),
            "partial_match": bool(res.get("partial_match")),
            "city": component(comps, "locality", "postal_town", "sublocality", "administrative_area_level_2"),
            "state": component(comps, "administrative_area_level_1", short=True),
            "postal_code": component(comps, "postal_code"), "country": component(comps, "country", short=True),
            "street": " ".join(x for x in (component(comps, "street_number"), component(comps, "route")) if x),
        })
    return {"results": out}


MAP_STYLE = ["feature:poi|element:labels|visibility:off", "feature:transit|visibility:off",
             "element:geometry|color:0xf4eee6", "feature:road|element:geometry|color:0xffffff",
             "feature:water|element:geometry|color:0xc9d8d2", "element:labels.text.fill|color:0x7a5a48"]


@router.get("/onboarding/staticmap")
async def static_map(lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180),
                     host: dict = Depends(current_host)):
    """Map preview of the confirmed address; the key never leaves the server."""
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        raise HTTPException(503, "Maps aren't set up yet.")
    params = [("center", f"{lat},{lng}"), ("zoom", "16"), ("size", "640x320"), ("scale", "2"),
              ("markers", f"color:0x7B3F25|{lat},{lng}"), ("key", key)] + [("style", s) for s in MAP_STYLE]
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            r = await client.get("https://maps.googleapis.com/maps/api/staticmap", params=params)
    except httpx.HTTPError as e:
        log.warning("static map failed: %s", type(e).__name__)
        raise HTTPException(503, "Map preview is unavailable.")
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
        log.warning("static map status %s", r.status_code)
        raise HTTPException(502, "Map preview is unavailable.")
    return Response(r.content, media_type=r.headers["content-type"], headers={"Cache-Control": "private, max-age=86400"})


@router.post("/onboarding/property")
async def save_property(body: PropertyIn, host: dict = Depends(current_host)):
    g = body.geocode
    address = body.address.strip()
    if len(address) < 5:
        raise HTTPException(400, "Type the full street address.")
    lat, lng = g.get("lat"), g.get("lng")
    is_num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)  # noqa: E731
    has_pin = is_num(lat) and is_num(lng)
    # Verified = picked from Google results. If lookup is down, the host may save the address as typed (no map pin).
    if not has_pin and g.get("unverified") is not True:
        raise HTTPException(400, "Look up the address first.")
    if has_pin and not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(400, "That map location isn't valid.")
    geo = {k: g.get(k) for k in ("lat", "lng", "place_id", "location_type", "city", "state", "postal_code", "country", "partial_match")} if has_pin else {}
    geo["verified"] = has_pin
    txt = lambda v: v.strip()[:120] if isinstance(v, str) else ""  # noqa: E731 — geocode is client-sent; never trust its types
    name = body.name.strip() or txt(g.get("street")) or address.split(",")[0].strip() or "My rental"
    city = txt(g.get("city")) if has_pin else ""
    if has_pin:
        for k in ("place_id", "location_type", "city", "state", "postal_code", "country"):
            geo[k] = txt(g.get(k)) or None
        geo["partial_match"] = g.get("partial_match") is True
    existing = await onboarding_property(host["id"])
    if existing:
        await db.properties.update_one({"id": existing["id"]}, {"$set": {"name": name, "address": address, "city": city, "geocode": geo}})
        return ser(await onboarding_property(host["id"]))
    prop = Property(host_id=host["id"], name=name, city=city, address=address, geocode=geo, onboarding=True)
    await db.properties.insert_one(prop.model_dump())
    return ser(prop.model_dump())


# ---------- State ----------
async def state(host: dict) -> dict:
    prop = await onboarding_property(host["id"])
    rooms = []
    if prop:
        rs = await db.rooms.find({"host_id": host["id"], "property_id": prop["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
        items = await db.items.find({"host_id": host["id"], "property_id": prop["id"]}, {"_id": 0}).sort("created_at", 1).to_list(2000)
        for r in rs:
            rooms.append(ser({**r, "items": [ser(i) for i in items if i["room_id"] == r["id"]]}))
    done = [r for r in rooms if r["status"] == "complete"]
    # Rooms are optional: a confirmed address is enough to finish, rooms can be scanned later.
    return {"property": ser(prop) if prop else None, "rooms": rooms, "completed_rooms": len(done),
            "can_finish": bool(prop), "complete": bool(host.get("onboarding_complete")),
            "skipped": bool(host.get("onboarding_skipped"))}


@router.get("/onboarding")
async def get_state(host: dict = Depends(current_host)):
    return await state(host)


@router.post("/onboarding/complete")
async def complete(host: dict = Depends(current_host)):
    s = await state(host)
    if not s["can_finish"]:
        raise HTTPException(400, "Add your address first.")
    await db.properties.update_one({"id": s["property"]["id"]}, {"$set": {"onboarding_complete": True}})
    await db.users.update_one({"id": host["id"]}, {"$set": {"onboarding_complete": True}})
    return {"ok": True}


@router.post("/onboarding/skip")
async def skip(host: dict = Depends(current_host)):
    """Let the host into the app now; setup stays available from the Rentals tab."""
    await db.users.update_one({"id": host["id"]}, {"$set": {"onboarding_skipped": True}})
    return {"ok": True}


# ---------- Rooms ----------
@router.post("/onboarding/rooms")
async def add_room(body: RoomIn, host: dict = Depends(current_host)):
    prop = await onboarding_property(host["id"])
    if not prop:
        raise HTTPException(400, "Add your address first.")
    room = Room(host_id=host["id"], property_id=prop["id"], type=body.type.strip().lower(), label=body.label.strip())
    await db.rooms.insert_one(room.model_dump())
    return ser({**room.model_dump(), "items": []})


@router.get("/onboarding/rooms/{room_id}")
async def get_room(room_id: str, host: dict = Depends(current_host)):
    room = await owned("rooms", room_id, host["id"])
    items = await db.items.find({"room_id": room_id, "host_id": host["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return ser({**room, "items": [ser(i) for i in items]})


@router.patch("/onboarding/rooms/{room_id}")
async def patch_room(room_id: str, body: RoomPatch, host: dict = Depends(current_host)):
    room = await owned("rooms", room_id, host["id"])
    upd = {"updated_at": now_utc()}
    if body.type is not None:
        upd["type"] = body.type.strip().lower()
    if body.label is not None:
        upd["label"] = body.label.strip()
    if body.status is not None:
        upd["status"] = body.status
    if body.scan_data is not None:
        upd["scan_data"] = {**room.get("scan_data", {}), **body.scan_data}
    await db.rooms.update_one({"id": room_id}, {"$set": upd})
    return await get_room(room_id, host)


@router.delete("/onboarding/rooms/{room_id}")
async def delete_room(room_id: str, host: dict = Depends(current_host)):
    await owned("rooms", room_id, host["id"])
    await db.rooms.delete_one({"id": room_id})
    await db.items.delete_many({"room_id": room_id, "host_id": host["id"]})
    return {"ok": True}


# ---------- Items ----------
@router.post("/onboarding/rooms/{room_id}/items")
async def add_item(room_id: str, body: ItemIn, host: dict = Depends(current_host)):
    room = await owned("rooms", room_id, host["id"])
    data = body.model_dump()
    for k in ("brand", "model", "photo_url"):
        data[k] = blank(data[k])
    data["category"] = data["category"].strip().lower()
    item = Item(host_id=host["id"], room_id=room_id, property_id=room["property_id"], **data)
    await db.items.insert_one(item.model_dump())
    await db.rooms.update_one({"id": room_id}, {"$set": {"updated_at": now_utc()}})
    return ser(item.model_dump())


@router.patch("/onboarding/items/{item_id}")
async def patch_item(item_id: str, body: ItemPatch, host: dict = Depends(current_host)):
    await owned("items", item_id, host["id"])
    upd = body.model_dump(exclude_unset=True)
    for k in ("brand", "model"):
        if k in upd:
            upd[k] = blank(upd[k])
    if upd.get("category"):
        upd["category"] = upd["category"].strip().lower()
    if upd:
        await db.items.update_one({"id": item_id}, {"$set": upd})
    return ser(await owned("items", item_id, host["id"]))


@router.delete("/onboarding/items/{item_id}")
async def delete_item(item_id: str, host: dict = Depends(current_host)):
    await owned("items", item_id, host["id"])
    await db.items.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Automatic suggestion from a photo ----------
SUGGEST_SYSTEM = "You look at one photo from inside a home and reply with ONLY a JSON object. Never invent brands you can't read."


@router.post("/onboarding/suggest")
async def suggest(body: SuggestIn, host: dict = Depends(current_host)):
    path = body.photo.split("/api/files/", 1)[-1].split("?")[0]
    rec = await db.files.find_one({"path": path, "host_id": host["id"], "is_deleted": False})
    if not rec:
        raise HTTPException(404, "Photo not found")
    try:
        data, _ = await run_in_threadpool(get_object, path)
        out = _json(await _run(SUGGEST_SYSTEM, (
            "What room is this, and which appliances or fixtures can you see? Return JSON: "
            '{"room_type": one of "bedroom","bathroom","kitchen","living room","dining room","laundry","garage",'
            '"office","basement","hallway","outdoor","other", "items": [{"name": short plain name like "Refrigerator" '
            'or "Water heater", "category": "appliance" | "fixture" | "other", "brand": brand only if clearly readable else null}]}. '
            "At most 6 items, most important first."), base64.b64encode(data).decode()))
    except (AIError, requests.RequestException):
        return {"ok": False}
    items = [{"name": str(i.get("name"))[:60], "category": str(i.get("category") or "other")[:40], "brand": i.get("brand")}
             for i in (out.get("items") or []) if isinstance(i, dict) and i.get("name")][:6]
    return {"ok": True, "room_type": str(out.get("room_type") or "other")[:40], "items": items}
