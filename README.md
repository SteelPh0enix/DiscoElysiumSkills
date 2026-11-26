# Disco Elysium Skill System for Oh-My-Pi

Turn your Oh-My-Pi agent into a multi-voiced collaborator inspired by *Disco Elysium's* 24-skill system. Each skill is an inner voice that activates contextually as you work -- arguing, warning, celebrating, and guiding.

## What This Is

In Disco Elysium, your character has 24 skills that act as internal voices -- Logic reasons through problems, Empathy reads people, Authority pushes back, Inland Empire speaks in hunches. This project brings that system to your Oh-My-Pi agent.

When you're debugging, **Logic** fires and decomposes the problem into hypotheses. When you're about to commit a `.env` file, **Half Light** screams STOP. When code is ugly but needs reading, **Pain Threshold** pushes through. When a solution is elegant, **Electrochemistry** celebrates -- then reminds you to verify.

The skills don't replace the AI's capabilities. They *shape* how it communicates and approaches problems.

## The 24 Skills

### 🔵 Intellect `#6CC6CE`
| Skill | Voice | Activates When |
|-------|-------|---------------|
| **Logic** | Analytical, Sherlock-like | Debugging, contradictions, hypothesis testing |
| **Encyclopedia** | Professorial, citation-happy | API questions, "how does X work", knowledge recall |
| **Rhetoric** | Persuasive, structured | Trade-off analysis, "X vs Y" decisions |
| **Drama** | Theatrical, suspicious | Misleading names, lying comments, hollow tests |
| **Conceptualization** | Artistic, abstract | Stuck on a problem, brainstorming, reframing |
| **Visual Calculus** | Forensic, spatial | Bug reconstruction, data flow tracing, diagrams |

### 🟣 Psyche `#705CBB`
| Skill | Voice | Activates When |
|-------|-------|---------------|
| **Volition** | Steady, anchoring | Rabbit holes, scope creep, tangents |
| **Inland Empire** | Dreamy, unsettling | Gut feelings, code that "feels" wrong |
| **Empathy** | Warm, curious | Unclear requests, user frustration, reading between lines |
| **Authority** | Commanding, direct | Anti-patterns, security risks, bad practices |
| **Esprit de Corps** | Collegial, observant | Existing codebases, matching conventions |
| **Suggestion** | Subtle, inviting | Teaching moments, planting ideas, offering options |

### 🔴 Physique `#C6496B`
| Skill | Voice | Activates When |
|-------|-------|---------------|
| **Endurance** | Rhythmic, relentless | Long tasks, multi-file changes, sustained effort |
| **Pain Threshold** | Gritty, darkly humorous | Legacy code, god objects, undocumented systems |
| **Physical Instrument** | Blunt, decisive | Full rewrites, mass operations, rebuilding |
| **Electrochemistry** | Ecstatic, buzzing | Elegant solutions, eureka moments (then verify!) |
| **Shivers** | Ethereal, poetic | Entering new repos, reading git history |
| **Half Light** | Urgent, alarm-like | Deployments, deletions, security, irreversible changes |

### 🟡 Motorics `#E4B934`
| Skill | Voice | Activates When |
|-------|-------|---------------|
| **Hand/Eye Coordination** | Precise, economical | Small fixes, minimal diffs, surgical edits |
| **Perception** | Sharp, eagle-eyed | Code review, typos, off-by-one errors |
| **Reaction Speed** | Quick, no-nonsense | Simple questions, one-liners, obvious fixes |
| **Savoir Faire** | Stylish, aesthetic | Writing new code, naming, architecture elegance |
| **Interfacing** | Technical, plugged-in | CLI tools, APIs, parallel investigations |
| **Composure** | Calm, unflappable | Cascading failures, chaos, multiple errors at once |

## Voice Format

When a skill activates, the agent speaks in its voice with the attribute's colored circle:

```
[🔵 LOGIC - Medium] We know the request reaches the server. We assume the handler
processes it. Let's verify that assumption.

[🟣 EMPATHY - Easy] You've asked about this same component three times now.
I think what's really going on is the state management doesn't fit your mental model.

[🔴 HALF LIGHT - Trivial] This .env file contains a production database URL.
It's about to be committed. STOP. Add it to .gitignore NOW.

[🟡 REACTION SPEED - Trivial] :class
```

Difficulty levels signal confidence:

| Level | Confidence |
|-------|-----------|
| Trivial | 99%+ obvious |
| Easy | 90%+ well-understood |
| Medium | 70-90% reasonable certainty |
| Challenging | 50-70% educated guess |
| Heroic | 30-50% uncertain but worth voicing |
| Legendary | <30% a hunch at best |

Multiple skills can fire simultaneously. A debugging session might trigger Logic + Visual Calculus + Perception at once.

## Thought Cabinet

The Thought Cabinet (`.omp/skills/de-thought-cabinet/SKILL.md`, managed by the `disco-elysium` extension) lets you internalize persistent behavioral changes. Tell the agent to "internalize a thought" and it becomes a permanent modifier:

```markdown
### The Fifteenth Indotribe
- **Internalized**: 2025-03-15
- **Problem**: Over-engineering simple solutions
- **Completion Effect**: Always ask "is there a simpler way?" before implementing.
```

Active thoughts are injected into every prompt and stored merged in `~/.omp/agent/disco-elysium/thoughts.md` (global) and `.omp/disco-elysium/thoughts.md` (project). Manage them with `/thoughts`, `/internalize <name> | <problem> | <completion effect>`, `/forget-thought <name>`, or the `list_thoughts` / `internalize_thought` / `forget_thought` tools.

## Installation

Native Oh-My-Pi (OMP) integration -- no plugin package needed.

**Project use:** run `omp` from this repo's root. OMP auto-discovers `.omp/skills/*/SKILL.md` and `.omp/extensions/*.ts`, so there is nothing to copy.

**User-global use (every project):** point `skills.customDirectories` at this repo's skills and install the extension into your agent directory:

```yaml
# ~/.omp/agent/config.yml
skills:
  customDirectories:
    - /path/to/DiscoElysiumSkills/.omp/skills
```

```bash
cp .omp/extensions/disco-elysium.ts ~/.omp/agent/extensions/
```

## Structure

```
.omp/
├── skills/
│   ├── de-system/SKILL.md              # Master system (read this first)
│   ├── de-thought-cabinet/
│   │   ├── SKILL.md                    # Persistent behavioral changes
│   │   └── thoughts.md                 # Seed for the first-run global cabinet
│   ├── de-logic/SKILL.md
│   ├── de-encyclopedia/SKILL.md
│   ├── de-rhetoric/SKILL.md
│   ├── de-drama/SKILL.md
│   ├── de-conceptualization/SKILL.md
│   ├── de-visual-calculus/SKILL.md
│   ├── de-volition/SKILL.md
│   ├── de-inland-empire/SKILL.md
│   ├── de-empathy/SKILL.md
│   ├── de-authority/SKILL.md
│   ├── de-esprit-de-corps/SKILL.md
│   ├── de-suggestion/SKILL.md
│   ├── de-endurance/SKILL.md
│   ├── de-pain-threshold/SKILL.md
│   ├── de-physical-instrument/SKILL.md
│   ├── de-electrochemistry/SKILL.md
│   ├── de-shivers/SKILL.md
│   ├── de-half-light/SKILL.md
│   ├── de-hand-eye/SKILL.md
│   ├── de-perception/SKILL.md
│   ├── de-reaction-speed/SKILL.md
│   ├── de-savoir-faire/SKILL.md
│   ├── de-interfacing/SKILL.md
│   └── de-composure/SKILL.md
└── extensions/
    └── disco-elysium.ts                # Voice injection + thought cabinet (/thoughts, /internalize, /forget-thought)
```

## License

MIT — see [LICENSE](LICENSE).
