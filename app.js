/* ══════════════════════════════════════════
   CharioTrack — app.js  (CORRIGÉ — clés JSON adaptées à MON_CABLAGE)

   Clés JSON reçues depuis server.py (venant de l'ESP32) :
     statut, posX, posY, angle_deg, dist_cm,
     dist_g, dist_c, dist_d,
     acc_x, acc_y, acc_z,
     ticks_g, ticks_d,
     choc, batterie
   ══════════════════════════════════════════ */

// ════════════════════════════════════════
// 1. CONFIGURATION
// ════════════════════════════════════════

const CONFIG = {
  SERVER_URL:         "http://localhost:5000",
  REFRESH_MS:         1000,
  OBSTACLE_ALERT_CM:  30,
  SHOCK_THRESHOLD_G:  2.0,
  LOW_BATTERY_PCT:    20,
  MAX_PATH_POINTS:    500,
};

// ════════════════════════════════════════
// 2. ÉTAT GLOBAL
// ════════════════════════════════════════

const state = {
  connected: false, demoMode: false,
  pathPoints: [], shockPoints: [], obstaclePoints: [],
  lastData: null, demoAngle: 0, demoX: 0, demoY: 0,
  historyLoaded: false,
};

// ════════════════════════════════════════
// 3. HORLOGE
// ════════════════════════════════════════

function updateClock() {
  const n = new Date();
  document.getElementById("clock").textContent =
    `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}`;
}
setInterval(updateClock, 1000);
updateClock();

// ════════════════════════════════════════
// 4. COMMUNICATION AVEC LE SERVEUR FLASK
// ════════════════════════════════════════

async function fetchFromServer() {
  try {
    const r = await fetch(`${CONFIG.SERVER_URL}/data`, { signal: AbortSignal.timeout(900) });
    if (!r.ok) throw new Error();
    const data = await r.json();
    setConnectionStatus("online");
    return data;
  } catch {
    if (!state.demoMode) {
      setConnectionStatus("demo");
      addLog("Serveur non trouvé — Mode démonstration actif", "warning");
      addLog("Lance server.py puis rafraîchis la page", "info");
      state.demoMode = true;
    }
    return generateDemoData();
  }
}

async function fetchHistory()    { try { const r = await fetch(`${CONFIG.SERVER_URL}/history?limit=300`); return await r.json(); } catch { return []; } }
async function fetchStats()      { try { const r = await fetch(`${CONFIG.SERVER_URL}/stats`); return await r.json(); } catch { return null; } }
async function fetchEvenements() { try { const r = await fetch(`${CONFIG.SERVER_URL}/history/evenements`); return await r.json(); } catch { return []; } }

// ════════════════════════════════════════
// 5. DONNÉES DE DÉMONSTRATION
//    (clés identiques à celles de l'ESP32)
// ════════════════════════════════════════

function generateDemoData() {
  const t = Date.now() / 1000;
  state.demoAngle += 0.05;
  state.demoX += Math.cos(state.demoAngle) * 2;
  state.demoY += Math.sin(state.demoAngle) * 1.5;
  const distG = Math.sin(t/4) > 0.7 ? Math.round(15 + Math.random()*10) : Math.round(60 + Math.random()*40);
  const isShoc = Math.random() < 0.015;
  return {
    statut:    isShoc ? "CHOC" : Math.abs(Math.cos(state.demoAngle)) > 0.05 ? "AVANCE" : "ARRET",
    posX:      parseFloat(state.demoX.toFixed(1)),
    posY:      parseFloat(state.demoY.toFixed(1)),
    angle_deg: parseFloat((state.demoAngle * 180 / Math.PI).toFixed(1)),
    dist_cm:   parseFloat((Math.sqrt(state.demoX**2 + state.demoY**2)).toFixed(1)),
    batterie:  Math.max(5, 85 - Math.floor(t/60)),
    dist_g:    distG,
    dist_c:    999,   // 1 seul capteur dans mon câblage
    dist_d:    999,
    acc_x:     parseFloat((Math.sin(t*1.3)*0.3).toFixed(3)),
    acc_y:     parseFloat((Math.cos(t*0.9)*0.2).toFixed(3)),
    acc_z:     parseFloat((0.98 + Math.sin(t*2)*0.05).toFixed(3)),
    ticks_g:   Math.floor(t * 5),
    ticks_d:   Math.floor(t * 5),
    choc:      isShoc,
    source:    "demo",
  };
}

// ════════════════════════════════════════
// 6. MISE À JOUR DE L'AFFICHAGE
//    Utilise les bonnes clés : statut, posX, posY,
//    batterie, dist_g, dist_c, dist_d, acc_x/y/z, choc
// ════════════════════════════════════════

function updateDashboard(data) {
  state.lastData = data;

  const statusEl   = document.getElementById("val-status");
  const cardStatus = document.getElementById("card-status");

  // ----- Statut (ARRET / AVANCE / VIRAGE_GAUCHE / VIRAGE_DROITE / CHOC) -----
  const statut = (data.statut || "ARRET").toUpperCase();

  if (statut === "AVANCE") {
    statusEl.textContent = "En mouvement";
    statusEl.className   = "metric-value green";
    cardStatus.className = "metric-card";
  } else if (statut === "ARRET") {
    statusEl.textContent = "À l'arrêt";
    statusEl.className   = "metric-value yellow";
    cardStatus.className = "metric-card";
  } else if (statut === "VIRAGE_DROITE") {
    statusEl.textContent = "Virage Droite";
    statusEl.className   = "metric-value green";
    cardStatus.className = "metric-card";
  } else if (statut === "VIRAGE_GAUCHE") {
    statusEl.textContent = "Virage Gauche";
    statusEl.className   = "metric-value green";
    cardStatus.className = "metric-card";
  } else if (statut === "CHOC" || data.choc === true || data.choc === 1) {
    statusEl.textContent = "CHOC !";
    statusEl.className   = "metric-value red";
    cardStatus.className = "metric-card alert";
    showShockAlert();
    addLog(`⚠ Choc détecté à X:${data.posX} Y:${data.posY}`, "danger");
    state.shockPoints.push({ x: parseFloat(data.posX || 0), y: parseFloat(data.posY || 0) });
  }

  // ----- Position -----
  document.getElementById("val-pos").textContent =
    `X: ${parseFloat(data.posX || 0).toFixed(1)} / Y: ${parseFloat(data.posY || 0).toFixed(1)}`;

  // ----- Distance totale -----
  document.getElementById("val-dist").textContent =
    `${parseFloat(data.dist_cm || 0).toFixed(0)} cm`;

  // ----- Batterie -----
  const bat   = Math.round(data.batterie || 0);
  const batEl = document.getElementById("val-bat");
  batEl.textContent = `${bat}%`;
  batEl.className   = bat > 50 ? "metric-value green" : bat > CONFIG.LOW_BATTERY_PCT ? "metric-value orange" : "metric-value red";
  document.getElementById("card-bat").className =
    bat > 50 ? "metric-card" : bat > CONFIG.LOW_BATTERY_PCT ? "metric-card warning" : "metric-card alert";

  // ----- Capteurs ultrason -----
  // 1 seul capteur (Gauche = dist_g), Centre et Droite = 999
  updateSensor("left",   data.dist_g   || 999);
  updateSensor("center", data.dist_c   || 999);
  updateSensor("right",  data.dist_d   || 999);

  // Alerte obstacle
  if ((data.dist_g || 999) < CONFIG.OBSTACLE_ALERT_CM &&
      (!state._lastObstacleLog || Date.now() - state._lastObstacleLog > 5000)) {
    addLog(`Obstacle à ${Math.round(data.dist_g)} cm (capteur gauche)`, "warning");
    state._lastObstacleLog = Date.now();
    state.obstaclePoints.push({ x: parseFloat(data.posX || 0), y: parseFloat(data.posY || 0) });
  }

  // ----- Radar -----
  updateRadar(data.dist_g || 999, data.dist_c || 999, data.dist_d || 999);

  // ----- Accéléromètre -----
  updateAxis("x", parseFloat(data.acc_x || 0));
  updateAxis("y", parseFloat(data.acc_y || 0));
  updateAxis("z", parseFloat(data.acc_z || 1));

  // Gyroscope — pas envoyé par l'ESP32, on affiche 0
  document.getElementById("gx").textContent = "0°/s";
  document.getElementById("gy").textContent = "0°/s";
  document.getElementById("gz").textContent = "0°/s";

  // ----- Trajet -----
  state.pathPoints.push({ x: parseFloat(data.posX || 0), y: parseFloat(data.posY || 0) });
  if (state.pathPoints.length > CONFIG.MAX_PATH_POINTS) state.pathPoints.shift();
  drawMap();
}

// ════════════════════════════════════════
// 7. CAPTEURS ULTRASON
// ════════════════════════════════════════

function updateSensor(id, distCm) {
  // Si 999 = pas de capteur → afficher "--"
  if (distCm >= 999) {
    document.getElementById(`sbar-${id}`).style.width = "0%";
    document.getElementById(`sval-${id}`).textContent = "-- cm";
    return;
  }
  const pct = Math.min(100, Math.round((distCm / 100) * 100));
  document.getElementById(`sbar-${id}`).style.width      = `${pct}%`;
  document.getElementById(`sbar-${id}`).style.background =
    distCm < CONFIG.OBSTACLE_ALERT_CM ? "#ef4444" : distCm < 50 ? "#f97316" : "#22c55e";
  document.getElementById(`sval-${id}`).textContent = `${Math.round(distCm)} cm`;
}

// ════════════════════════════════════════
// 8. RADAR SVG
// ════════════════════════════════════════

const RCX = 150, RCY = 150, RMAX = 120;
function distToPx(cm) { return Math.min(RMAX, (Math.min(cm, 100) / 100) * RMAX); }
function pxy(deg, r)  { const a = ((deg - 90) * Math.PI) / 180; return { x: RCX + r * Math.cos(a), y: RCY + r * Math.sin(a) }; }

function updateRadar(dL, dC, dR) {
  setCone("cone-left",   -45, distToPx(dL), dL);
  setCone("cone-center",   0, distToPx(dC), dC);
  setCone("cone-right",  +45, distToPx(dR), dR);
}

function setCone(id, ang, r, cm) {
  if (cm >= 999) {
    document.getElementById(id).setAttribute("d", "");
    return;
  }
  const p1 = pxy(ang - 20, r), p2 = pxy(ang + 20, r);
  document.getElementById(id).setAttribute("d",
    `M ${RCX},${RCY} L ${p1.x.toFixed(1)},${p1.y.toFixed(1)} A ${r.toFixed(1)},${r.toFixed(1)} 0 0,1 ${p2.x.toFixed(1)},${p2.y.toFixed(1)} Z`
  );
  const c = cm < CONFIG.OBSTACLE_ALERT_CM ? "#ef4444" : cm < 50 ? "#f97316" : "#4ade80";
  document.getElementById(id).style.stroke = c;
  document.getElementById(id).style.fill   = c + "26";
}

// ════════════════════════════════════════
// 9. CARTE DE TRAJET
// ════════════════════════════════════════

function drawMap() {
  const canvas = document.getElementById("map-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0d150d"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1a2a1a"; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (!state.pathPoints.length) return;

  const xs = state.pathPoints.map(p => p.x), ys = state.pathPoints.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale  = Math.min((W - 60) / Math.max(maxX - minX, 50), (H - 60) / Math.max(maxY - minY, 50));
  const offX   = W / 2 - ((minX + maxX) / 2) * scale;
  const offY   = H / 2 + ((minY + maxY) / 2) * scale;
  const toS    = p => ({ sx: p.x * scale + offX, sy: -p.y * scale + offY });

  ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
  ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 4;
  ctx.beginPath();
  state.pathPoints.forEach((p, i) => {
    const { sx, sy } = toS(p);
    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
  });
  ctx.stroke(); ctx.shadowBlur = 0;

  state.obstaclePoints.forEach(p => {
    const { sx, sy } = toS(p);
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316"; ctx.fill();
  });
  state.shockPoints.forEach(p => {
    const { sx, sy } = toS(p);
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444"; ctx.fill();
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 7, sy - 7); ctx.lineTo(sx + 7, sy + 7);
    ctx.moveTo(sx + 7, sy - 7); ctx.lineTo(sx - 7, sy + 7);
    ctx.stroke();
  });

  const last = toS(state.pathPoints[state.pathPoints.length - 1]);
  ctx.beginPath(); ctx.arc(last.sx, last.sy, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#3b82f6"; ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 10;
  ctx.fill(); ctx.shadowBlur = 0;

  ctx.fillStyle = "#6b8f6b"; ctx.font = "10px 'Space Mono',monospace";
  const lp = state.pathPoints[state.pathPoints.length - 1];
  ctx.fillText(`X: ${lp.x.toFixed(1)} cm`, 10, 18);
  ctx.fillText(`Y: ${lp.y.toFixed(1)} cm`, 10, 32);
  ctx.fillText(`${state.pathPoints.length} pts`, W - 55, 18);
}

// ════════════════════════════════════════
// 10. ACCÉLÉROMÈTRE
// ════════════════════════════════════════

function updateAxis(axis, value) {
  const l = document.getElementById(`ax-${axis}`);
  l.textContent = `${value.toFixed(2)} g`;
  l.style.color = Math.abs(value) > CONFIG.SHOCK_THRESHOLD_G ? "#ef4444" : "#22c55e";
  const b   = document.getElementById(`axbar-${axis}`);
  const pct = Math.min(Math.abs(value) / 3, 1) * 50;
  b.style.left       = value >= 0 ? "50%" : `${50 - pct}%`;
  b.style.width      = `${pct}%`;
  b.style.background = Math.abs(value) > CONFIG.SHOCK_THRESHOLD_G ? "#ef4444" : "#22c55e";
}

// ════════════════════════════════════════
// 11. CONNEXION
// ════════════════════════════════════════

function setConnectionStatus(status) {
  const dot   = document.getElementById("conn-dot");
  const label = document.getElementById("conn-label");
  dot.className = `conn-dot ${status}`;
  if (status === "online") {
    label.textContent = "Connecté — Serveur Flask";
    if (!state.connected) {
      addLog("Connexion au serveur Flask établie", "ok");
      state.connected = true;
      state.demoMode  = false;
      loadHistoryFromDB();
    }
  } else if (status === "demo") {
    label.textContent = "Mode démo (serveur hors ligne)";
    state.connected = false;
  }
}

// ════════════════════════════════════════
// 12. CHARGEMENT HISTORIQUE DEPUIS DB
//     Utilise pos_x/pos_y (noms colonnes SQLite)
// ════════════════════════════════════════

async function loadHistoryFromDB() {
  if (state.historyLoaded) return;
  state.historyLoaded = true;
  addLog("Chargement de l'historique depuis SQLite...", "info");

  const rows = await fetchHistory();
  if (rows.length > 0) {
    const ordered = [...rows].reverse();
    // Colonnes SQLite : pos_x, pos_y
    state.pathPoints = ordered.map(r => ({ x: r.pos_x || 0, y: r.pos_y || 0 }));
    if (state.pathPoints.length > CONFIG.MAX_PATH_POINTS)
      state.pathPoints = state.pathPoints.slice(-CONFIG.MAX_PATH_POINTS);
    ordered.filter(r => r.choc === 1).forEach(r =>
      state.shockPoints.push({ x: r.pos_x || 0, y: r.pos_y || 0 })
    );
    drawMap();
    addLog(`${rows.length} mesures chargées depuis la base de données`, "ok");
  }

  const stats = await fetchStats();
  if (stats) updateStatsPanel(stats);

  const events = await fetchEvenements();
  events.slice(0, 15).forEach(e => {
    addLog(`[DB] ${e.message}`, e.type === "choc" ? "danger" : e.type === "obstacle" ? "warning" : "info");
  });
}

// ════════════════════════════════════════
// 13. STATISTIQUES
// ════════════════════════════════════════

function updateStatsPanel(stats) {
  const get = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  get("stat-db-mesures",   stats.total_mesures   || 0);
  get("stat-db-chocs",     stats.nb_chocs        || 0);
  get("stat-db-obstacles", stats.nb_obstacles    || 0);
  get("stat-db-distmax",   `${stats.distance_max_cm || 0} cm`);
  get("stat-db-batmin",    `${stats.batterie_min_pct || 0}%`);
  get("stat-db-debut",     stats.session_debut   || "--");
}
setInterval(async () => {
  if (state.connected) { const s = await fetchStats(); if (s) updateStatsPanel(s); }
}, 30000);

// ════════════════════════════════════════
// 14. ALERTES CHOC
// ════════════════════════════════════════

function showShockAlert() {
  const b = document.getElementById("shock-banner");
  b.classList.add("active");
  setTimeout(() => b.classList.remove("active"), 10000);
}
function dismissShock() { document.getElementById("shock-banner").classList.remove("active"); }

// ════════════════════════════════════════
// 15. JOURNAL
// ════════════════════════════════════════

let logEntries = [];
function addLog(message, type = "info") {
  const n    = new Date();
  const time = `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}`;
  logEntries.unshift({ time, message, type });
  if (logEntries.length > 60) logEntries.pop();
  renderLog();
}
function renderLog() {
  const ul = document.getElementById("event-log"); if (!ul) return;
  ul.innerHTML = logEntries.map(e =>
    `<li class="log-entry log-${e.type}"><span class="log-time">${e.time}</span><span class="log-msg">${e.message}</span></li>`
  ).join("");
}
function clearLog() { logEntries = []; renderLog(); addLog("Journal local effacé", "info"); }

// ════════════════════════════════════════
// 16. EFFACER LA BASE
// ════════════════════════════════════════

async function clearDatabase() {
  if (!confirm("Effacer tout l'historique de la base de données ?")) return;
  try {
    await fetch(`${CONFIG.SERVER_URL}/history`, { method: "DELETE" });
    state.pathPoints = []; state.shockPoints = []; state.obstaclePoints = [];
    state.historyLoaded = false;
    drawMap();
    addLog("Base de données effacée", "warning");
  } catch { addLog("Erreur : impossible d'effacer la base", "danger"); }
}

// ════════════════════════════════════════
// 17. RÉINITIALISER LE TRAJET
// ════════════════════════════════════════

function resetPath() {
  state.pathPoints = []; state.shockPoints = []; state.obstaclePoints = [];
  drawMap();
  addLog("Trajet réinitialisé (affichage uniquement)", "info");
}

// ════════════════════════════════════════
// 18. BOUCLE PRINCIPALE
// ════════════════════════════════════════

async function mainLoop() {
  const data = await fetchFromServer();
  updateDashboard(data);
}

addLog("Démarrage CharioTrack (câblage personnel)...", "info");
addLog(`Serveur Flask : ${CONFIG.SERVER_URL}`, "info");
addLog("HC-SR04 : 1 capteur actif (Gauche)", "info");
mainLoop();
setInterval(mainLoop, CONFIG.REFRESH_MS);