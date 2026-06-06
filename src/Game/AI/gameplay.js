import dayjs from "dayjs";
import { callAI } from "./main.jsx";
import {
  GAMEPLAY_PROMPT_DEFAULTS,
  normalizePromptPack,
} from "./gameplayPrompts.js";
import {
  JSON_URLS,
  loadCountryNames,
  loadRegionCatalog,
  readJson,
  writeJson,
} from "../../runtime/assets.js";
import {
  applyEventImpactsToWorld,
  buildActionDisplayText,
  normalizeActionEntry,
  normalizeActions,
  normalizeChatEntry,
  normalizeChats,
  normalizeEvents,
  normalizeGameData,
  normalizeWorldState,
  readActionsState,
  readChatsState,
  readEventsState,
  readGameStateBundle,
  readWorldState,
  writeActionsState,
  writeChatsState,
  writeEventsState,
  writeGameData,
  writeWorldState,
} from "../../runtime/gameState.js";
import { SimEngine } from "../../Simulation/SimEngine.js";
import { AgentOrchestrator } from "./Agents/index.js";

const CHAT_HINT_PATTERNS = [
  /\bchat\b/i,
  /\bconference\b/i,
  /\bcontact\b/i,
  /\bdiplomac/i,
  /\bmeet\b/i,
  /\bmessage\b/i,
  /\bnegotiat/i,
  /\boutreach\b/i,
  /\bparley\b/i,
  /\bpeace talk/i,
  /\breach out\b/i,
  /\bspeak with\b/i,
  /\bsummit\b/i,
  /\btalk to\b/i,
  /\btalks? with\b/i,
  /\bпереговор/i,
  /\bвстрет/i,
  /\bдипломат/i,
  /\bсвяз/i,
  /\bчат/i,
  /\bдоговор/i,
];

const DEFAULT_SUGGESTION_TOPICS = [
  {
    title: "Stabilize the domestic front",
    description: "Keep the home front orderly and reduce the chance of internal drift while outside pressure builds.",
  },
  {
    title: "Shape the diplomatic field",
    description: "Use talks, signals, and leverage to narrow hostile options before the next crisis hardens.",
  },
  {
    title: "Prepare military leverage",
    description: "Create visible readiness and practical reserves so rivals must factor your capability into their plans.",
  },
  {
    title: "Secure economic depth",
    description: "Expand the industrial and fiscal base that decides whether later gambles are sustainable.",
  },
];

const cloneValue = (value) => {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const normalizeString = (value) => String(value ?? "").trim();
const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const sentenceCase = (value) => {
  const text = normalizeString(value);
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const maybeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractJsonPayload = (rawText) => {
  const direct = maybeJsonParse(rawText);
  if (direct) return direct;

  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const parsed = maybeJsonParse(fencedMatch[1].trim());
    if (parsed) return parsed;
  }

  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    const parsed = maybeJsonParse(objectMatch[0]);
    if (parsed) return parsed;
  }

  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) {
    const parsed = maybeJsonParse(arrayMatch[0]);
    if (parsed) return parsed;
  }

  return null;
};

const renderTemplate = (template, variables) =>
  String(template ?? "").replace(/\$\{([^}]+)\}/g, (_match, key) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  });

const loadPromptCatalog = async ({ force = false } = {}) =>
  normalizePromptPack(await readJson(JSON_URLS.prompts, { defaultValue: {}, force }));

const buildEventHistoryText = (events, { limit = 10 } = {}) => {
  const normalizedEvents = normalizeEvents(events);
  if (normalizedEvents.length === 0) {
    return "No prior events have been recorded yet.";
  }

  return normalizedEvents
    .slice(-limit)
    .map((event) => {
      const date = normalizeString(event.date) || "undated";
      const description = normalizeString(event.description);
      const impactNotes = [];

      if (event.impacts.regionTransfers.length > 0) {
        impactNotes.push(
          `Territorial shifts: ${event.impacts.regionTransfers
            .map((entry) => `${entry.regionName || entry.regionId} -> ${entry.toCode}`)
            .join(", ")}`,
        );
      }

      if (event.impacts.polityChanges.length > 0) {
        impactNotes.push(
          `Polity changes: ${event.impacts.polityChanges
            .map((entry) => `${entry.code}${entry.name ? ` renamed to ${entry.name}` : ""}${entry.color ? ` color ${entry.color}` : ""}`)
            .join(", ")}`,
        );
      }

      return [
        `- ${date}: ${event.title}`,
        description ? `  ${description}` : "",
        impactNotes.length > 0 ? `  ${impactNotes.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
};

const buildChatSummaryText = (chats, { limit = 4 } = {}) => {
  const normalizedChats = normalizeChats(chats);
  if (normalizedChats.length === 0) {
    return "No diplomatic chats are currently recorded.";
  }

  return normalizedChats
    .slice(0, limit)
    .map((chat) => {
      const participants = chat.countries.map((country) => country.name).join(", ");
      const lastMessage = chat.messages.at(-1);
      return `- ${participants}: ${
        lastMessage ? `${lastMessage.speaker || lastMessage.role}: ${lastMessage.text}` : "no messages yet"
      }`;
    })
    .join("\n");
};

const buildActionHistoryText = (actions, { includeResolved = false } = {}) => {
  const normalizedActions = normalizeActions(actions);
  const filteredActions = includeResolved
    ? normalizedActions
    : normalizedActions.filter((action) => action.status === "planned");

  if (filteredActions.length === 0) {
    return includeResolved
      ? "No actions have been recorded yet."
      : "No planned actions are currently queued.";
  }

  return filteredActions
    .map((action) => {
      const kindLabel = action.kind === "chat" ? "chat" : "action";
      const statusLabel = action.status !== "planned" ? ` [${action.status}]` : "";
      return `- (${kindLabel}) ${action.title}${statusLabel}: ${buildActionDisplayText(action)}`;
    })
    .join("\n");
};

const buildTerritorySummary = async (world) => {
  const normalizedWorld = normalizeWorldState(world);
  const regionOverrides = Object.entries(normalizedWorld.regionOwnershipOverrides);

  if (regionOverrides.length === 0) {
    return "No territorial overrides from the base scenario are currently recorded.";
  }

  const regionCatalog = await loadRegionCatalog();
  const regionLookup = new Map(regionCatalog.map((region) => [region.id, region]));

  return regionOverrides
    .slice(0, 24)
    .map(([regionId, ownerCode]) => {
      const region = regionLookup.get(regionId);
      const regionName = region?.name || regionId;
      const countryName = region?.country ? ` (${region.country})` : "";
      return `- ${regionName}${countryName} -> ${ownerCode}`;
    })
    .join("\n");
};

const buildWorldSummary = async (bundle) => {
  const territorySummary = await buildTerritorySummary(bundle.world);
  const polityOverrides = Object.values(normalizeWorldState(bundle.world).polityOverrides);
  const politySummary =
    polityOverrides.length === 0
      ? "No dynamic polity overrides are currently recorded."
      : polityOverrides
          .slice(0, 16)
          .map((entry) =>
            `- ${entry.code}: ${entry.name || entry.code}${entry.color ? ` (${entry.color})` : ""}${
              entry.aliases.length > 0 ? ` aliases ${entry.aliases.join(", ")}` : ""
            }`,
          )
          .join("\n");

  const activeCatalyst = normalizeWorldState(bundle.world).activeCatalyst;
  const catalystSummary = activeCatalyst
    ? `Active catalyst: ${activeCatalyst.title || "untitled"} - ${activeCatalyst.premise || activeCatalyst.opening || ""}`
    : "No active catalyst scene.";

  const relations = bundle.world.relations || {};
  const relationsList = Object.entries(relations)
      .map(([code, score]) => `${code}: ${score >= 0 ? '+' : ''}${score}`)
      .join(", ");
  const relationsText = relationsList ? `Geopolitical relations with other countries (on scale of -100 to +100): ${relationsList}` : "";

  return [
    `Player polity: ${bundle.game.country || "Unknown polity"}`,
    `Current round: ${bundle.game.round}`,
    `Current date: ${bundle.game.gameDate || "unknown"}`,
    `Language: ${(() => {
      const lang = bundle.game.language || bundle.world.language || "English";
      return `${lang} (CRITICAL: All generated text, dialogue, events, titles, and descriptions MUST be exclusively in ${lang})`;
    })()}`,
    `Difficulty: ${bundle.game.difficulty || "standard"}`,
    relationsText,
    "",
    "Territorial changes from the base scenario:",
    territorySummary,
    "",
    "Dynamic polity overrides:",
    politySummary,
    "",
    catalystSummary,
  ].filter((x) => typeof x === "string").join("\n");
};

const formatDateReadable = (value) => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("D MMMM YYYY") : normalizeString(value);
};

const buildDifficultyGuidance = (difficulty, mode = "general") => {
  const normalizedDifficulty = normalizeString(difficulty).toLowerCase();
  const intro =
    mode === "chats"
      ? "Diplomatic concessions and cooperation should scale with the difficulty."
      : "Long-term success and geopolitical leverage should scale with the difficulty.";

  switch (normalizedDifficulty) {
    case "easy":
      return `${intro} The player can convert reasonable preparation into results relatively easily.`;
    case "hard":
      return `${intro} The player should need stronger leverage, preparation, and credibility before major outcomes stick.`;
    case "very hard":
    case "extreme":
      return `${intro} Major outcomes should require overwhelming preparation, sustained leverage, or unusually favorable conditions.`;
    default:
      return `${intro} Outcomes should feel plausible and earned without becoming static.`;
  }
};

const buildAdvisorHistoryText = (messages, { limit = 18 } = {}) => {
  const normalizedMessages = normalizeArray(messages)
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const role = normalizeString(entry.role || entry.speaker || "message");
      const text = normalizeString(entry.text || entry.content || entry.message);
      if (!text) {
        return null;
      }

      return `${role}: ${text}`;
    })
    .filter(Boolean);

  if (normalizedMessages.length === 0) {
    return "No advisor messages are currently recorded.";
  }

  return normalizedMessages.slice(-limit).join("\n");
};

const buildDetailedChatHistoryText = (chats, { limit = 8 } = {}) => {
  const normalizedChats = normalizeChats(chats);
  if (normalizedChats.length === 0) {
    return "No chats occurred in these rounds.";
  }

  return normalizedChats
    .slice(0, limit)
    .map((chat, index) => {
      const header = `Chat ${index + 1}: ${chat.countries.map((country) => country.name).join(", ")}`;
      const body =
        chat.messages.length > 0
          ? chat.messages
              .slice(-10)
              .map((message) => `${message.speaker || message.role}: ${message.text}`)
              .join("\n")
          : "No messages yet.";
      return `${header}\n${body}`;
    })
    .join("\n\n");
};

const buildRecentRoundsWithDates = (bundle) => {
  const history = normalizeArray(bundle.world?.simulationHistory);

  if (history.length === 0) {
    return `Current round only: ${bundle.game.gameDate || "unknown date"}`;
  }

  return history
    .slice(0, 8)
    .map((entry) => `${entry.fromDate || "unknown"} -> ${entry.toDate || entry.date || "unknown"}`)
    .join("; ");
};

const buildPlayerPolityRegionsText = async (bundle) => {
  const playerCode = normalizeString(bundle.game.country);
  if (!playerCode) {
    return "No player polity is currently set.";
  }

  const world = normalizeWorldState(bundle.world);
  const regionEntries = Object.entries(world.regionOwnershipOverrides);
  if (regionEntries.length === 0) {
    return "No explicit player region override list is currently recorded.";
  }

  const regionCatalog = await loadRegionCatalog();
  const regionLookup = new Map(regionCatalog.map((region) => [region.id, region]));
  const playerRegions = regionEntries
    .filter(([, ownerCode]) => normalizeString(ownerCode).toLowerCase() === playerCode.toLowerCase())
    .slice(0, 24)
    .map(([regionId]) => {
      const region = regionLookup.get(regionId);
      return region?.name || regionId;
    });

  if (playerRegions.length === 0) {
    return "No explicit player region override list is currently recorded.";
  }

  return playerRegions.join(", ");
};

const resolveHelperValues = (helperTemplates, variables) => {
  let resolved = {};

  for (let pass = 0; pass < 2; pass += 1) {
    resolved = Object.fromEntries(
      Object.entries(helperTemplates).map(([key, template]) => [
        key,
        renderTemplate(template, { ...variables, ...resolved }),
      ]),
    );
  }

  return resolved;
};

const buildTemplateVariables = async (
  bundle,
  {
    actionInput = "",
    catalystChoice = "",
    catalystHistory = "",
    catalystOpening = "",
    catalystPremise = "",
    chat = null,
    eventsToConsolidate = "",
    gameMasterRequest = "",
    targetDate = "",
  } = {},
) => {
  const normalizedChat = chat && typeof chat === "object" ? normalizeChats([chat])[0] : null;
  const regionCatalog = await loadRegionCatalog();
  const chatHistory =
    normalizedChat?.messages?.map((message) => `${message.speaker || message.role}: ${message.text}`).join("\n") ||
    "No chat history.";
  const chatParticipants = normalizedChat?.countries?.map((country) => country.name).join(", ") || "";
  const lastSpeaker = normalizedChat?.messages?.at(-1)?.speaker || "";
  const date = bundle.game.gameDate || "";
  const target = targetDate || bundle.game.gameDate || "";
  const worldSummary = await buildWorldSummary(bundle);
  const recentEvents = buildEventHistoryText(bundle.events);
  const allActions = buildActionHistoryText(bundle.actions, { includeResolved: true });

  return {
    actionInput,
    advisorMessages: buildAdvisorHistoryText(bundle.advisor || []),
    allActions,
    catalystChoice,
    catalystDate: date,
    catalystHistory,
    catalystPercent:
      normalizeArray(bundle.world?.activeCatalyst?.history).length > 0
        ? `${Math.min(100, normalizeArray(bundle.world?.activeCatalyst?.history).length * 50)}%`
        : "0%",
    catalystOpening,
    catalystPremise,
    chatHistory,
    chatHistoryLong: buildDetailedChatHistoryText(bundle.chats),
    chatParticipants,
    chatSummary: buildChatSummaryText(bundle.chats),
    chatsToConsolidate: buildChatSummaryText(bundle.chats, { limit: 12 }),
    date,
    dateReadable: formatDateReadable(date),
    difficulty: bundle.game.difficulty || "standard",
    difficultyGuidanceChats: buildDifficultyGuidance(bundle.game.difficulty, "chats"),
    difficultyGuidanceJumpForward: buildDifficultyGuidance(bundle.game.difficulty, "jump"),
    eventsToConsolidate: eventsToConsolidate || buildEventHistoryText(bundle.events, { limit: 12 }),
    gameMasterRequest,
    language: (() => {
      const lang = bundle.game.language || bundle.world.language || "English";
      return `${lang} (CRITICAL: All generated text, dialogue, events, titles, and descriptions MUST be exclusively in ${lang})`;
    })(),
    lastSpeaker,
    numberOfRegions: String(regionCatalog.length),
    plannedActions: buildActionHistoryText(bundle.actions),
    playerPolity: bundle.game.country || "Unknown polity",
    playerBattalionSummaries: "No battalion summary data is currently available in the lightweight runtime.",
    playerPolityRegions: await buildPlayerPolityRegionsText(bundle),
    recentEvents,
    recentEventsLong: buildEventHistoryText(bundle.events, { limit: 24 }),
    recentRoundsWithDates: buildRecentRoundsWithDates(bundle),
    respondingPolityName:
      normalizedChat?.countries.find((country) => country.name !== bundle.game.country)?.name || "",
    simulationRules: normalizeString(bundle.world.simulationRules) || "No extra simulation rules were provided.",
    startDate: bundle.game.startDate || "",
    targetDate: target,
    targetDateReadable: formatDateReadable(target),
    worldBeforeRoundOne:
      normalizeString(bundle.world.startingTimelineText) || "No pre-game world briefing was provided.",
    worldSummary,
    worldSummaryNoCity: worldSummary,
  };
};

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timeoutId = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const runJsonTask = async (taskKey, { fallback, timeoutMs = 12000, userMessage, variables }) => {
  const prompts = await loadPromptCatalog();
  const helperValues = resolveHelperValues(prompts.helpers, variables);
  const systemPrompt = renderTemplate(prompts.tasks[taskKey], {
    ...variables,
    ...helperValues,
  });

  try {
    const raw = await withTimeout(
      callAI(systemPrompt, [{ role: "user", parts: [{ text: userMessage }] }]),
      timeoutMs,
      `AI task "${taskKey}" timed out.`,
    );
    const parsed = extractJsonPayload(raw);
    if (parsed) {
      return parsed;
    }
  } catch {
    // Fall through to deterministic fallback.
  }

  return fallback();
};

const mergePolityCatalog = (countryCatalog, world) => {
  const merged = new Map();

  for (const country of countryCatalog) {
    if (!country) continue;
    merged.set((country.code || country.name).toUpperCase(), {
      code: country.code || "",
      name: country.name || country.code || "",
    });
  }

  for (const polity of Object.values(normalizeWorldState(world).polityOverrides)) {
    if (!polity) continue;
    merged.set((polity.code || polity.name).toUpperCase(), {
      code: polity.code,
      name: polity.name || polity.code,
    });

    if (polity.name) {
      merged.set(polity.name.toUpperCase(), {
        code: polity.code,
        name: polity.name,
      });
    }
  }

  return Array.from(merged.values());
};

const resolveInvitees = async (names, world) => {
  const countryCatalog = mergePolityCatalog(await loadCountryNames(), world);
  const lookup = new Map();

  for (const country of countryCatalog) {
    lookup.set((country.name || "").toUpperCase(), country);
    if (country.code) {
      lookup.set(country.code.toUpperCase(), country);
    }
  }

  return names
    .map((name) => lookup.get(normalizeString(name).toUpperCase()) || null)
    .filter(Boolean)
    .map((entry) => ({
      code: entry.code || "",
      name: entry.name || entry.code || "",
    }));
};

const inferInviteeNames = async (text, world, playerCountry = "") => {
  const countryCatalog = mergePolityCatalog(await loadCountryNames(), world);
  const normalizedText = normalizeString(text).toLowerCase();

  return countryCatalog
    .filter((country) => country.name && country.name.toLowerCase() !== normalizeString(playerCountry).toLowerCase())
    .filter((country) => normalizedText.includes(country.name.toLowerCase()))
    .slice(0, 5)
    .map((country) => country.name);
};

const fallbackActionSuggestions = async (bundle) => {
  const isTr = bundle.game.language === "Türkçe";
  const recentTitles = normalizeEvents(bundle.events).slice(-3).map((event) => event.title);
  
  const topicsData = isTr ? [
    { title: "İç cepheyi dengele", description: "İç cepheyi düzenli tutun ve dış baskı artarken iç sürüklenme ihtimalini azaltın." },
    { title: "Diplomatik alanı şekillendir", description: "Bir sonraki kriz sertleşmeden önce düşman seçeneklerini daraltmak için görüşmeleri, sinyalleri ve kozları kullanın." },
    { title: "Askeri koz hazırla", description: "Rakiplerinizin kapasitenizi planlarına dahil etmesi için görünür bir hazırlık ve pratik rezervler oluşturun." },
    { title: "Ekonomik derinliği güvenceye al", description: "Sonraki risklerin sürdürülebilir olup olmayacağını belirleyen endüstriyel ve mali tabanı genişletin." }
  ] : DEFAULT_SUGGESTION_TOPICS;

  const topics = topicsData.map((topic, index) => {
    const recentTitle = recentTitles[index];
    const actions = [
      normalizeActionEntry({
        kind: "action",
        source: "suggested",
        text: isTr
          ? `${recentTitle || topic.title.toLowerCase()} konusunda somut bir adım atın ve ilgili kurumları harekete geçirin.`
          : `Issue a concrete order addressing ${recentTitle || topic.title.toLowerCase()} and assign a responsible ministry or command.`,
        title: recentTitle
          ? isTr ? `Şuna yanıt ver: ${recentTitle}` : `Respond to ${recentTitle}`
          : isTr ? `Şunun için harekete geç: ${topic.title}` : `Act on ${topic.title}`,
      }),
      normalizeActionEntry({
        kind: "action",
        source: "suggested",
        text: isTr
          ? `Bu hamlenin direniş tetiklemesi ihtimaline karşı ${bundle.game.country || "devlet"} için bir acil durum planı veya ikincil önlem paketi hazırlayın.`
          : `Prepare a second-order measure that protects ${bundle.game.country || "the polity"} if this line of effort triggers resistance.`,
        title: isTr ? "Bir acil durum planı oluştur" : "Create a contingency layer",
      }),
    ].filter(Boolean);

    return {
      actions,
      description: topic.description,
      id: `fallback-topic-${index}`,
      title: recentTitle || topic.title,
    };
  });

  return { topics };
};

const fallbackDescriptionToAction = async (rawInput, bundle) => {
  const trimmed = normalizeString(rawInput);
  const isChat = CHAT_HINT_PATTERNS.some((pattern) => pattern.test(trimmed));
  const inferredInvitees = isChat
    ? await inferInviteeNames(trimmed, bundle.world, bundle.game.country)
    : [];
  const title = sentenceCase(trimmed.split(/[.!?]/)[0] || trimmed);
  const expandedText = isChat
    ? `${trimmed}. Clarify the objective, the concession you can offer, and the outcome you want before the exchange hardens.`
    : `${trimmed}. Define the instrument, timing, and expected political or military effect so the move can be executed cleanly.`;

  return {
    chatStarter: isChat ? trimmed : "",
    invitees: inferredInvitees,
    kind: isChat ? "chat" : "action",
    text: expandedText.slice(0, 520),
    title: title.length > 72 ? `${title.slice(0, 69)}...` : title,
  };
};

const pickMentionedSpeaker = (messageText, participants, excludedSpeaker) => {
  const normalizedText = normalizeString(messageText).toLowerCase();
  if (!normalizedText) return null;

  return (
    participants.find((country) => {
      if (country.name === excludedSpeaker) return false;
      return normalizedText.includes(country.name.toLowerCase());
    }) ?? null
  );
};

const fallbackNextSpeaker = ({ chat, excludedSpeaker }) => {
  const normalizedChat = normalizeChats([chat])[0];
  if (!normalizedChat) {
    return { nextSpeaker: "" };
  }

  const lastMessage = normalizedChat.messages.at(-1);
  const mentionedSpeaker = pickMentionedSpeaker(lastMessage?.text, normalizedChat.countries, excludedSpeaker);
  if (mentionedSpeaker) {
    return { nextSpeaker: mentionedSpeaker.name };
  }

  const fallbackCountry =
    normalizedChat.countries.find((country) => country.name !== excludedSpeaker) ??
    normalizedChat.countries[0] ??
    { name: "" };

  return {
    nextSpeaker: fallbackCountry.name,
  };
};

const buildGeneratedChat = async (chatLike, linkEventId, world) => {
  const countriesInput = Array.isArray(chatLike?.countries) ? chatLike.countries : [];
  const countryNames = countriesInput
    .map((entry) => (typeof entry === "string" ? entry : entry?.name || entry?.code || ""))
    .filter(Boolean);
  const countries = await resolveInvitees(countryNames, world);

  return normalizeChatEntry({
    countries,
    id: chatLike?.id,
    linkedEventId: linkEventId,
    messages:
      chatLike?.messages && Array.isArray(chatLike.messages)
        ? chatLike.messages
        : chatLike?.openingMessage
        ? [
            {
              code: countries.find((country) => country.name === chatLike.speaker)?.code || countries[0]?.code || "",
              role: "leader",
              speaker: chatLike.speaker || countries[0]?.name || "",
              text: chatLike.openingMessage,
              time: "",
            },
          ]
        : [],
    source: "invitation",
    status: "open",
    title: chatLike?.title || `Chat with ${countries.map((country) => country.name).join(", ")}`,
  });
};

const fallbackJumpSimulation = async ({ bundle, days, mode, targetDate }) => {
  const isTr = bundle.game.language === "Türkçe";
  const plannedActions = normalizeActions(bundle.actions).filter((action) => action.status === "planned");

  const regionCatalog = await loadRegionCatalog();
  const countryCatalog = await loadCountryNames();

  const engine = new SimEngine(bundle, regionCatalog, countryCatalog);
  const events = await engine.processDeterministicJump(days, plannedActions, isTr);

  // Mark the last event as major/notable
  if (events.length > 0) {
    const lastIdx = events.length - 1;
    events[lastIdx].importance = "major";
    events[lastIdx].notable = true;
  }

  const lastEvent = events.at(-1) ?? null;
  const catalyst = lastEvent
    ? {
        choices: isTr
          ? ["Avantajı hemen kullan", "Harekete geçmeden önce temkinli yaklaş", "Bekle ve daha fazla istihbarat topla"]
          : ["Press the advantage immediately", "Probe cautiously before committing", "Hold position and gather more intelligence"],
        opening: `${lastEvent.title}. ${lastEvent.description}`,
        premise: isTr
          ? `Bu olay, ${lastEvent.title.toLowerCase()} karar anına yaklaştığında başlıyor.`
          : `This scene begins as ${lastEvent.title.toLowerCase()} reaches the point where direct judgment matters.`,
        title: lastEvent.title,
      }
    : null;

  return {
    catalyst,
    clearActions: true,
    events,
    stopDate: targetDate,
    summary:
      plannedActions.length > 0
        ? isTr
          ? `${bundle.game.country} planlama aşamasından uygulamaya geçiyor ve dünya bu turun en somut emirlerine uyum sağlamaya başlıyor.`
          : `${bundle.game.country} moves from planning into execution, and the world begins adjusting to the turn's most concrete orders.`
        : isTr
        ? `Zaman, ${bundle.game.country} tarafından doğrudan bir emir verilmeden ilerliyor, ancak daha geniş sistem değişmeye ve baskı oluşturmaya devam ediyor.`
        : `Time advances without a direct order from ${bundle.game.country}, but the wider system keeps shifting and building pressure.`,
  };
};

const normalizeGeneratedEvent = (entry, index = 0) => {
  const normalized = normalizeEvents([entry])[0];
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    id: normalized.id || `generated-event-${index}`,
  };
};

const applyStateChanges = (world, result, countryCatalog, regionCatalog, playerCountry, difficulty) => {
  const nextWorld = { ...world };
  const playerCode = countryCatalog.find(c => c.name.toLowerCase() === playerCountry.toLowerCase() || c.code.toLowerCase() === playerCountry.toLowerCase())?.code || "TR";

  // 1. Initialize relations if empty
  const relations = { ...(nextWorld.relations || {}) };
  if (Object.keys(relations).length === 0) {
    for (const c of countryCatalog) {
      if (c.code !== playerCode) {
        let baseRel = 10;
        if (difficulty === "hard") baseRel = -10;
        else if (difficulty === "nightmare" || difficulty === "kabus") baseRel = -25;
        relations[c.code] = Math.floor(Math.random() * 31) - 15 + baseRel;
      }
    }
  }

  // 2. Initialize tensions if empty
  const tensions = { ...(nextWorld.tensions || {}) };
  if (Object.keys(tensions).length === 0) {
    for (const r of regionCatalog) {
      tensions[r.id] = Math.floor(Math.random() * 20) + 10;
    }
  }

  // 3. Process structured state_changes from LLM output
  if (result && result.state_changes) {
    const sc = result.state_changes;
    if (sc.relations && typeof sc.relations === "object") {
      for (const [key, value] of Object.entries(sc.relations)) {
        if (relations[key] !== undefined && typeof value === "number") {
          relations[key] = Math.max(-100, Math.min(100, relations[key] + value));
        }
      }
    }
    if (sc.tensions && typeof sc.tensions === "object") {
      for (const [key, value] of Object.entries(sc.tensions)) {
        if (typeof value === "number") {
          tensions[key] = Math.max(0, Math.min(100, (tensions[key] || 15) + value));
        }
      }
    }
    if (sc.map_pins && Array.isArray(sc.map_pins)) {
      let currentPins = [...(nextWorld.mapPins || [])];
      for (const pin of sc.map_pins) {
        if (pin.action === "add" && pin.type && pin.regionId) {
          const pinId = `pin-${pin.type}-${pin.regionId}-${Date.now()}`;
          const isTr = (difficulty || "").toLowerCase().includes("tr") || (playerCountry || "").toLowerCase().includes("tür");
          const typeNames = {
            industry: isTr ? "Sanayi Bölgesi" : "Industrial Zone",
            warehouse: isTr ? "Lojistik Merkezi" : "Logistics Center",
            milbase: isTr ? "Askeri Garnizon" : "Military Garrison",
            naval: isTr ? "Deniz Üssü" : "Naval Base",
            airbase: isTr ? "Hava Üssü" : "Airbase",
            research: isTr ? "Araştırma Laboratuvarı" : "Research Lab",
          };
          currentPins.push({
            id: pinId,
            name: typeNames[pin.type] || pin.type,
            type: pin.type,
            regionId: pin.regionId,
            polityCode: pin.polityCode || playerCode
          });
        } else if (pin.action === "remove" && pin.type && pin.regionId) {
          currentPins = currentPins.filter(p => !(p.type === pin.type && p.regionId === pin.regionId));
        }
      }
      nextWorld.mapPins = currentPins;
    }
  }

  // Decay tensions slightly over time
  for (const rid of Object.keys(tensions)) {
    tensions[rid] = Math.max(10, Math.round(tensions[rid] * 0.9));
  }

  nextWorld.relations = relations;
  nextWorld.tensions = tensions;
  return nextWorld;
};

const applySimulationResult = async ({
  baseActions,
  baseChats,
  baseColors,
  baseEvents,
  baseGame,
  baseWorld,
  result,
}) => {
  const regionCatalog = await loadRegionCatalog();
  const countryCatalog = await loadCountryNames();
  const plannedActionSnapshot = normalizeActions(baseActions).filter((action) => action.status === "planned");

  // Removed the dummy 'action initiated' events so the simulation only shows actual LLM narrated consequences.
  const generatedEvents = normalizeArray(result.events)
    .map((entry, index) => normalizeGeneratedEvent(entry, index))
    .filter(Boolean);
  const nextEvents = [...normalizeEvents(baseEvents), ...generatedEvents];
  const nextGame = normalizeGameData({
    ...baseGame,
    gameDate: normalizeString(result.stopDate) || baseGame.gameDate,
    round: (baseGame.round || 1) + 1,
  });
  // plannedActionSnapshot already built above
  const nextActions = normalizeActions(baseActions).map((action) => ({
    ...action,
    status: action.status === "planned" && result.clearActions ? "resolved" : action.status,
  }));
  const nextChats = [...normalizeChats(baseChats)];

  for (const event of generatedEvents) {
    for (const createdChat of event.impacts.createdChats) {
      const nextChat = await buildGeneratedChat(createdChat, event.id, baseWorld);
      if (nextChat) {
        nextChats.unshift(nextChat);
      }
    }
  }

  const { colors: nextColors, world: worldWithImpacts } = applyEventImpactsToWorld({
    colors: baseColors,
    events: generatedEvents,
    regionCatalog,
    countryCatalog,
    world: {
      ...baseWorld,
      activeCatalyst: result.catalyst ?? null,
      actionSuggestions: [],
      lastJumpMode: normalizeString(result.mode),
      lastJumpSummary: normalizeString(result.summary),
      lastJumpTargetDate: nextGame.gameDate,
      simulationHistory: [
        {
          catalyst: result.catalyst ? cloneValue(result.catalyst) : null,
          date: nextGame.gameDate,
          eventIds: generatedEvents.map((event) => event.id),
          fromDate: baseGame.gameDate,
          mode: normalizeString(result.mode) || "jump",
          plannedActions: plannedActionSnapshot,
          round: nextGame.round,
          summary: normalizeString(result.summary),
          toDate: nextGame.gameDate,
        },
        ...normalizeWorldState(baseWorld).simulationHistory,
      ].slice(0, 12),
    },
  });

  const nextWorldWithUpdates = applyStateChanges(
    worldWithImpacts,
    result,
    countryCatalog,
    regionCatalog,
    baseGame.country || "Turkey",
    baseGame.difficulty || "standard"
  );

  await Promise.all([
    writeActionsState(nextActions),
    writeChatsState(nextChats),
    writeEventsState(nextEvents),
    writeGameData(nextGame),
    writeJson(JSON_URLS.colors, nextColors, { pretty: true }),
    writeWorldState(nextWorldWithUpdates),
  ]);

  return {
    actions: nextActions,
    chats: nextChats,
    colors: nextColors,
    events: nextEvents,
    game: nextGame,
    world: nextWorldWithUpdates,
  };
};

export const generateActionSuggestions = async ({ force = true } = {}) => {
  const bundle = await readGameStateBundle({ force });
  const variables = await buildTemplateVariables(bundle);
  const payload = await runJsonTask("actions", {
    fallback: () => fallbackActionSuggestions(bundle),
    timeoutMs: 45000,
    userMessage: "Generate current strategic action suggestions as JSON only.",
    variables,
  });

  const topics = normalizeArray(payload?.topics)
    .map((topic, topicIndex) => {
      if (!topic || typeof topic !== "object") {
        return null;
      }

      const title = normalizeString(topic.title || topic.name);
      if (!title) {
        return null;
      }

      return {
        actions: normalizeArray(topic.actions)
          .map((action, actionIndex) =>
            normalizeActionEntry(
              {
                ...action,
                source: "suggested",
                suggestionTopic: title,
              },
              actionIndex,
            ),
          )
          .filter(Boolean),
        description: normalizeString(topic.description),
        id: normalizeString(topic.id) || `topic-${topicIndex}`,
        title,
      };
    })
    .filter(Boolean);

  const world = normalizeWorldState(await readWorldState());
  world.actionSuggestions = topics;
  await writeWorldState(world);

  return topics;
};

export const refinePlayerAction = async (rawInput, { persist = true } = {}) => {
  const bundle = await readGameStateBundle({ force: true });
  const variables = await buildTemplateVariables(bundle, { actionInput: rawInput });
  const payload = await runJsonTask("descriptionToAction", {
    fallback: () => fallbackDescriptionToAction(rawInput, bundle),
    userMessage: "Convert the player's raw intent into one structured in-game command as JSON only.",
    variables,
  });

  const invitees = normalizeArray(payload?.invitees).map((entry) => normalizeString(entry)).filter(Boolean);
  const action = normalizeActionEntry({
    chatStarter: normalizeString(payload?.chatStarter),
    invitees,
    kind: normalizeString(payload?.kind).toLowerCase() === "chat" ? "chat" : "action",
    rawInput,
    source: "manual",
    status: "planned",
    text: normalizeString(payload?.text),
    title: normalizeString(payload?.title),
  });

  if (!action) {
    throw new Error("Could not convert the action into a structured command.");
  }

  if (persist) {
    const nextActions = [...(await readActionsState({ force: true })), action];
    await writeActionsState(nextActions);
  }

  return action;
};

export const chooseNextDiplomaticSpeaker = async ({
  chat,
  excludeSpeaker = "",
} = {}) => {
  const bundle = await readGameStateBundle({ force: true });
  const normalizedChat = normalizeChats([chat])[0];
  if (!normalizedChat) {
    return "";
  }

  const variables = await buildTemplateVariables(bundle, { chat: normalizedChat });
  const payload = await runJsonTask("nextSpeaker", {
    fallback: () => fallbackNextSpeaker({ chat: normalizedChat, excludedSpeaker: excludeSpeaker }),
    userMessage: "Choose the next speaker as JSON only.",
    variables: {
      ...variables,
      lastSpeaker: excludeSpeaker || variables.lastSpeaker,
    },
  });

  const nextSpeaker = normalizeString(payload?.nextSpeaker);
  if (!nextSpeaker) {
    return fallbackNextSpeaker({ chat: normalizedChat, excludedSpeaker: excludeSpeaker }).nextSpeaker;
  }

  const validSpeaker =
    normalizedChat.countries.find((country) => country.name.toLowerCase() === nextSpeaker.toLowerCase()) ??
    normalizedChat.countries.find((country) => country.name !== excludeSpeaker);

  return validSpeaker?.name || "";
};

export const consolidateRecentHistory = async ({ limit = 12 } = {}) => {
  const bundle = await readGameStateBundle({ force: true });
  const variables = await buildTemplateVariables(bundle, {
    chatsToConsolidate: buildChatSummaryText(bundle.chats, { limit }),
    eventsToConsolidate: buildEventHistoryText(bundle.events, { limit }),
  });
  const payload = await runJsonTask("eventConsolidator", {
    fallback: () => ({
      summary: `Recent history: ${normalizeEvents(bundle.events)
        .slice(-limit)
        .map((event) => `${event.date || "undated"} ${event.title}`)
        .join("; ")}`,
    }),
    userMessage: "Summarize the recent campaign history as JSON only.",
    variables,
  });

  return normalizeString(payload?.summary);
};

export const createCatalyst = async ({ force = true } = {}) => {
  const bundle = await readGameStateBundle({ force });
  const variables = await buildTemplateVariables(bundle);
  const payload = await runJsonTask("catalystCreation", {
    fallback: () => ({
      choices: [
        "Intervene decisively",
        "Probe for weakness first",
        "Remain cautious and observe",
      ],
      opening: normalizeEvents(bundle.events).at(-1)?.description || "A turning point begins to unfold.",
      premise: normalizeEvents(bundle.events).at(-1)?.title || "A decisive moment takes shape.",
      title: normalizeEvents(bundle.events).at(-1)?.title || "Emerging Catalyst",
    }),
    userMessage: "Design the next catalyst scene as JSON only.",
    variables,
  });

  const catalyst = {
    choices: normalizeArray(payload?.choices).map((entry) => normalizeString(entry)).filter(Boolean).slice(0, 5),
    opening: normalizeString(payload?.opening),
    premise: normalizeString(payload?.premise),
    title: normalizeString(payload?.title),
  };

  const world = normalizeWorldState(await readWorldState({ force: true }));
  world.activeCatalyst = catalyst;
  await writeWorldState(world);
  return catalyst;
};

export const advanceActiveCatalyst = async (choiceText) => {
  const bundle = await readGameStateBundle({ force: true });
  const baseColors = await readJson(JSON_URLS.colors, { defaultValue: {}, force: true });
  const world = normalizeWorldState(bundle.world);
  const catalyst = world.activeCatalyst;

  if (!catalyst) {
    throw new Error("No active catalyst is available.");
  }

  const catalystHistoryText = normalizeArray(catalyst.history)
    .map((entry) => `${entry.choice}: ${entry.summary}`)
    .join("\n");
  const variables = await buildTemplateVariables(bundle, {
    catalystChoice: choiceText,
    catalystHistory: catalystHistoryText,
    catalystOpening: catalyst.opening || "",
    catalystPremise: catalyst.premise || catalyst.title || "",
  });

  const payload = await runJsonTask("catalystExecutor", {
    fallback: () => ({
      nextChoices: normalizeArray(catalyst.choices).slice(0, 3),
      resolved: normalizeArray(catalyst.history).length >= 1,
      summary: `${choiceText} becomes the line of action inside "${catalyst.title || "the scene"}", pushing the situation toward a definite outcome.`,
    }),
    userMessage: "Continue the catalyst scene as JSON only.",
    variables,
  });

  const historyEntry = {
    choice: choiceText,
    summary: normalizeString(payload?.summary),
  };

  const nextCatalyst = {
    ...catalyst,
    choices: normalizeArray(payload?.nextChoices).map((entry) => normalizeString(entry)).filter(Boolean).slice(0, 5),
    history: [...normalizeArray(catalyst.history), historyEntry],
    opening: normalizeString(payload?.summary) || catalyst.opening,
  };

  if (!payload?.resolved) {
    const nextWorld = {
      ...world,
      activeCatalyst: nextCatalyst,
    };
    await writeWorldState(nextWorld);
    return {
      catalyst: nextCatalyst,
      world: nextWorld,
    };
  }

  const summaryVariables = await buildTemplateVariables(bundle, {
    catalystHistory: [...normalizeArray(catalyst.history), historyEntry]
      .map((entry) => `${entry.choice}: ${entry.summary}`)
      .join("\n"),
    catalystPremise: catalyst.premise || catalyst.title || "",
  });
  const summaryPayload = await runJsonTask("catalystSummary", {
    fallback: () => ({
      description: historyEntry.summary,
      importance: "major",
      title: catalyst.title || "Catalyst resolved",
    }),
    userMessage: "Summarize the finished catalyst into one campaign event as JSON only.",
    variables: summaryVariables,
  });

  const catalystEvent = normalizeGeneratedEvent({
    date: bundle.game.gameDate,
    description: normalizeString(summaryPayload?.description),
    impacts: {
      createdChats: [],
      polityChanges: [],
      regionTransfers: [],
    },
    importance: normalizeString(summaryPayload?.importance) || "major",
    kind: "catalyst",
    notable: true,
    playerRelated: true,
    title: normalizeString(summaryPayload?.title) || catalyst.title || "Catalyst resolved",
  });

  return applySimulationResult({
    baseActions: bundle.actions,
    baseChats: bundle.chats,
    baseColors,
    baseEvents: bundle.events,
    baseGame: bundle.game,
    baseWorld: {
      ...bundle.world,
      activeCatalyst: null,
    },
    result: {
      catalyst: null,
      clearActions: false,
      events: catalystEvent ? [catalystEvent] : [],
      mode: "catalyst",
      stopDate: bundle.game.gameDate,
      summary: normalizeString(summaryPayload?.description) || historyEntry.summary,
    },
  });
};

export const simulateTimelineJump = async ({ days, mode = "jump" } = {}) => {
  const bundle = await readGameStateBundle({ force: true });
  const baseColors = await readJson(JSON_URLS.colors, { defaultValue: {}, force: true });
  let safeDays = Math.max(1, Math.trunc(Number(days) || 0));
  
  if (mode === "auto") {
    const plannedActionsCount = normalizeActions(bundle.actions).filter((a) => a.status === "planned" && a.source === "manual").length;
    safeDays = Math.max(30, plannedActionsCount * 25);
  }
  
  const targetDate = dayjs(bundle.game.gameDate).add(safeDays, "day").format("YYYY-MM-DD");
  
  const regionCatalog = await loadRegionCatalog();
  const countryCatalog = await loadCountryNames();
  const engine = new SimEngine(bundle, regionCatalog, countryCatalog);
  
  // 1. Auto-Consolidate History every 10 rounds to save LLM tokens
  let currentEvents = bundle.events;
  if (bundle.game.round > 0 && bundle.game.round % 10 === 0) {
    console.log(`[Auto-Consolidate] Round ${bundle.game.round}: Compressing history...`);
    try {
      const summaryText = await consolidateRecentHistory({ limit: 15 });
      if (summaryText) {
        currentEvents = [
          {
            date: bundle.game.gameDate,
            title: `Tarihçe Sıkıştırıldı (Tur ${bundle.game.round})`,
            description: summaryText,
            importance: "major",
            kind: "world",
            playerRelated: false,
            notable: true,
            impacts: { regionTransfers: [], polityChanges: [], createdChats: [] },
            id: Date.now()
          },
          // Keep only the very last event for immediate context
          ...bundle.events.slice(-1)
        ];
        // Instantly write to save state
        await writeEventsState(currentEvents);
      }
    } catch (e) {
      console.warn("Auto-consolidation failed:", e);
    }
  }

  // 2. RUN DETERMINISTIC TICK (Economy, Player Action Deduction, AI Decision Trees)
  const tickResult = engine.runDeterministicTick(bundle.actions);
  const updatedBundle = {
    ...bundle,
    world: tickResult.nextWorld,
    actions: tickResult.nextActions,
    events: [
      ...currentEvents,
      // Inject mechanical tick events (like AI decisions, Riots) into the history for LLM to see
      ...tickResult.tickEvents.map((evt, i) => ({
        date: bundle.game.gameDate,
        title: "Simulation System Event",
        description: evt,
        importance: "minor",
        kind: "world",
      }))
    ]
  };

  const variables = await buildTemplateVariables(updatedBundle, { targetDate });

  let payload = null;
  const timeoutMs = 60000;
  
  try {
    const orchestrator = new AgentOrchestrator();
    payload = await withTimeout(
        orchestrator.orchestrate(variables),
        timeoutMs,
        "Agent orchestrator timed out."
    );
  } catch (err) {
    console.warn("Agent orchestrator failed:", err);
  }

  if (!payload || !payload.events) {
    payload = await fallbackJumpSimulation({ bundle: updatedBundle, days: safeDays, mode, targetDate });
  }

  const result = {
    catalyst: payload?.catalyst ?? null,
    clearActions: payload?.clearActions !== false,
    events: normalizeArray(payload?.events),
    mode,
    stopDate: normalizeString(payload?.stopDate) || targetDate,
    summary: normalizeString(payload?.summary),
  };

  return applySimulationResult({
    baseActions: updatedBundle.actions,
    baseChats: updatedBundle.chats,
    baseColors,
    baseEvents: updatedBundle.events,
    baseGame: updatedBundle.game,
    baseWorld: updatedBundle.world,
    result,
  });
};

export const simulateAutoJump = async ({ days = 365 } = {}) =>
  simulateTimelineJump({ days, mode: "auto" });

export const applyGameMasterCommand = async (requestText) => {
  const bundle = await readGameStateBundle({ force: true });
  const baseColors = await readJson(JSON_URLS.colors, { defaultValue: {}, force: true });
  const variables = await buildTemplateVariables(bundle, { gameMasterRequest: requestText });
  const payload = await runJsonTask("gameMaster", {
    fallback: () => ({
      impacts: {
        polityChanges: [],
        regionTransfers: [],
      },
      summary: "No deterministic GM fallback changes were inferred from the request.",
    }),
    userMessage: "Apply the GM request as JSON only.",
    variables,
  });

  const gmEvent = normalizeGeneratedEvent({
    date: bundle.game.gameDate,
    description: normalizeString(payload?.summary),
    impacts: payload?.impacts,
    importance: "major",
    kind: "game-master",
    notable: true,
    playerRelated: true,
    title: "Game master intervention",
  });

  if (!gmEvent) {
    throw new Error("The game master request did not produce a valid change set.");
  }

  return applySimulationResult({
    baseActions: bundle.actions,
    baseChats: bundle.chats,
    baseColors,
    baseEvents: bundle.events,
    baseGame: bundle.game,
    baseWorld: bundle.world,
    result: {
      catalyst: null,
      clearActions: false,
      events: [gmEvent],
      mode: "game-master",
      stopDate: bundle.game.gameDate,
      summary: gmEvent.description,
    },
  });
};
