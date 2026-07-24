import { describe, expect, test } from "bun:test";
import { parseOutcomeMarkdown } from "../src/lib/outcome.js";

const SAMPLE = `# Outcome: Acme Corp — Senior Engineer

**Status:** interview_only

**Date resolved:** 2026-06-01

## Interview stages reached
- [x] Phone screen (2026-04-10)
- [x] Technical interview (2026-04-20)
- [ ] Case interview
- [ ] Final round
- [ ] Offer received

## Notes
2026-04-10: Recruiter said the team liked my systems background.
2026-06-01: Process went quiet after the technical round.
`;

describe("parseOutcomeMarkdown", () => {
  test("parses status, date, stages, and notes", () => {
    const result = parseOutcomeMarkdown(SAMPLE);
    expect(result.status).toBe("interview_only");
    expect(result.dateResolved).toBe("2026-06-01");
    expect(result.stages).toEqual([
      { label: "Phone screen", checked: true, date: "2026-04-10" },
      { label: "Technical interview", checked: true, date: "2026-04-20" },
      { label: "Case interview", checked: false, date: undefined },
      { label: "Final round", checked: false, date: undefined },
      { label: "Offer received", checked: false, date: undefined },
    ]);
    expect(result.notes).toContain("Process went quiet after the technical round.");
  });

  test("defaults to in_progress when Status is missing", () => {
    const result = parseOutcomeMarkdown("# Outcome: X — Y\n\n## Notes\nnothing yet\n");
    expect(result.status).toBe("in_progress");
  });

  test("parses stages correctly with CRLF line endings", () => {
    const crlf = SAMPLE.replace(/\n/g, "\r\n");
    const result = parseOutcomeMarkdown(crlf);
    expect(result.status).toBe("interview_only");
    expect(result.stages[0]).toEqual({ label: "Phone screen", checked: true, date: "2026-04-10" });
    expect(result.stages[2]).toEqual({ label: "Case interview", checked: false, date: undefined });
  });
});
