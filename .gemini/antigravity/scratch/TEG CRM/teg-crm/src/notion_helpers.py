from __future__ import annotations

import logging
import time
from typing import Any

from notion_client import Client
from notion_client.errors import APIResponseError

logger = logging.getLogger(__name__)


def paginated_query(
    client: Client,
    db_id: str,
    filter: dict | None = None,
    sorts: list | None = None,
) -> list[dict]:
    """Fetches all pages from a Notion database, handling pagination automatically."""
    results: list[dict] = []
    cursor: str | None = None
    while True:
        kwargs: dict[str, Any] = {"database_id": db_id, "page_size": 100}
        if filter:
            kwargs["filter"] = filter
        if sorts:
            kwargs["sorts"] = sorts
        if cursor:
            kwargs["start_cursor"] = cursor

        response = client.databases.query(**kwargs)
        results.extend(response["results"])

        if not response.get("has_more"):
            break
        cursor = response["next_cursor"]
        time.sleep(0.35)

    return results


def with_retry(fn: Any, max_attempts: int = 5) -> Any:
    """Calls fn(), retrying with exponential backoff on Notion 429 rate-limit errors."""
    for attempt in range(max_attempts):
        try:
            return fn()
        except APIResponseError as exc:
            if exc.status == 429 and attempt < max_attempts - 1:
                wait = 2**attempt
                logger.warning("Rate limited. Retrying in %ds (attempt %d/%d)", wait, attempt + 1, max_attempts)
                time.sleep(wait)
            else:
                raise


def title_prop(text: str) -> dict:
    return {"title": [{"text": {"content": text}}]}


def rich_text_prop(text: str) -> dict:
    return {"rich_text": [{"text": {"content": text}}]}


def select_prop(name: str) -> dict:
    return {"select": {"name": name}}


def multi_select_prop(names: list[str]) -> dict:
    return {"multi_select": [{"name": n} for n in names]}


def date_prop(iso_date: str) -> dict:
    return {"date": {"start": iso_date}}


def relation_prop(page_ids: list[str]) -> dict:
    return {"relation": [{"id": pid} for pid in page_ids]}


def email_prop(email: str) -> dict:
    return {"email": email}


def url_prop(url: str) -> dict:
    return {"url": url}


def phone_prop(phone: str) -> dict:
    return {"phone_number": phone}


def checkbox_prop(value: bool) -> dict:
    return {"checkbox": value}
