# CharioTrack

## Système IoT de suivi de chariot en temps réel

CharioTrack est un **prototype IoT embarqué** conçu pour assurer la supervision intelligente et continue d'un chariot.

Le système permet de surveiller en temps réel les mouvements du chariot, les obstacles situés devant lui, sa position, sa distance parcourue et son niveau de batterie. Les données collectées par l'ESP32 sont transmises par Wi-Fi à un serveur Flask, enregistrées dans une base de données SQLite puis visualisées à travers un tableau de bord Web interactif.

## Le projet a été réalisé dans le cadre du module **Internet des objets**, durant l'année universitaire **2025-2026**, par **Yosser Ayadi** et **Naziha Goubaa**.

## Table des matières

* [Présentation](#présentation)
* [Problématique](#problématique)
* [Objectifs](#objectifs)
* [Fonctionnalités](#fonctionnalités)
* [Architecture du système](#architecture-du-système)
* [Flux de données](#flux-de-données)
* [Matériel utilisé](#matériel-utilisé)
* [Mesure de la batterie](#mesure-de-la-batterie)
* [Odométrie et calcul de position](#odométrie-et-calcul-de-position)
* [Backend et API REST](#backend-et-api-rest)
* [Base de données](#base-de-données)
* [Tableau de bord Web](#tableau-de-bord-web)
* [Bibliothèques embarquées](#bibliothèques-embarquées)
* [Tests](#tests)
* [Structure du projet](#structure-du-projet)
* [Installation](#installation)
* [Configuration](#configuration)
* [Lancement](#lancement)
* [Sécurité](#sécurité)
* [Résultats](#résultats)
* [Difficultés rencontrées](#difficultés-rencontrées)
* [Perspectives](#perspectives)
* [Documentation](#documentation)
* [Auteurs](#auteurs)

---

## Présentation

La gestion d'un chariot peut présenter plusieurs difficultés, notamment les collisions, les pertes, le manque de suivi en temps réel et la nécessité d'une surveillance manuelle.

CharioTrack propose une solution IoT permettant de centraliser les informations provenant du chariot et de les rendre accessibles depuis un navigateur Web sur le réseau local.

Le système combine :

* un microcontrôleur ESP32 ;
* plusieurs capteurs physiques ;
* une communication Wi-Fi ;
* un serveur Flask ;
* une base de données SQLite ;
* une interface Web en HTML, CSS et JavaScript.

---

## Problématique

Le projet répond principalement aux besoins suivants :

* détecter les mouvements et l'arrêt du chariot ;
* détecter les chocs ;
* détecter les obstacles situés devant le chariot ;
* suivre la position du chariot ;
* mesurer la distance parcourue ;
* surveiller le niveau de batterie ;
* enregistrer l'historique des données ;
* visualiser les informations à distance sur une interface Web.

---

## Objectifs

Les principaux objectifs de CharioTrack sont :

1. Détecter les mouvements, l'arrêt et les chocs du chariot à l'aide du MPU-6050.
2. Mesurer la distance aux obstacles à l'aide du HC-SR04.
3. Calculer la position X/Y et la distance parcourue grâce à l'odométrie.
4. Mesurer le niveau de batterie d'une cellule Li-ion 18650.
5. Stocker les données dans SQLite via un serveur Flask.
6. Afficher les informations dans un tableau de bord Web en temps réel.

---

## Fonctionnalités

### Détection des mouvements et des chocs

Le capteur MPU-6050 permet de mesurer l'accélération et le mouvement du chariot.

Le système exploite ces données pour détecter notamment :

* le mouvement ;
* l'arrêt ;
* les chocs.

### Détection des obstacles

Le HC-SR04 permet de mesurer la distance entre le chariot et les obstacles situés devant lui.

En cas d'obstacle, le système peut déclencher des alertes sonores et visuelles grâce au buzzer et à la LED rouge.

### Localisation par odométrie

La position X/Y du chariot est calculée à partir des ticks générés par les disques codeurs associés aux roues.

Cette approche permet de calculer :

* la distance parcourue ;
* l'angle de déplacement ;
* la position X ;
* la position Y.

### Surveillance de la batterie

La tension de la batterie Li-ion 18650 est mesurée à l'aide d'un pont diviseur de tension connecté à l'ADC de l'ESP32.

Cette méthode permet d'obtenir une estimation du niveau de batterie tout en protégeant l'entrée ADC de l'ESP32.

### Transmission des données

L'ESP32 transmet les données au serveur Flask via Wi-Fi et HTTP.

Les données sont envoyées sous forme de JSON puis enregistrées dans SQLite.

### Historique

Les données reçues sont enregistrées afin de permettre la consultation de l'historique des mesures et des statistiques de session.

### Tableau de bord Web

L'interface Web permet de visualiser notamment :

* le statut du chariot ;
* la position X/Y ;
* les distances ultrasoniques ;
* les données de l'accéléromètre ;
* le niveau de batterie ;
* la carte de trajet ;
* le journal des événements horodatés.

---

## Architecture du système

CharioTrack est organisé en trois couches principales.

```text
                         CHARIOTRACK
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
          Hardware         Backend          Frontend
              |               |               |
            ESP32           Flask        HTML/CSS/JS
              |               |               |
       +------+------+        |               |
       |      |     |         |               |
     MPU-6050 HC-SR04 LM393   |               |
       |      |     |         |               |
       +------+------+         |               |
              |                |               |
              +------ Wi-Fi ---+               |
                     HTTP POST                 |
                            |                  |
                            v                  |
                         SQLite <----- HTTP GET
                                               |
                                               v
                                      Tableau de bord
```

### Couche Hardware

L'ESP32 constitue le cœur du système. Il assure notamment :

* la connexion Wi-Fi ;
* la communication I2C ;
* l'utilisation des GPIO ;
* la lecture ADC ;
* la gestion des interruptions.

Il communique avec le MPU-6050, les capteurs ultrasoniques, les encodeurs LM393 et le circuit de mesure de batterie.

### Couche Backend

Le serveur Python Flask reçoit les données JSON envoyées par l'ESP32, les stocke dans SQLite puis les rend disponibles à l'interface Web.

### Couche Frontend

L'interface Web développée avec HTML, CSS et JavaScript interroge le serveur toutes les secondes afin de mettre à jour les informations affichées.

---

## Flux de données

Le flux complet du système est :

```text
Capteurs
   |
   v
ESP32
   |
   | Wi-Fi / HTTP POST
   v
Serveur Flask
   |
   v
SQLite
   |
   | HTTP GET
   v
Navigateur Web
   |
   v
Tableau de bord
```

Cette architecture permet de séparer l'acquisition des données, leur stockage et leur visualisation.

---

## Matériel utilisé

| Composant             | Quantité | Fonction                                                |
| --------------------- | -------: | ------------------------------------------------------- |
| ESP32 DevKit          |        1 | Microcontrôleur, Wi-Fi, GPIO, I2C, ADC et interruptions |
| MPU-6050              |        1 | Accéléromètre et gyroscope, détection des chocs         |
| HC-SR04               |        3 | Mesure des distances aux obstacles                      |
| LM393 + disque codeur |        2 | Comptage des ticks des roues                            |
| Batterie Li-ion 18650 |        1 | Alimentation principale                                 |
| Porte-pile 18650      |        1 | Support de la batterie                                  |
| Module Boost 5V       |        1 | Conversion 3,7 V vers 5 V                               |
| Résistance 10 kΩ      |        1 | Pont diviseur de batterie                               |
| Résistance 20 kΩ      |        1 | Pont diviseur de batterie                               |
| LED rouge             |        1 | Alerte visuelle                                         |
| Résistance 220 Ω      |        1 | Limitation du courant de la LED                         |
| Buzzer actif          |        1 | Alerte sonore                                           |
| Breadboard            |        1 | Montage électronique                                    |
| Câbles Dupont         |      ~40 | Connexions des composants                               |

Les composants et leurs rôles sont détaillés dans le rapport du projet.

---

## Mesure de la batterie

La batterie utilisée est une cellule Li-ion 18650 dont la tension peut atteindre **4,2 V** lorsqu'elle est complètement chargée.

L'ESP32 accepte au maximum environ **3,3 V** sur ses entrées ADC. Un pont diviseur est donc utilisé pour réduire la tension avant de l'appliquer au GPIO33.

La configuration documentée utilise :

```text
R1 = 10 kΩ
R2 = 20 kΩ
```

Le calcul présenté dans le rapport est :

```text
Vadc = Vbat × R2 / (R1 + R2)

Vadc = 4,2 × 20 / (10 + 20)

Vadc = 2,80 V
```

La tension obtenue reste donc inférieure à 3,3 V.

Cette méthode présente plusieurs avantages :

* simplicité ;
* faible coût ;
* mesure indicative du niveau de batterie ;
* compatibilité avec l'ADC de l'ESP32.

---

## Odométrie et calcul de position

La position est calculée sans GPS, à partir du comptage des ticks des disques codeurs.

Chaque fenêtre du disque codeur correspond à un tick compté par interruption GPIO.

### Distance

La distance est calculée selon :

```text
d = ticks × (π × diamètre_roue / ticks_par_tour)
```

### Angle

La variation d'angle est calculée selon :

```text
Δθ = (d_droite - d_gauche) / écartement_roues
```

### Position

La position X/Y est ensuite mise à jour avec :

```text
X += d_moy × cos(θ)

Y += d_moy × sin(θ)
```

## Cette méthode permet de reconstruire la trajectoire du chariot à partir des déplacements des roues.

## Backend et API REST

Le backend est développé avec **Python Flask**.

Le serveur reçoit les données provenant de l'ESP32, les enregistre dans SQLite et fournit les informations nécessaires au tableau de bord Web.

### Endpoints

| Méthode | Endpoint   | Description                                      |
| ------- | ---------- | ------------------------------------------------ |
| GET     | `/data`    | Récupération des dernières données en temps réel |
| POST    | `/data`    | Réception des données envoyées par l'ESP32       |
| GET     | `/history` | Récupération de l'historique des mesures         |
| GET     | `/stats`   | Récupération des statistiques de session         |
| DELETE  | `/history` | Suppression de l'historique                      |

Ces endpoints sont documentés dans le rapport du projet.

---

## Base de données

CharioTrack utilise **SQLite** pour stocker les données collectées par le système.

La base locale utilisée pendant l'exécution est :

```text
chariotrack.db
```

Les données enregistrées comprennent notamment :

* horodatage ;
* statut ;
* position X/Y ;
* distance parcourue ;
* niveau de batterie ;
* distances mesurées ;
* accélérations ;
* ticks des roues ;
* événements liés aux chocs.

La base permet également de conserver l'historique nécessaire aux statistiques et à la visualisation du trajet.

Dans le dépôt GitHub, la base SQLite locale est ignorée afin de ne pas versionner les données générées pendant les essais.

---

## Tableau de bord Web

Le frontend est développé avec :

```text
HTML
CSS
JavaScript
```

Il interroge le serveur toutes les secondes afin de récupérer les nouvelles données.

Le tableau de bord permet notamment de visualiser :

* le statut du chariot ;
* la position X/Y ;
* les distances aux obstacles ;
* les données de l'accéléromètre ;
* le niveau de batterie ;
* la trajectoire ;
* les événements horodatés.

L'interface est accessible depuis un navigateur connecté au même réseau local que le serveur.

---

## Bibliothèques embarquées

Le programme ESP32 utilise notamment les bibliothèques suivantes :

| Bibliothèque    | Rôle                                      |
| --------------- | ----------------------------------------- |
| `Wire.h`        | Communication I2C                         |
| `MPU6050.h`     | Lecture du MPU-6050                       |
| `WiFi.h`        | Connexion Wi-Fi                           |
| `HTTPClient.h`  | Envoi des requêtes HTTP                   |
| `ArduinoJson.h` | Création et manipulation des données JSON |

Ces bibliothèques sont documentées dans le rapport du projet.

---

## Tests

Le projet a suivi une méthodologie de test composant par composant avant l'intégration finale.

Chaque test a été réalisé en téléversant le programme correspondant sur l'ESP32 puis en utilisant le moniteur série à **115200 bauds**.

| Test                 | Composant      | Résultat attendu                                  |
| -------------------- | -------------- | ------------------------------------------------- |
| `TEST1_WiFi.ino`     | Wi-Fi ESP32    | Obtention de l'adresse IP et informations réseau  |
| `TEST2_MPU6050.ino`  | MPU-6050       | Variation des valeurs AccX/AccY/AccZ              |
| `TEST3_HCSR04.ino`   | HC-SR04        | Mesure des distances en cm                        |
| `TEST4_LM393.ino`    | LM393 + disque | Augmentation des ticks lors de la rotation        |
| `TEST5_Batterie.ino` | Pont diviseur  | Mesure de la tension et estimation du pourcentage |

Les tests individuels ont été validés avant l'intégration complète du système.

---

## Structure du projet

```text
CharioTrack/
│
├── CharioTrack.ino          # Programme embarqué ESP32
│
├── server.py                # Serveur Flask et API REST
├── app.js                   # Logique du tableau de bord
├── index.html               # Interface Web
├── style.css                # Styles de l'interface
│
├── requirements.txt         # Dépendances Python
├── .gitignore               # Fichiers exclus de Git
│
├── docs/
│   ├── Présentation.pdf     # Présentation du projet
│   └── Rapport.pdf          # Rapport technique
│
└── chariotrack.db           # Base SQLite locale
```

---

## Installation

### Prérequis

Pour exécuter la partie serveur :

* Python 3 ;
* pip ;
* navigateur Web.

Pour la partie embarquée :

* Arduino IDE ;
* support ESP32 ;
* carte ESP32 DevKit ;
* composants électroniques du projet.

### Cloner le projet

```bash
git clone https://github.com/naziha-goubaa/chariotrack.git
```

Puis :

```bash
cd chariotrack
```

### Installer les dépendances

Le fichier `requirements.txt` contient :

```text
Flask==3.0.3
flask-cors==4.0.1
```

Installation :

```bash
py -m pip install -r requirements.txt
```

---

## Configuration

Avant de programmer l'ESP32, configurer les paramètres Wi-Fi et l'adresse du serveur dans :

```text
CharioTrack.ino
```

Le dépôt utilise des valeurs génériques pour éviter de publier des identifiants réseau :

```cpp
const char* SSID       = "YOUR_WIFI_SSID";
const char* PASSWORD   = "YOUR_WIFI_PASSWORD";
```

Il faut remplacer ces valeurs uniquement dans l'environnement local de développement.

L'adresse IP du PC exécutant Flask doit également être configurée afin que l'ESP32 puisse communiquer avec le serveur.

---

## Lancement du serveur

Démarrer le serveur Flask avec :

```bash
py server.py
```

Le serveur est utilisé comme intermédiaire entre l'ESP32, SQLite et l'interface Web.

L'adresse locale utilisée par le frontend est :

```text
http://localhost:5000
```

Pour une communication avec l'ESP32, utiliser l'adresse IP locale de la machine exécutant le serveur.

---

## Lancement du tableau de bord

Une fois le serveur démarré, ouvrir :

```text
index.html
```

dans un navigateur.

Le navigateur interroge l'API Flask afin de récupérer les données du chariot.

Pour un fonctionnement complet :

1. connecter l'ESP32 au réseau Wi-Fi ;
2. démarrer le serveur Flask ;
3. vérifier l'adresse IP du serveur dans le programme ESP32 ;
4. téléverser le programme sur l'ESP32 ;
5. ouvrir le tableau de bord Web.

---

## Programmation de l'ESP32

Le programme principal est :

```text
CharioTrack.ino
```

Il assure notamment :

* l'initialisation des capteurs ;
* la connexion Wi-Fi ;
* la lecture du MPU-6050 ;
* la lecture des capteurs ultrasoniques ;
* le comptage des ticks des roues ;
* la mesure de la batterie ;
* le calcul de l'odométrie ;
* la création des données JSON ;
* l'envoi des données au serveur Flask.

Les bibliothèques nécessaires doivent être installées dans Arduino IDE avant la compilation.

---

## Sécurité

Certaines précautions sont nécessaires pour un déploiement réel.

### Identifiants Wi-Fi

Les identifiants Wi-Fi ne doivent pas être publiés dans un dépôt public.

Le code versionné utilise donc :

```text
YOUR_WIFI_SSID
YOUR_WIFI_PASSWORD
```

### Protection électrique

Le projet utilise des ponts diviseurs afin de protéger les entrées de l'ESP32 contre des tensions supérieures à celles acceptées par ses GPIO/ADC.

Le rapport insiste notamment sur la nécessité de protéger les entrées de l'ESP32 lors de l'utilisation du HC-SR04 et de la mesure de batterie.

### API

Pour une utilisation au-delà du réseau local, il serait recommandé d'ajouter une authentification et de sécuriser les communications entre le système embarqué et le serveur.

---

## Résultats

L'intégration finale du projet permet de réaliser les fonctionnalités suivantes :

* détection du mouvement, de l'arrêt et des chocs ;
* détection des obstacles frontaux ;
* alertes sonores et visuelles ;
* calcul de la position X/Y ;
* calcul de la distance parcourue ;
* mesure du niveau de batterie ;
* transmission Wi-Fi des données ;
* stockage historique dans SQLite ;
* tableau de bord Web interactif en temps réel.

Le système permet ainsi de mettre en œuvre une chaîne IoT complète allant de l'acquisition des données jusqu'à leur visualisation.

---

## Difficultés rencontrées

Le développement du prototype a notamment nécessité de résoudre plusieurs problèmes techniques :

### Protection des entrées ESP32

Le HC-SR04 fonctionne avec une alimentation de 5 V. Un pont diviseur est donc nécessaire pour adapter les niveaux de tension aux entrées de l'ESP32.

### Bruit de mesure sur l'ADC

La mesure de la batterie peut être affectée par du bruit sur l'ADC de l'ESP32. Le projet utilise une moyenne de plusieurs lectures pour stabiliser la mesure.

### Câblage

L'intégration simultanée de plusieurs capteurs, du circuit d'alimentation et des composants d'alerte nécessite une organisation rigoureuse du câblage.

Ces difficultés sont également identifiées dans le rapport du projet.

---

## Perspectives

Les principales évolutions envisagées sont :

### Détection d'obstacles multidirectionnelle

Ajouter plusieurs capteurs afin de détecter les obstacles dans différentes directions autour du chariot.

### Amélioration du câblage

Optimiser le montage électronique afin d'obtenir un système plus fiable et mieux organisé.

### Améliorations logicielles

Ajouter de nouvelles fonctionnalités de surveillance et d'alerte et améliorer le code existant.

### GPS

Ajouter un module GPS pour obtenir une localisation géographique réelle.

### Caméra

Ajouter une caméra afin d'enrichir les capacités de surveillance du chariot.

### MQTT

Explorer MQTT pour faire évoluer la communication IoT vers une architecture plus adaptée aux systèmes connectés distribués.

Ces pistes d'évolution sont proposées dans le rapport et la présentation du projet.

---

## Documentation

La documentation complète est disponible dans le dossier :

```text
docs/
```

### Présentation

```text
docs/Présentation.pdf
```

Elle présente le contexte, l'architecture, les composants, la mesure de batterie, l'odométrie, les tests, les résultats et les perspectives du projet.

### Rapport technique

```text
docs/Rapport.pdf
```

Le rapport détaille notamment :

* l'architecture générale ;
* les composants ;
* le câblage ;
* la mesure de batterie ;
* le code ESP32 ;
* l'odométrie ;
* les endpoints Flask ;
* la procédure de test ;
* les résultats ;
* les difficultés ;
* les perspectives.

---

## Contexte académique

**Projet :** CharioTrack
**Type :** Prototype IoT embarqué
**Module :** Internet des objets
**Année universitaire :** 2025-2026

**Encadrantes :**

* Mme Sirine KHALFALLAH
* Mme Hadda BEN ELHADJ

**Réalisé par :**

* Yosser AYADI
* Naziha GOUBAA

---

## Auteurs

### Naziha Goubaa

GitHub :

https://github.com/naziha-goubaa

LinkedIn :

https://www.linkedin.com/in/naziha-goubaa-a04b71266/

### Yosser Ayadi

Projet réalisé en collaboration dans le cadre du module Internet des objets.

---

## Licence

Projet académique développé dans le cadre de la formation en informatique.

Pour toute utilisation ou réutilisation du code, veuillez contacter les auteurs.
