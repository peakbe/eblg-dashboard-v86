import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

/* ----------------------------------------------------------
   PROXY GÉNÉRIQUE
---------------------------------------------------------- */
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing url");

  try {
    const r = await fetch(url);
    const data = await r.text();
    res.send(data);
  } catch (e) {
    res.status(500).send("Proxy error");
  }
});

/* ----------------------------------------------------------
   METAR SÉCURISÉ AVEC FALLBACK
---------------------------------------------------------- */
app.get("/metar", async (req, res) => {
  try {
    const response = await fetch(`https://avwx.rest/api/metar/EBLG`, {
      headers: { Authorization: process.env.AVWX_API_KEY }
    });

    if (!response.ok) throw new Error("AVWX offline");

    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error("AVWX DOWN → fallback activé");

    return res.json({
      station: "EBLG",
      flight_rules: "UNKNOWN",
      raw: "METAR unavailable",
      fallback: true,
      timestamp: new Date().toISOString()
    });
  }
});

/* ----------------------------------------------------------
   TAF SÉCURISÉ AVEC FALLBACK
---------------------------------------------------------- */
app.get("/taf", async (req, res) => {
  try {
    const response = await fetch(`https://avwx.rest/api/taf/EBLG`, {
      headers: { Authorization: process.env.AVWX_API_KEY }
    });

    if (!response.ok) throw new Error("AVWX offline");

    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error("AVWX TAF DOWN → fallback activé");

    return res.json({
      station: "EBLG",
      raw: "TAF unavailable",
      fallback: true,
      timestamp: new Date().toISOString()
    });
  }
});

/* ----------------------------------------------------------
   FIDS AVEC CORS + FALLBACK ROBUSTE
---------------------------------------------------------- */
app.get("/fids", async (req, res) => {
  try {
    const url = "https://opensky-network.org/api/flights/departure?airport=EBLG&begin=0&end=0";

    let response;
    try {
      response = await fetch(url, { timeout: 5000 });
    } catch (networkError) {
      console.error("Erreur réseau FIDS :", networkError);
      return res.json([
        {
          flight: "N/A",
          destination: "N/A",
          time: "N/A",
          status: "Unavailable",
          fallback: true,
          timestamp: new Date().toISOString()
        }
      ]);
    }

    if (!response.ok) {
      console.error("FIDS HTTP error :", response.status);
      return res.json([
        {
          flight: "N/A",
          destination: "N/A",
          time: "N/A",
          status: "Unavailable",
          fallback: true,
          timestamp: new Date().toISOString()
        }
      ]);
    }

    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error("FIDS DOWN → fallback activé :", error.message);

    return res.json([
      {
        flight: "N/A",
        destination: "N/A",
        time: "N/A",
        status: "Unavailable",
        fallback: true,
        timestamp: new Date().toISOString()
      }
    ]);
  }
});


/* ----------------------------------------------------------
   DÉMARRAGE DU SERVEUR (MANQUAIT !)
---------------------------------------------------------- */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
