"""LinkedIn message generator for ACC 2026 outreach.

Uses Google Gemini to generate personalised German messages,
prompts for confirmation, then logs Interaction to SQLite + updates contact status.

Run:
  python -m src.linkedin.message_gen --url https://linkedin.com/in/person [--owner niklas]

Then paste the LinkedIn profile data when prompted.
"""
from __future__ import annotations

import argparse
import logging
import os
import re
from datetime import date

import django
from dotenv import load_dotenv
from rich.console import Console
from rich.prompt import Confirm

# Bootstrap Django environment before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "crm.settings")
django.setup()

from crm.contacts.models import Contact, Interaction, InteractionType
from src.config import Config

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
Bewerte streng von 1 bis 5. Eine 5 is selten.
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
Extern: Person kommt von einer anderen firma. Nenne 2-4 starke Firmennamen als Credibility.

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

SIGNATUR: Nur "VG Finn" oder "Viele Grüße, Finn" or "Beste Grüße, Finn". Kein Titel, kein TEG.

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
    contact: Contact,
    message: str,
) -> None:
    """Creates an Interaction record in SQLite for the sent message."""
    Interaction.objects.create(
        contact=contact,
        summary="LinkedIn outreach message sent",
        interaction_type=InteractionType.LINKEDIN_MESSAGE,
        date=date.today(),
        next_action="Await response",
        notes=message,
    )


def _call_and_display(
    contact: Contact,
    full_response: str,
) -> None:
    """Shared post-call logic: display response, check fit, confirm, log to SQLite."""
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

    if Confirm.ask("Log to SQLite and mark as Messaged?"):
        _log_interaction(contact, message)
        contact.outreach_status = "Messaged"
        contact.save()
        console.print("[green]✓[/green] Logged to SQLite — contact marked Messaged.")


def _run_gemini_mode(
    contact: Contact,
    name: str,
    owner: str,
    cfg: Config,
) -> None:
    """Calls Google Gemini, shows output, prompts for confirmation, logs to SQLite."""
    try:
        from google import genai
    except ImportError:
        console.print("[red]Error:[/red] google-genai package not installed. Run: pip install google-genai")
        return

    profile_data = _prompt_profile_data()
    if not profile_data.strip():
        console.print("[yellow]No profile data entered. Exiting.[/yellow]")
        return

    invite_url = build_invite_url(cfg, owner)
    user_message = f"Name: {name}\n\nProfil-Infos:\n{profile_data}\n\nEinladungslink für diese Nachricht: {invite_url}"

    console.print("\n[dim]Generating message via Gemini...[/dim]")
    ai_client = genai.Client(api_key=cfg.gemini_api_key)
    response = ai_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_message,
        config=genai.types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=800,
            safety_settings=[
                genai.types.SafetySetting(
                    category=genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold=genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                genai.types.SafetySetting(
                    category=genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold=genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                genai.types.SafetySetting(
                    category=genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold=genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                genai.types.SafetySetting(
                    category=genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold=genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
            ],
        ),
    )
    full_response = response.text or ""
    _call_and_display(contact, full_response)


def _run_print_mode(name: str, owner: str, cfg: Config) -> None:
    """No API key set — prints a clipboard-ready block for manual use."""
    invite_url = build_invite_url(cfg, owner)
    console.print("\n[bold yellow]No GEMINI_API_KEY set — clipboard mode[/bold yellow]")
    console.print("[dim]Set GEMINI_API_KEY in .env to enable auto-generation.[/dim]")
    console.print("\n[dim]Step 1: Open AI Studio or ChatGPT. Start a new chat.[/dim]")
    console.print("[dim]Step 2: Paste the SYSTEM_PROMPT constant from src/linkedin/message_gen.py as the system prompt.[/dim]")
    console.print("\n[dim]Step 3: Send this as your first message:[/dim]\n")
    console.print("─" * 60)
    console.print(f"{name}")
    console.print(f"\n[Paste headline, role, bio, experience here]\n\nEinladungslink: {invite_url}")
    console.print("─" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LinkedIn outreach message for TEG SQLite CRM")
    parser.add_argument("--url", required=True, help="LinkedIn profile URL of the contact")
    parser.add_argument("--owner", default="", help="Your name (for UTM link and logging)")
    args = parser.parse_args()

    cfg = Config.from_env()

    contact = Contact.objects.filter(linkedin_url=args.url).first()
    if not contact:
        console.print(f"[red]Error:[/red] No contact found for {args.url}")
        console.print("[dim]Run contact_logger first to create the contact.[/dim]")
        return

    name = contact.name
    status_name = contact.outreach_status or "unknown"
    owner = args.owner or (cfg.team_members[0].name if cfg.team_members else "Finn")

    console.print(f"\n[bold]{name}[/bold]  [dim]({status_name})[/dim]")

    if status_name != "Connected":
        console.print(f"[yellow]Warning:[/yellow] Status is '{status_name}', not 'Connected'. Proceed anyway? ")
        if not Confirm.ask("Continue?"):
            return

    if cfg.gemini_api_key:
        _run_gemini_mode(contact, name, owner, cfg)
    else:
        _run_print_mode(name, owner, cfg)


if __name__ == "__main__":
    main()
