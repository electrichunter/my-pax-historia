import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Layer, Source, useMap, Marker } from "react-map-gl/maplibre";
import { onRegionSelected } from "../Selection/Regions";
import {
  JSON_URLS,
  PMTILES_PROTOCOL_URLS,
  ensurePmtilesProtocol,
  getNationColors,
  readJson,
} from "../../runtime/assets.js";
import { loadCountryLabelCollections } from "../../runtime/countryLabels.js";

ensurePmtilesProtocol();
const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

const buildCountryTextSize = (multiplier = 1) => ([
  "interpolate", ["exponential", 2], ["zoom"],
  0, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, -16]]],
  4, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, -12]]],
  8, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, -8]]],
  12, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, -4]]],
  16, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, 0]]],
  20, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, 4]]],
  24, ["*", multiplier, ["*", ["get", "areaScale"], ["^", 2, 8]]],
]);

const buildFallbackColorExpression = () => ([
  "rgb",
  ["+", 64, ["*", ["index-of", ["slice", ["get", "GID_0"], 0, 1], "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], 5]],
  ["+", 64, ["*", ["index-of", ["slice", ["get", "GID_0"], 2, 3], "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], 5]],
  ["+", 64, ["*", ["index-of", ["slice", ["get", "GID_0"], 1, 2], "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], 5]],
]);

const fallbackColorFromCode = (code = "") => {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized.length < 3) {
    return "rgb(96, 96, 96)";
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const a = Math.max(0, alphabet.indexOf(normalized[0]));
  const b = Math.max(0, alphabet.indexOf(normalized[1]));
  const c = Math.max(0, alphabet.indexOf(normalized[2]));
  return `rgb(${64 + a * 5}, ${64 + c * 5}, ${64 + b * 5})`;
};

const WorldMap = () => {
  const { current: map } = useMap();
  const [colorMap, setColorMap] = useState({});
  const [worldState, setWorldState] = useState({ regionOwnershipOverrides: {} });
  const [timelineOverrides, setTimelineOverrides] = useState(null);
  const [pointLabelData, setPointLabelData] = useState(EMPTY_FEATURE_COLLECTION);
  const [curvedLabelData, setCurvedLabelData] = useState(EMPTY_FEATURE_COLLECTION);
  const countriesUrl = PMTILES_PROTOCOL_URLS.countries;
  const regionsUrl = PMTILES_PROTOCOL_URLS.regions;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUpdate = (event) => {
      setTimelineOverrides(event.detail);
    };

    window.addEventListener("timeline-map-state-update", handleUpdate);
    return () => {
      window.removeEventListener("timeline-map-state-update", handleUpdate);
    };
  }, []);

  const activeWorldState = useMemo(() => {
    const baseState = worldState ?? { regionOwnershipOverrides: {}, polityOverrides: {} };
    if (timelineOverrides) {
      return {
        ...baseState,
        regionOwnershipOverrides: timelineOverrides.regionOwnershipOverrides ?? {},
        polityOverrides: timelineOverrides.polityOverrides ?? {},
      };
    }
    return baseState;
  }, [worldState, timelineOverrides]);

  const handleRegionClick = useCallback((event) => {
    const features = map.queryRenderedFeatures(event.point, { layers: ["regions-fill"] });
    if (!features.length) return;

    const { COUNTRY, NAME_1, GID_0, GID_1 } = features[0].properties;
    onRegionSelected({ COUNTRY, NAME_1, GID_0, GID_1, lngLat: event.lngLat });
  }, [map]);

  useEffect(() => {
    if (!map) return;
    map.on("click", handleRegionClick);
    return () => map.off("click", handleRegionClick);
  }, [handleRegionClick, map]);

  useEffect(() => {
    getNationColors()
      .then(setColorMap)
      .catch((error) => console.error("Error loading colors:", error));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorldState = () => {
      readJson(JSON_URLS.world, { defaultValue: {}, force: true })
        .then((data) => {
          if (!cancelled) {
            setWorldState(data ?? {});
          }
        })
        .catch((error) => console.error("Error loading world state:", error));
    };

    loadWorldState();
    const interval = setInterval(loadWorldState, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadCountryLabelCollections()
      .then(({ pointLabelData: pointLabels, curvedLabelData: curvedLabels }) => {
        if (cancelled) return;
        setPointLabelData(pointLabels);
        setCurvedLabelData(curvedLabels);
      })
      .catch((error) => console.error("Failed to load country labels:", error));

    return () => {
      cancelled = true;
    };
  }, []);

  const fillStyle = useMemo(() => {
    const resolvedColorMap = { ...colorMap };
    for (const [code, override] of Object.entries(activeWorldState?.polityOverrides ?? {})) {
      if (override?.color) {
        const hexMatch = /^#?([a-f0-9]{6})$/i.exec(override.color);
        if (hexMatch) {
          const hex = hexMatch[1];
          resolvedColorMap[code.toUpperCase()] = [
            Number.parseInt(hex.slice(0, 2), 16),
            Number.parseInt(hex.slice(2, 4), 16),
            Number.parseInt(hex.slice(4, 6), 16),
          ];
        }
      }
    }

    const stops = Object.entries(resolvedColorMap).flatMap(([iso, rgb]) => [
      iso, `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    ]);
    const fallback = buildFallbackColorExpression();
    const regionOverrideStops = Object.entries(activeWorldState?.regionOwnershipOverrides ?? {}).flatMap(([regionId, ownerCode]) => [
      regionId,
      resolvedColorMap[ownerCode]
        ? `rgb(${resolvedColorMap[ownerCode][0]}, ${resolvedColorMap[ownerCode][1]}, ${resolvedColorMap[ownerCode][2]})`
        : fallbackColorFromCode(ownerCode),
    ]);

    return {
      "fill-color": regionOverrideStops.length > 0
        ? [
          "match",
          ["get", "GID_1"],
          ...regionOverrideStops,
          stops.length > 0 ? ["match", ["get", "GID_0"], ...stops, fallback] : fallback,
        ]
        : stops.length > 0
        ? ["match", ["get", "GID_0"], ...stops, fallback]
        : fallback,
      "fill-opacity": 0.66,
    };
  }, [colorMap, activeWorldState]);

  const pointLabelLayerLayout = useMemo(() => ({
    "text-field": ["get", "name"],
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-size": buildCountryTextSize(),
    "text-rotate": ["get", "rotation"],
    "text-anchor": "center",
    "text-allow-overlap": true,
    "text-pitch-alignment": "map",
    "text-rotation-alignment": "map",
    "text-keep-upright": false,
  }), []);

  const curvedLabelLayerLayout = useMemo(() => ({
    "text-field": ["get", "glyph"],
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-size": buildCountryTextSize(),
    "text-rotate": ["get", "rotation"],
    "text-anchor": "center",
    "text-allow-overlap": true,
    "text-pitch-alignment": "map",
    "text-rotation-alignment": "map",
    "text-keep-upright": false,
  }), []);

  const labelLayerPaint = useMemo(() => ({
    "text-color": "#FFFFFF",
    "text-halo-color": "rgba(0, 0, 0, 0.5)",
    "text-halo-width": 1,
    "text-opacity": [
      "interpolate", ["linear"], ["zoom"],
      5, 0.75,
      8, 0,
    ],
  }), []);

  const [resolvedPins, setResolvedPins] = useState([]);

  useEffect(() => {
    const pins = activeWorldState?.mapPins ?? [];
    if (pins.length === 0) {
      setResolvedPins([]);
      return;
    }

    let cancelled = false;
    const resolveCoords = async () => {
      try {
        const [rBounds, cBounds] = await Promise.all([loadRegionBounds(), loadCountryBounds()]);
        if (cancelled) return;

        const nextPins = [];
        for (const pin of pins) {
          let coords = null;
          if (pin.regionId) {
            const bounds = rBounds.get(pin.regionId);
            if (bounds) {
              coords = [
                (bounds[0][0] + bounds[1][0]) / 2,
                (bounds[0][1] + bounds[1][1]) / 2,
              ];
            }
          }

          let fromCoords = null;
          if (pin.fromRegionId) {
            const bounds = rBounds.get(pin.fromRegionId);
            if (bounds) {
              fromCoords = [
                (bounds[0][0] + bounds[1][0]) / 2,
                (bounds[0][1] + bounds[1][1]) / 2,
              ];
            }
          }

          if (coords) {
            nextPins.push({
              ...pin,
              lng: coords[0],
              lat: coords[1],
              fromLng: fromCoords ? fromCoords[0] : null,
              fromLat: fromCoords ? fromCoords[1] : null,
            });
          }
        }

        setResolvedPins(nextPins);
      } catch (error) {
        console.error("Failed to resolve pin coords:", error);
      }
    };

    resolveCoords();
    return () => {
      cancelled = true;
    };
  }, [activeWorldState?.mapPins]);

  return (
    <>
      <Source id="countries-source" type="vector" url={countriesUrl}>
        <Layer
          id="countries-fill"
          type="fill"
          source-layer="countries"
          paint={fillStyle}
        />
        <Layer
          id="countries-outline"
          type="line"
          source-layer="countries"
          paint={{ "line-color": "#000", "line-width": 1 }}
        />
      </Source>

      <Source id="regions-source" type="vector" url={regionsUrl}>
        <Layer
          id="regions-fill"
          type="fill"
          source-layer="regions"
          paint={{ "fill-opacity": 0 }}
        />
        <Layer
          id="regions-outline"
          type="line"
          source-layer="regions"
          paint={{
            "line-color": "#000",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              3, 0.2,
              8, 0.6,
              12, 1.0,
            ],
            "line-opacity": [
              "interpolate", ["linear"], ["zoom"],
              3, 0,
              4, 0.4,
              8, 0.7,
            ],
          }}
        />
      </Source>

      <Source id="country-curved-label-source" type="geojson" data={curvedLabelData}>
        <Layer
          id="country-curved-labels"
          type="symbol"
          layout={curvedLabelLayerLayout}
          paint={labelLayerPaint}
        />
      </Source>

      <Source id="country-point-label-source" type="geojson" data={pointLabelData}>
        <Layer
          id="country-labels"
          type="symbol"
          layout={pointLabelLayerLayout}
          paint={labelLayerPaint}
        />
      </Source>

      {resolvedPins.map((pin) => (
        <AnimatedMarker key={pin.id} pin={pin} />
      ))}
    </>
  );
};

const AnimatedMarker = ({ pin }) => {
  const [pos, setPos] = useState({ lng: pin.fromLng || pin.lng, lat: pin.fromLat || pin.lat });

  useEffect(() => {
    if (pin.fromLng == null || pin.fromLat == null) {
      setPos({ lng: pin.lng, lat: pin.lat });
      return;
    }

    const startLng = pin.fromLng;
    const startLat = pin.fromLat;
    const endLng = pin.lng;
    const endLat = pin.lat;
    const duration = 2500;
    const startTime = performance.now();

    let animId;
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentLng = startLng + (endLng - startLng) * ease;
      const currentLat = startLat + (endLat - startLat) * ease;

      setPos({ lng: currentLng, lat: currentLat });

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [pin.lng, pin.lat, pin.fromLng, pin.fromLat]);

  const emojiMap = {
    industry: "🏭",
    warehouse: "📦",
    army: "🪖",
  };
  const emoji = emojiMap[pin.type] || "📍";

  return (
    <Marker longitude={pos.lng} latitude={pos.lat} anchor="center">
      <div
        style={{
          alignItems: "center",
          background: pin.type === "army" ? "rgba(220,38,38,0.95)" : "rgba(17,24,39,0.95)",
          border: pin.type === "army" ? "2px solid #ef4444" : "1px solid rgba(255,255,255,0.25)",
          borderRadius: "50%",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
          cursor: "pointer",
          display: "flex",
          fontSize: pin.type === "army" ? "1.3rem" : "1.05rem",
          height: pin.type === "army" ? "2.5rem" : "2.1rem",
          justifyContent: "center",
          position: "relative",
          transition: "transform 0.15s ease",
          width: pin.type === "army" ? "2.5rem" : "2.1rem",
        }}
        title={pin.name}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span>{emoji}</span>
        <div
          style={{
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            color: "white",
            fontSize: "0.68rem",
            fontWeight: "bold",
            marginTop: "0.25rem",
            padding: "0.15rem 0.35rem",
            position: "absolute",
            top: "100%",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {pin.name}
        </div>
      </div>
    </Marker>
  );
};

export default WorldMap;
