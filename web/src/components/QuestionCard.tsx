import { useState } from "react";
import type { AskUserQuestionItem } from "../api/runTypes";
import type { PendingQuestion } from "../hooks/useRunSocket";
import { inputClass, outlineButtonClass, primaryButtonClass } from "../lib/ui";

const OTHER_VALUE = "__other__";

function optionMarker(multiSelect: boolean | undefined, selected: boolean): string {
  if (multiSelect) return selected ? "☑" : "☐";
  return selected ? "●" : "○";
}

function QuestionBlock({
  item,
  selected,
  otherText,
  onToggle,
  onOtherText,
}: {
  item: AskUserQuestionItem;
  selected: string[];
  otherText: string;
  onToggle: (label: string) => void;
  onOtherText: (text: string) => void;
}) {
  const isOtherSelected = selected.includes(OTHER_VALUE);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-signal">
        {item.header}
      </p>
      <p className="text-sm text-ink">{item.question}</p>
      <div className="flex flex-col gap-1.5">
        {item.options.map((opt) => {
          const isSelected = selected.includes(opt.label);
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onToggle(opt.label)}
              className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? "border-signal/40 bg-signal/[0.08]"
                  : "border-border/15 hover:border-signal/25"
              }`}
            >
              <span className="text-sm font-medium text-ink">
                {optionMarker(item.multiSelect, isSelected)} {opt.label}
              </span>
              {opt.description && (
                <span className="pl-4 text-xs text-muted">{opt.description}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onToggle(OTHER_VALUE)}
          className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-colors ${
            isOtherSelected
              ? "border-signal/40 bg-signal/[0.08] text-ink"
              : "border-border/15 text-muted hover:border-signal/25"
          }`}
        >
          {optionMarker(item.multiSelect, isOtherSelected)} Other...
        </button>
        {isOtherSelected && (
          <input
            autoFocus
            value={otherText}
            onChange={(e) => onOtherText(e.target.value)}
            placeholder="Type your own answer..."
            className={inputClass}
          />
        )}
      </div>
    </div>
  );
}

export function QuestionCard({
  question,
  onAnswer,
  onSkip,
}: {
  question: PendingQuestion;
  onAnswer: (answers: Record<string, string | string[]>) => void;
  onSkip: () => void;
}) {
  const items = question.questions;
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [otherText, setOtherText] = useState<Record<number, string>>({});

  function toggle(index: number, item: AskUserQuestionItem, label: string) {
    setSelections((prev) => {
      const current = prev[index] ?? [];
      if (item.multiSelect) {
        const next = current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label];
        return { ...prev, [index]: next };
      }
      return { ...prev, [index]: current.includes(label) ? [] : [label] };
    });
  }

  const allAnswered = items.every((_, i) => {
    const sel = selections[i] ?? [];
    if (sel.length === 0) return false;
    if (sel.includes(OTHER_VALUE)) return (otherText[i] ?? "").trim().length > 0;
    return true;
  });

  function handleSubmit() {
    const answers: Record<string, string | string[]> = {};
    items.forEach((item, i) => {
      const sel = selections[i] ?? [];
      const labels = sel.map((l) =>
        l === OTHER_VALUE ? (otherText[i] ?? "").trim() : l,
      );
      answers[item.question] = item.multiSelect ? labels : (labels[0] ?? "");
    });
    onAnswer(answers);
  }

  return (
    <div className="rounded-2xl border border-signal/30 bg-signal/[0.06] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-signal">
          <span aria-hidden>?</span>
          {items.length > 1 ? "Claude has questions" : "Claude has a question"}
        </p>
        <span className="shrink-0 rounded-full bg-signal/15 px-2 py-0.5 text-[10px] font-medium text-signal">
          Needs your answer
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-3">
        {items.map((item, i) => (
          <QuestionBlock
            key={item.question}
            item={item}
            selected={selections[i] ?? []}
            otherText={otherText[i] ?? ""}
            onToggle={(label) => toggle(i, item, label)}
            onOtherText={(text) =>
              setOtherText((prev) => ({ ...prev, [i]: text }))
            }
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={primaryButtonClass}
        >
          Submit answer{items.length > 1 ? "s" : ""}
        </button>
        <button onClick={onSkip} className={outlineButtonClass}>
          Skip
        </button>
      </div>
    </div>
  );
}
