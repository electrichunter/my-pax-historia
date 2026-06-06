import { WorldGraph } from "./GraphState.js";
import dayjs from "dayjs";

export class SimEngine {
    constructor(bundle, regionCatalog, countryCatalog) {
        this.bundle = bundle;
        this.regionCatalog = regionCatalog;
        this.countryCatalog = countryCatalog;
        this.graph = WorldGraph.fromWorldState(bundle, regionCatalog, countryCatalog);
    }

    // Evaluates deterministic rules for AI budgets and resources
    evaluateBudget(polityCode) {
        // Deterministic resource evaluation based on graph
        const regionsOwned = this.graph.getNodesByType("region")
            .filter(node => this.graph.getEdges(node.id, "owned_by").some(e => e.target === polityCode));
        
        const industries = this.graph.getNodesByType("industry")
            .filter(ind => {
                const regionEdge = this.graph.getEdges(ind.id, "located_in")[0];
                return regionEdge && regionsOwned.some(r => r.id === regionEdge.target);
            });
            
        return {
            regions: regionsOwned.length,
            industrialCapacity: industries.length * 10,
            militaryBudget: 100 + (industries.length * 15)
        };
    }

    // The core deterministic tick loop
    runDeterministicTick(plannedActions) {
        const nextWorld = structuredClone(this.bundle.world);
        const nextActions = structuredClone(plannedActions);
        const tickEvents = [];
        const countryCatalog = this.countryCatalog;
        const playerCode = countryCatalog.find(c => c.name.toLowerCase() === (this.bundle.game.country || "Turkey").toLowerCase() || c.code.toLowerCase() === (this.bundle.game.country || "TR").toLowerCase())?.code || "TR";

        // 1. Economy Tick (Resource Generation)
        for (const polity of Object.values(nextWorld.polityOverrides || {})) {
            if (!polity || !polity.code || !polity.resources) continue;
            const res = polity.resources;
            
            // Generate Political Power and Economic Capital
            res.politicalPower = Math.min(200, (res.politicalPower || 200) + 15);
            res.economicCapital = Math.min(200, (res.economicCapital || 100) + 20);

            // Stability check
            if (res.stability < 30) {
                tickEvents.push(`[SYSTEM_EVENT: Low Stability Crisis in ${polity.code}. Riots spread.]`);
                res.economicCapital = Math.max(0, res.economicCapital - 10);
            }
        }

        // 2. Player Action Deduction
        for (const action of nextActions) {
            if (action.status !== "planned" || action.source !== "manual") continue;
            
            // Calculate cost (re-implement basic cost logic here)
            const text = (action.text || action.title || "").toLowerCase();
            let cost = 15;
            if (action.kind === "chat") cost = 10;
            if (text.includes("savaş") || text.includes("attack") || text.includes("ordu") || text.includes("sınır") || text.includes("asker") || text.includes("military")) cost = 30;

            const playerRes = nextWorld.polityOverrides[playerCode]?.resources;
            if (playerRes) {
                if (playerRes.politicalPower >= cost) {
                    playerRes.politicalPower -= cost;
                } else {
                    action.status = "failed";
                    action.failureReason = "Insufficient Political Power.";
                    tickEvents.push(`[SYSTEM_EVENT: Player action "${action.title}" failed due to bureaucracy and lack of political capital.]`);
                }
            }
        }

        // 3. AI Agents (Decision Trees)
        for (const polity of Object.values(nextWorld.polityOverrides || {})) {
            if (!polity || !polity.code || polity.code === playerCode || !polity.resources) continue;
            const res = polity.resources;
            
            // Simple Agendas based on resources
            if (res.stability < 40 && res.politicalPower >= 20) {
                // Focus on internal stability
                res.politicalPower -= 20;
                res.stability += 15;
                tickEvents.push(`[AI_ACTION: ${polity.code} initiates domestic reforms to quell unrest.]`);
            } else if (res.economicCapital < 50 && res.politicalPower >= 10) {
                // Seek trade
                res.politicalPower -= 10;
                tickEvents.push(`[AI_ACTION: ${polity.code} aggressively seeks foreign investment and trade deals to boost its failing economy.]`);
            } else if (res.militaryCap > 60 && res.politicalPower >= 30 && res.stability > 50) {
                // Hostile posture
                res.politicalPower -= 30;
                tickEvents.push(`[AI_ACTION: ${polity.code} conducts large-scale military drills near its borders, signaling aggressive intent.]`);
            }
        }

        return { nextWorld, nextActions, tickEvents };
    }

    async processDeterministicJump(days, plannedActions, isTr) {
        const events = [];
        const currentOverrides = { ...(this.bundle.world?.regionOwnershipOverrides || {}) };
        
        if (plannedActions.length > 0) {
            plannedActions.forEach((action, index) => {
              const eventDate = dayjs(this.bundle.game.gameDate)
                .add(Math.max(1, Math.round(((index + 1) / (plannedActions.length + 1)) * Math.max(days, 1))), "day")
                .format("YYYY-MM-DD");
        
              events.push({
                date: eventDate,
                description:
                  action.kind === "chat"
                    ? isTr
                      ? `Oyuncu diplomatik bir toplantı başlattı: "${action.title}". (Sistem Notu: LLM bağlantısı kurulamadığı için detaylı anlatım üretilemedi).`
                      : `The player initiated a diplomatic meeting: "${action.title}". (System Note: Detailed narration unavailable due to LLM fallback).`
                    : isTr
                      ? `Oyuncu emri uygulamaya kondu: "${action.title}". Bu hamlenin stratejik sonuçları hesaplanıyor.`
                      : `Player order enacted: "${action.title}". Strategic consequences are being calculated.`,
                impacts: {
                  createdChats:
                    action.kind === "chat" && action.invitees.length > 0 && action.chatStarter
                      ? [
                          {
                            countries: action.invitees,
                            openingMessage: action.chatStarter,
                            speaker: this.bundle.game.country,
                            title: action.title,
                          },
                        ]
                      : [],
                  polityChanges: [],
                  regionTransfers: [],
                },
                importance: "minor",
                kind: action.kind === "chat" ? "diplomacy" : "player",
                notable: false,
                playerRelated: true,
                title:
                  action.kind === "chat"
                    ? isTr
                      ? `Diplomatik Kanal: ${action.title}`
                      : `Diplomatic Channel: ${action.title}`
                    : isTr
                      ? `Emir: ${action.title}`
                      : `Order: ${action.title}`,
              });
            });
        }

        const difficulty = this.bundle.game.difficulty || "standard";
        let surpriseChance = 0.15;
        if (difficulty === "easy") surpriseChance = 0.05;
        else if (difficulty === "hard") surpriseChance = 0.20;
        else if (difficulty === "nightmare" || difficulty === "kabus") surpriseChance = 0.35;

        const targetCount = Math.max(4, plannedActions.length);
        while (events.length < targetCount) {
            const eventIndex = events.length;
            const eventDate = dayjs(this.bundle.game.gameDate)
              .add(Math.max(1, Math.round(((eventIndex + 1) / (targetCount + 1)) * Math.max(days, 1))), "day")
              .format("YYYY-MM-DD");

            if (this.regionCatalog.length === 0 || this.countryCatalog.length < 2) {
                break;
            }

            const isBlackSwan = Math.random() < surpriseChance;
            
            // Neden-Sonuç Zinciri (Causal Chain)
            let forceKind = null;
            let forceRegion = null;
            let forceCountry1 = null;
            let forceCountry2 = null;

            if (events.length > 0 && Math.random() < 0.5) {
                const prev = events[events.length - 1];
                if (prev.kind === "intelligence" || prev.kind === "military") {
                    forceKind = Math.random() < 0.5 ? "military" : "world";
                    forceRegion = prev.regionId;
                    forceCountry1 = prev.country1;
                } else if (prev.kind === "economy") {
                    forceKind = "politics";
                    forceRegion = prev.regionId;
                    forceCountry1 = prev.country1;
                } else if (prev.kind === "media") {
                    forceKind = "diplomacy";
                    forceCountry1 = prev.country1;
                    forceCountry2 = prev.country2;
                }
            }

            const region = forceRegion 
                ? (this.regionCatalog.find(r => r.id === forceRegion) || this.regionCatalog[Math.floor(Math.random() * this.regionCatalog.length)])
                : this.regionCatalog[Math.floor(Math.random() * this.regionCatalog.length)];
            const regionId = region.id;
            const regionName = region.name;
            const defaultOwnerCode = region.countryCode || "US";
            const currentOwnerCode = currentOverrides[regionId] || defaultOwnerCode;
            const currentOwner = this.countryCatalog.find((c) => c.code === currentOwnerCode);
            const currentOwnerName = currentOwner ? currentOwner.name : currentOwnerCode;

            const country1 = forceCountry1
                ? (this.countryCatalog.find(c => c.name === forceCountry1 || c.code === forceCountry1) || currentOwner || this.countryCatalog[0])
                : this.countryCatalog[Math.floor(Math.random() * this.countryCatalog.length)];
            
            let country2 = forceCountry2
                ? (this.countryCatalog.find(c => c.name === forceCountry2 || c.code === forceCountry2) || this.countryCatalog[0])
                : null;
            if (!country2) {
                let attempts = 0;
                country2 = country1;
                while (country2.code === country1.code && attempts < 10) {
                    country2 = this.countryCatalog[Math.floor(Math.random() * this.countryCatalog.length)];
                    attempts++;
                }
            }

            if (isBlackSwan) {
                const blackSwans = [
                    {
                        titleTr: "Küresel Finansal Çöküş",
                        titleEn: "Global Financial Crash",
                        descTr: "BÜYÜK BORSALARDA ÇÖKÜŞ! Uluslararası dev bankaların iflası sonrası faiz oranları fırladı ve küresel ticaret durma noktasına geldi.",
                        descEn: "MAJOR STOCK MARKET CRASH! Global trade ground to a halt and interest rates skyrocketed following the bankruptcy of major international banks.",
                        kind: "economy",
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        titleTr: "Bölgesel Deprem Felaketi",
                        titleEn: "Regional Earthquake Disaster",
                        descTr: `YÜZYILIN DEPREMİ! Merkez üssü ${regionName} olan 7.9 büyüklüğündeki deprem tüm bölgede büyük yıkıma ve can kaybına yol açtı.`,
                        descEn: `EARTHQUAKE OF THE CENTURY! A magnitude 7.9 earthquake centered in ${regionName} caused massive destruction and loss of life across the region.`,
                        kind: "disaster",
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        titleTr: "Beklenmedik Askeri Darbe",
                        titleEn: "Unexpected Military Coup",
                        descTr: `DARBE GİRİŞİMİ! ${country1.name} içinde orduya bağlı bir cunta yönetime el koymaya çalıştı, ülkede sıkıyönetim ilan edildi.`,
                        descEn: `COUP D'ETAT ATTEMPT! A military junta within ${country1.name} attempted to seize power, martial law was declared.`,
                        kind: "politics",
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    }
                ];

                const bSwan = blackSwans[Math.floor(Math.random() * blackSwans.length)];
                events.push({
                    date: eventDate,
                    description: isTr ? bSwan.descTr : bSwan.descEn,
                    impacts: bSwan.impacts,
                    importance: "major",
                    kind: bSwan.kind,
                    notable: true,
                    playerRelated: country1.name === this.bundle.game.country,
                    title: isTr ? bSwan.titleTr : bSwan.titleEn,
                    regionId,
                    country1: country1.name,
                    country2: country2.name
                });
            } else {
                const archetypes = [
                    {
                        kind: "infrastructure",
                        titleTr: `${regionName} Altyapı Genişletmesi`,
                        titleEn: `${regionName} Infrastructure Expansion`,
                        descTr: `${regionName} bölgesinde yeni demiryolu ve lojistik hatları genişletme projesi yerel yönetimce onaylandı.`,
                        descEn: `A new railway and logistics line expansion project in ${regionName} was approved by the local administration.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "economy",
                        titleTr: "Döviz Dalgalanması",
                        titleEn: "Currency Fluctuation",
                        descTr: `Ekonomik belirsizlik ve döviz kurlarındaki hareketlilik, ${country1.name} sınırları içindeki ${regionName} bölgesinde sanayi yatırımlarını yavaşlattı.`,
                        descEn: `Economic uncertainty and exchange rate volatility slowed down industrial investments in ${regionName} region within ${country1.name}.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "intelligence",
                        titleTr: "Sınır İstihbaratı",
                        titleEn: "Border Intelligence",
                        descTr: `${regionName} bölgesindeki askeri hareketlilik insansız hava araçları ve uydu görüntüleriyle doğrulandı.`,
                        descEn: `Military movement in ${regionName} region was confirmed via unmanned aerial vehicles and satellite imagery.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "disaster",
                        titleTr: "Şiddetli Fırtına",
                        titleEn: "Severe Storm",
                        descTr: `${regionName} kıyılarında meydana gelen şiddetli fırtına ve fırtına kabarması, liman operasyonlarını geçici olarak askıya aldı.`,
                        descEn: `A severe storm and storm surge on the coasts of ${regionName} temporarily suspended port operations.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "politics",
                        titleTr: "Bütçe Protestosu",
                        titleEn: "Budget Protest",
                        descTr: `${country1.name} muhalefeti, savunma bütçesindeki yüksek artış planına karşı parlamentoda sert tepki gösterdi.`,
                        descEn: `The opposition in ${country1.name} reacted strongly in parliament against the planned sharp increase in the defense budget.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "technology",
                        titleTr: "Yerli Savunma Atılımı",
                        titleEn: "Local Defense Breakthrough",
                        descTr: `${country1.name} mühendisleri, yapay zeka entegrasyonlu yerli savunma sistemlerinin saha testlerini başarıyla tamamladı.`,
                        descEn: `Engineers in ${country1.name} successfully completed field tests of AI-integrated domestic defense systems.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "humanitarian",
                        titleTr: "Sınır Yardım Kampı",
                        titleEn: "Border Aid Camp",
                        descTr: `${regionName} yakınlarındaki sınır mülteci kampına insani yardım ulaştırmak amacıyla koordinasyon komitesi kuruldu.`,
                        descEn: `A coordination committee was established to deliver humanitarian aid to the border refugee camp near ${regionName}.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "naval",
                        titleTr: "Deniz Devriyesi Gerginliği",
                        titleEn: "Naval Patrol Tension",
                        descTr: `${regionName} yakınlarındaki sularda devriye gezen ${country1.name} fırkateynleri şüpheli kargo gemilerini takibe aldı.`,
                        descEn: `Frigates from ${country1.name} patrolling waters near ${regionName} tracked suspicious cargo vessels.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "election",
                        titleTr: "Erken Seçim Tartışması",
                        titleEn: "Early Election Debate",
                        descTr: `${country1.name} genelinde yapılan son anketler, koalisyon ortaklarının erken seçim ihtimalini tartıştığını ortaya koydu.`,
                        descEn: `Recent polls across ${country1.name} revealed that coalition partners are actively debating early election prospects.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "media",
                        titleTr: "Diplomatik Basın Krizi",
                        titleEn: "Diplomatic Press Crisis",
                        descTr: `Uluslararası basında çıkan iddialar, ${country1.name} ve ${country2.name} arasındaki ikili diplomatik kanallarda gerginliğe yol açtı.`,
                        descEn: `Claims in international media led to tensions in bilateral diplomatic channels between ${country1.name} and ${country2.name}.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "health",
                        titleTr: "Kamu Sağlığı Alarmı",
                        titleEn: "Public Health Alert",
                        descTr: `${regionName} bölgesinde yeni bir virüs varyantının tespit edilmesi üzerine yerel sağlık tedbirleri artırıldı.`,
                        descEn: `Local health measures were heightened following the detection of a new virus variant in ${regionName} region.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "industry",
                        titleTr: "Sanayi Yatırımı",
                        titleEn: "Industrial Investment",
                        descTr: `${country1.name}, endüstriyel üretimi desteklemek için ${regionName} bölgesinde yeni tesisler açacağını bildirdi.`,
                        descEn: `${country1.name} reported that it will open new facilities in ${regionName} region to support industrial manufacturing.`,
                        impacts: { createdChats: [], polityChanges: [], regionTransfers: [] }
                    },
                    {
                        kind: "military",
                        titleTr: `${regionName} Çatışması`,
                        titleEn: `${regionName} Conflict`,
                        descTr: `${regionName} üzerinde denetim el değiştirdi. ${country2.name} güçleri, ${country1.name} idaresini sonlandırarak bölgede denetim kurdu.`,
                        descEn: `Control over ${regionName} has shifted. Forces aligned with ${country2.name} established control, displacing the ${country1.name} authorities.`,
                        impacts: {
                            createdChats: [],
                            polityChanges: [],
                            regionTransfers: [
                                {
                                    fromCode: country1.code,
                                    note: "Strategic realignment",
                                    regionId: regionId,
                                    regionName: regionName,
                                    toCode: country2.code,
                                },
                            ],
                        }
                    }
                ];

                let possibleArchetypes = archetypes;
                if (forceKind) {
                    possibleArchetypes = archetypes.filter(a => a.kind === forceKind);
                    if (possibleArchetypes.length === 0) possibleArchetypes = archetypes;
                }

                const arch = possibleArchetypes[Math.floor(Math.random() * possibleArchetypes.length)];
                const finalEvent = {
                    date: eventDate,
                    description: isTr ? arch.descTr : arch.descEn,
                    impacts: arch.impacts,
                    importance: "minor",
                    kind: arch.kind,
                    notable: false,
                    playerRelated: country1.name === this.bundle.game.country || country2.name === this.bundle.game.country,
                    title: isTr ? arch.titleTr : arch.titleEn,
                    regionId,
                    country1: country1.name,
                    country2: country2.name
                };

                if (arch.kind === "military" && arch.impacts.regionTransfers.length > 0) {
                    currentOverrides[regionId] = country2.code;
                }

                events.push(finalEvent);
            }
        }

        return events;
    }
}
