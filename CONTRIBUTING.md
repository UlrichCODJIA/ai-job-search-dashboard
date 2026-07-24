# Contributing

Thanks for taking a look at this. It's a small side project maintained solo
alongside a job search, so responses may not be instant, but issues and PRs
are genuinely welcome.

## Local setup

You need [Bun](https://bun.sh) and a checkout of
[`ai-job-search`](https://github.com/MadsLorentzen/ai-job-search) (the
framework this dashboard reads from) to point `AI_JOB_SEARCH_ROOT` at. If you
just want to run the test suite, any directory containing an (empty) `.claude/`
folder and a `CLAUDE.md` file is enough - the tests don't read real data from it.

```bash
bun install
export AI_JOB_SEARCH_ROOT=/path/to/ai-job-search
bun run dev
```

Before opening a PR:

```bash
bun run typecheck
bun run test
```

Both also run in CI on every PR.

## Scope

This repo is a reader/launcher for `ai-job-search`'s own commands and data
files - it doesn't reimplement any of the framework's logic. If a change would
mean duplicating what a slash command already does (evaluating fit, drafting
a CV, etc.), it likely belongs in the
[ai-job-search](https://github.com/MadsLorentzen/ai-job-search) repo instead,
and this dashboard should just launch/display it.

## Code style

- No new abstractions or config flags for hypothetical future needs - match
  the existing pattern of small, targeted code over general-purpose layers
  (see `server/src/lib/markdown.ts` or `csv.ts` for the kind of thing this
  codebase prefers over pulling in a library).
- Add a test alongside any behavior change in `server/src/lib/`.
- Comments explain *why*, not *what* - skip comments that just restate the
  code.

## Reporting bugs vs. requesting features

Use the issue templates - they'll prompt for the environment info that's
usually needed to reproduce something (OS, whether you're on `dev` or `start`,
etc.).

## Security issues

Please don't open a public issue for a security vulnerability - see
[SECURITY.md](SECURITY.md) instead.
