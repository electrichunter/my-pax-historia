import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import {
    PMTILES_ARCHIVES,
    decodeVectorTile,
    getPmtilesArchive,
    loadCountryNames,
    loadRegionCatalog,
} from "../../runtime/assets.js";
import { getLocaleStrings } from "../../runtime/locales.js";
import { simulateAutoJump, simulateTimelineJump } from "../AI/gameplay.js";
import {
    normalizeActions,
    readActionsState,
    readEventsState,
    readGameData,
    readWorldState,
} from "../../runtime/gameState.js";
import { playSynthSound } from "./actions.jsx";
import { extractMapPins } from "../../Simulation/EventExtractor.js";

dayjs.extend(advancedFormat);

const TIMELINE_STYLE_ID = "timeline-ui-style";
const PANEL_WIDTH = "26.25rem";

const ensureTimelineStyles = () => {
    if (typeof document === "undefined" || document.getElementById(TIMELINE_STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = TIMELINE_STYLE_ID;
    style.textContent = `
    @keyframes timeline-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .timeline-markdown p {
        margin: 0 0 0.45rem 0;
    }

    .timeline-markdown p:last-child {
        margin-bottom: 0;
    }

    .timeline-markdown strong {
        color: rgba(255,255,255,0.96);
    }

    .timeline-markdown em {
        color: rgba(216,227,255,0.78);
    }

    .timeline-markdown ul,
    .timeline-markdown ol {
        margin: 0.35rem 0 0.45rem 1.1rem;
        padding: 0;
    }

    .timeline-markdown li {
        margin-bottom: 0.18rem;
    }

    .timeline-markdown blockquote {
        border-left: 2px solid rgba(96,165,250,0.55);
        color: rgba(214,226,255,0.68);
        margin: 0.55rem 0;
        padding-left: 0.8rem;
    }

    .timeline-markdown code {
        background: rgba(15,23,42,0.55);
        border-radius: 4px;
        padding: 0.05rem 0.32rem;
    }

    .newspaper-markdown p {
        margin: 0 0 0.6rem 0;
        text-indent: 1.5em;
    }
    .newspaper-markdown p:first-of-type {
        text-indent: 0;
    }
    .newspaper-markdown p:first-of-type::first-letter {
        float: left;
        font-size: 2.2rem;
        line-height: 1.7rem;
        padding-top: 2px;
        padding-right: 6px;
        padding-left: 2px;
        font-weight: bold;
        color: #2c2416;
        font-family: Georgia, serif;
    }
    .newspaper-markdown strong {
        color: #000;
        font-weight: bold;
    }
    .newspaper-markdown em {
        color: #333;
        font-style: italic;
    }
    `;
    document.head.appendChild(style);
};

const SpinnerRing = ({ size = 14, tone = "rgba(255,255,255,0.88)" }) => {
    useEffect(() => {
        ensureTimelineStyles();
    }, []);

    return (
        <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ animation: "timeline-spin 0.7s linear infinite" }}
        >
        <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.2)" strokeWidth="2.2" />
        <path d="M12 4a8 8 0 0 1 8 8" stroke={tone} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
};

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
    </svg>
);

const MapIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
    <path d="M9 3v15" />
    <path d="M15 6v15" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
    </svg>
);

const panelSurface = {
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
    color: "white",
    fontFamily: "sans-serif",
    overflow: "hidden",
    position: "fixed",
    width: PANEL_WIDTH,
    zIndex: 9998,
};

const widgetSurface = {
    alignItems: "center",
    backdropFilter: "blur(4px)",
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)",
    color: "white",
    display: "flex",
    fontFamily: "sans-serif",
    gap: "0.25rem",
    height: "3.5rem",
    justifyContent: "center",
    padding: "0 0.5rem",
    position: "fixed",
    transition: "right 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
    width: "18rem",
    zIndex: 9999,
};

const buttonStyle = {
    alignItems: "center",
    background: "none",
    border: "none",
    borderRadius: "6px",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    display: "flex",
    flexShrink: 0,
    fontSize: "1.5rem",
    fontWeight: "900",
    height: "2rem",
    justifyContent: "center",
    lineHeight: 1,
    transition: "all 0.15s ease",
    width: "2rem",
};

const formatDate = (value, pattern = "MMM D, YYYY") => {
    if (!value) {
        return "Undated";
    }

    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format(pattern) : String(value);
};

const formatRange = (fromDate, toDate) => {
    if (!fromDate && !toDate) {
        return "No recorded range";
    }

    if (!fromDate) {
        return formatDate(toDate);
    }

    if (!toDate || fromDate === toDate) {
        return formatDate(fromDate);
    }

    return `${formatDate(fromDate)} -> ${formatDate(toDate)}`;
};

const resolvePolityName = (code, polityLookup) => {
    if (!code) {
        return "";
    }

    return polityLookup.get(code) || code;
};

const resolveRegionName = (transfer, regionLookup) => {
    if (!transfer) {
        return "";
    }

    return transfer.regionName || regionLookup.get(transfer.regionId)?.name || transfer.regionId || "";
};

const getEventMapChangeCount = (event) =>
(event?.impacts?.regionTransfers?.length || 0) + (event?.impacts?.polityChanges?.length || 0);

const collectEventTags = (event, { polityLookup, regionLookup }) => {
    const labels = new Set();

    for (const change of event?.impacts?.polityChanges ?? []) {
        const label = change.name || resolvePolityName(change.code, polityLookup);
        if (label) {
            labels.add(label);
        }
    }

    for (const transfer of event?.impacts?.regionTransfers ?? []) {
        const regionName = resolveRegionName(transfer, regionLookup);
        if (regionName) {
            labels.add(regionName);
        }

        const ownerName = resolvePolityName(transfer.toCode, polityLookup);
        if (ownerName) {
            labels.add(ownerName);
        }
    }

    for (const chat of event?.impacts?.createdChats ?? []) {
        for (const country of chat?.countries ?? []) {
            if (country?.name) {
                labels.add(country.name);
            }
        }
    }

    return Array.from(labels).slice(0, 8);
};

const buildEventLookup = (events) => new Map((events ?? []).map((event) => [event.id, event]));

let regionBoundsPromise = null;
let countryBoundsPromise = null;

const tilePointToLngLat = (px, py, extent = 4096) => {
    const lng = (px / extent) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / extent)));
    const lat = latRad * (180 / Math.PI);
    return [lng, lat];
};

const extendBounds = (currentBounds, nextBounds) => {
    if (!nextBounds) {
        return currentBounds;
    }

    if (!currentBounds) {
        return nextBounds;
    }

    return [
        [
            Math.min(currentBounds[0][0], nextBounds[0][0]),
            Math.min(currentBounds[0][1], nextBounds[0][1]),
        ],
        [
            Math.max(currentBounds[1][0], nextBounds[1][0]),
            Math.max(currentBounds[1][1], nextBounds[1][1]),
        ],
    ];
};

const geometryToBounds = (geometry, extent = 4096) => {
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    for (const ring of geometry ?? []) {
        for (const point of ring ?? []) {
            const [lng, lat] = tilePointToLngLat(point.x, point.y, extent);
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
        }
    }

    if (
        !Number.isFinite(minLng) ||
        !Number.isFinite(minLat) ||
        !Number.isFinite(maxLng) ||
        !Number.isFinite(maxLat)
    ) {
        return null;
    }

    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ];
};

const loadFeatureBounds = async (archiveUrl, layerName, keyResolvers) => {
    const pmtiles = getPmtilesArchive(archiveUrl);
    const tileData = await pmtiles.getZxy(0, 0, 0);
    if (!tileData?.data) {
        return new Map();
    }

    const tile = await decodeVectorTile(tileData.data);
    const layer = tile.layers[layerName];
    if (!layer) {
        return new Map();
    }

    const extent = layer.extent || 4096;
    const boundsLookup = new Map();

    for (let index = 0; index < layer.length; index += 1) {
        const feature = layer.feature(index);
        const props = feature.properties ?? {};
        const key = keyResolvers
        .map((resolver) => resolver(props))
        .find((candidate) => candidate != null && String(candidate).trim() !== "");

        if (!key) {
            continue;
        }

        const featureBounds = geometryToBounds(feature.loadGeometry(), extent);
        if (!featureBounds) {
            continue;
        }

        const normalizedKey = String(key);
        boundsLookup.set(
            normalizedKey,
            extendBounds(boundsLookup.get(normalizedKey) || null, featureBounds),
        );
    }

    return boundsLookup;
};

const loadRegionBounds = async () => {
    if (!regionBoundsPromise) {
        regionBoundsPromise = loadFeatureBounds(
            PMTILES_ARCHIVES.regions,
            "regions",
            [
                (props) => props?.GID_1,
                                                (props) => props?.gid_1,
                                                (props) => props?.HASC_1,
                                                (props) => props?.fid,
            ],
        );
    }

    return regionBoundsPromise;
};

const loadCountryBounds = async () => {
    if (!countryBoundsPromise) {
        countryBoundsPromise = loadFeatureBounds(
            PMTILES_ARCHIVES.countries,
            "countries",
            [
                (props) => props?.GID_0,
                                                 (props) => props?.gid_0,
                                                 (props) => props?.ISO_A3,
                                                 (props) => props?.iso_a3,
            ],
        );
    }

    return countryBoundsPromise;
};

const getEventFocusBounds = (event, { countryBounds, regionBounds, polityLookup }) => {
    let resolvedBounds = null;

    for (const transfer of event?.impacts?.regionTransfers ?? []) {
        const regionId = String(transfer?.regionId ?? "");
        if (!regionId) {
            continue;
        }

        resolvedBounds = extendBounds(resolvedBounds, regionBounds.get(regionId) || null);
    }

    for (const change of event?.impacts?.polityChanges ?? []) {
        const code = String(change?.code ?? "");
        if (!code) {
            continue;
        }

        resolvedBounds = extendBounds(resolvedBounds, countryBounds.get(code) || null);
    }

    for (const chat of event?.impacts?.createdChats ?? []) {
        for (const country of chat?.countries ?? []) {
            const countryCodeOrName = typeof country === "string" ? country : country?.code || country?.name || "";
            if (!countryCodeOrName) continue;
            let code = countryBounds.has(countryCodeOrName) ? countryCodeOrName : null;
            if (!code && polityLookup) {
                for (const [c, name] of polityLookup.entries()) {
                    if (name.toLowerCase() === countryCodeOrName.toLowerCase() || c.toLowerCase() === countryCodeOrName.toLowerCase()) {
                        code = c;
                        break;
                    }
                }
            }
            if (code) {
                resolvedBounds = extendBounds(resolvedBounds, countryBounds.get(code) || null);
            }
        }
    }

    if (!resolvedBounds && polityLookup) {
        const titleAndDesc = `${event?.title || ""} ${event?.description || ""}`.toLowerCase();
        for (const [code, name] of polityLookup.entries()) {
            if (name && titleAndDesc.includes(name.toLowerCase())) {
                resolvedBounds = extendBounds(resolvedBounds, countryBounds.get(code) || null);
            }
        }
    }

    return resolvedBounds;
};

const getRevealedEventIds = (worldState, latestTurnRecord, visibleEventCount, openPanel) => {
    if (!worldState) return null;

    if (openPanel !== "history") {
        return null; // Null indicates all events are revealed (normal mode)
    }

    const revealedIds = new Set();

    // 1. All events from previous simulation histories are fully revealed
    const rawHistory = worldState.simulationHistory ?? [];
    for (let i = 1; i < rawHistory.length; i++) {
        const turn = rawHistory[i];
        if (turn && turn.eventIds) {
            turn.eventIds.forEach((id) => revealedIds.add(id));
        }
    }

    // 2. Only first visibleEventCount events of the latest turn are revealed
    if (latestTurnRecord && latestTurnRecord.events) {
        const visibleCount = Math.min(visibleEventCount, latestTurnRecord.events.length);
        for (let i = 0; i < visibleCount; i++) {
            const ev = latestTurnRecord.events[i];
            if (ev && ev.id) {
                revealedIds.add(ev.id);
            }
        }
    }

    return revealedIds;
};

const getActiveOverrides = (allEvents, revealedEventIds, defaultWorldState, regionCatalog, countryCatalog) => {
    const baseState = defaultWorldState ?? { regionOwnershipOverrides: {}, polityOverrides: {}, mapPins: [] };
    if (!revealedEventIds) {
        return {
            regionOwnershipOverrides: baseState.regionOwnershipOverrides ?? {},
            polityOverrides: baseState.polityOverrides ?? {},
            mapPins: baseState.mapPins ?? [],
        };
    }

    const regionOwnershipOverrides = {};
    const polityOverrides = {};
    let mapPins = [];

    const isTr = defaultWorldState?.language === "Türkçe";

    for (const event of allEvents ?? []) {
        if (!event || !event.id || !revealedEventIds.has(event.id)) {
            continue;
        }

        const impacts = event.impacts ?? {};

        for (const transfer of impacts.regionTransfers ?? []) {
            if (transfer && transfer.regionId) {
                regionOwnershipOverrides[transfer.regionId] = transfer.toCode;
            }
        }

        for (const change of impacts.polityChanges ?? []) {
            if (change && change.code) {
                polityOverrides[change.code] = {
                    ...(polityOverrides[change.code] ?? {
                        aliases: [],
                        code: change.code,
                        color: "",
                        name: "",
                        note: "",
                    }),
                    ...(change.aliases?.length > 0 ? { aliases: change.aliases } : {}),
                    ...(change.color ? { color: change.color } : {}),
                    ...(change.name ? { name: change.name } : {}),
                    ...(change.note ? { note: change.note } : {}),
                };
            }
        }

        // Dynamic pin & army extraction for revealed events
        const text = `${event.title || ""} ${event.description || ""}`.toLowerCase();

        // Extracted detailed pins from helper module
        const extractedPins = extractMapPins(event, regionCatalog, isTr);
        for (const pin of extractedPins) {
            if (!mapPins.some((p) => p.id === pin.id)) {
                mapPins.push(pin);
            }
        }

        const isArmy = text.includes("ordu") || text.includes("birlik") || text.includes("asker") || text.includes("army") || text.includes("troops") || text.includes("hareket") || text.includes("intikal") || text.includes("sevk");

        if (isArmy && regionCatalog && countryCatalog) {
            const mentionedRegions = [];
            for (const region of regionCatalog) {
                if (region.name && text.includes(region.name.toLowerCase())) {
                    mentionedRegions.push(region);
                }
            }

            if (mentionedRegions.length >= 1) {
                const destinationRegion = mentionedRegions[mentionedRegions.length - 1];
                const sourceRegion = mentionedRegions.length > 1 ? mentionedRegions[0] : null;

                let actorCountryCode = "TR";
                for (const country of countryCatalog) {
                    if (country.name && text.includes(country.name.toLowerCase())) {
                        actorCountryCode = country.code;
                        break;
                    }
                }

                const armyId = `army-${actorCountryCode.toLowerCase()}`;
                mapPins = mapPins.filter((p) => p.id !== armyId);
                mapPins.push({
                    id: armyId,
                    name: isTr ? `${actorCountryCode} Kolordusu` : `${actorCountryCode} Army Corps`,
                    type: "army",
                    regionId: destinationRegion.id,
                    fromRegionId: sourceRegion ? sourceRegion.id : null,
                });
            }
        }
    }

    return {
        regionOwnershipOverrides,
        polityOverrides,
        mapPins,
    };
};

const getMapInstance = (mapRef) => mapRef?.current?.getMap?.() ?? mapRef?.current ?? null;

const focusMapOnBounds = (mapRef, bounds, maxZoom = 6.8) => {
    const map = getMapInstance(mapRef);
    if (!map || !bounds) {
        return;
    }

    let [[west, south], [east, north]] = bounds;

    if (Math.abs(east - west) < 0.35) {
        const delta = maxZoom > 7.5 ? 0.25 : 0.6;
        west -= delta;
        east += delta;
    }

    if (Math.abs(north - south) < 0.35) {
        const delta = maxZoom > 7.5 ? 0.16 : 0.45;
        south -= delta;
        north += delta;
    }

    map.fitBounds(
        [
            [west, south],
            [east, north],
        ],
        {
            duration: 1800,
            essential: true,
            maxZoom,
            padding: 80,
        },
    );
};

const filterPlannedActions = (actions) =>
normalizeActions(actions).filter((action) => action.status === "planned");

const buildTurnRecord = ({ entry, index, history, eventLookup, game, lookups }) => {
    if (!entry) {
        return null;
    }

    const fallbackStartDate =
    entry.fromDate ||
    history[index + 1]?.toDate ||
    history[index + 1]?.date ||
    game?.startDate ||
    entry.toDate ||
    entry.date;
    const toDate = entry.toDate || entry.date || game?.gameDate || "";
    const fromDate = fallbackStartDate || toDate;
    const events = (entry.eventIds ?? []).map((eventId) => eventLookup.get(eventId)).filter(Boolean);
    const plannedActions = filterPlannedActions(entry.plannedActions || entry.actions);
    const mapChangeCount = events.reduce((sum, event) => sum + getEventMapChangeCount(event), 0);
    const tags = new Set();

    for (const action of plannedActions) {
        for (const invitee of action?.invitees ?? []) {
            if (invitee) {
                tags.add(invitee);
            }
        }
    }

    for (const event of events) {
        for (const label of collectEventTags(event, lookups)) {
            tags.add(label);
        }
    }

    const primaryEvent = events.find((event) => String(event.importance).toLowerCase() === "major") || events[0];

    return {
        date: entry.date || toDate,
        eventCount: events.length,
        events,
        fromDate,
        id: `${entry.toDate || entry.date || index}-${index}`,
        mapChangeCount,
        mode: entry.mode || "jump",
        plannedActions,
        rangeLabel: formatRange(fromDate, toDate),
        round: entry.round || 0,
        summary: entry.summary || "",
        tags: Array.from(tags).slice(0, 10),
        title:
        primaryEvent?.title ||
        (plannedActions[0]?.title ? `Turn centered on ${plannedActions[0].title}` : `Round ${entry.round || Math.max(1, (game?.round || 1) - index)}`),
        toDate,
    };
};

const MetricPill = ({ children, icon = null, tone = "default" }) => {
    const toneMap = {
        default: {
            background: "rgba(148,163,184,0.12)",
            border: "1px solid rgba(148,163,184,0.18)",
            color: "rgba(226,232,240,0.84)",
        },
        accent: {
            background: "rgba(96,165,250,0.12)",
            border: "1px solid rgba(96,165,250,0.22)",
            color: "#bfdbfe",
        },
        violet: {
            background: "rgba(168,85,247,0.12)",
            border: "1px solid rgba(192,132,252,0.2)",
            color: "#e9d5ff",
        },
        gold: {
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.25)",
            color: "#fde68a",
        },
    };

    const resolved = toneMap[tone] || toneMap.default;

    return (
        <span
        style={{
            alignItems: "center",
            background: resolved.background,
            border: resolved.border,
            borderRadius: "999px",
            color: resolved.color,
            display: "inline-flex",
            fontSize: "0.69rem",
            fontWeight: 600,
            gap: "0.32rem",
            letterSpacing: "0.02em",
            padding: "0.28rem 0.6rem",
        }}
        >
        {icon}
        <span>{children}</span>
        </span>
    );
};

const TagPill = ({ children }) => (
    <span
    style={{
        background: "rgba(255,255,255,0.04)",
                                   border: "1px solid rgba(255,255,255,0.08)",
                                   borderRadius: "999px",
                                   color: "rgba(226,228,240,0.74)",
                                   display: "inline-flex",
                                   fontSize: "0.68rem",
                                   fontWeight: 600,
                                   padding: "0.24rem 0.55rem",
    }}
    >
    {children}
    </span>
);

const ghostButtonStyle = {
    alignItems: "center",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "rgba(255,255,255,0.84)",
    cursor: "pointer",
    display: "inline-flex",
    fontSize: "0.74rem",
    fontWeight: 600,
    gap: "0.42rem",
    justifyContent: "center",
    padding: "0.5rem 0.78rem",
    transition: "all 0.15s ease",
};

const EventCard = ({ event, footer = null, lookups, loc }) => {
    const tags = collectEventTags(event, lookups);
    const mapChangeCount = getEventMapChangeCount(event);
    const isTr = loc?.code === "tr";
    const isPlayerOrder = event.kind === "player" || event.playerRelated === true && event.title?.startsWith("📋");
    const isClassified = !isPlayerOrder && (
        event.classified || 
        event.kind === "intelligence" || 
        (event.title && (
            event.title.toLowerCase().includes("istihbarat") ||
            event.title.toLowerCase().includes("ajan") ||
            event.title.toLowerCase().includes("gizli") ||
            event.title.toLowerCase().includes("intelligence") ||
            event.title.toLowerCase().includes("secret") ||
            event.title.toLowerCase().includes("spy")
        )) ||
        (event.description && (
            event.description.toLowerCase().includes("casus") ||
            event.description.toLowerCase().includes("sızma") ||
            event.description.toLowerCase().includes("sabotaj") ||
            event.description.toLowerCase().includes("clandestine")
        ))
    );

    const cardBorder = isPlayerOrder
        ? "1px solid rgba(251,191,36,0.45)"
        : "1px solid rgba(255,255,255,0.08)";
    const cardBg = isPlayerOrder
        ? "linear-gradient(180deg, rgba(251,191,36,0.10), rgba(251,191,36,0.04))"
        : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.03))";
    const cardShadow = isPlayerOrder
        ? "inset 0 1px 0 rgba(251,191,36,0.12), 0 0 18px rgba(251,191,36,0.07)"
        : "inset 0 1px 0 rgba(255,255,255,0.03)";

    return (
        <div
        style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            boxShadow: cardShadow,
            overflow: "hidden",
        }}
        >
        <div
        style={{
            alignItems: "center",
            background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            gap: "0.45rem",
            justifyContent: "space-between",
            padding: "0.85rem 1rem 0.7rem",
        }}
        >
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
        <MetricPill icon={<CalendarIcon />} tone="default">
        {formatDate(event.date)}
        </MetricPill>
        <MetricPill
            tone={isPlayerOrder ? "gold" : isClassified ? "violet" : "accent"}
            icon={isPlayerOrder ? "📋" : isClassified ? "🕵️" : "📰"}
        >
        {isPlayerOrder
            ? (isTr ? "Oyuncu Emri" : "Player Order")
            : isClassified 
            ? (isTr ? "Gizli / Ajan" : "Classified / Spy") 
            : (isTr ? "Haber" : "Public News")}
        </MetricPill>
        {mapChangeCount > 0 && (
            <MetricPill icon={<MapIcon />} tone="accent">
            {mapChangeCount} map change{mapChangeCount === 1 ? "" : "s"}
            </MetricPill>
        )}
        </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", padding: "0.95rem 1rem 1rem" }}>
        {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {tags.map((tag) => (
                <TagPill key={`${event.id}-${tag}`}>{tag}</TagPill>
            ))}
            </div>
        )}

        <div style={{ color: "rgba(255,255,255,0.94)", fontSize: "0.82rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {event.title}
        </div>

        {event.description && (
            <div className="timeline-markdown" style={{ color: "rgba(221,228,240,0.82)", fontSize: "0.77rem", lineHeight: "1.58" }}>
            <ReactMarkdown>{event.description}</ReactMarkdown>
            </div>
        )}

        {footer}
        </div>
        </div>
    );
};

const NewspaperHeadline = ({ event, loc }) => {
    if (!event) return null;
    return (
        <div style={{
            background: "#fbf8f0",
            backgroundImage: "radial-gradient(rgba(0,0,0,0.015) 1px, transparent 0), radial-gradient(rgba(0,0,0,0.015) 1px, transparent 0)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 4px 4px",
            border: "4px double #2c2416",
            borderRadius: "4px",
            color: "#1c140a",
            padding: "1.25rem",
            fontFamily: "'Georgia', 'Times New Roman', serif",
            boxShadow: "0 10px 20px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.04)",
            margin: "1rem 0",
            transform: "rotate(-1deg)",
            transition: "transform 0.3s ease",
            cursor: "default"
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "rotate(0deg) scale(1.02)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "rotate(-1deg)"}
        >
            <div style={{ textAlign: "center", borderBottom: "2px solid #2c2416", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "Georgia, serif", color: "#1c140a" }}>
                    {loc.code === "tr" ? "GÜNLÜK HAVADİS" : "THE DAILY CHRONICLE"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: "bold", borderTop: "1px solid #2c2416", paddingTop: "0.25rem", marginTop: "0.25rem", color: "#4a3b2c" }}>
                    <span>{formatDate(event.date)}</span>
                    <span>* {loc.code === "tr" ? "FİLİ HAKİKAT" : "DIVERTED HISTORY"} *</span>
                    <span>10 CENTS</span>
                </div>
            </div>

            <h1 style={{ margin: "0.5rem 0 0.75rem", fontSize: "1.2rem", fontWeight: "900", lineHeight: "1.25", textTransform: "uppercase", textAlign: "center", borderBottom: "1px dashed #c4b69d", paddingBottom: "0.5rem", color: "#1c140a", fontFamily: "Georgia, serif" }}>
                {event.title}
            </h1>

            {event.description && (
                <div className="newspaper-markdown" style={{ fontSize: "0.8rem", lineHeight: "1.5", textAlign: "justify", color: "#2c2416" }}>
                    <ReactMarkdown>{event.description}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

const EmptyPanelState = ({ text }) => (
    <div
    style={{
        alignItems: "center",
        background: "rgba(255,255,255,0.03)",
                                       border: "1px dashed rgba(255,255,255,0.1)",
                                       borderRadius: "16px",
                                       color: "rgba(214,226,255,0.48)",
                                       display: "flex",
                                       fontSize: "0.78rem",
                                       fontStyle: "italic",
                                       justifyContent: "center",
                                       lineHeight: "1.55",
                                       minHeight: "9.5rem",
                                       padding: "1.1rem",
                                       textAlign: "center",
    }}
    >
    {text}
    </div>
);

const PanelChrome = ({
    children,
    eyebrow,
    isOpen,
    subtitle,
    title,
    topOffset,
    onClose,
}) => {
    const hasHeaderText = Boolean(eyebrow || title || subtitle);

    return (
        <div
        style={{
            ...panelSurface,
            bottom: isOpen ? "4.9rem" : "-40rem",
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 13rem)",
            right: "0.5rem",
            maxHeight: "800px",
            maxWidth: "calc(100vw - 1rem)",
            minHeight: "25rem",
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            transition: "bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
        }}
        >
        <div
        style={{
            borderBottom: hasHeaderText ? "1px solid rgba(255,255,255,0.07)" : "none",
            flexShrink: 0,
            padding: hasHeaderText ? "1rem 1.25rem 0.75rem" : "0.7rem 0.75rem 0",
        }}
        >
        <div style={{ alignItems: "center", display: "flex", justifyContent: hasHeaderText ? "space-between" : "flex-end" }}>
        {hasHeaderText && (
            <div style={{ minWidth: 0 }}>
            {eyebrow && (
                <div style={{ color: "rgba(147,197,253,0.75)", fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.14em", marginBottom: "0.12rem", textTransform: "uppercase" }}>
                {eyebrow}
                </div>
            )}
            {title && (
                <div style={{ color: "rgba(255,255,255,0.96)", fontSize: "1rem", fontWeight: 700 }}>
                {title}
                </div>
            )}
            {subtitle && (
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem", lineHeight: "1.45", marginTop: "0.12rem" }}>
                {subtitle}
                </div>
            )}
            </div>
        )}
        <button
        type="button"
        onClick={onClose}
        style={{
            background: "none",
            border: "none",
            borderRadius: "6px",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            display: "flex",
            fontSize: "1.1rem",
            lineHeight: 1,
            padding: "0.15rem 0.3rem",
            transition: "all 0.15s ease",
        }}
        onMouseEnter={(event) => {
            event.currentTarget.style.background = "rgba(255,255,255,0.08)";
            event.currentTarget.style.color = "white";
        }}
        onMouseLeave={(event) => {
            event.currentTarget.style.background = "none";
            event.currentTarget.style.color = "rgba(255,255,255,0.5)";
        }}
        aria-label="Close panel"
        >
        <CloseIcon />
        </button>
        </div>
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "0.85rem", minHeight: 0, overflowY: "auto", padding: "0.95rem 1.25rem 1.25rem", scrollbarWidth: "none" }}>
        {children}
        </div>
        </div>
    );
};

const JumpNode = ({ isLoading, opt, onJump }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
            if (isLoading) {
                return;
            }

            onJump(opt.days);
        }}
        style={{
            background: hovered ? "rgba(109,40,217,0.35)" : "rgba(109,40,217,0.15)",
            border: hovered ? "1px solid rgba(139,92,246,0.7)" : "1px solid rgba(139,92,246,0.35)",
            borderRadius: "10px",
            color: "white",
            cursor: "pointer",
            opacity: isLoading ? 0.7 : 1,
            outline: "none",
            padding: "0.38rem 0",
            textAlign: "center",
            transition: "all 0.12s ease",
            width: "12.5rem",
        }}
        >
        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{opt.sublabel}</div>
        <div style={{ color: "rgba(196,165,255,0.7)", fontSize: "0.7rem" }}>
        {opt.label}
        </div>
        </button>
    );
};

const TimelineSkipPanel = ({
    currentDate,
    error,
    isLoading,
    isOpen,
    onAutoJump,
    onClose,
    onJump,
    topOffset,
    loc,
}) => {
    const jumpOptions = [
        { label: loc.dur1w, sublabel: dayjs(currentDate).add(7, "day").locale(loc.code).format(loc.dateFormat), days: 7 },
        { label: loc.dur1m, sublabel: dayjs(currentDate).add(1, "month").locale(loc.code).format(loc.dateFormat), days: 30 },
        { label: loc.dur3m, sublabel: dayjs(currentDate).add(3, "month").locale(loc.code).format(loc.dateFormat), days: 90 },
        { label: loc.dur6m, sublabel: dayjs(currentDate).add(6, "month").locale(loc.code).format(loc.dateFormat), days: 180 },
        { label: loc.dur1y, sublabel: dayjs(currentDate).add(1, "year").locale(loc.code).format(loc.dateFormat), days: 365 },
    ];

    return (
        <PanelChrome
        eyebrow=""
        isOpen={isOpen}
        onClose={onClose}
        title={loc.timeSkip}
        topOffset={topOffset}
        >
        <div
        style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 0,
        }}
        >
        <div
        style={{
            background: "rgba(109,40,217,0.2)",
            border: "2px solid rgba(139,92,246,0.8)",
            borderRadius: "999px",
            color: "rgba(196,165,255,0.95)",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            padding: "0.35rem 0",
            textAlign: "center",
            width: "5.5rem",
        }}
        >
        {dayjs(currentDate).locale(loc.code).format(loc.dateFormat)}
        </div>

        {jumpOptions.map((opt) => (
            <React.Fragment key={opt.label}>
            <div style={{ background: "rgba(139,92,246,0.4)", height: "1.25rem", width: "2px" }} />
            <JumpNode isLoading={isLoading} opt={opt} onJump={onJump} />
            </React.Fragment>
        ))}

        <div style={{ background: "rgba(139,92,246,0.4)", height: "1.25rem", width: "2px" }} />
        <button
        type="button"
        onClick={() => {
            if (isLoading) {
                return;
            }

            onAutoJump();
        }}
        style={{
            background: "rgba(37,99,235,0.2)",
            border: "1px solid rgba(96,165,250,0.45)",
            borderRadius: "12px",
            color: "white",
            cursor: "pointer",
            opacity: isLoading ? 0.72 : 1,
            padding: "0.55rem 0.7rem",
            textAlign: "center",
            width: "12.5rem",
        }}
        >
        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{loc.code === "tr" ? "Dinamik Atla (Emre Göre)" : "Dynamic Jump"}</div>
        </button>
        </div>

        {isLoading && (
            <div
            style={{
                alignItems: "center",
                background: "rgba(109,40,217,0.15)",
                border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: "12px",
                color: "rgba(196,165,255,0.95)",
                display: "flex",
                fontSize: "0.85rem",
                fontWeight: 600,
                gap: "0.6rem",
                justifyContent: "center",
                padding: "0.85rem 1rem",
                marginTop: "0.5rem",
            }}
            >
            <SpinnerRing size={16} tone="rgba(196,165,255,0.95)" />
            <span>{loc.code === "tr" ? "Olaylar Hazırlanıyor... (Lütfen bekleyin)" : loc.loadingTimeline}</span>
            </div>
        )}

        {error && (
            <div
            style={{
                background: "rgba(127,29,29,0.24)",
                   border: "1px solid rgba(248,113,113,0.3)",
                   borderRadius: "16px",
                   color: "#fecaca",
                   fontSize: "0.76rem",
                   lineHeight: "1.5",
                   padding: "0.85rem 0.9rem",
            }}
            >
            {error}
            </div>
        )}
        </PanelChrome>
    );
};

const TimelineHistoryPanel = ({
    isOpen,
    onFocusEvent,
    onRevealNextEvent,
    lookups,
    onClose,
    record,
    topOffset,
    visibleEventCount,
    loc,
}) => {
    const totalEvents = record?.events?.length || 0;
    const visibleEvents =
    totalEvents > 0
    ? record.events.slice(0, Math.min(visibleEventCount, totalEvents))
    : [];
    const hasMoreEvents = visibleEvents.length < totalEvents;
    const lastVisibleEventRef = React.useRef(null);

    useEffect(() => {
        if (!isOpen || !lastVisibleEventRef.current) {
            return;
        }

        lastVisibleEventRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }, [isOpen, record?.id, visibleEvents.length]);

    return (
        <PanelChrome
        eyebrow=""
        isOpen={isOpen}
        onClose={onClose}
        subtitle={record?.rangeLabel || ""}
        title={loc.eventsTitle}
        topOffset={topOffset}
        >
        {!record ? (
            <EmptyPanelState text={loc.noEventChain} />
        ) : totalEvents === 0 ? (
            <EmptyPanelState text={loc.noWorldEvents} />
        ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {visibleEvents.map((event, index) => {
                const isLastVisible = index === visibleEvents.length - 1;
                const hasMapChanges = getEventMapChangeCount(event) > 0;

                return (
                    <div key={event.id} ref={isLastVisible ? lastVisibleEventRef : null}>
                    <EventCard
                    event={event}
                    lookups={lookups}
                    loc={loc}
                    footer={(
                        hasMapChanges ? (
                            <div style={{ display: "flex", justifyContent: "center", marginTop: "0.15rem" }}>
                            <button
                            type="button"
                            onClick={() => onFocusEvent(event)}
                            style={{
                                ...ghostButtonStyle,
                                color: "#bfdbfe",
                            }}
                            >
                            <MapIcon />
                            <span>{loc.showOnMap}</span>
                            </button>
                            </div>
                        ) : null
                    )}
                    />
                    </div>
                );
            })}
            {hasMoreEvents && (
                <button
                type="button"
                onClick={onRevealNextEvent}
                style={{
                    ...ghostButtonStyle,
                    minHeight: "2.5rem",
                    width: "100%",
                }}
                >
                <ChevronDownIcon />
                <span>{loc.revealNext}</span>
                </button>
            )}
            {!hasMoreEvents && record && record.events && record.events.length > 0 && (
                (() => {
                    const notableEvent = record.events.find(e => {
                        const isClassified = e.classified || e.kind === "intelligence" || 
                            (e.title && (e.title.toLowerCase().includes("istihbarat") || e.title.toLowerCase().includes("gizli"))) ||
                            (e.description && (e.description.toLowerCase().includes("casus") || e.description.toLowerCase().includes("sızma")));
                        return !isClassified && (e.notable || String(e.importance).toLowerCase() === "major");
                    }) || record.events.find(e => {
                        const isClassified = e.classified || e.kind === "intelligence" || 
                            (e.title && (e.title.toLowerCase().includes("istihbarat") || e.title.toLowerCase().includes("gizli")));
                        return !isClassified;
                    }) || record.events[0];
                    
                    const isNotableClassified = notableEvent.classified || notableEvent.kind === "intelligence" || 
                        (notableEvent.title && (notableEvent.title.toLowerCase().includes("istihbarat") || notableEvent.title.toLowerCase().includes("gizli"))) ||
                        (notableEvent.description && (notableEvent.description.toLowerCase().includes("casus") || notableEvent.description.toLowerCase().includes("sızma")));

                    if (!isNotableClassified) {
                        return <NewspaperHeadline event={notableEvent} loc={loc} />;
                    } else {
                        return (
                            <div style={{
                                background: "#111625",
                                border: "2px dashed #f59e0b",
                                borderRadius: "10px",
                                color: "#fef3c7",
                                padding: "1.25rem",
                                fontFamily: "sans-serif",
                                boxShadow: "0 10px 20px rgba(0,0,0,0.4), inset 0 0 15px rgba(245,158,11,0.05)",
                                margin: "1rem 0",
                                transform: "rotate(1deg)",
                                transition: "transform 0.3s ease",
                                cursor: "default"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = "rotate(0deg) scale(1.02)"}
                            onMouseLeave={(e) => e.currentTarget.style.transform = "rotate(1deg)"}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid rgba(245,158,11,0.2)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                                    <span style={{ fontSize: "1.3rem" }}>🕵️</span>
                                    <span style={{ fontWeight: "bold", fontSize: "0.78rem", color: "#f59e0b", letterSpacing: "1px", textTransform: "uppercase" }}>
                                        {loc.code === "tr" ? "GİZLİ İSTİHBARAT RAPORU" : "CLASSIFIED DOSSIER"}
                                    </span>
                                </div>
                                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: "bold", color: "white" }}>{notableEvent.title}</h4>
                                <p style={{ margin: 0, fontSize: "0.78rem", lineHeight: "1.45", color: "rgba(255,255,255,0.7)" }}>{notableEvent.description}</p>
                            </div>
                        );
                    }
                })()
            )}
            </div>
        )}
        </PanelChrome>
    );
};

const DateWidget = ({
    activePanel = null,
    mapRef,
    onSetPanel = null,
    onTogglePanel = null,
    rightShift,
    topOffset = "0.5rem",
}) => {
    const [gameData, setGameData] = useState(null);
    const [events, setEvents] = useState([]);
    const [worldState, setWorldState] = useState(null);
    const [countryBounds, setCountryBounds] = useState(new Map());
    const [polityLookup, setPolityLookup] = useState(new Map());
    const [regionBounds, setRegionBounds] = useState(new Map());
    const [regionLookup, setRegionLookup] = useState(new Map());
    const [localOpenPanel, setLocalOpenPanel] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [visibleEventCount, setVisibleEventCount] = useState(1);
    const openPanel = typeof onSetPanel === "function" ? activePanel : localOpenPanel;

    useEffect(() => {
        ensureTimelineStyles();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            return;
        }

        playSynthSound("tick");

        const interval = setInterval(() => {
            playSynthSound("tick");
        }, 1000);

        return () => clearInterval(interval);
    }, [isLoading]);

    useEffect(() => {
        let cancelled = false;

        const loadLookups = async () => {
            try {
                const [countries, regions, nextCountryBounds, nextRegionBounds] = await Promise.all([
                    loadCountryNames(),
                                                                                                    loadRegionCatalog(),
                                                                                                    loadCountryBounds(),
                                                                                                    loadRegionBounds(),
                ]);

                if (cancelled) {
                    return;
                }

                setCountryBounds(nextCountryBounds);
                setPolityLookup(new Map((countries ?? []).map((entry) => [entry.code, entry.name])));
                setRegionBounds(nextRegionBounds);
                setRegionLookup(new Map((regions ?? []).map((entry) => [entry.id, entry])));
            } catch (lookupError) {
                if (!cancelled) {
                    console.error("Failed to load timeline lookups:", lookupError);
                }
            }
        };

        loadLookups();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadState = async () => {
            try {
                const [game, nextEvents, world] = await Promise.all([
                    readGameData({ force: true }),
                                                                    readEventsState({ force: true }),
                                                                    readWorldState({ force: true }),
                ]);

                if (cancelled) {
                    return;
                }

                setGameData(game);
                setEvents(nextEvents);
                setWorldState(world);
            } catch (loadError) {
                if (!cancelled) {
                    console.error("Failed to load timeline state:", loadError);
                }
            }
        };

        loadState();
        const interval = setInterval(loadState, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    function setPanel(panelName) {
        if (typeof onSetPanel === "function") {
            onSetPanel(panelName);
            return;
        }

        setLocalOpenPanel(panelName);
    }

    function togglePanel(panelName) {
        if (isLoading && panelName !== "skip") {
            return;
        }

        if (typeof onTogglePanel === "function") {
            onTogglePanel(panelName);
            return;
        }

        setLocalOpenPanel((current) => (current === panelName ? null : panelName));
    }

    const runJump = async (days, mode = "jump") => {
        if (!gameData || days == null || isLoading) {
            return;
        }

        setPanel("skip");
        setIsLoading(true);
        setError("");

        try {
            const startJumpTime = Date.now();
            
            const actionsData = await readActionsState({ force: true });
            const plannedActionsCount = normalizeActions(actionsData).filter((a) => a.status === "planned" && a.source === "manual").length;
            
            let delayMs = 150;
            if (plannedActionsCount === 1) delayMs = 3000;
            else if (plannedActionsCount === 2) delayMs = 3000;
            else if (plannedActionsCount >= 3) delayMs = 5000;

            // Allow UI to render the loading state and provide LLM API cooldown time
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const result = mode === "auto"
            ? await simulateAutoJump({ days })
            : await simulateTimelineJump({ days });
            
            setGameData(result.game);
            setEvents(result.events);
            setWorldState(result.world);
            setVisibleEventCount(1);
            setPanel("history");
        } catch (jumpError) {
            console.error("Failed to simulate jump:", jumpError);
            setError(jumpError.message || "Failed to simulate timeline jump.");
        } finally {
            setIsLoading(false);
        }
    };

    const eventLookup = useMemo(() => buildEventLookup(events), [events]);
    const lookups = useMemo(() => ({ polityLookup, regionLookup }), [polityLookup, regionLookup]);

    const historyRecords = useMemo(() => {
        const rawHistory = worldState?.simulationHistory ?? [];
        return rawHistory
        .map((entry, index) => buildTurnRecord({
            entry,
            index,
            history: rawHistory,
            eventLookup,
            game: gameData,
            lookups,
        }))
        .filter(Boolean);
    }, [eventLookup, gameData, lookups, worldState]);

    const latestTurnRecord = historyRecords[0] || null;
    const totalEvents = latestTurnRecord?.events?.length || 0;
    const activeVisibleEvent =
    openPanel === "history" && totalEvents > 0
    ? latestTurnRecord.events[Math.min(Math.max(visibleEventCount, 1), totalEvents) - 1]
    : null;

    const loc = getLocaleStrings(gameData?.language);

    const displayDate = gameData
    ? dayjs(gameData.gameDate).locale(loc.code).format(loc.dateFormat)
    : "Loading...";
    const currentDate = gameData?.gameDate ?? dayjs().format("YYYY-MM-DD");

    useEffect(() => {
        setVisibleEventCount(1);
    }, [latestTurnRecord?.id]);

    useEffect(() => {
        if (!activeVisibleEvent) {
            return;
        }

        const bounds = getEventFocusBounds(activeVisibleEvent, { countryBounds, regionBounds, polityLookup });
        
        const text = `${activeVisibleEvent.title || ""} ${activeVisibleEvent.description || ""}`.toLowerCase();
        const isLocalized = text.includes("sanayi") || text.includes("fabrika") || text.includes("depo") || text.includes("üs") || text.includes("üretim") || text.includes("factory") || text.includes("base") || text.includes("warehouse");
        const zoomLevel = isLocalized ? 8.8 : 6.8;

        focusMapOnBounds(mapRef, bounds, zoomLevel);

        const regionId = activeVisibleEvent?.impacts?.regionTransfers?.[0]?.regionId || null;
        const kind = activeVisibleEvent?.kind || "world";
        const pulseEvent = new CustomEvent("map-event-pulse", {
            detail: {
                regionId,
                kind,
                event: activeVisibleEvent
            }
        });
        window.dispatchEvent(pulseEvent);
    }, [activeVisibleEvent, countryBounds, mapRef, regionBounds, polityLookup]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const revealedIds = getRevealedEventIds(worldState, latestTurnRecord, visibleEventCount, openPanel);
        const regionCatalog = Array.from(regionLookup.values());
        const countryCatalog = Array.from(polityLookup.entries()).map(([code, name]) => ({ code, name }));
        const activeOverrides = getActiveOverrides(events, revealedIds, worldState, regionCatalog, countryCatalog);

        window.dispatchEvent(
            new CustomEvent("timeline-map-state-update", {
                detail: activeOverrides,
            })
        );
    }, [worldState, events, latestTurnRecord, visibleEventCount, openPanel, regionLookup, polityLookup]);

    const revealNextEvent = () => {
        setVisibleEventCount((current) => {
            if (!totalEvents) {
                return 1;
            }

            const nextCount = Math.min(totalEvents, current + 1);
            if (nextCount > current) {
                playSynthSound("reveal");
            }
            return nextCount;
        });
    };

    const focusEvent = (event) => {
        const bounds = getEventFocusBounds(event, { countryBounds, regionBounds, polityLookup });
        const text = `${event?.title || ""} ${event?.description || ""}`.toLowerCase();
        const isLocalized = text.includes("sanayi") || text.includes("fabrika") || text.includes("depo") || text.includes("üs") || text.includes("üretim") || text.includes("factory") || text.includes("base") || text.includes("warehouse");
        const zoomLevel = isLocalized ? 8.8 : 6.8;
        focusMapOnBounds(mapRef, bounds, zoomLevel);
    };

    return (
        <>
        <TimelineSkipPanel
        currentDate={currentDate}
        error={error}
        isLoading={isLoading}
        isOpen={openPanel === "skip"}
        onAutoJump={() => runJump(0, "auto")}
        onClose={() => setPanel(null)}
        onJump={(days) => runJump(days, "jump")}
        topOffset={topOffset}
        loc={loc}
        />
        <TimelineHistoryPanel
        isOpen={openPanel === "history"}
        onFocusEvent={focusEvent}
        onRevealNextEvent={revealNextEvent}
        lookups={lookups}
        onClose={() => setPanel(null)}
        record={latestTurnRecord}
        topOffset={topOffset}
        visibleEventCount={visibleEventCount}
        loc={loc}
        />

        <div
        style={{
            ...widgetSurface,
            right: rightShift,
            top: topOffset,
        }}
        >
        <button
        type="button"
        title={loc.eventsTitle}
        style={{
            ...buttonStyle,
            color: openPanel === "history" ? "#bfdbfe" : buttonStyle.color,
        }}
        onClick={() => togglePanel("history")}
        onMouseEnter={(event) => {
            if (openPanel !== "history") {
                event.currentTarget.style.color = "white";
            }
        }}
        onMouseLeave={(event) => {
            if (openPanel !== "history") {
                event.currentTarget.style.color = buttonStyle.color;
            }
        }}
        >
        {"\u00AB"}
        </button>

        <div style={{ alignItems: "center", display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        <div style={{ color: "rgba(255,255,255,0.94)", fontSize: "0.95rem", letterSpacing: "0.02em" }}>
        {displayDate}
        </div>
        </div>

        <button
        type="button"
        title={loc.timeSkip}
        style={{
            ...buttonStyle,
            color: openPanel === "skip" ? "rgba(196,165,255,0.9)" : buttonStyle.color,
        }}
        onClick={() => {
            if (isLoading) {
                setPanel("skip");
                return;
            }

            togglePanel("skip");
        }}
        onMouseEnter={(event) => {
            if (openPanel !== "skip") {
                event.currentTarget.style.color = "white";
            }
        }}
        onMouseLeave={(event) => {
            if (openPanel !== "skip") {
                event.currentTarget.style.color = buttonStyle.color;
            }
        }}
        >
        {isLoading ? <SpinnerRing size={15} tone="rgba(196,165,255,0.95)" /> : "\u00BB"}
        </button>
        </div>
        </>
    );
};

export { DateWidget };
