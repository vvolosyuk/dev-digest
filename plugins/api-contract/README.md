# api-contract plugin

Review skills for the **API Contract Reviewer** agent. Each skill owns one
question, so the agent doesn't get the same rules twice:

| Skill | `type` | Answers |
|---|---|---|
| [`breaking-change`](skills/breaking-change/SKILL.md) | rubric | Does this removal / rename / narrowing break consumers? |
| [`response-schema`](skills/response-schema/SKILL.md) | rubric | Did the shape of a response change in a way clients can't survive? |
| [`semver-discipline`](skills/semver-discipline/SKILL.md) | convention | Which version bump does this require, and does the declared one match? |
| [`deprecation-policy`](skills/deprecation-policy/SKILL.md) | convention | Is the contract being retired via deprecate → keep working → remove? |

They complement the samples in [`docs/skills-samples/`](../../docs/skills-samples/README.md).
`breaking-change-detector` and `route-signature-compat` are broader checklists.
These skills are narrower and link to each other.

## Use in Claude Code

```text
/plugin marketplace add ./           # from the repo root (.claude-plugin/marketplace.json)
/plugin install api-contract@devdigest
```

## Use in DevDigest

Each `SKILL.md` has the frontmatter DevDigest's importer reads (`name`,
`description`, `type`). Claude Code ignores `type`.

- **Import `.md`**: Skills → Import → pick `skills/<name>/SKILL.md`.
- **Import `.zip`**: zip the skill folder (`<name>/SKILL.md` one level deep) and import it.

Then link the skills to **API Contract Reviewer** in this order: `breaking-change`,
`response-schema`, `deprecation-policy`, `semver-discipline`. The bump decision
comes last because it builds on the other three verdicts.

## Versioning

Semver, recorded in [`CHANGELOG.md`](CHANGELOG.md). A release updates every place
a version lives:

| Where | Field | Bump when |
|---|---|---|
| `.claude-plugin/plugin.json` | `version` | any release of the plugin (Claude Code reads this one first) |
| `../../.claude-plugin/marketplace.json` → `plugins[api-contract]` | `version` | same value as `plugin.json` |
| `skills/<name>/SKILL.md` frontmatter | `metadata.version` | that skill's text changed |
| `../../.claude-plugin/marketplace.json` → `metadata` | `version` | the marketplace catalog changed (plugin added/removed/renamed) |

The plugin version is the highest bump of any skill in the release. Rewording a
skill or adding examples is PATCH. A new rule, red flag or skill is MINOR.
Removing or renaming a skill, or changing its `type` or a severity in a way that
changes verdicts, is MAJOR.

DevDigest doesn't read `metadata.version`; it versions imported skills itself
(v1, v2, …).
