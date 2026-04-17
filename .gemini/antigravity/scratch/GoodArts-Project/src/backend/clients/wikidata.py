"""
ArtLog — Wikidata SPARQL Client
Fetches high-resolution artwork metadata from Wikidata.
HD image policy: always prefer P18 (depicts image) and select largest resolution.
"""
import hashlib
import json
from typing import Optional

import httpx

from src.backend.config import settings

SPARQL = settings.WIKIDATA_SPARQL_URL
HEADERS = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "ArtLog/0.1 (personal art tracker; contact via GitHub)",
}


def _derive_era(year: Optional[int]) -> str:
    if year is None:
        return "Unknown"
    if year < 1400:
        return "Medieval"
    if year < 1600:
        return "Renaissance"
    if year < 1750:
        return "Baroque"
    if year < 1850:
        return "Neoclassical"
    if year < 1900:
        return "19th Century"
    if year < 1945:
        return "Modern"
    return "Contemporary"


def _hd_image_url(wikimedia_filename: str) -> str:
    """
    Convert a Wikimedia Commons image title to its full-resolution URL.
    Uses the Wikimedia image service to get HD-quality images.
    """
    name = wikimedia_filename.replace(" ", "_")
    md5 = hashlib.md5(name.encode()).hexdigest()
    return f"https://upload.wikimedia.org/wikipedia/commons/{md5[0]}/{md5[:2]}/{name}"


def _parse_artwork(binding: dict) -> dict:
    """Parse one SPARQL result binding into an artwork dict."""
    wikidata_id = binding.get("item", {}).get("value", "").split("/")[-1]
    title = binding.get("itemLabel", {}).get("value", "Untitled")
    artist = binding.get("creatorLabel", {}).get("value")
    movement = binding.get("movementLabel", {}).get("value")
    medium = binding.get("mediumLabel", {}).get("value")
    museum = binding.get("locationLabel", {}).get("value")
    museum_city = binding.get("cityLabel", {}).get("value")
    museum_country = binding.get("countryLabel", {}).get("value")
    description = binding.get("description", {}).get("value")

    year = None
    inception = binding.get("inception", {}).get("value", "")
    if inception:
        try:
            year = int(inception[:4])
        except ValueError:
            pass

    image_url = binding.get("image", {}).get("value", "")
    # Wikidata returns full-res Wikimedia Commons URLs directly via P18
    image_url_hd = image_url  # Already HD for Wikidata P18 images

    return {
        "title": title,
        "artist": artist,
        "year": year,
        "medium": medium,
        "movement": movement,
        "era": _derive_era(year),
        "museum": museum,
        "museum_city": museum_city,
        "museum_country": museum_country,
        "image_url": image_url,
        "image_url_hd": image_url_hd,
        "description": description,
        "wikidata_id": wikidata_id,
        "source": "wikidata",
    }


async def search_wikidata(query: str, limit: int = 20) -> list[dict]:
    """Search artworks on Wikidata by title or artist keyword."""
    sparql_query = f"""
    SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?image ?inception
           ?movementLabel ?mediumLabel ?locationLabel ?cityLabel ?countryLabel ?description
    WHERE {{
      ?item wdt:P31 wd:Q3305213.
      {{
        ?item rdfs:label ?lbl FILTER(LANG(?lbl) = "en" && CONTAINS(LCASE(?lbl), LCASE("{query}")))
      }} UNION {{
        ?item wdt:P170 ?creator.
        ?creator rdfs:label ?clbl FILTER(LANG(?clbl) = "en" && CONTAINS(LCASE(?clbl), LCASE("{query}")))
      }}
      OPTIONAL {{ ?item wdt:P18 ?image. }}
      OPTIONAL {{ ?item wdt:P571 ?inception. }}
      OPTIONAL {{ ?item wdt:P135 ?movement. }}
      OPTIONAL {{ ?item wdt:P186 ?medium. }}
      OPTIONAL {{ ?item wdt:P276 ?location. ?location wdt:P131 ?city. ?location wdt:P17 ?country. }}
      OPTIONAL {{ ?item schema:description ?description FILTER(LANG(?description) = "en") }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT {limit}
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(SPARQL, params={"query": sparql_query, "format": "json"}, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
    bindings = data.get("results", {}).get("bindings", [])
    results = [_parse_artwork(b) for b in bindings if b.get("image")]
    return results


async def fetch_artwork_by_id(wikidata_id: str) -> Optional[dict]:
    """Fetch a single artwork by its Wikidata Q-number."""
    sparql_query = f"""
    SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?image ?inception
           ?movementLabel ?mediumLabel ?locationLabel ?cityLabel ?countryLabel ?description
    WHERE {{
      BIND(wd:{wikidata_id} AS ?item)
      ?item wdt:P31 wd:Q3305213.
      OPTIONAL {{ ?item wdt:P18 ?image. }}
      OPTIONAL {{ ?item wdt:P571 ?inception. }}
      OPTIONAL {{ ?item wdt:P135 ?movement. }}
      OPTIONAL {{ ?item wdt:P186 ?medium. }}
      OPTIONAL {{ ?item wdt:P276 ?location. ?location wdt:P131 ?city. ?location wdt:P17 ?country. }}
      OPTIONAL {{ ?item schema:description ?description FILTER(LANG(?description) = "en") }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT 1
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(SPARQL, params={"query": sparql_query, "format": "json"}, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
    bindings = data.get("results", {}).get("bindings", [])
    if not bindings:
        return None
    return _parse_artwork(bindings[0])


async def explore_wikidata(movement: str, limit: int = 15) -> list[dict]:
    """Fetch prominent artworks related to a specific movement."""
    # Wikidata property P135 = movement, Q-number for movement is variable. 
    # Use exact text match on movementLabel to find works.
    sparql_query = f"""
    SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?image ?inception
           ?movementLabel ?mediumLabel ?locationLabel ?cityLabel ?countryLabel ?description
    WHERE {{
      ?item wdt:P31 wd:Q3305213.
      ?item wdt:P135 ?movement.
      ?movement rdfs:label ?mlbl FILTER(LANG(?mlbl) = "en" && CONTAINS(LCASE(?mlbl), LCASE("{movement}")))
      ?item wdt:P18 ?image.
      OPTIONAL {{ ?item wdt:P170 ?creator. }}
      OPTIONAL {{ ?item wdt:P571 ?inception. }}
      OPTIONAL {{ ?item wdt:P186 ?medium. }}
      OPTIONAL {{ ?item wdt:P276 ?location. ?location wdt:P131 ?city. ?location wdt:P17 ?country. }}
      OPTIONAL {{ ?item schema:description ?description FILTER(LANG(?description) = "en") }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT {limit}
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(SPARQL, params={"query": sparql_query, "format": "json"}, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()
            bindings = data.get("results", {}).get("bindings", [])
            results = [_parse_artwork(b) for b in bindings if b.get("image")]
            return results
        except Exception as e:
            print(f"Explore query failed for {movement}: {str(e)}")
            return []

