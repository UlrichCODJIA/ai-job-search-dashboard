import { Drawer } from "../Drawer";
import { ALL_NAV_ITEMS } from "./navItems";

interface PageGuide {
  description: string;
  commands?: string[];
}

const PAGE_GUIDES: Record<string, PageGuide> = {
  "/": {
    description:
      "Stage counts across the pipeline, a 30-day activity trend, a sector breakdown, and what needs your attention -- upcoming interviews and stale drafts/applications worth a follow-up.",
  },
  "/discovery": {
    description:
      "Every posting /scrape found, ranked by /rank. Sort and filter, and see the reasoning behind each fit score -- highlights, strengths, gaps, deadline, location -- before deciding to apply.",
    commands: ["/scrape", "/rank", "/apply"],
  },
  "/pipeline": {
    description:
      "Your tracked applications as a six-stage board, Drafted through Rejected/Closed. /apply creates a row the moment it drafts something; /interview and /outcome carry it the rest of the way.",
    commands: ["/apply", "/interview", "/outcome"],
  },
  "/upskill": {
    description: "A read view over the framework's own generated skill-gap reports and study plan.",
    commands: ["/upskill"],
  },
  "/salary": {
    description:
      "Browse the framework's benchmark data with its Python-backed lookup, and add, edit, or delete benchmarked companies and index metadata directly, right here.",
  },
  "/profile": {
    description:
      "Edit your candidate profile inline, section by section, no text editor. Upload source documents, or generate a tailored CV or cover-letter template from an example.",
    commands: ["/setup", "/expand", "/add-template"],
  },
  "/settings": {
    description:
      "Edit what /scrape searches for, manage auto-approved commands, installed portals (with per-portal health), notifications, and reset candidate data.",
    commands: ["/scrape", "/add-portal", "/reset"],
  },
  "/runs": {
    description:
      "Launch any of the framework's slash commands and watch them stream live, approve or deny tool calls as they come up, and reply to a command that pauses mid-run to ask a question.",
  },
};

export function GuideDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Guide">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted">
          What each page does, and which of the framework's slash commands feed it.
        </p>
        <ul className="flex flex-col gap-2">
          {ALL_NAV_ITEMS.map(({ to, label, icon: NavIcon }) => {
            const guide = PAGE_GUIDES[to];
            return (
              <li key={to} className="rounded-2xl border border-border/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <NavIcon className="h-4 w-4 shrink-0 text-signal" />
                  <p className="text-sm font-semibold text-ink">{label}</p>
                </div>
                {guide && (
                  <>
                    <p className="mt-1 text-xs text-muted">{guide.description}</p>
                    {guide.commands && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {guide.commands.map((command) => (
                          <code
                            key={command}
                            className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink/80"
                          >
                            {command}
                          </code>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Drawer>
  );
}
