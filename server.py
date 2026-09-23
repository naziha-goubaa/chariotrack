"""
CharioTrack — server.py (CORRIGÉ FINAL)
- Route / → sert index.html
- Clés JSON adaptées à CharioTrack_Final_MON_CABLAGE.ino
- Base de données avec les bonnes colonnes

LANCER :
  pip install flask flask-cors
  python server.py
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os

# Flask cherche index.html, style.css, app.js dans le même dossier
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DATABASE = "chariotrack.db"
HOST     = "0.0.0.0"
PORT     = 5000

# ══════════════════════════════════════════
# BASE DE DONNÉES
# ══════════════════════════════════════════

def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS mesures (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT    NOT NULL,
            statut    TEXT    DEFAULT 'ARRET',
            pos_x     REAL    DEFAULT 0,
            pos_y     REAL    DEFAULT 0,
            dist_cm   REAL    DEFAULT 0,
            batterie  INTEGER DEFAULT 0,
            dist_g    REAL    DEFAULT 999,
            dist_c    REAL    DEFAULT 999,
            dist_d    REAL    DEFAULT 999,
            acc_x     REAL    DEFAULT 0,
            acc_y     REAL    DEFAULT 0,
            acc_z     REAL    DEFAULT 1,
            ticks_g   INTEGER DEFAULT 0,
            ticks_d   INTEGER DEFAULT 0,
            choc      INTEGER DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS evenements (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            type      TEXT NOT NULL,
            message   TEXT NOT NULL,
            pos_x     REAL DEFAULT 0,
            pos_y     REAL DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()
    print("✅ Base de données prête.")

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Dernières données en mémoire
last_data = {
    "statut": "ARRET",
    "posX": 0, "posY": 0,
    "angle_deg": 0,
    "dist_cm": 0,
    "batterie": 0,
    "dist_g": 999, "dist_c": 999, "dist_d": 999,
    "acc_x": 0, "acc_y": 0, "acc_z": 1,
    "ticks_g": 0, "ticks_d": 0,
    "choc": False,
    "timestamp": now()
}

# ══════════════════════════════════════════
# ROUTE PRINCIPALE — sert index.html
# ══════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory('.', 'index.html')

# ══════════════════════════════════════════
# DONNÉES TEMPS RÉEL
# ══════════════════════════════════════════

@app.route("/data", methods=["GET"])
def get_data():
    return jsonify(last_data)


@app.route("/data", methods=["POST"])
def post_data():
    global last_data

    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON invalide"}), 400

    data["timestamp"] = now()
    last_data = data

    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO mesures
            (timestamp, statut, pos_x, pos_y, dist_cm, batterie,
             dist_g, dist_c, dist_d,
             acc_x, acc_y, acc_z,
             ticks_g, ticks_d, choc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["timestamp"],
        data.get("statut",   "ARRET"),
        data.get("posX",     0),
        data.get("posY",     0),
        data.get("dist_cm",  0),
        data.get("batterie", 0),
        data.get("dist_g",   999),
        data.get("dist_c",   999),
        data.get("dist_d",   999),
        data.get("acc_x",    0),
        data.get("acc_y",    0),
        data.get("acc_z",    1),
        data.get("ticks_g",  0),
        data.get("ticks_d",  0),
        1 if data.get("choc") else 0,
    ))

    # Événements automatiques
    if data.get("choc"):
        c.execute("""INSERT INTO evenements (timestamp,type,message,pos_x,pos_y)
                     VALUES (?,?,?,?,?)""",
                  (data["timestamp"], "choc",
                   f"Choc — accX={data.get('acc_x',0):.2f}g",
                   data.get("posX",0), data.get("posY",0)))

    if data.get("dist_g", 999) < 30:
        c.execute("""INSERT INTO evenements (timestamp,type,message,pos_x,pos_y)
                     VALUES (?,?,?,?,?)""",
                  (data["timestamp"], "obstacle",
                   f"Obstacle à {data.get('dist_g',0):.0f} cm",
                   data.get("posX",0), data.get("posY",0)))

    if data.get("batterie", 100) < 20:
        c.execute("""INSERT INTO evenements (timestamp,type,message,pos_x,pos_y)
                     VALUES (?,?,?,?,?)""",
                  (data["timestamp"], "batterie_faible",
                   f"Batterie faible : {data.get('batterie',0)}%",
                   data.get("posX",0), data.get("posY",0)))

    conn.commit()
    conn.close()

    print(f"[{data['timestamp']}] {data.get('statut')} | "
          f"HC-SR04: {data.get('dist_g')} cm | "
          f"Bat: {data.get('batterie')}% | "
          f"Choc: {data.get('choc')}")

    return jsonify({"ok": True, "timestamp": data["timestamp"]})

# ══════════════════════════════════════════
# HISTORIQUE
# ══════════════════════════════════════════

@app.route("/history", methods=["GET"])
def get_history():
    limit = request.args.get("limit", 500, type=int)
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM mesures ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/history/chocs", methods=["GET"])
def get_chocs():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM evenements WHERE type='choc' ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/history/evenements", methods=["GET"])
def get_evenements():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM evenements ORDER BY id DESC LIMIT 100")
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/history", methods=["DELETE"])
def delete_history():
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM mesures")
    c.execute("DELETE FROM evenements")
    conn.commit()
    conn.close()
    print("🗑️  Historique effacé.")
    return jsonify({"ok": True})

# ══════════════════════════════════════════
# STATISTIQUES
# ══════════════════════════════════════════

@app.route("/stats", methods=["GET"])
def get_stats():
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM mesures")
    total = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM evenements WHERE type='choc'")
    nb_chocs = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM evenements WHERE type='obstacle'")
    nb_obstacles = c.fetchone()[0]

    c.execute("SELECT MAX(dist_cm) FROM mesures")
    dist_max = c.fetchone()[0] or 0

    c.execute("SELECT MIN(batterie) FROM mesures")
    bat_min = c.fetchone()[0] or 0

    c.execute("SELECT MIN(timestamp), MAX(timestamp) FROM mesures")
    row = c.fetchone()
    debut, fin = row[0], row[1]

    conn.close()

    return jsonify({
        "total_mesures":    total,
        "nb_chocs":         nb_chocs,
        "nb_obstacles":     nb_obstacles,
        "distance_max_cm":  round(float(dist_max), 1),
        "batterie_min_pct": bat_min,
        "session_debut":    debut,
        "session_fin":      fin,
    })

# ══════════════════════════════════════════
# DÉMARRAGE
# ══════════════════════════════════════════

if __name__ == "__main__":
    print("═" * 50)
    print("  CharioTrack — Serveur Flask + SQLite")
    print("  ADAPTÉ à CharioTrack_Final_MON_CABLAGE")
    print("═" * 50)
    init_db()
    print(f"🚀 Serveur sur http://localhost:{PORT}")
    print(f"📡 En attente des données ESP32...")
    print(f"🌐 Dashboard : http://10.114.133.138:{PORT}")
    print("═" * 50)
    app.run(host=HOST, port=PORT, debug=True)