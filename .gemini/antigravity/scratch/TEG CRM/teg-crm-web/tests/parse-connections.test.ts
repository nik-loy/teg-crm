import { describe, it, expect } from "vitest";
import {
  parseLinkedInConnections,
  isConnectedOnLine,
} from "../src/lib/extraction/parse-connections";

// ─── English LinkedIn Connections page ───────────────────────────────────────
// Shape: "<Name>'s profile picture" / <Name> / <headline> / "Connected on <date>" / "Message"
const FIXTURE_EN = `Max Mustermann's profile picture
Max Mustermann

Product Manager at Example GmbH

Connected on June 12, 2026

Message

Jane Doe's profile picture
Jane Doe

Software Engineer at Acme Inc | Building things

Connected on June 11, 2026

Message`;

// ─── German LinkedIn Connections page ────────────────────────────────────────
// Real paste from a German-locale teammate. The anchor line is
// "Am <day>. <Monat> <year> vernetzt" (NOT "Verbunden am …"), the button is
// "Nachricht", and the profile-picture alt-text comes in three shapes:
//   • "Profilbild von <Name>, offen für Jobangebote"  (open-to-work)
//   • "<Name>s Profilbild"                             (possessive -s)
//   • "<Name>' Profilbild"                             (apostrophe possessive)
const FIXTURE_DE = `Profilbild von Jonathan Andreas Fink, offen für Jobangebote
Jonathan Andreas Fink

Business Analyst | Pharma Manufacturing Digitalization | MSAT, Data Products & Process Improvement

Am 12. Juni 2026 vernetzt

Nachricht

Shan-Hua Chungs Profilbild
Shan-Hua Chung

Principal Scientist and People Leader in Cell Technologies at Roche Pharma Early Research and Development

Am 12. Juni 2026 vernetzt

Nachricht

Sung-Hui Yis Profilbild
Sung-Hui Yi

Scientist in Antibody Discovery, in vitro RNA/Protein Synthesis, Automation and Biophysics

Am 12. Juni 2026 vernetzt

Nachricht

Maximilian Sacherers Profilbild
Maximilian Sacherer

Dr. rer. nat. | Organischer Chemiker | Roche Diagnostics GmbH

Am 12. Juni 2026 vernetzt

Nachricht

Mariam Zaidis Profilbild
Mariam Zaidi

Data Scientist at Roche

Am 12. Juni 2026 vernetzt

Nachricht

Janick Weberpals' Profilbild
Janick Weberpals

R&D Data Science & AI

Am 12. Juni 2026 vernetzt

Nachricht

Fabian Stamp, PhDs Profilbild
Fabian Stamp, PhD

Senior Data Scientist @Roche with focus on
automation | ML | AI

Am 12. Juni 2026 vernetzt

Nachricht

Shuhan Xiaos Profilbild
Shuhan Xiao

PhD Student

Am 12. Juni 2026 vernetzt

Nachricht

Diane Ebingers Profilbild
Diane Ebinger

Senior Associate Gene Therapy at Roche | M. Sc. Biotechnology

Am 12. Juni 2026 vernetzt

Nachricht

Nikita Makarovs Profilbild
Nikita Makarov

Machine Learning @ Valinor | PhD @ Roche/Genentech & Helmholtz Munich

Am 12. Juni 2026 vernetzt

Nachricht

Moritz Langs Profilbild
Moritz Lang

Senior Data Scientist / Biostatistician at Roche Diagnostics GmbH

Am 12. Juni 2026 vernetzt

Nachricht

Dr. Katharina Theresa Bergers Profilbild
Dr. Katharina Theresa Berger

Senior Manager at Simon-Kucher | Automotive

Am 11. Juni 2026 vernetzt

Nachricht

Dr. Wing Ki (Catherine) Wongs Profilbild
Dr. Wing Ki (Catherine) Wong

Principal Scientist & Technical Project Lead, Roche | AI for Drug Design, Pharma R&D | Oxford PhD

Am 11. Juni 2026 vernetzt

Nachricht

Michal Swiats Profilbild
Michal Swiat

Senior Associate Display Technologies at Roche

Am 11. Juni 2026 vernetzt

Nachricht

Thomas Pickls Profilbild
Thomas Pickl

Scientist | MSAT Chemical Expert

Am 11. Juni 2026 vernetzt

Nachricht

James Hendersons Profilbild
James Henderson

Scientist

Am 11. Juni 2026 vernetzt

Nachricht

Francesco Ansideris Profilbild
Francesco Ansideri

Postdoctoral Researcher presso Roche Diagnostics Penzberg

Am 11. Juni 2026 vernetzt`;

// One German + one English entry pasted together (a mixed-language team session).
const FIXTURE_MIXED = `Anna Schmidt's profile picture
Anna Schmidt

Product Manager at Google

Connected on June 10, 2026

Message

Lukas Müllers Profilbild
Lukas Müller

Data Engineer bei Siemens

Am 9. Juni 2026 vernetzt

Nachricht`;

// ─── isConnectedOnLine ───────────────────────────────────────────────────────

describe("isConnectedOnLine — anchor detection", () => {
  it("matches the English 'Connected on <date>' line", () => {
    expect(isConnectedOnLine("Connected on June 12, 2026")).toBe(true);
  });

  it("matches the current German 'Am <date> vernetzt' line", () => {
    expect(isConnectedOnLine("Am 12. Juni 2026 vernetzt")).toBe(true);
    expect(isConnectedOnLine("Am 1. März 2026 vernetzt")).toBe(true);
  });

  it("does not match a normal headline that merely starts with 'Am'", () => {
    expect(isConnectedOnLine("Am Markt 5 | Retail Strategy")).toBe(false);
  });
});

// ─── English ─────────────────────────────────────────────────────────────────

describe("parseLinkedInConnections — English", () => {
  it("parses both English connections", () => {
    const r = parseLinkedInConnections(FIXTURE_EN);
    expect(r.success).toBe(true);
    expect(r.connections).toHaveLength(2);
  });

  it("extracts names and ISO connectedOn dates", () => {
    const r = parseLinkedInConnections(FIXTURE_EN);
    expect(r.connections[0].name).toBe("Max Mustermann");
    expect(r.connections[0].connectedOn).toBe("2026-06-12");
    expect(r.connections[1].name).toBe("Jane Doe");
    expect(r.connections[1].connectedOn).toBe("2026-06-11");
  });

  it("never includes the 'profile picture' alt-text as a name", () => {
    const names = parseLinkedInConnections(FIXTURE_EN).connections.map((c) => c.name);
    expect(names.join(" ")).not.toMatch(/profile picture/i);
  });
});

// ─── German ──────────────────────────────────────────────────────────────────

describe("parseLinkedInConnections — German", () => {
  it("parses all 17 German connections", () => {
    const r = parseLinkedInConnections(FIXTURE_DE);
    expect(r.success).toBe(true);
    expect(r.connections).toHaveLength(17);
  });

  it("extracts clean names across all three profile-picture alt-text shapes", () => {
    const names = parseLinkedInConnections(FIXTURE_DE).connections.map((c) => c.name);
    expect(names).toEqual([
      "Jonathan Andreas Fink", // "Profilbild von …, offen für Jobangebote"
      "Shan-Hua Chung",        // "<Name>s Profilbild"
      "Sung-Hui Yi",
      "Maximilian Sacherer",
      "Mariam Zaidi",
      "Janick Weberpals",      // "<Name>' Profilbild" (apostrophe)
      "Fabian Stamp, PhD",     // comma in name + 2-line headline
      "Shuhan Xiao",
      "Diane Ebinger",
      "Nikita Makarov",
      "Moritz Lang",
      "Dr. Katharina Theresa Berger",
      "Dr. Wing Ki (Catherine) Wong", // parentheses in name
      "Michal Swiat",
      "Thomas Pickl",
      "James Henderson",
      "Francesco Ansideri",
    ]);
  });

  it("never includes a 'Profilbild' line as a name", () => {
    const names = parseLinkedInConnections(FIXTURE_DE).connections.map((c) => c.name);
    expect(names.join(" ")).not.toMatch(/profilbild/i);
  });

  it("parses 'Am <day>. <Monat> <year> vernetzt' into ISO dates", () => {
    const byName = new Map(
      parseLinkedInConnections(FIXTURE_DE).connections.map((c) => [c.name, c])
    );
    expect(byName.get("Jonathan Andreas Fink")!.connectedOn).toBe("2026-06-12");
    expect(byName.get("James Henderson")!.connectedOn).toBe("2026-06-11");
  });

  it("joins a multi-line headline with ·", () => {
    const fabian = parseLinkedInConnections(FIXTURE_DE).connections.find(
      (c) => c.name === "Fabian Stamp, PhD"
    )!;
    expect(fabian.headline).toContain("Senior Data Scientist");
    expect(fabian.headline).toContain("automation | ML | AI");
  });
});

// ─── Mixed-language paste ────────────────────────────────────────────────────

describe("parseLinkedInConnections — mixed EN + DE in one paste", () => {
  it("parses both regardless of language", () => {
    const r = parseLinkedInConnections(FIXTURE_MIXED);
    expect(r.connections.map((c) => c.name)).toEqual(["Anna Schmidt", "Lukas Müller"]);
    expect(r.connections[0].connectedOn).toBe("2026-06-10");
    expect(r.connections[1].connectedOn).toBe("2026-06-09");
  });
});
