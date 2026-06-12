import { describe, it, expect } from "vitest";
import { parseLinkedInMessages } from "../src/lib/extraction/parse-connections";

const EN_SAMPLE = `Thomas Weber
Jun 8
You: Looking forward to connecting!

. Active conversation. Press return to go to conversation details
Open the options list in your conversation with Alex Rep and Thomas Weber
Anna Schmidt, #HIRINGStatus is reachable
Anna Schmidt
Jun 5
Jun 5
Anna: Hi, thanks for reaching out — happy to connect!

. Press return to go to conversation details
Open the options list in your conversation with Anna Schmidt and Alex Rep
Marco FischerStatus is reachable
Marco Fischer
Jun 5
Jun 5
Marco: Hi, great to connect with you!

. Press return to go to conversation details
Open the options list in your conversation with Marco Fischer and Alex Rep
Sarah Johnson-Miller

Sarah Johnson-Miller
Jun 5
Jun 5
Sponsored Go beyond the classroom—learn from industry leaders

. Press return to go to conversation details
Open the options list in your conversation with Sarah Johnson-Miller
David van der BergStatus is reachable
David van der Berg
Jun 5
Jun 5
David: Thanks for the connection request!

. Press return to go to conversation details
Open the options list in your conversation with Alex Rep and David van der Berg
Klaus Bauer
Klaus Bauer
Jun 3
Jun 3
You: Hi Klaus, thanks for connecting — happy to be in touch!

. Press return to go to conversation details
Open the options list in your conversation with Klaus Bauer and Alex Rep
Hans-Peter Lange
Hans-Peter Lange
Jun 3
Jun 3
You: Hi Hans-Peter, great to connect — let me know if you'd like to chat.

. Press return to go to conversation details
Open the options list in your conversation with Hans-Peter Lange and Alex Rep`;

const DE_SAMPLE = `Nachrichten
Nachrichten durchsuchen
Neue Nachricht verfassen
Jobs Ungelesen Kontakte InMail Als Favorit markiert
Zu den Informationen über das aktuelle Gespräch wechseln
Liste der UnterhaltungenHinweis zur Verwendung von Bildschirmlesegeräten: Die Ergebnisse der Nachrichten werden kontinuierlich aktualisiert.
Lisa Hoffmann
Lisa Hoffmann
12:16
12:16
Sie: Hallo Lisa, vielen Dank für Ihre schnelle Antwort!

. Aktuelle Unterhaltung. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Lisa Hoffmann und Jonas Vertrieb öffnen
Kevin Braun
Kevin Braun
10:16
10:16
Sie: Hey Kevin, danke fürs Vernetzen!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Kevin Braun und Jonas Vertrieb öffnen
Peter Schwartz
Peter Schwartz
10:14
10:14
Sie: Hey Peter, schön, dass wir verbunden sind!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Peter Schwartz und Jonas Vertrieb öffnen
Dr. María Elena García
Dr. María Elena García
10:12
10:12
Sie: Hallo Frau García, freut mich, mit Ihnen vernetzt zu sein!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Dr. María Elena García und Jonas Vertrieb öffnen
Jan Nowak
Jan Nowak
10:11
10:11
Sie: Hey Jan, thanks for connecting!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Jan Nowak und Jonas Vertrieb öffnen`;

describe("parseLinkedInMessages", () => {
  describe("English LinkedIn UI", () => {
    it("extracts names from EN paste", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      expect(result.success).toBe(true);
      expect(result.names).toContain("Thomas Weber");
      expect(result.names).toContain("Anna Schmidt");
      expect(result.names).toContain("Marco Fischer");
      expect(result.names).toContain("Sarah Johnson-Miller");
      expect(result.names).toContain("David van der Berg");
      expect(result.names).toContain("Klaus Bauer");
      expect(result.names).toContain("Hans-Peter Lange");
    });

    it("strips EN status suffix 'FischerStatus is reachable'", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      expect(result.names).toContain("Marco Fischer");
      expect(result.names).not.toContain("Marco FischerStatus is reachable");
    });

    it("strips EN comma-status suffix '#HIRINGStatus is reachable'", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      expect(result.names).toContain("Anna Schmidt");
      expect(result.names.some(n => n.includes("#HIRING"))).toBe(false);
    });

    it("deduplicates names within one paste", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      const unique = new Set(result.names.map(n => n.toLowerCase()));
      expect(result.names.length).toBe(unique.size);
    });
  });

  describe("German LinkedIn UI", () => {
    it("extracts names from DE paste", () => {
      const result = parseLinkedInMessages(DE_SAMPLE);
      expect(result.success).toBe(true);
      expect(result.names).toContain("Lisa Hoffmann");
      expect(result.names).toContain("Kevin Braun");
      expect(result.names).toContain("Peter Schwartz");
      expect(result.names).toContain("Dr. María Elena García");
      expect(result.names).toContain("Jan Nowak");
    });

    it("ignores UI chrome lines (Nachrichten, Jobs Ungelesen, etc.)", () => {
      const result = parseLinkedInMessages(DE_SAMPLE);
      expect(result.names.some(n => /^Nachrichten|Jobs Ungelesen|Neue Nachricht/i.test(n))).toBe(false);
    });
  });

  describe("failure cases", () => {
    it("returns success:false with empty input", () => {
      const result = parseLinkedInMessages("   ");
      expect(result.success).toBe(false);
      expect(result.names).toHaveLength(0);
    });

    it("returns success:false when pasting connections text instead of messages text", () => {
      const connectionsText = "Max Mustermann\nProduct Manager\nConnected on June 12, 2026\nMessage";
      const result = parseLinkedInMessages(connectionsText);
      expect(result.success).toBe(false);
    });
  });
});
