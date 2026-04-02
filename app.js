// ======================================================
// IMPORTS
// ======================================================

// Carte
import { initMap } from "./js/map.js";

// Runways (important : doit être chargé avant METAR)
import "./js/runways.js";

// METAR / TAF / FIDS
import { loadMetar } from "./js/metar.js";
import { loadTaf } from "./js/taf.js";
import { loadFids } from "./js/fids.js";

// UI
import { initUI } from "./js/ui.js";


// ======================================================
// INITIALISATION
// ======================================================

window.onload = () => {

    // 1) Carte
    window.map = initMap();

    // 2) UI
    initUI();

    // 3) Données
    loadMetar();
    loadTaf();
    loadFids();
};
