import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const agentDir = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".omp", "agent");
const GLOBAL_FILE = path.join(agentDir, "disco-elysium", "thoughts.md");
// Project layout keeps skills/ next to extensions/; a user-global install links the pack's skills/ into the agent dir.
const SEED_CANDIDATES = [
	path.join(import.meta.dir, "..", "skills", "de-thought-cabinet", "thoughts.md"),
	path.join(agentDir, "skills", "de-thought-cabinet", "thoughts.md"),
];

async function findSeedFile(): Promise<string | null> {
	for (const candidate of SEED_CANDIDATES) {
		try {
			await fs.access(candidate);
			return candidate;
		} catch {
			// try the next candidate
		}
	}
	return null;
}
const FILE_HEADER = `# Thought Cabinet - Internalized Thoughts

*These thoughts permanently modify behavior. Each Completion Effect is active.*

---

`;

interface Thought {
	name: string;
	effect: string;
	scope: "global" | "project";
	raw: string;
}

function projectFile(ctx: { cwd: string }): string {
	return path.join(ctx.cwd, ".omp", "disco-elysium", "thoughts.md");
}

function splitEntries(content: string): { prefix: string; entries: string[] } {
	const parts = content.split(/^### /m);
	return { prefix: parts[0], entries: parts.slice(1).map(p => `### ${p}`) };
}

function entryName(entry: string): string {
	return entry.slice(4).split("\n", 1)[0].trim();
}

async function readEntries(file: string): Promise<string[]> {
	try {
		return splitEntries(await fs.readFile(file, "utf8")).entries;
	} catch {
		return [];
	}
}

function toThought(entry: string, scope: Thought["scope"]): Thought {
	const effect = /\*\*Completion Effect\*\*:\s*(.*)/.exec(entry)?.[1]?.trim() ?? "";
	return { name: entryName(entry), effect, scope, raw: entry };
}

async function loadMerged(ctx: { cwd: string }): Promise<Thought[]> {
	const merged = new Map<string, Thought>();
	for (const entry of await readEntries(GLOBAL_FILE)) merged.set(entryName(entry).toLowerCase(), toThought(entry, "global"));
	for (const entry of await readEntries(projectFile(ctx))) merged.set(entryName(entry).toLowerCase(), toThought(entry, "project"));
	return [...merged.values()];
}

function formatThoughts(thoughts: Thought[]): string {
	if (thoughts.length === 0) return "No internalized thoughts yet.";
	return thoughts.map(t => `- **${t.name}** (${t.scope}): ${t.effect || t.raw.trim().split("\n", 1)[0]}`).join("\n");
}

function buildInjection(thoughts: Thought[]): string {
	const lines = thoughts.map(t => `- **${t.name}** (${t.scope}): ${t.effect || t.raw.trim().split("\n", 1)[0]}`);
	return `# Disco Elysium Skill Voices
24 inner-voice skills are available (master sheet: skill://de-system; per-skill: skill://de-<name>, e.g. skill://de-logic). When a skill's trigger applies, voice it once as \`[<emoji> <NAME> - <Difficulty>] <in-character line>\` — emoji per attribute: 🔵 INTELLECT, 🟣 PSYCHE, 🔴 PHYSIQUE, 🟡 MOTORICS — then continue the actual work in your normal voice. Difficulty signals confidence: Trivial 99%+, Easy 90%+, Medium 70-90%, Challenging 50-70%, Heroic 30-50%, Legendary <30%. Multiple skills may fire at once. Voices shape how you communicate; they never replace doing the work.
## Active Internalized Thoughts
${lines.length > 0 ? lines.join("\n") : "None internalized yet."}`;
}

async function upsertThought(file: string, name: string, problem: string, effect: string): Promise<void> {
	let prefix = FILE_HEADER;
	let entries: string[] = [];
	try {
		const split = splitEntries(await fs.readFile(file, "utf8"));
		prefix = split.prefix;
		entries = split.entries;
	} catch {
		// missing/unreadable file: start fresh with the standard header
	}
	const key = name.toLowerCase();
	entries = entries.filter(e => entryName(e).toLowerCase() !== key);
	const today = new Date().toISOString().slice(0, 10);
	if (entries.length > 0 && !entries[entries.length - 1].endsWith("\n\n")) entries.push("\n");
	entries.push(`### ${name}\n- **Internalized**: ${today}\n- **Problem**: ${problem}\n- **Completion Effect**: ${effect}\n`);
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, prefix + entries.join(""), "utf8");
}

async function removeThought(file: string, name: string): Promise<string | null> {
	let content: string;
	try {
		content = await fs.readFile(file, "utf8");
	} catch {
		return null;
	}
	const { prefix, entries } = splitEntries(content);
	const key = name.toLowerCase();
	const removed = entries.filter(e => entryName(e).toLowerCase() === key).map(entryName);
	if (removed.length === 0) return null;
	await fs.writeFile(file, prefix + entries.filter(e => entryName(e).toLowerCase() !== key).join(""), "utf8");
	return removed.join(", ");
}

async function forgetOneLayer(ctx: { cwd: string }, name: string): Promise<{ text: string; removed: boolean }> {
	const key = name.toLowerCase();
	const project = projectFile(ctx);
	const r = await removeThought(project, name);
	if (r) {
		const shadow = (await readEntries(GLOBAL_FILE)).some(e => entryName(e).toLowerCase() === key);
		const note = shadow ? ` — a global copy of "${name}" is now exposed; call again to forget it too.` : ".";
		return { text: `Forgot: ${r} (${project})${note}`, removed: true };
	}
	const g = await removeThought(GLOBAL_FILE, name);
	if (!g) return { text: `No thought named "${name}" found.`, removed: false };
	return { text: `Forgot: ${g} (${GLOBAL_FILE})`, removed: true };
}

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

export default function discoElysium(pi: ExtensionAPI) {
	const z = pi.zod;

	pi.setLabel("Disco Elysium Skills");

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.agent.kind !== "main") return;
		try {
			await fs.access(GLOBAL_FILE);
			return;
		} catch {
			// not seeded yet
		}
		try {
			const seed = await findSeedFile();
			if (!seed) {
				pi.logger.warn("[disco-elysium] no seed thoughts.md found, skipping global cabinet seeding");
				return;
			}
			await fs.mkdir(path.dirname(GLOBAL_FILE), { recursive: true });
			await fs.copyFile(seed, GLOBAL_FILE);
			// Nix store seeds are read-only and copyFile preserves that mode; the cabinet must stay writable.
			await fs.chmod(GLOBAL_FILE, 0o644);
		} catch (err) {
			pi.logger.error(`[disco-elysium] failed to seed global thought cabinet: ${err}`);
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (event.reason === "revive") return;
		try {
			const thoughts = await loadMerged(ctx);
			return {
				message: {
					customType: "disco-elysium-voices",
					display: false,
					attribution: "agent" as const,
					content: buildInjection(thoughts),
				},
			};
		} catch (err) {
			pi.logger.error(`[disco-elysium] voice injection failed: ${err}`);
		}
	});

	pi.registerTool({
		name: "list_thoughts",
		label: "List Thoughts",
		description: "List all active internalized thoughts, merged from the global and project thought cabinets.",
		parameters: z.object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			try {
				return textResult(formatThoughts(await loadMerged(ctx)));
			} catch (err) {
				return textResult(`Error listing thoughts: ${err}`);
			}
		},
	});

	pi.registerTool({
		name: "internalize_thought",
		label: "Internalize Thought",
		description: "Internalize a persistent behavioral change into the thought cabinet. Writes to the project cabinet by default; pass scope \"global\" for the global cabinet.",
		parameters: z.object({
			name: z.string().describe("Thought name"),
			problem: z.string().describe("What situation or pattern prompted this thought"),
			completion_effect: z.string().describe("The permanent behavioral change"),
			scope: z.enum(["project", "global"]).optional().describe("Which cabinet to write to (default: project)"),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			try {
				const file = params.scope === "global" ? GLOBAL_FILE : projectFile(ctx);
				await upsertThought(file, params.name, params.problem, params.completion_effect);
				return textResult(`Thought internalized. Completion effect now active. (${params.scope ?? "project"}: ${file})`);
			} catch (err) {
				return textResult(`Error internalizing thought: ${err}`);
			}
		},
	});

	pi.registerTool({
		name: "forget_thought",
		label: "Forget Thought",
		description: "Remove an internalized thought by name. Without scope, forgets one layer at a time: the project copy first, then the global copy on a second call. Scope \"both\" removes it from both cabinets at once.",
		parameters: z.object({
			name: z.string().describe("Thought name to remove"),
			scope: z.enum(["project", "global", "both"]).optional().describe("Which cabinet to remove from. Omit to forget one layer at a time (project first, then global); \"both\" removes from both at once"),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			try {
				if (!params.scope) return textResult((await forgetOneLayer(ctx, params.name)).text);
				const files = params.scope === "both" ? [GLOBAL_FILE, projectFile(ctx)] : [params.scope === "global" ? GLOBAL_FILE : projectFile(ctx)];
				const removed: string[] = [];
				for (const file of files) {
					const r = await removeThought(file, params.name);
					if (r) removed.push(`${r} (${file})`);
				}
				return textResult(removed.length > 0 ? `Forgot: ${removed.join("; ")}` : `No thought named "${params.name}" found.`);
			} catch (err) {
				return textResult(`Error forgetting thought: ${err}`);
			}
		},
	});

	pi.registerCommand("thoughts", {
		description: "Show active internalized thoughts (merged global + project)",
		handler: async (_args, ctx) => {
			try {
				pi.sendMessage(
					{ customType: "disco-thoughts", content: formatThoughts(await loadMerged(ctx)), display: true },
					{ triggerTurn: false },
				);
			} catch (err) {
				ctx.ui.notify(`Failed to list thoughts: ${err}`, "error");
			}
		},
	});

	pi.registerCommand("internalize", {
		description: "Internalize a thought (project cabinet): /internalize <name> | <problem> | <completion effect>",
		handler: async (args, ctx) => {
			const parts = args.split("|").map(s => s.trim()).filter(s => s.length > 0);
			if (parts.length < 3) {
				ctx.ui.notify("Usage: /internalize <name> | <problem> | <completion effect>", "error");
				return;
			}
			const [name, problem, effect] = parts;
			try {
				await upsertThought(projectFile(ctx), name, problem, effect);
				ctx.ui.notify("Thought internalized. Completion effect now active.", "success");
			} catch (err) {
				ctx.ui.notify(`Failed to internalize thought: ${err}`, "error");
			}
		},
	});

	pi.registerCommand("forget-thought", {
		description: "Forget an internalized thought, one layer at a time (project copy first, then global): /forget-thought <name>",
		handler: async (args, ctx) => {
			const name = args.trim();
			if (!name) {
				ctx.ui.notify("Usage: /forget-thought <name>", "error");
				return;
			}
			try {
				const { text, removed } = await forgetOneLayer(ctx, name);
				ctx.ui.notify(text, removed ? "success" : "warning");
			} catch (err) {
				ctx.ui.notify(`Failed to forget thought: ${err}`, "error");
			}
		},
	});
}
