import { callAI } from "../main.jsx";

const extractJsonPayload = (raw) => {
    try {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
            return JSON.parse(raw.slice(start, end + 1));
        }
    } catch {
        // Fallback to empty
    }
    return null;
};

export class Agent {
    constructor(name, systemPrompt) {
        this.name = name;
        this.systemPrompt = systemPrompt;
    }

    buildPrompt(context) {
        return `${this.systemPrompt}\n\nCRITICAL QUALITY RULES:\n1. Every event description must be at least 2 sentences and contain concrete details (names, cities, numbers, dates).\n2. The events should be connected by a logical cause-and-effect chain.\n3. Write description and title in the requested language.\n\nLanguage: ${context.language || "English"}\nCurrent State:\n${context.worldSummary || ""}\n\nReturn ONLY a JSON object representing your proposed events:\n{"events": [{"date":"YYYY-MM-DD", "title":"", "description":"", "kind":"world", "importance":"minor", "impacts":{"regionTransfers":[], "polityChanges":[]}}]}`;
    }
}

export class MilitaryAgent extends Agent {
    constructor() {
        super("MilitaryAgent", "You are the Military Commander. Focus on troop deployments, defense readiness, border security, and regional tensions. Propose 1-2 strictly military or conflict-related events.");
    }
}

export class EconomyAgent extends Agent {
    constructor() {
        super("EconomyAgent", "You are the Minister of Economy. Focus on industrial zones, supply chains, trade routes, and economic pacts. Propose 1-2 strictly economic or infrastructure-related events.");
    }
}

export class DiplomacyAgent extends Agent {
    constructor() {
        super("DiplomacyAgent", "You are the Foreign Minister. Focus on alliances, treaties, diplomatic channels, and international relations. Propose 1-2 strictly diplomatic events.");
    }
}

export class DirectorAgent extends Agent {
    constructor() {
        super("DirectorAgent", "You are the Grand Director. Synthesize the reports from Military, Economy, and Diplomacy into a cohesive set of final events.");
    }

    buildPrompt(context, reports) {
        return `${this.systemPrompt}\n\nCRITICAL CONSOLIDATION & QUALITY RULES:\n1. Synthesize the domain agent reports.\n2. Every event description must be at least 2 sentences and contain concrete details (names, cities, numbers, dates).\n3. Ensure the events are connected by a logical cause-and-effect chain.\n4. Span at least 3 categories (military, economic, diplomatic, internal politics, technological, natural disaster).\n5. When appropriate, draw historical parallels to real past events in description (Historical Comparison).\n6. Ensure continuity and avoid contradictions.\n7. Write exclusively in the requested language.\n\nLanguage: ${context.language || "English"}\n\nReports from Agents:\nMilitary: ${JSON.stringify(reports.military)}\nEconomy: ${JSON.stringify(reports.economy)}\nDiplomacy: ${JSON.stringify(reports.diplomacy)}\n\nState:\n${context.worldSummary || ""}\n\nReturn JSON only in this format:\n{"summary":"Overall narrative summary of the turn","stopDate":"YYYY-MM-DD","clearActions":true,"events":[{"date":"YYYY-MM-DD","title":"","description":"","importance":"minor","kind":"world","playerRelated":false,"notable":false,"impacts":{"regionTransfers":[],"polityChanges":[],"createdChats":[]}}],"catalyst":null}`;
    }
}

export class AgentOrchestrator {
    constructor() {
        this.agents = {
            military: new MilitaryAgent(),
            economy: new EconomyAgent(),
            diplomacy: new DiplomacyAgent()
        };
        this.director = new DirectorAgent();
    }

    async orchestrate(variables) {
        const reports = {};
        
        // Execute domain agents sequentially to avoid overloading local inference
        for (const [key, agent] of Object.entries(this.agents)) {
            try {
                const prompt = agent.buildPrompt(variables);
                const raw = await callAI(prompt, [{ role: "user", parts: [{ text: "Provide your report in JSON format." }] }]);
                const parsed = extractJsonPayload(raw);
                reports[key] = parsed?.events || [];
            } catch (err) {
                console.warn(`Agent ${agent.name} failed:`, err);
                reports[key] = [];
            }
        }
        
        // Final consolidation by Director
        try {
            const directorPrompt = this.director.buildPrompt(variables, reports);
            const raw = await callAI(directorPrompt, [{ role: "user", parts: [{ text: "Consolidate into the final JSON output." }] }]);
            const finalPayload = extractJsonPayload(raw);
            if (finalPayload && finalPayload.events) {
                return finalPayload;
            }
        } catch (err) {
            console.warn("DirectorAgent failed:", err);
        }

        return null; // Fallback required
    }
}
