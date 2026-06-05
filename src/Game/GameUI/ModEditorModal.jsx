import React, { useState, useEffect, useRef } from "react";
import { loadScenarioDetails, saveScenario, uploadScenarioAsset } from "../../runtime/library.js";

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10000,
};

const modalStyle = {
  background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  width: "600px",
  maxWidth: "90vw",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  overflow: "hidden",
};

const headerStyle = {
  padding: "1.5rem",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const titleStyle = {
  fontSize: "1.4rem",
  fontWeight: 700,
  color: "white",
  margin: 0,
};

const contentStyle = {
  padding: "1.5rem",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "1.2rem",
};

const footerStyle = {
  padding: "1.2rem 1.5rem",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  display: "flex",
  justifyContent: "flex-end",
  gap: "1rem",
  background: "rgba(0,0,0,0.2)",
};

const labelStyle = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.7)",
  marginBottom: "0.4rem",
};

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "white",
  fontSize: "1rem",
  outline: "none",
  fontFamily: "inherit",
};

const buttonStyle = {
  padding: "0.6rem 1.2rem",
  borderRadius: "8px",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
};

export const ModEditorModal = ({ scenarioId, onClose, onSaveComplete }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [simulationRules, setSimulationRules] = useState("");
  const [startingTimelineText, setStartingTimelineText] = useState("");
  
  const [originalDetails, setOriginalDetails] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!scenarioId) return;
    
    loadScenarioDetails(scenarioId)
      .then((details) => {
        setOriginalDetails(details);
        setName(details.scenario.name || "");
        setSubtitle(details.scenario.subtitle || "");
        setGameDate(details.data?.game?.gameDate || "2016-01-01");
        setSimulationRules(details.data?.world?.simulationRules || "");
        setStartingTimelineText(details.data?.world?.startingTimelineText || "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [scenarioId]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Mod adı boş olamaz.");
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const currentGame = originalDetails?.data?.game ?? {};
      const currentWorld = originalDetails?.data?.world ?? {};
      
      await saveScenario(scenarioId, {
        name,
        subtitle,
        game: {
          ...currentGame,
          gameDate: gameDate,
        },
        world: {
          ...currentWorld,
          simulationRules: simulationRules,
          startingTimelineText: startingTimelineText,
        }
      });
      
      if (selectedFile) {
        await uploadScenarioAsset(scenarioId, "cover_image", selectedFile);
      }
      
      onSaveComplete();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (loading) {
    return (
      <div style={modalOverlayStyle}>
        <div style={{...modalStyle, padding: "2rem", alignItems: "center"}}>
          <div style={{color: "white"}}>Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Mod Düzenle</h2>
          <button 
            onClick={onClose}
            style={{background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.5rem", cursor: "pointer"}}
          >
            ×
          </button>
        </div>
        
        <div style={contentStyle}>
          {error && (
            <div style={{background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", padding: "0.75rem", borderRadius: "8px"}}>
              {error}
            </div>
          )}
          
          <div>
            <label style={labelStyle}>Mod Adı</label>
            <input 
              style={inputStyle} 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Örn: 2020 Pandemi Modu"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Kısa Açıklama</label>
            <input 
              style={inputStyle} 
              value={subtitle} 
              onChange={(e) => setSubtitle(e.target.value)} 
              placeholder="Örn: Korona virüsü ve küresel gerilim"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Başlangıç Tarihi</label>
            <input 
              style={inputStyle} 
              type="date"
              value={gameDate} 
              onChange={(e) => setGameDate(e.target.value)} 
            />
          </div>
          
          <div>
            <label style={labelStyle}>Senaryo Kuralları (Prompt)</label>
            <textarea 
              style={{...inputStyle, height: "100px", resize: "vertical"}} 
              value={simulationRules} 
              onChange={(e) => setSimulationRules(e.target.value)} 
              placeholder="Örn: Halkın mutluluğu ön plandadır. Ülkeler daha barışçıl davranır..."
            />
            <div style={{fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginTop: "0.4rem"}}>
              Oyunun kaderini belirleyecek genel yapay zeka kurallarını ve devletlerin karakteristiğini buraya yazın.
            </div>
          </div>
          
          <div>
            <label style={labelStyle}>Olaylar ve Tarihsel Arka Plan</label>
            <textarea 
              style={{...inputStyle, height: "100px", resize: "vertical"}} 
              value={startingTimelineText} 
              onChange={(e) => setStartingTimelineText(e.target.value)} 
              placeholder="Örn: 2025 yılında ABD ve İran arasında savaş çıkacak. Ekonomik kriz yaşanacak..."
            />
            <div style={{fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginTop: "0.4rem"}}>
              Oyun başladığında gerçekleşmiş olacak veya zamanla gerçekleşecek spesifik olayları buraya yazın.
            </div>
          </div>
          
          <div>
            <label style={labelStyle}>Kapak Görseli</label>
            <div style={{display: "flex", gap: "1rem", alignItems: "center"}}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{...buttonStyle, background: "rgba(255,255,255,0.1)", color: "white"}}
              >
                Görsel Seç
              </button>
              <span style={{fontSize: "0.9rem", color: "rgba(255,255,255,0.6)"}}>
                {selectedFile ? selectedFile.name : (originalDetails?.scenario?.coverImageContentType ? "Mevcut görsel yüklü" : "Görsel seçilmedi")}
              </span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                style={{display: "none"}} 
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>
        
        <div style={footerStyle}>
          <button 
            onClick={onClose}
            style={{...buttonStyle, background: "transparent", color: "rgba(255,255,255,0.7)"}}
          >
            İptal
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            style={{
              ...buttonStyle, 
              background: saving ? "rgba(59,130,246,0.5)" : "#3b82f6", 
              color: "white"
            }}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
};
