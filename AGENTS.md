# AGENTS.md

## Scope
Apply these instructions to the whole repository root.

## Shared frontend guidance
- Consult the Foundry skill for frontend architecture, implementation, acceptance or agent-documentation decisions. Respect this repository's actual constraints and retrieve only relevant guidance; the corpus is at `/Users/fabiencampana/Documents/foundry`.
- This is a standalone Chrome extension. The candidate's runtime files and upload checksum are pinned for 0.2.0; refresh acceptance and validation deliberately for any future runtime change.
- Mac parity uses the exact revision in `scripts/mac-core-revision.txt`; never use an uncommitted Mac tree as the reference.
- Keep local/synthetic, automated and loaded-extension acceptance separate. Do not publish or submit a store listing without the owner's explicit instruction.

## Collaboration Contract
- Use short-lived branches from `main`.
- Keep commits in Conventional Commit format.
- Keep PR titles semantic (Conventional Commit style).
- Keep PRs focused and small.
- Run the quality command before requesting merge:
  - `make check`

## Safety Rules
- Do not rewrite history on shared branches unless explicitly requested.
- Do not use destructive git commands (`reset --hard`, `clean -fd`) without explicit approval.
- Do not commit secrets or credentials.

## Reporting
- State changed files and why.
- State validation commands run and results.
- State remaining risk or follow-up.
