export class WorldGraph {
    constructor() {
        this.nodes = new Map(); // id -> node
        this.edges = []; // { source, target, type, data }
    }
    
    addNode(id, type, data) {
        this.nodes.set(id, { id, type, data });
    }
    
    addEdge(source, target, type, data = {}) {
        this.edges.push({ source, target, type, data });
    }
    
    getNodesByType(type) {
        return Array.from(this.nodes.values()).filter(n => n.type === type);
    }
    
    getEdges(sourceId, type = null) {
        return this.edges.filter(e => e.source === sourceId && (!type || e.type === type));
    }

    // Convert current JSON-based world state into graph
    static fromWorldState(bundle, regionCatalog, countryCatalog) {
        const graph = new WorldGraph();
        
        // Add countries
        for (const country of countryCatalog) {
            graph.addNode(country.code, "polity", { name: country.name, ...country });
        }
        
        // Add regions
        for (const region of regionCatalog) {
            const owner = bundle.world.regionOwnershipOverrides[region.id] || region.countryCode || "US";
            graph.addNode(region.id, "region", { name: region.name, owner });
            graph.addEdge(region.id, owner, "owned_by");
        }
        
        // Add dynamic pins (industries, armies)
        for (const pin of bundle.world.mapPins || []) {
            graph.addNode(pin.id, pin.type, pin);
            if (pin.regionId) {
                graph.addEdge(pin.id, pin.regionId, "located_in");
            }
        }
        
        return graph;
    }
}
