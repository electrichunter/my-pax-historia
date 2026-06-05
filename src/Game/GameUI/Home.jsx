import React, { useState } from "react";
import { activateGame, createGame, createScenario, removeGame, saveGame, useLibraryState } from "../../runtime/library.js";
import { loadPresets } from "../../runtime/presets.js";
import { ModEditorModal } from "./ModEditorModal.jsx";

const CURATED_COUNTRIES = [
  { name: "Türkiye", code: "TR" },
  { name: "Saudi Arabia", code: "SA" },
  { name: "Italy", code: "IT" },
  { name: "South Korea", code: "KR" },
  { name: "United Kingdom", code: "GB" },
  { name: "Germany", code: "DE" },
  { name: "Mexico", code: "MX" },
  { name: "Brazil", code: "BR" },
  { name: "Canada", code: "CA" },
  { name: "USA", code: "US" },
  { name: "France", code: "FR" },
  { name: "Japan", code: "JP" },
  { name: "Russia", code: "RU" },
  { name: "China", code: "CN" },
  { name: "India", code: "IN" },
  { name: "Spain", code: "ES" },
  { name: "Australia", code: "AU" },
  { name: "Egypt", code: "EG" },
  { name: "Iran", code: "IR" },
  { name: "Israel", code: "IL" },
];

const containerStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(10, 15, 25, 0.85)",
  backdropFilter: "blur(8px)",
  color: "white",
  fontFamily: "sans-serif",
  zIndex: 9000,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "2rem",
  padding: "1.5rem 3rem",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(17, 24, 39, 0.4)",
};

const tabStyle = (isActive) => ({
  background: "none",
  border: "none",
  color: isActive ? "#3b82f6" : "rgba(255,255,255,0.6)",
  fontSize: "1.2rem",
  fontWeight: isActive ? 700 : 500,
  cursor: "pointer",
  padding: "0.5rem 0",
  borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
  transition: "all 0.2s",
});

const contentStyle = {
  flex: 1,
  padding: "2rem 3rem",
  overflowY: "auto",
};

const sectionTitleStyle = {
  fontSize: "1.5rem",
  fontWeight: 700,
  marginBottom: "1.5rem",
  color: "rgba(255,255,255,0.9)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "1.5rem",
  marginBottom: "3rem",
};

const cardStyle = {
  background: "linear-gradient(180deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  cursor: "pointer",
  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
  position: "relative",
};

const cardHoverStyle = {
  transform: "translateY(-4px)",
  boxShadow: "0 12px 24px rgba(0,0,0,0.4)",
  borderColor: "rgba(59,130,246,0.5)",
};

const actionButtonStyle = {
  background: "rgba(59,130,246,0.2)",
  border: "1px solid rgba(59,130,246,0.4)",
  borderRadius: "8px",
  color: "rgba(219,234,254,0.9)",
  padding: "0.4rem 0.8rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  zIndex: 2,
};

const deleteButtonStyle = {
  ...actionButtonStyle,
  background: "rgba(239,68,68,0.2)",
  borderColor: "rgba(239,68,68,0.4)",
  color: "rgba(254,202,202,0.9)",
  position: "absolute",
  top: "1rem",
  right: "1rem",
  padding: "0.3rem 0.6rem",
};

const CountryCard = ({ country, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{ ...cardStyle, ...(isHovered ? cardHoverStyle : {}), justifyContent: "center", minHeight: "120px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(country)}
    >
      <div style={{ fontSize: "1.4rem", fontWeight: 700, textAlign: "center" }}>
        {country.name}
      </div>
    </div>
  );
};

const ModCard = ({ scenario, onSelect, onEdit, onClone, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{ ...cardStyle, ...(isHovered ? cardHoverStyle : {}), alignItems: "flex-start" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(scenario)}
    >
      <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.4rem", color: scenario.accentColor || "#fff" }}>
        {scenario.name}
      </div>
      {scenario.subtitle && (
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "1rem" }}>
          {scenario.subtitle}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", width: "100%" }}>
        <button
          style={{ ...actionButtonStyle, flex: 1, textAlign: "center" }}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(scenario);
          }}
        >
           Düzenle
        </button>
        {scenario.id !== "default" && (
           <button
            style={{ ...actionButtonStyle, flex: 1, textAlign: "center", background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={(e) => {
              e.stopPropagation();
              onClone(scenario);
            }}
          >
            Klonla
          </button>
        )}
      </div>
      
      {isHovered && scenario.canDelete && (
        <button
          style={deleteButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(scenario);
          }}
          title="Modu Sil"
        >
          Sil
        </button>
      )}
    </div>
  );
};

const SaveCard = ({ game, onClick, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        ...cardStyle,
        ...(isHovered ? cardHoverStyle : {}),
        alignItems: "flex-start",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.4rem", paddingRight: "3rem" }}>{game.name}</div>
      {game.subtitle && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "0.8rem" }}>{game.subtitle}</div>}
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", marginTop: "auto" }}>
        {new Date(game.updatedAt).toLocaleDateString()}
      </div>
      
      {isHovered && game.canDelete && (
        <button
          style={deleteButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(game);
          }}
          title="Oyunu Sil"
        >
          Sil
        </button>
      )}
    </div>
  );
};

const Home = ({ setCurrentScreen }) => {
  const { games, scenarios } = useLibraryState();
  const presets = loadPresets();
  const [activeTab, setActiveTab] = useState("secimler");
  const [step, setStep] = useState("mod_selection"); // "mod_selection" | "country_selection"
  const [selectedMod, setSelectedMod] = useState(null);
  const [editingModId, setEditingModId] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [appLanguage, setAppLanguage] = useState("Türkçe");

  const handleStartGameWithModAndCountry = async (country) => {
    if (isStarting || !selectedMod) return;
    setIsStarting(true);
    try {
      const newGame = await createGame({
        name: `${selectedMod.name} Session`,
        scenarioId: selectedMod.id,
        setActive: true,
      });
      await saveGame(newGame.game.id, {
        gamePatch: {
          country: country.name,
          gameDate: "2016-01-01",
          language: appLanguage,
        }
      });
      await activateGame(newGame.game.id);
      setCurrentScreen("game");
    } catch (error) {
      console.error("Failed to start game:", error);
      setIsStarting(false);
    }
  };

  const handleLoadGame = async (game) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      await activateGame(game.id);
      setCurrentScreen("game");
    } catch (error) {
      console.error("Failed to load game:", error);
      setIsStarting(false);
    }
  };

  const handleDeleteGame = async (game) => {
    if (window.confirm(`"${game.name}" adlı oyunu silmek istediğinize emin misiniz?`)) {
      try {
        await removeGame(game.id);
      } catch (error) {
        console.error("Failed to delete game:", error);
      }
    }
  };

  const handleApplyPreset = async (preset) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const newGame = await createGame({
        scenarioId: "default",
        country: preset.country || "",
        gameDate: preset.gameDate || "2016-01-01",
        difficulty: preset.difficulty,
        language: preset.language,
      });
      await activateGame(newGame.id);
      setCurrentScreen("game");
    } catch (error) {
      console.error("Failed to apply preset:", error);
      setIsStarting(false);
    }
  };

  const handleEditMod = (scenario) => {
    setEditingModId(scenario.id);
  };
  
  const handleNewMod = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const details = await createScenario({
        seedScenarioId: "default",
        name: "Yeni Mod",
        setActive: true,
      });
      setEditingModId(details.scenario.id);
    } catch (error) {
       console.error("Failed to create new scenario:", error);
    } finally {
       setIsStarting(false);
    }
  };

  const handleCloneMod = async (scenario) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const details = await createScenario({
        accentColor: scenario.accentColor,
        name: `${scenario.name} Copy`,
        seedScenarioId: scenario.id,
        setActive: true,
        subtitle: scenario.subtitle,
      });
      setEditingModId(details.scenario.id);
    } catch (error) {
       console.error("Failed to clone scenario:", error);
    } finally {
       setIsStarting(false);
    }
  };

  const handleDeleteMod = async (scenario) => {
    if (window.confirm(`"${scenario.name}" modunu kalıcı olarak silmek istediğinize emin misiniz?`)) {
      try {
        await removeScenario(scenario.id);
      } catch (error) {
        console.error("Failed to delete mod:", error);
      }
    }
  };


  return (
    <div style={containerStyle}>
      {editingModId && (
        <ModEditorModal 
          scenarioId={editingModId} 
          onClose={() => setEditingModId(null)} 
          onSaveComplete={() => setEditingModId(null)} 
        />
      )}
      <div style={headerStyle}>
        <div style={{ fontSize: "1.8rem", fontWeight: 900, marginRight: "2rem", color: "white" }}>
          PAX HISTORIA
        </div>
        <button style={tabStyle(activeTab === "secimler")} onClick={() => { setActiveTab("secimler"); setStep("mod_selection"); }}>
          Seçimler
        </button>
        <button style={tabStyle(activeTab === "tum_devletler")} onClick={() => setActiveTab("tum_devletler")}>
          Tüm Devletler
        </button>
        <button style={tabStyle(activeTab === "ozel")} onClick={() => setActiveTab("ozel")}>
          Özel
        </button>
        
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>Oyun Dili:</span>
          <select 
            value={appLanguage}
            onChange={(e) => setAppLanguage(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              padding: "0.4rem 0.8rem",
              borderRadius: "8px",
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.9rem"
            }}
          >
            <option value="Türkçe" style={{color: "black"}}>Türkçe</option>
            <option value="English" style={{color: "black"}}>English</option>
            <option value="Deutsch" style={{color: "black"}}>Deutsch</option>
            <option value="Français" style={{color: "black"}}>Français</option>
            <option value="Español" style={{color: "black"}}>Español</option>
          </select>
        </div>
      </div>

      <div style={contentStyle}>
        {activeTab === "secimler" && step === "mod_selection" && (
          <>
            <div style={sectionTitleStyle}>
               <span>Senaryolar (Modlar)</span>
               <button 
                 style={{ ...actionButtonStyle, background: "#10b981", borderColor: "#059669", color: "white" }}
                 onClick={handleNewMod}
                 disabled={isStarting}
               >
                 + Yeni Mod Ekle
               </button>
            </div>
            <div style={gridStyle}>
              {scenarios.map((scenario) => (
                <ModCard
                  key={scenario.id}
                  scenario={scenario}
                  onSelect={(scen) => {
                    setSelectedMod(scen);
                    setStep("country_selection");
                  }}
                  onEdit={handleEditMod}
                  onClone={handleCloneMod}
                  onDelete={handleDeleteMod}
                />
              ))}
            </div>
            
            {games && games.length > 0 && (
              <>
                <div style={sectionTitleStyle}>Önceki Oyunlar</div>
                <div style={gridStyle}>
                  {games.map((game) => (
                    <SaveCard
                      key={game.id}
                      game={game}
                      onClick={() => handleLoadGame(game)}
                      onDelete={handleDeleteGame}
                    />
                  ))}
                </div>
              </>
            )}

            {presets && presets.length > 0 && (
              <>
                <div style={sectionTitleStyle}>Favori Seçimler (Presetler)</div>
                <div style={gridStyle}>
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      style={{ ...cardStyle, alignItems: "flex-start" }}
                      onClick={() => handleApplyPreset(preset)}
                    >
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.4rem" }}>{preset.name}</div>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "0.8rem" }}>{`🌍 ${preset.country || "Unspecified"}`}</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", marginTop: "auto" }}>{new Date(preset.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "secimler" && step === "country_selection" && selectedMod && (
          <>
             <div style={sectionTitleStyle}>
               <span>{selectedMod.name} - Ülke Seçimi</span>
               <button 
                 style={{ ...actionButtonStyle, background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" }}
                 onClick={() => setStep("mod_selection")}
               >
                 Geri Dön
               </button>
             </div>
             {isStarting && (
               <div style={{ marginBottom: "1.5rem", color: "#3b82f6", fontWeight: 600 }}>
                 Yükleniyor... Lütfen bekleyin.
               </div>
             )}
             <div style={gridStyle}>
              {CURATED_COUNTRIES.map((country) => (
                <CountryCard key={country.code} country={country} onClick={handleStartGameWithModAndCountry} />
              ))}
            </div>
          </>
        )}

        {activeTab === "tum_devletler" && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: "4rem", fontSize: "1.2rem" }}>
            Bu bölüm yakında eklenecektir. Şu anda Seçimler sekmesinden oyuna başlayabilirsiniz.
          </div>
        )}

        {activeTab === "ozel" && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: "4rem", fontSize: "1.2rem" }}>
            Özel oyun kuralları ve editör ayarları yakında eklenecektir.
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
