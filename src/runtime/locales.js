import "dayjs/locale/tr";
import "dayjs/locale/de";
import "dayjs/locale/fr";
import "dayjs/locale/es";
import { useState, useEffect } from "react";
import { readJson, JSON_URLS } from "./assets.js";

export const useLocale = () => {
    const [language, setLanguage] = useState("English");

    useEffect(() => {
        let cancelled = false;
        const fetchLang = () => {
            readJson(JSON_URLS.game, { defaultValue: {}, force: true })
            .then(data => { if (!cancelled && data.language) setLanguage(data.language); })
            .catch(() => {});
        };
        fetchLang();
        const iv = setInterval(fetchLang, 5000);
        return () => {
            cancelled = true;
            clearInterval(iv);
        };
    }, []);

    return getLocaleStrings(language);
};

export const getLocaleStrings = (language) => {
    const lang = language || "English";
    
    switch (lang) {
        case "Türkçe":
            return {
                code: "tr",
                dateFormat: "D MMMM YYYY",
                actionsTitle: "Aksiyonlar",
                submitDesc: (country, date) => `${date} tarihinde ${country} için aksiyonlarınızı belirleyin. Kararlarınız oyun dünyasının gidişatını etkileyecektir.`,
                helpBrainstorm: "Fikir fırtınası için yardım al",
                getAISuggestions: "Yapay zekadan tavsiye al",
                loadingSuggestions: "Yapay zeka tavsiyeleri yükleniyor...",
                refreshSuggestions: "Tavsiyeleri yenile",
                yourSubmitted: "GÖNDERİLEN AKSİYONLARINIZ",
                noActions: "Henüz aksiyon gönderilmedi.",
                enterAction: "Aksiyonunuzu girin...",
                timeSkip: "Zaman Atlama",
                jumpForward: "İleri Sar",
                autoJump: "Önemli Olaylara Kadar İlerle",
                eventsTitle: "Olaylar",
                historyTitle: "Zaman Çizelgesi",
                jumpDesc: "Bir süre belirleyerek zamanı hızlıca ileri sarın.",
                loadingTimeline: "Zaman çizelgesi işleniyor...",
                noEvents: "Henüz hiçbir olay kaydedilmedi.",
                noEventChain: "Henüz bir olay zinciri mevcut değil.",
                noWorldEvents: "Bu zaman atlaması için hiçbir dünya olayı kaydedilmedi.",
                showOnMap: "Haritada göster",
                revealNext: "Sonraki olayı göster",
                dur1w: "1 hafta",
                dur1m: "1 ay",
                dur3m: "3 ay",
                dur6m: "6 ay",
                dur1y: "1 yıl",
                chatTitle: "Sohbet",
                advisorTitle: "Danışman",
                clearChat: "Sohbeti temizle",
                askAdvisor: "Danışmanınıza sorun..."
            };
        case "Deutsch":
            return {
                code: "de",
                dateFormat: "D. MMMM YYYY",
                actionsTitle: "Aktionen",
                submitDesc: (country, date) => `Reichen Sie Aktionen für ${country} am ${date} ein. Ihre Aktionen werden die Spielwelt beeinflussen.`,
                helpBrainstorm: "Hilfe beim Brainstorming",
                getAISuggestions: "KI-Vorschläge erhalten",
                loadingSuggestions: "KI-Vorschläge werden geladen...",
                refreshSuggestions: "Vorschläge aktualisieren",
                yourSubmitted: "IHRE EINGEREICHTEN AKTIONEN",
                noActions: "Noch keine Aktionen eingereicht.",
                enterAction: "Geben Sie Ihre Aktion ein...",
                timeSkip: "Zeitsprung",
                jumpForward: "Vorspulen",
                autoJump: "Vorspulen bis zum nächsten wichtigen Ereignis",
                eventsTitle: "Ereignisse",
                historyTitle: "Zeitachse",
                jumpDesc: "Spulen Sie die Zeit um einen bestimmten Zeitraum vor.",
                loadingTimeline: "Zeitachse wird berechnet...",
                noEvents: "Es wurden noch keine Ereignisse aufgezeichnet.",
                noEventChain: "Noch keine Ereigniskette verfügbar.",
                noWorldEvents: "Für diesen Zeitsprung wurden keine Weltereignisse aufgezeichnet.",
                showOnMap: "Auf der Karte anzeigen",
                revealNext: "Nächstes Ereignis aufdecken",
                dur1w: "1 Woche",
                dur1m: "1 Monat",
                dur3m: "3 Monate",
                dur6m: "6 Monate",
                dur1y: "1 Jahr",
                chatTitle: "Chat",
                advisorTitle: "Berater",
                clearChat: "Chat leeren",
                askAdvisor: "Fragen Sie Ihren Berater..."
            };
        case "Français":
            return {
                code: "fr",
                dateFormat: "D MMMM YYYY",
                actionsTitle: "Actions",
                submitDesc: (country, date) => `Soumettez des actions pour ${country} pour le ${date}. Vos actions affecteront la réponse du monde du jeu.`,
                helpBrainstorm: "Aide à la réflexion d'actions",
                getAISuggestions: "Obtenir des suggestions de l'IA",
                loadingSuggestions: "Chargement des suggestions de l'IA...",
                refreshSuggestions: "Actualiser les suggestions",
                yourSubmitted: "VOS ACTIONS SOUMISES",
                noActions: "Aucune action soumise pour le moment.",
                enterAction: "Entrez votre action...",
                timeSkip: "Saut dans le temps",
                jumpForward: "Avancer rapidement",
                autoJump: "Avancer jusqu'à un événement important",
                eventsTitle: "Événements",
                historyTitle: "Chronologie",
                jumpDesc: "Avancez rapidement le temps sur une période définie.",
                loadingTimeline: "Calcul de la chronologie...",
                noEvents: "Aucun événement n'a encore été enregistré.",
                noEventChain: "Aucune chaîne d'événements n'est encore disponible.",
                noWorldEvents: "Aucun événement mondial n'a été enregistré pour ce saut dans le temps.",
                showOnMap: "Afficher sur la carte",
                revealNext: "Révéler l'événement suivant",
                dur1w: "1 semaine",
                dur1m: "1 mois",
                dur3m: "3 mois",
                dur6m: "6 mois",
                dur1y: "1 an",
                chatTitle: "Chat",
                advisorTitle: "Conseiller",
                clearChat: "Effacer le chat",
                askAdvisor: "Demandez à votre conseiller..."
            };
        case "Español":
            return {
                code: "es",
                dateFormat: "D de MMMM de YYYY",
                actionsTitle: "Acciones",
                submitDesc: (country, date) => `Envía acciones para ${country} el ${date}. Tus acciones afectarán cómo responde el mundo del juego.`,
                helpBrainstorm: "Ayuda para generar ideas",
                getAISuggestions: "Obtener sugerencias de IA",
                loadingSuggestions: "Cargando sugerencias de IA...",
                refreshSuggestions: "Actualizar sugerencias",
                yourSubmitted: "TUS ACCIONES ENVIADAS",
                noActions: "Aún no se han enviado acciones.",
                enterAction: "Ingresa tu acción...",
                timeSkip: "Salto de tiempo",
                jumpForward: "Avanzar",
                autoJump: "Avanzar hasta un evento importante",
                eventsTitle: "Eventos",
                historyTitle: "Cronología",
                jumpDesc: "Avanza rápidamente el tiempo en una cantidad establecida.",
                loadingTimeline: "Calculando la cronología...",
                noEvents: "Aún no se han registrado eventos.",
                noEventChain: "Aún no hay una cadena de eventos disponible.",
                noWorldEvents: "No se registraron eventos mundiales para este salto de tiempo.",
                showOnMap: "Mostrar en el mapa",
                revealNext: "Revelar el siguiente evento",
                dur1w: "1 semana",
                dur1m: "1 mes",
                dur3m: "3 meses",
                dur6m: "6 meses",
                dur1y: "1 año",
                chatTitle: "Chat",
                advisorTitle: "Asesor",
                clearChat: "Borrar chat",
                askAdvisor: "Pregúntale a tu asesor..."
            };
        case "English":
        default:
            return {
                code: "en",
                dateFormat: "MMMM Do, YYYY",
                actionsTitle: "Actions",
                submitDesc: (country, date) => `Submit actions for ${country} for ${date}. Your actions will affect how the game world responds.`,
                helpBrainstorm: "Help brainstorm actions",
                getAISuggestions: "Get AI suggestions",
                loadingSuggestions: "Loading AI suggestions...",
                refreshSuggestions: "Refresh AI suggestions",
                yourSubmitted: "YOUR SUBMITTED ACTIONS",
                noActions: "No actions submitted yet.",
                enterAction: "Enter your action...",
                timeSkip: "Time Skip",
                jumpForward: "Jump Forward",
                autoJump: "Auto-jump to notable event",
                eventsTitle: "Events",
                historyTitle: "History",
                jumpDesc: "Advance the simulation forward by a set amount of time.",
                loadingTimeline: "Processing timeline...",
                noEvents: "No events have been recorded yet.",
                noEventChain: "No event chain is available yet.",
                noWorldEvents: "No world events were recorded for this time skip.",
                showOnMap: "Show on map",
                revealNext: "Reveal next event",
                dur1w: "1 week",
                dur1m: "1 month",
                dur3m: "3 months",
                dur6m: "6 months",
                dur1y: "1 year",
                chatTitle: "Chat",
                advisorTitle: "Advisor",
                clearChat: "Clear chat",
                askAdvisor: "Ask your advisor..."
            };
    }
};
