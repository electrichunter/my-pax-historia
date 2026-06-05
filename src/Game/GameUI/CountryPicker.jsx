import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCountryNames } from "../../runtime/assets.js";

const DROPDOWN_MAX_HEIGHT = "14rem";

const wrapperStyle = {
  position: "relative",
  width: "100%",
};

const inputBaseStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#f8fafc",
  fontSize: "0.9rem",
  outline: "none",
  padding: "0.8rem 0.9rem",
  width: "100%",
};

const dropdownStyle = {
  background: "linear-gradient(180deg, rgba(15,18,28,0.98) 0%, rgba(12,14,22,0.97) 100%)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "14px",
  boxShadow: "0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
  left: 0,
  maxHeight: DROPDOWN_MAX_HEIGHT,
  overflowY: "auto",
  position: "absolute",
  right: 0,
  scrollbarWidth: "thin",
  top: "calc(100% + 4px)",
  zIndex: 10050,
};

const itemBaseStyle = {
  alignItems: "center",
  border: "none",
  borderRadius: "10px",
  color: "rgba(244,246,255,0.9)",
  cursor: "pointer",
  display: "flex",
  fontSize: "0.84rem",
  gap: "0.6rem",
  justifyContent: "space-between",
  margin: "2px 4px",
  padding: "0.55rem 0.7rem",
  textAlign: "left",
  transition: "background 0.12s ease",
  width: "calc(100% - 8px)",
};

const codeTagStyle = {
  background: "rgba(255,255,255,0.08)",
  borderRadius: "6px",
  color: "rgba(200,210,230,0.6)",
  flexShrink: 0,
  fontSize: "0.68rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  padding: "0.18rem 0.4rem",
};

const emptyStyle = {
  color: "rgba(180,190,210,0.45)",
  fontSize: "0.78rem",
  fontStyle: "italic",
  padding: "0.9rem 0.8rem",
  textAlign: "center",
};

const clearButtonStyle = {
  alignItems: "center",
  background: "none",
  border: "none",
  borderRadius: "6px",
  color: "rgba(255,255,255,0.35)",
  cursor: "pointer",
  display: "flex",
  fontSize: "0.75rem",
  height: "1.4rem",
  justifyContent: "center",
  padding: 0,
  position: "absolute",
  right: "0.55rem",
  top: "50%",
  transform: "translateY(-50%)",
  transition: "color 0.15s ease",
  width: "1.4rem",
};

/**
 * Searchable country picker dropdown.
 *
 * Uses loadCountryNames() from assets.js to pull the full country list from
 * PMTiles data. Matches the project's inline-style glassmorphism design.
 *
 * @param {Object} props
 * @param {string} props.value       Current country name
 * @param {Function} props.onChange  Called with the selected country name string
 * @param {string} [props.placeholder]
 */
const CountryPicker = ({ value, onChange, placeholder = "Select a country…" }) => {
  const [countries, setCountries] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load country names on mount
  useEffect(() => {
    let cancelled = false;

    loadCountryNames()
      .then((list) => {
        if (!cancelled) {
          setCountries(list);
        }
      })
      .catch((error) => {
        console.warn("CountryPicker: failed to load country names", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.code && c.code.toLowerCase().includes(query)),
    );
  }, [countries, search]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered.length]);

  const handleSelect = useCallback(
    (country) => {
      onChange(country.name);
      setIsOpen(false);
      setSearch("");
      setHighlightedIndex(-1);
    },
    [onChange],
  );

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearch("");
  };

  const handleInputChange = (event) => {
    setSearch(event.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onChange("");
    setSearch("");
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        setIsOpen(true);
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1,
        );
        break;
      case "Enter":
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-country-item]");
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const displayValue = isOpen ? search : value || "";

  return (
    <div style={wrapperStyle} ref={wrapperRef}>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          style={{
            ...inputBaseStyle,
            borderColor: isOpen ? "rgba(124,58,237,0.45)" : "rgba(255,255,255,0.1)",
            paddingRight: value ? "2.2rem" : "0.9rem",
          }}
          value={displayValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        {value && !isOpen && (
          <button
            type="button"
            style={clearButtonStyle}
            onClick={handleClear}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.35)";
            }}
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div style={dropdownStyle} ref={listRef}>
          {filtered.length === 0 ? (
            <div style={emptyStyle}>
              {countries.length === 0
                ? "Loading countries…"
                : "No countries match your search"}
            </div>
          ) : (
            <div style={{ padding: "3px 0" }}>
              {filtered.map((country, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected =
                  value && country.name.toLowerCase() === value.toLowerCase();

                return (
                  <button
                    key={country.code || country.name}
                    type="button"
                    data-country-item
                    style={{
                      ...itemBaseStyle,
                      background: isHighlighted
                        ? "rgba(124,58,237,0.22)"
                        : isSelected
                          ? "rgba(124,58,237,0.12)"
                          : "transparent",
                    }}
                    onClick={() => handleSelect(country)}
                    onMouseEnter={(e) => {
                      setHighlightedIndex(index);
                      if (!isHighlighted) {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.06)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isHighlighted && !isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      {country.name}
                    </span>
                    {country.code && (
                      <span style={codeTagStyle}>{country.code}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CountryPicker;
