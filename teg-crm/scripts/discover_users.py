"""Lists all Notion workspace users with their IDs.

Run: python -m scripts.discover_users

Output: a table of person-type users. Copy the Notion User IDs into config/team.json.
Bots (API integrations) are excluded from the output.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()


def list_workspace_users(client: Client) -> list[dict]:
    """Returns all person-type users from the Notion workspace."""
    response = client.users.list()
    return [u for u in response["results"] if u.get("type") == "person"]


def main() -> None:
    token = os.getenv("NOTION_TOKEN")
    if not token:
        console.print("[red]Error:[/red] NOTION_TOKEN env var not set")
        raise SystemExit(1)

    client = Client(auth=token)
    users = list_workspace_users(client)

    if not users:
        console.print("[yellow]No person-type users found in workspace.[/yellow]")
        console.print("Check that your integration has access to the workspace.")
        return

    table = Table(title="Notion Workspace Users")
    table.add_column("Name", style="cyan")
    table.add_column("Email", style="green")
    table.add_column("Notion User ID (copy to config/team.json)", style="yellow")
    for user in users:
        name = user.get("name", "Unknown")
        email = user.get("person", {}).get("email", "N/A")
        table.add_row(name, email, user["id"])

    console.print(table)
    console.print(
        "\n[dim]Copy team.json.example -> config/team.json and fill in the IDs above.[/dim]"
    )


if __name__ == "__main__":
    main()
