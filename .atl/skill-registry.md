# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When creating a pull request, opening a PR, or preparing changes for review. | branch-pr | `/Users/guviedo/.config/opencode/skills/branch-pr/SKILL.md` |
| When writing Go tests, using teatest, or adding test coverage. | go-testing | `/Users/guviedo/.config/opencode/skills/go-testing/SKILL.md` |
| When creating a GitHub issue, reporting a bug, or requesting a feature. | issue-creation | `/Users/guviedo/.config/opencode/skills/issue-creation/SKILL.md` |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen". | judgment-day | `/Users/guviedo/.config/opencode/skills/judgment-day/SKILL.md` |
| When working on Next.js pages, components, data fetching, forms, caching, or Supabase integration. | nextjs | `/Users/guviedo/.cursor/skills/nextjs/SKILL.md` |
| When user asks to create a new skill, add agent instructions, or document patterns for AI. | skill-creator | `/Users/guviedo/.config/opencode/skills/skill-creator/SKILL.md` |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### branch-pr
- Every PR MUST link an approved issue with `status:approved`; blank or unlinked PRs are blocked.
- Branch names MUST match `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)/[a-z0-9._-]+$`.
- PRs MUST have exactly one `type:*` label matching the change type.
- Use the repo PR template with linked issue, summary, changes table, test plan, and checklist.
- Commit messages MUST be conventional commits; never add `Co-Authored-By` trailers.
- Run required checks such as shellcheck for modified shell scripts before PR.

### go-testing
- Prefer table-driven tests with `t.Run` for multiple cases and both success/error paths.
- Test Bubbletea state transitions directly through `Model.Update()` when validating model behavior.
- Use `teatest.NewTestModel` for full interactive TUI flows.
- Use golden files for stable visual output snapshots.
- Mock side effects through interfaces; use `t.TempDir()` for file operations.
- Skip real command/integration tests under `testing.Short()` when appropriate.

### issue-creation
- GitHub issues MUST use a template; blank issues are disabled.
- Search existing issues first to avoid duplicates.
- New issues receive `status:needs-review`; a maintainer MUST add `status:approved` before PR work.
- Use bug report template for defects and feature request template for enhancements.
- Fill every required field and pre-flight checkbox.
- Questions belong in Discussions, not issues.

### judgment-day
- Resolve relevant skills from this registry before launching judges; inject matching compact rules into all review/fix prompts.
- Launch exactly two blind independent judge sub-agents in parallel for the same target.
- Synthesize findings as confirmed, suspect, or contradiction; classify warnings as real vs theoretical.
- Round 1 fixes require user confirmation before applying confirmed issues.
- Re-judge after fixes; after two fix iterations with remaining issues, ask the user whether to continue.
- Theoretical warnings are informational and do not block approval.

### nextjs
- App Router pages should remain Server Components by default; put `"use client"` only at the lowest interactive boundary.
- Never use the browser Supabase client in Server Components; never use the server client in Client Components.
- Use React Query hydration for rich SSR data and centralized `queryKeys` in `lib/query-client.ts`.
- Mutations validate with Zod, then invalidate React Query cache and revalidate Next.js cache tags.
- Auth route protection lives in `proxy.ts`, not `middleware.ts`.
- Components belong in `components/ui`, `components/shared`, or `components/{feature}` based on scope.
- Validation schemas live in `lib/validations/{feature}.schema.ts` and export inferred `z.infer<>` types.

### skill-creator
- Create a skill only for reusable AI guidance, non-trivial workflows, or project-specific conventions.
- Skill names use lowercase hyphen conventions: generic technology, project-component, test-component, or action-target.
- `SKILL.md` frontmatter must include `name`, `description` with Trigger text, `license: Apache-2.0`, author, and version.
- Put reusable templates/schemas in `assets/`; point references to local files in `references/`, not web URLs.
- Keep examples minimal; avoid duplicating existing docs or adding troubleshooting fluff.
- Register new skills in `AGENTS.md` after creation.

## Project Conventions

| File | Path | Notes |
|------|------|-------|

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
