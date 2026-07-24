import { describe, expect, test } from "bun:test";
import { parseUpskillReport } from "../src/lib/upskill.js";

const SAMPLE = `# Upskill Report — 2026-04-20

**Mode:** Aggregate

## Gap Heatmap

| Priority | Skill / Area | Type | Gap Source |
|---|---|---|---|
| Critical | Kubernetes | Hard | 4/5 jobs, score 3.2 |
| Low | GraphQL | [tooling] | 1/5 jobs |

## Learning Plan

### Cloud & Infrastructure

**Kubernetes** \`[Hard]\` — ~12h
- [Kubernetes docs](https://kubernetes.io/docs/) — official, hands-on
Study direction: focus on deployments and services first.

## Suggested Study Order

| # | Topic | Type | Est. Time | Note |
|---|---|---|---|---|
| 1 | Kubernetes | Hard | 12h | Start here |

**Total estimated time: ~12h**
`;

describe("parseUpskillReport", () => {
  test("extracts date, mode, heatmap, and study order", () => {
    const report = parseUpskillReport("report-2026-04-20.md", SAMPLE);
    expect(report.date).toBe("2026-04-20");
    expect(report.mode).toBe("Aggregate");
    expect(report.gapHeatmap).toEqual([
      { priority: "Critical", skill: "Kubernetes", type: "Hard", gapSource: "4/5 jobs, score 3.2" },
      { priority: "Low", skill: "GraphQL", type: "[tooling]", gapSource: "1/5 jobs" },
    ]);
    expect(report.suggestedStudyOrder).toEqual([
      { order: "1", topic: "Kubernetes", type: "Hard", estTime: "12h", note: "Start here" },
    ]);
    expect(report.totalEstimatedTime).toBe("~12h");
    expect(report.learningPlanRaw).toContain("Kubernetes");
  });

  test("parses correctly with CRLF line endings", () => {
    const crlf = SAMPLE.replace(/\n/g, "\r\n");
    const report = parseUpskillReport("report-2026-04-20.md", crlf);
    expect(report.date).toBe("2026-04-20");
    expect(report.mode).toBe("Aggregate");
    expect(report.gapHeatmap).toHaveLength(2);
    expect(report.suggestedStudyOrder).toHaveLength(1);
    expect(report.totalEstimatedTime).toBe("~12h");
  });
});
