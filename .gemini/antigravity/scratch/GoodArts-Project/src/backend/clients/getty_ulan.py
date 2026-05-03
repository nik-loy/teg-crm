"""
GoodArts — Getty Union List of Artist Names (ULAN) Client
Fetches authoritative artist biographies, nationalities, and life dates.
"""
from typing import Optional

import httpx

SPARQL_URL = "http://vocab.getty.edu/sparql"
HEADERS = {"Accept": "application/sparql-results+json"}


async def fetch_artist_dossier(artist_name: str) -> Optional[dict]:
    """
    Search ULAN for an artist and return structured bio data.
    """
    query = f"""
    SELECT ?id ?bio ?birth ?death ?nationality
    WHERE {{
      ?id a gvp:PersonConcept;
          luc:term "{artist_name}";
          gvp:biographyPreferred [schema:description ?bio].
      OPTIONAL {{ ?id gvp:agentByear ?birth. }}
      OPTIONAL {{ ?id gvp:agentDyear ?death. }}
      OPTIONAL {{
        ?id gvp:parentContext [skos:prefLabel [dct:language gvp_lang:en; rdf:value ?nationality]].
        FILTER(CONTAINS(LCASE(?nationality), "american") || CONTAINS(LCASE(?nationality), "dutch") || 
               CONTAINS(LCASE(?nationality), "french") || CONTAINS(LCASE(?nationality), "italian") ||
               CONTAINS(LCASE(?nationality), "spanish") || CONTAINS(LCASE(?nationality), "german"))
      }}
      FILTER(CONTAINS(LCASE(STR(?id)), "ulan"))
    }}
    LIMIT 1
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(SPARQL_URL, params={"query": query}, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()

        bindings = data.get("results", {}).get("bindings", [])
        if not bindings:
            return None

        b = bindings[0]
        return {
            "ulan_id": b.get("id", {}).get("value", "").split("/")[-1],
            "bio": b.get("bio", {}).get("value"),
            "birth_year": int(b["birth"]["value"]) if "birth" in b else None,
            "death_year": int(b["death"]["value"]) if "death" in b else None,
            "nationality": b.get("nationality", {}).get("value"),
        }
    except Exception:
        return None
