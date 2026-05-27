"""LinkedIn message generator for ACC 2026 outreach.

Two modes:
  API mode   (ANTHROPIC_API_KEY set): calls Claude, generates personalised German message,
             prompts for confirmation, then logs Interaction to Notion + updates contact status.
  Print mode (no API key): formats profile data into a copy-paste block for ChatGPT.

Run:
  python -m src.linkedin.message_gen --url https://linkedin.com/in/person [--owner niklas]

Then paste the LinkedIn profile data when prompted.
"""
from __future__ import annotations

import argparse
import logging
import re
from datetime import date

from dotenv import load_dotenv
from notion_client import Client
from rich.console import Console
from rich.prompt import Confirm, Prompt

from src.config import Config
from src.notion_helpers import rich_text_prop, select_prop, title_prop, with_retry
from src.linkedin.contact_logger import find_by_linkedin_url, update_contact_status

load_dotenv()
console = Console()
logger = logging.getLogger(__name__)

# ── System prompt (verbatim from ACC 2026 LinkedIn Outreach Workflow Template) ──

SYSTEM_PROMPT = """Du bist ein Outreach-Assistent für die AI Consulting Conference 2026 (ACC 2026), organisiert von TEG - The Entrepreneurial Group.

Deine Aufgabe ist es, kurze, natürlich klingende LinkedIn-Nachrichten zu erstellen, um potenzielle Teilnehmer einzuladen. Die Nachrichten sollen sich anfühlen, als hätte eine echte Person sie in 30 Sekunden getippt, nicht wie ein Template, eine Pressemitteilung oder Sales-Outreach.

Die Grundlogik: Nicht zuerst die Konferenz erklären, sondern zeigen, warum genau diese Person thematisch passen könnte.

## WORKFLOW — Infos empfangen

Wenn du Informationen zur Person bekommst, machst du immer diese fünf Dinge:
1. Fit-Rating
2. Senioritäts-Check
3. Template-Entscheidung
4. Du/Sie-Entscheidung
5. LinkedIn-Nachricht generieren

## 1. FIT-RATING
Bewerte streng von 1 bis 5. Eine 5 ist selten.
5 = Absoluter Volltreffer: Beratung/Tech, direkter AI-Bezug im Jobtitel, Junior- bis Mid-Level, München/DACH.
4 = Sehr gut: Beratung/Tech, thematisch nah, aber AI nicht Hauptfokus ODER guter AI-Bezug, aber etwas entfernte Branche.
3 = Solide: Angrenzende Branche, allgemeiner Tech-, Digital- oder Transformation-Bezug.
2 = Grenzwertig: Wenig Bezug zu Beratung oder AI.
1 = Kein Fit: Komplett andere Branche.
Gib eine kurze Begründung in 1-2 Sätzen. Die meisten guten Targets sind eine 4, nicht automatisch eine 5.

## 2. SENIORITÄTS-CHECK
Warnung ausgeben bei: Partner, Associate Partner, Principal, Director, VP, Managing Director, C-Level, Vorstand.
Dann: „Achtung: sehr senior. Executive Access (€200) wäre vermutlich das passendere Ticket."
Ohne Bedenken anschreibbar: Business Analyst, Associate, Consultant, Junior Consultant, Senior Consultant (wenn nicht zu nah am Speaker), Senior Associate, Working Student mit AI-Bezug, Masterstudierende mit AI-Bezug.

## 3. TEMPLATE-ENTSCHEIDUNG
Intern: Person arbeitet bei McKinsey, Roland Berger, IBM, appliedAI, PwC, BCG, Capgemini Invent, MaibornWolff, Netlight, Hogan Lovells, Munich Re, oder LMU München (alle haben bestätigte Speaker). Erwähne beiläufig, dass auch jemand aus deren Haus spricht.
Extern: Person kommt von einer anderen Firma. Nenne 2-4 starke Firmennamen als Credibility.

## 4. DU/SIE-ENTSCHEIDUNG
Du: Associate, Consultant, Junior Consultant, Business Analyst, Senior Associate, Masterstudierende, Startup-Umfeld, lockerer LinkedIn-Auftritt.
Sie: Manager+, deutlich ältere Personen, formeller Auftritt, Partner/Director/C-Level. Im Zweifel: Sie.

## 5. LINKEDIN-NACHRICHT GENERIEREN
Länge: 350-450 Zeichen, Maximum 500 Zeichen.
Stil: kurz, natürlich, kein Marketing-Ton, keine langen Absätze, keine vollen Speaker-Titel.
Kein Preis, kein Rabatt, kein Coupon, kein "sichern Sie sich jetzt", kein "Wir von TEG organisieren", kein Titel in der Signatur.
Beginne mit dem Bezug zur Person. Logik: „Du machst X. Wir machen Y. Deshalb dachte ich, es könnte passen."

AGENDA (10. Juni 2026, München):
- 10:00 Opening Keynotes: KI und die neue Wertschöpfung in der Beratung
- 10:45 Hauptpanel: Wer führt die AI-Transformation? Strategieberatung vs. Tech-Consulting vs. interne AI-Teams
- 11:30 Real AI Case Study: Vom Pilot zur Wirkung
- 13:15 Industry Briefings: Health, Automotive, Mobility, Financial Services
- 13:15 Hands-on Workshops: Accenture, Netlight (je ca. 20 Teilnehmer)
- 15:00 Fireside Chat: Governance, Haftung & Risiko
- 15:30 Panel: Die Zukunft der Beraterkarriere
- 16:30 Closing Keynote: Consulting 2030

BESTÄTIGTE SPEAKER (für thematisches Matching und Intern/Extern-Check):
Florian Bauer (McKinsey), Anja Huber (McKinsey), Marcus Hartmann (Roland Berger), Tsun-Tao Chan (Roland Berger), Andrea Martin (IBM), Dr. Andreas Liebl (appliedAI), Susanne Schmutzler (PwC), Daniel Steiner (PwC), Erik Lenhard (BCG), Dr. Florian Forst (Capgemini Invent), Alexander Hofmann (MaibornWolff), Moritz Tränkner-Tuborgh (Netlight), Daniel Schober (Netlight), Dr. Stefan Schuppert (Hogan Lovells), Dr. Peter Bärnreuther (Munich Re), Prof. Dr. Anne-Sophie Mayer (LMU).

PERSONALISIERUNG — Bezüge nutzen: konkreter Jobfokus, konkrete Branche, konkretes Thema aus dem Profil, Bezug zu einer Agenda-Session.
Schlechte Personalisierung: „mit Ihrem spannenden Profil", „mit Ihrem Background in Consulting", „aufgrund Ihrer Erfahrung".

SIGNATUR: Nur "VG Finn" oder "Viele Grüße, Finn" oder "Beste Grüße, Finn". Kein Titel, kein TEG.

WICHTIGE REGELN:
- Antworte immer auf Deutsch
- Halte die Nachricht unter 500 Zeichen, Ziel 350-450 Zeichen
- Variiere Struktur und Formulierungen
- Keine vollen Speaker-Titel
- Keine Preise, Rabatte, Coupon-Codes
- Der persönliche Bezug ist wichtiger als die Speakerliste

OUTPUT-FORMAT — antworte immer in genau diesem Format:
**Fit-Rating:** [1-5]/5
[Kurze Begründung]
**Senioritäts-Check:**
[Kurze Einschätzung]
**Template:** Intern/Extern
[Kurze Erklärung]
**Ansprache:** Du/Sie
[Kurze Erklärung]
**Nachricht:**
[LinkedIn-Nachricht]
—"""


def build_invite_url(cfg: Config, owner: str) -> str:
    """Returns the invite URL with the correct utm_source for this owner."""
    utm = owner.lower().replace(" ", "")
    for member in cfg.team_members:
        if member.name.lower() == owner.lower():
            utm = member.utm_source or utm
            break
    return f"{cfg.outreach_luma_url}&utm_source={utm}"


def parse_fit_rating(response: str) -> int:
    """Extracts the fit rating integer from the LLM response."""
    match = re.search(r"\*\*Fit-Rating:\*\*\s*(\d)/5", response)
    return int(match.group(1)) if match else 0


def parse_message(response: str) -> str:
    """Extracts the LinkedIn message text from the LLM response."""
    match = re.search(r"\*\*Nachricht:\*\*\n(.*?)(?:\n—|\Z)", response, re.DOTALL)
    if not match:
        return ""
    return match.group(1).strip()


def should_proceed(fit_rating: int, threshold: int = 3) -> bool:
    return fit_rating >= threshold


def _prompt_profile_data() -> str:
    """Interactive prompt to collect LinkedIn profile data from user."""
    console.print("\n[bold]Paste LinkedIn profile data[/bold] (headline, role, bio, experience).")
    console.print("[dim]Press Enter twice when done.[/dim]\n")
    lines = []
    empty_count = 0
    while empty_count < 1:
        line = input()
        if line == "":
            empty_count += 1
        else:
            empty_count = 0
            lines.append(line)
    return "\n".join(lines)


def _log_interaction(
    client: Client,
    cfg: Config,
    contact_page_id: str,
    message: str,
) -> None:
    """Creates an Interaction record in Notion for the sent message."""
    with_retry(lambda: client.pages.create(
        parent={"database_id": cfg.interactions_db_id},
        properties={
            "Summary": title_prop("LinkedIn outreach message sent"),
            "Contact": {"relation": [{"id": contact_page_id}]},
            "Date": {"date": {"start": date.today().isoformat()}},
            "Type": select_prop("LinkedIn Message"),
            "Next Action": rich_text_prop("Await response"),
        },
    ))


def _run_api_mode(
    client: Client,
    cfg: Config,
    contact_page_id: str,
    name: str,
    owner: str,
) -> None:
    """Calls Claude API, shows output, prompts for confirmation, logs to Notion."""
    try:
        import anthropic
    except ImportError:
        console.print("[red]Error:[/red] anthropic package not installed. Run: pip install anthropic")
        return

    profile_data = _prompt_profile_data()
    if not profile_data.strip():
        console.print("[yellow]No profile data entered. Exiting.[/yellow]")
        return

    invite_url = build_invite_url(cfg, owner)
    user_message = f"Name: {name}\n\nProfil-Infos:\n{profile_data}\n\nEinladungslink für diese Nachricht: {invite_url}"

    console.print("\n[dim]Generating message...[/dim]")
    ai_client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)
    response = ai_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    full_response = response.content[0].text

    console.print("\n" + "─" * 60)
    console.print(full_response)
    console.print("─" * 60 + "\n")

    fit = parse_fit_rating(full_response)
    if not should_proceed(fit):
        console.print(f"[yellow]Fit-Rating {fit}/5 — below threshold. Not logging.[/yellow]")
        return

    message = parse_message(full_response)
    if not message:
        console.print("[yellow]Could not parse message from response. Not logging.[/yellow]")
        return

    if Confirm.ask("Log to Notion and mark as Messaged?"):
        _log_interaction(client, cfg, contact_page_id, message)
        update_contact_status(client, contact_page_id, "Messaged")
        console.print("[green]✓[/green] Logged to Notion — contact marked Messaged.")


def _run_print_mode(name: str, owner: str, cfg: Config) -> None:
    """No API key — prints formatted block ready to paste into ChatGPT."""
    invite_url = build_invite_url(cfg, owner)
    console.print("\n[bold yellow]No ANTHROPIC_API_KEY set — clipboard mode[/bold yellow]")
    console.print("\n[dim]Step 1: Copy the system prompt at the top of message_gen.py into a new ChatGPT chat.[/dim]")
    console.print("\n[dim]Step 2: Then send this message:[/dim]\n")
    console.print("─" * 60)
    console.print(f"{name}")
    console.print(f"\n[Paste headline, role, bio, experience here]\n\nEinladungslink: {invite_url}")
    console.print("─" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LinkedIn outreach message for TEG CRM")
    parser.add_argument("--url", required=True, help="LinkedIn profile URL of the contact")
    parser.add_argument("--owner", default="", help="Your name (for UTM link and logging)")
    args = parser.parse_args()

    cfg = Config.from_env()
    client = Client(auth=cfg.notion_token)

    contact_page_id = find_by_linkedin_url(client, cfg, args.url)
    if not contact_page_id:
        console.print(f"[red]Error:[/red] No contact found for {args.url}")
        console.print("[dim]Run contact_logger first to create the contact.[/dim]")
        return

    contact = with_retry(lambda: client.pages.retrieve(page_id=contact_page_id))
    name = contact["properties"]["Name"]["title"][0]["text"]["content"]
    status = (contact["properties"].get("LinkedIn Outreach Status") or {}).get("select") or {}
    status_name = status.get("name", "unknown")
    owner = args.owner or (cfg.team_members[0].name if cfg.team_members else "Finn")

    console.print(f"\n[bold]{name}[/bold]  [dim]({status_name})[/dim]")

    if status_name != "Connected":
        console.print(f"[yellow]Warning:[/yellow] Status is '{status_name}', not 'Connected'. Proceed anyway? ")
        if not Confirm.ask("Continue?"):
            return

    if cfg.anthropic_api_key:
        _run_api_mode(client, cfg, contact_page_id, name, owner)
    else:
        _run_print_mode(name, owner, cfg)


if __name__ == "__main__":
    main()
