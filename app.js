/* ----------------------------------------------------------
   CONSTANTES
---------------------------------------------------------- */

const PROXY = "https://eblg-proxy.onrender.com/proxy?url=";

// METAR via proxy (clé AVWX cachée côté Render)
const METAR_URL = "https://eblg-proxy.onrender.com/metar";

// FIDS via proxy Render
const FIDS_ARR = PROXY + encodeURIComponent("https://fids.liegeairport.com/api/flights/Arrivals");
const FIDS_DEP = PROXY + encodeURIComponent("https://fids.liegeairport.com/api/flights/Departures");

// Carte
const MAP_CENTER = [50.6374, 5.4432];
const MAP_ZOOM = 12;

/* ----------------------------------------------------------
   SONOMÈTRES (tes vrais points)
---------------------------------------------------------- */

const SONOS = [
  { id:"F017", lat:50.764883, lon:5.630606 },
  { id:"F001", lat:50.737, lon:5.608833 },
  { id:"F014", lat:50.718894, lon:5.573164 },
  { id:"F015", lat:50.688839, lon:5.526217 },
  { id:"F005", lat:50.639331, lon:5.323519 },
  { id:"F003", lat:50.601167, lon:5.3814 },
  { id:"F011", lat:50.601142, lon:5.356006 },
  { id:"F008", lat:50.594878, lon:5.35895 },
  { id:"F002", lat:50.588414, lon:5.370522 },
  { id:"F007", lat:50.590756, lon:5.345225 },
  { id:"F009", lat:50.580831, lon:5.355417 },
  { id:"F004", lat:50.605414, lon:5.321406 },
  { id:"F010", lat:50.599392, lon:5.313492 },
  { id:"F013", lat:50.586914, lon:5.308678 },
  { id:"F016", lat:50.619617, lon:5.295345 },
  { id:"F006", lat:50.609594, lon:5.271403 },
  { id:"F012", lat:50.621917, lon:5.254747 }
];

let sonometers = {}; // {id, lat, lon, marker, status}

/* ----------------------------------------------------------
   MAP LEAFLET
---------------------------------------------------------- */

let map;
let runwayLayer;
let sonometerLayer;

function initMap() {
  map = L.map("map", {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    preferCanvas: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  runwayLayer = L.layerGroup().addTo(map);
  sonometerLayer = L.layerGroup().addTo(map);

  initSonometers();
}

function initSonometers() {
  SONOS.forEach(s => {
    const marker = L.circleMarker([s.lat, s.lon], {
      radius: 6,
      color: "#4b5563",
      fillColor: "#9ca3af",
      fillOpacity: 0.9
    }).addTo(sonometerLayer);

    sonometers[s.id] = {
      id: s.id,
      lat: s.lat,
      lon: s.lon,
      marker,
      status: "neutral"
    };
  });
}

/* ----------------------------------------------------------
   METAR
---------------------------------------------------------- */

app.get("/metar", async (req, res) => {
  try {
    const url = `https://avwx.rest/api/metar/EBLG?format=json&token=${process.env.AVWX_API_KEY}`;

    const r = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "EBLG-Dashboard/1.0"
      }
    });

    if (!r.ok) {
      console.error("AVWX error:", await r.text());
      return res.status(500).json({ error: "Erreur AVWX" });
    }

    const data = await r.json();
    res.json(data);

  } catch (err) {
    console.error("Erreur METAR :", err);
    res.status(500).json({ error: "Erreur serveur METAR" });
  }
});


/* ----------------------------------------------------------
   FIDS FETCH
---------------------------------------------------------- */

async function fetchFIDS() {
  const [arr, dep] = await Promise.all([
    fetch(FIDS_ARR).then(r => r.json()),
    fetch(FIDS_DEP).then(r => r.json())
  ]);

  return {
    arrivals: Array.isArray(arr) ? arr : [],
    departures: Array.isArray(dep) ? dep : []
  };
}

/* ----------------------------------------------------------
   HELPERS FIDS
---------------------------------------------------------- */

function formatLocal(t) {
  if (!t) return "-";
  return new Date(t).toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels"
  });
}

function minutesFromNow(time) {
  if (!time) return "-";
  const now = new Date();
  const t = new Date(time);
  const diffMin = Math.round((t - now) / 60000);

  if (diffMin < -5) return `il y a ${Math.abs(diffMin)} min`;
  if (diffMin < 1) return "maintenant";
  return `dans ${diffMin} min`;
}

function isDelayed(v) {
  const sched = v.sTx || v.scheduled;
  const est = v.eTx;
  const act = v.aTx;

  if (!sched) return false;

  const s = new Date(sched);
  if (act && new Date(act) > s) return true;
  if (est && new Date(est) > s) return true;

  return false;
}

function flightColor(v) {
  if (v.flightPax && v.flightPax.startsWith("C")) return "#0ea5e9"; // Cargo
  return "#10b981"; // Pax
}

/* ----------------------------------------------------------
   MINI TABLEAU : Prochains vols
---------------------------------------------------------- */

function renderNextFlights(arrivals, departures) {
  const container = document.getElementById("next-flights");

  let html = "<strong>Arrivées</strong><br>";
  arrivals.forEach(f => {
    html += `
      <div class="flight-row">
        <strong>${f.flightPax || f.flight}</strong> → ${formatLocal(f.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(f.eTx)})</span>
      </div>
    `;
  });

  html += "<br><strong>Départs</strong><br>";
  departures.forEach(f => {
    html += `
      <div class="flight-row">
        <strong>${f.flightPax || f.flight}</strong> → ${formatLocal(f.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(f.eTx)})</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ----------------------------------------------------------
   LISTE FIDS PRINCIPALE
---------------------------------------------------------- */

function updateFlightsUI(f) {
  const el = document.getElementById("flights-list");

  if ((!f.arrivals.length) && (!f.departures.length)) {
    el.textContent = "Aucun vol FIDS disponible.";
    return;
  }

  let html = "";

  html += "<strong>Arrivées</strong><br>";
  f.arrivals.forEach(v => {
    const delayed = isDelayed(v);
    const color = flightColor(v);

    html += `
      <div class="flight-row" style="border-left:4px solid ${color}; padding-left:6px; margin-bottom:6px;">
        <strong>${v.flightPax || v.flight}</strong> → ${formatLocal(v.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(v.eTx)})</span>
        ${delayed ? `<span style="color:#b91c1c; font-weight:bold;"> RETARD</span>` : ""}
      </div>
    `;
  });

  html += "<br><strong>Départs</strong><br>";
  f.departures.forEach(v => {
    const delayed = isDelayed(v);
    const color = flightColor(v);

    html += `
      <div class="flight-row" style="border-left:4px solid ${color}; padding-left:6px; margin-bottom:6px;">
        <strong>${v.flightPax || v.flight}</strong> → ${formatLocal(v.eTx)}
        <span style="color:#6b7280;">(${minutesFromNow(v.eTx)})</span>
        ${delayed ? `<span style="color:#b91c1c; font-weight:bold;"> RETARD</span>` : ""}
      </div>
    `;
  });

  el.innerHTML = html;
}

/* ----------------------------------------------------------
   LIMITATION À 10 VOLS
---------------------------------------------------------- */

function limitNextFlights(list) {
  return list
    .filter(f => f.scheduled)
    .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled))
    .slice(0, 10);
}

/* ----------------------------------------------------------
   RUNWAY
---------------------------------------------------------- */

let currentRunway = null;

function extractRunway(fids) {
  const all = [...fids.arrivals, ...fids.departures];
  if (!all.length) return null;

  const counts = {};
  all.forEach(v => {
    if (!v.runway) return;
    counts[v.runway] = (counts[v.runway] || 0) + 1;
  });

  const entries = Object.entries(counts);
  if (!entries.length) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0] };
}

function drawRunwayAxis(rw) {
  runwayLayer.clearLayers();
  if (!rw) return;

  let coords;
  if (rw.name === "22") {
    coords = [
      [50.64594, 5.44375],
      [50.65480, 5.46530]
    ];
  } else if (rw.name === "04") {
    coords = [
      [50.65480, 5.46530],
      [50.64594, 5.44375]
    ];
  } else {
    return;
  }

  L.polyline(coords, {
    color: "#f97316",
    weight: 4
  }).addTo(runwayLayer);

  currentRunway = rw.name;
  document.getElementById("runway-info").textContent = `Piste active : ${rw.name}`;
}

/* ----------------------------------------------------------
   BOUTONS CARTE
---------------------------------------------------------- */

function initMapButtons() {
  document.getElementById("reset-map")?.addEventListener("click", () => {
    map.setView(MAP_CENTER, MAP_ZOOM);
  });

  document.getElementById("zoom-runway")?.addEventListener("click", () => {
    if (!currentRunway) return;

    if (currentRunway === "22") {
      map.fitBounds([
        [50.64594, 5.44375],
        [50.65480, 5.46530]
      ]);
    } else if (currentRunway === "04") {
      map.fitBounds([
        [50.65480, 5.46530],
        [50.64594, 5.44375]
      ]);
    }
  });

  document.getElementById("zoom-impacted")?.addEventListener("click", () => {
    const impacted = Object.values(sonometers).filter(s => s.status === "impact");
    if (!impacted.length) return;

    const bounds = L.latLngBounds(impacted.map(s => [s.lat, s.lon]));
    map.fitBounds(bounds.pad(0.3));
  });

  document.getElementById("zoom-global")?.addEventListener("click", () => {
    map.setView(MAP_CENTER, MAP_ZOOM);
  });
}

/* ----------------------------------------------------------
   REFRESH GLOBAL
---------------------------------------------------------- */

async function refresh() {
  try {
    const metar = await fetchMetar();
    updateMetarUI(metar);
  } catch (e) {
    document.getElementById("meteo-summary").textContent = "METAR indisponible";
  }

  const fids = await fetchFIDS();

  fids.arrivals = limitNextFlights(fids.arrivals);
  fids.departures = limitNextFlights(fids.departures);

  updateFlightsUI(fids);
  renderNextFlights(fids.arrivals, fids.departures);

  const rw = extractRunway(fids);
  if (!rw) {
    document.getElementById("runway-info").textContent = "Piste non déterminée.";
    return;
  }

  drawRunwayAxis(rw);
}

/* ----------------------------------------------------------
   INIT
---------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initMapButtons();
  refresh();
  setInterval(refresh, 60000);
});
