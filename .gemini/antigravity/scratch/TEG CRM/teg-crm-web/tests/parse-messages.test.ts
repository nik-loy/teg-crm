import { describe, it, expect } from "vitest";
import { parseLinkedInMessages } from "../src/lib/extraction/parse-connections";

const EN_SAMPLE = `Raphael de Boer
Jun 8
You: Hahahaha seems legit 👀👀

. Active conversation. Press return to go to conversation details
Open the options list in your conversation with Niklas Loycke and Raphael de Boer
Toni Wiemeyer, #HIRINGStatus is reachable
Toni Wiemeyer
Jun 5
Jun 5
Toni: Hi Niklas, vielen Dank für deine Nachricht und die Einladung.

. Press return to go to conversation details
Open the options list in your conversation with Toni Wiemeyer and Niklas Loycke
Sparsh TyagiStatus is reachable
Sparsh Tyagi
Jun 5
Jun 5
Sparsh: Hi Niklas, danke für die Vernetzung!

. Press return to go to conversation details
Open the options list in your conversation with Sparsh Tyagi and Niklas Loycke
Maria Luisa Romero Toro

Maria Luisa Romero Toro
Jun 5
Jun 5
Sponsored Go beyond the classroom—learn from industry leaders

. Press return to go to conversation details
Open the options list in your conversation with Maria Luisa Romero Toro
Vignesh ChandrasekaranStatus is reachable
Vignesh Chandrasekaran
Jun 5
Jun 5
Vignesh: 👍

. Press return to go to conversation details
Open the options list in your conversation with Niklas Loycke and Vignesh Chandrasekaran
Dario Menzen
Dario Menzen
Jun 3
Jun 3
You: Hallo Herr Menzen, vielen Dank für die Vernetzung.

. Press return to go to conversation details
Open the options list in your conversation with Dario Menzen and Niklas Loycke
Jan-Marco Müller
Jan-Marco Müller
Jun 3
Jun 3
You: Hallo Herr Müller, vielen Dank für die Vernetzung.

. Press return to go to conversation details
Open the options list in your conversation with Jan-Marco Müller and Niklas Loycke`;

const DE_SAMPLE = `Nachrichten
Nachrichten durchsuchen
Neue Nachricht verfassen
Jobs Ungelesen Kontakte InMail Als Favorit markiert
Zu den Informationen über das aktuelle Gespräch wechseln
Liste der UnterhaltungenHinweis zur Verwendung von Bildschirmlesegeräten: Die Ergebnisse der Nachrichten werden kontinuierlich aktualisiert.
Diane Ebinger
Diane Ebinger
12:16
12:16
Sie: Hi Diane, dankeschön für die schnelle Antwort.

. Aktuelle Unterhaltung. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Diane Ebinger und Jonas Böhrer öffnen
Shuhan Xiao
Shuhan Xiao
10:16
10:16
Sie: Hey Shuhan, danke fürs Vernetzen!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Shuhan Xiao und Jonas Böhrer öffnen
Nikita Makarov
Nikita Makarov
10:14
10:14
Sie: Hey Nikita, danke fürs Vernetzen!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Nikita Makarov und Jonas Böhrer öffnen
Dr. Wing Ki (Catherine) Wong
Dr. Wing Ki (Catherine) Wong
10:12
10:12
Sie: Hallo Frau Wong, danke für die Vernetzung!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Dr. Wing Ki (Catherine) Wong und Jonas Böhrer öffnen
Michal Swiat
Michal Swiat
10:11
10:11
Sie: Hey Michal, thanks for connecting!

. Drücken Sie die Eingabetaste, um zu den Details der Unterhaltung zu wechseln.
Liste der Optionen in Ihrer Unterhaltung mit Michal Swiat und Jonas Böhrer öffnen`;

describe("parseLinkedInMessages", () => {
  describe("English LinkedIn UI", () => {
    it("extracts names from EN paste", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      expect(result.success).toBe(true);
      expect(result.names).toContain("Raphael de Boer");
      expect(result.names).toContain("Toni Wiemeyer");
      expect(result.names).toContain("Sparsh Tyagi");
      expect(result.names).toContain("Maria Luisa Romero Toro");
      expect(result.names).toContain("Vignesh Chandrasekaran");
      expect(result.names).toContain("Dario Menzen");
      expect(result.names).toContain("Jan-Marco Müller");
    });

    it("strips EN status suffix 'TyagiStatus is reachable'", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      expect(result.names).toContain("Sparsh Tyagi");
      expect(result.names).not.toContain("Sparsh TyagiStatus is reachable");
    });

    it("strips EN comma-status suffix '#HIRINGStatus is reachable'", () => {
      const result = parseLinkedInMessages(EN_SAMPLE);
      expect(result.names).toContain("Toni Wiemeyer");
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
      expect(result.names).toContain("Diane Ebinger");
      expect(result.names).toContain("Shuhan Xiao");
      expect(result.names).toContain("Nikita Makarov");
      expect(result.names).toContain("Dr. Wing Ki (Catherine) Wong");
      expect(result.names).toContain("Michal Swiat");
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
