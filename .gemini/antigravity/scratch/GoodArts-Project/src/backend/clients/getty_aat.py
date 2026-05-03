"""
GoodArts — Getty Art & Architecture Thesaurus (AAT) Client
Fetches structured definitions for art techniques and styles.
Uses Getty SPARQL endpoint: http://vocab.getty.edu/sparql.
"""
import json
from typing import Optional

import httpx

SPARQL_URL = "http://vocab.getty.edu/sparql"
HEADERS = {"Accept": "application/sparql-results+json"}


async def get_technique_definition(term: str) -> Optional[dict]:
    """
    Search AAT for a technique/style term and return its definition and hierarchy.
    Example: 'impasto' -> {definition, broader, aat_id}.
    """
    query = f"""
    SELECT ?id ?definition ?broader
    WHERE {{
      ?id a skos:Concept;
          luc:term "{term}";
          skos:scopeNote [dct:language gvp_lang:en; rdf:value ?definition].
      OPTIONAL {{
        ?id gvp:broaderPreferred [skos:prefLabel [dct:language gvp_lang:en; rdf:value ?broader]]
      }}
      FILTER(CONTAINS(LCASE(STR(?id)), "aat"))
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
            "aat_id": b.get("id", {}).get("value", "").split("/")[-1],
            "definition": b.get("definition", {}).get("value"),
            "broader": b.get("broader", {}).get("value"),
        }
    except Exception:
        return None


async def enrich_techniques(technique_list_json: Optional[str]) -> Optional[str]:
    """
    Take a JSON list of technique titles, fetch definitions for each,
    and return a JSON dict mapping term -> definition info.
    """
    if not technique_list_json:
        return None
    try:
        terms = json.loads(technique_list_json)
    except Exception:
        return None

    if not terms:
        return None

    results = {}
    for term in terms[:5]:  # Limit to 5 definitions per artwork
        info = await get_technique_definition(term)
        if info:
            results[term] = info

    return json.dumps(results) if results else None
