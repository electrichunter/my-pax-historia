// EventExtractor.js - Extracts dynamic map pins and structures from event narratives

export const extractMapPins = (event, regionCatalog, isTr) => {
    const mapPins = [];
    const text = `${event.title || ""} ${event.description || ""}`.toLowerCase();

    // 1. Identify target region mentioned in the event
    let targetRegion = null;
    if (regionCatalog) {
        for (const region of regionCatalog) {
            if (region.name && text.includes(region.name.toLowerCase())) {
                targetRegion = region;
                break;
            }
        }
    }

    if (!targetRegion && event.impacts?.regionTransfers?.length > 0) {
        const regionId = event.impacts.regionTransfers[0].regionId;
        targetRegion = regionCatalog?.find((r) => r.id === regionId);
    }

    if (!targetRegion) {
        return mapPins;
    }

    const regionId = targetRegion.id;
    const regionName = targetRegion.name;

    // 2. Identify detailed pin types using comprehensive keyword mappings
    const isIndustry = text.includes("sanayi") || text.includes("fabrika") || text.includes("endüstri") || text.includes("industry") || text.includes("factory") || text.includes("üretim tesis");
    const isWarehouse = text.includes("depo") || text.includes("antrepo") || text.includes("lojistik") || text.includes("warehouse") || text.includes("depot") || text.includes("saklama alan");
    const isMilitaryBase = text.includes("askeri üs") || text.includes("askerî üs") || text.includes("tümen karargah") || text.includes("ordu karargah") || text.includes("mühimmat") || text.includes("kışla") || text.includes("military base") || text.includes("garrison") || text.includes("barracks") || text.includes("taktik üs");
    const isNavalBase = text.includes("liman") || text.includes("tersane") || text.includes("deniz üssü") || text.includes("port") || text.includes("shipyard") || text.includes("naval base") || text.includes("fırkateyn üssü");
    const isAirBase = text.includes("hava üssü") || text.includes("savaş uçağı üssü") || text.includes("airbase") || text.includes("hangar") || text.includes("pist") || text.includes("filo üssü") || text.includes("drone üssü");
    const isResearchLab = text.includes("laboratuvar") || text.includes("ar-ge") || text.includes("teknoloji merkezi") || text.includes("research lab") || text.includes("r&d") || text.includes("bilim") || text.includes("reaktör");

    if (isIndustry) {
        mapPins.push({
            id: `pin-industry-${regionId}`,
            name: isTr ? `${regionName} Sanayi Bölgesi` : `${regionName} Industrial Zone`,
            type: "industry",
            regionId,
        });
    }
    if (isWarehouse) {
        mapPins.push({
            id: `pin-warehouse-${regionId}`,
            name: isTr ? `${regionName} Lojistik Merkezi` : `${regionName} Logistics Center`,
            type: "warehouse",
            regionId,
        });
    }
    if (isMilitaryBase) {
        mapPins.push({
            id: `pin-milbase-${regionId}`,
            name: isTr ? `${regionName} Askeri Garnizonu` : `${regionName} Military Garrison`,
            type: "milbase",
            regionId,
        });
    }
    if (isNavalBase) {
        mapPins.push({
            id: `pin-naval-${regionId}`,
            name: isTr ? `${regionName} Deniz Üssü & Limanı` : `${regionName} Naval Base & Port`,
            type: "naval",
            regionId,
        });
    }
    if (isAirBase) {
        mapPins.push({
            id: `pin-airbase-${regionId}`,
            name: isTr ? `${regionName} Taktik Hava Üssü` : `${regionName} Tactical Airbase`,
            type: "airbase",
            regionId,
        });
    }
    if (isResearchLab) {
        mapPins.push({
            id: `pin-research-${regionId}`,
            name: isTr ? `${regionName} Bilim ve Araştırma Laboratuvarı` : `${regionName} Science & Research Lab`,
            type: "research",
            regionId,
        });
    }

    return mapPins;
};
