# Security Policy

## Reporting a vulnerability

Please **don't** open a public GitHub issue for a security vulnerability.
Instead, email <codjiaulrich61@gmail.com> with a description and repro steps.
This is a solo-maintained side project, so response times are best-effort,
but security reports get priority over everything else.

## What's in scope

This dashboard runs entirely on your own machine and launches real Claude
Code sessions against your own `ai-job-search` checkout. Things worth
reporting:

- Any way for the server to read, write, or delete a file outside the
  directories documented in the README's
  ["What it reads and writes"](README.md#what-it-reads-and-writes) section
  (e.g. a path-traversal bug in the documents/uploads/reports endpoints).
- Any way for the **Runs** launcher to execute a tool call without going
  through the Agent SDK's own approve/deny classification.
- Any way for one browser session to see or affect another's data (this app
  has no concept of separate users, but it also shouldn't leak data between
  unrelated requests).
- Information disclosure - stack traces, absolute file paths, or file
  contents appearing in an API response where they shouldn't.

## What's explicitly out of scope

- The dashboard having **no authentication** is by design - it's meant for a
  single local user, not multi-tenant or public-internet use. The README's
  ["Remote access"](README.md#remote-access-eg-from-your-phone) section
  already says not to expose it beyond a private Tailscale network. Reports
  about "there's no login" won't be treated as vulnerabilities on their own.
- Vulnerabilities in the `ai-job-search` framework itself (the slash commands,
  `.claude/skills/`, etc.) belong on
  [its own repo](https://github.com/MadsLorentzen/ai-job-search), not here.
