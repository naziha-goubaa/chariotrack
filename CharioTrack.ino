#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <math.h>

//Config
const char* SSID       = "YOUR_WIFI_SSID";
const char* PASSWORD   = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP  = "10.114.133.138";
const int   SERVER_PORT = 5000;

//Broches
#define TRIG_G  26
#define ECHO_G  27
#define ENC_G   34
#define ENC_D   35
#define PIN_BAT 33
#define BUZZER  25
#define LED     2

//Batterie pont 110k + 220k
const float R1_BAT = 110000.0;
const float R2_BAT = 220000.0;

//Odométrie
const int   TICKS_PAR_TOUR   = 20;
const float DIAMETRE_ROUE    = 6.5;
const float ECARTEMENT_ROUES = 15.0;
const float PERIMETRE        = 3.14159265 * DIAMETRE_ROUE;

//Variables globales 
volatile long ticksG = 0, ticksD = 0;
long ticksG_prev = 0, ticksD_prev = 0;
float posX = 0, posY = 0, angle = 0, distanceTotale = 0;
String statut = "ARRET";
bool chocDetecte = false;
unsigned long dernierEnvoi = 0;

//Choc : valeurs précédentes pour détecter variation brusque
float prevAccX = 0, prevAccY = 0, prevAccZ = 0;
unsigned long dernierChoc = 0;


// SR04 NON-BLOQUANT

volatile unsigned long echoStart = 0;
volatile unsigned long echoDur   = 0;
volatile bool          echoReady = false;

void IRAM_ATTR isrEcho() {
  if (digitalRead(ECHO_G) == HIGH) {
    echoStart = micros();
  } else {
    unsigned long dur = micros() - echoStart;
    if (dur > 150 && dur < 25000) {
      echoDur   = dur;
      echoReady = true;
    }
  }
}

void triggerSR04() {
  digitalWrite(TRIG_G, LOW);
  delayMicroseconds(5);
  digitalWrite(TRIG_G, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_G, LOW);
}

// FILTRE MÉDIAN sur 5 mesures

#define MEDIAN_SIZE 5
float medianBuf[MEDIAN_SIZE];
int   medianIdx = 0;
bool  medianFull = false;

void pushMedian(float val) {
  medianBuf[medianIdx] = val;
  medianIdx = (medianIdx + 1) % MEDIAN_SIZE;
  if (medianIdx == 0) medianFull = true;
}

float getMedian() {
  int n = medianFull ? MEDIAN_SIZE : medianIdx;
  if (n == 0) return 999.0;
  float tmp[MEDIAN_SIZE];
  for (int i = 0; i < n; i++) tmp[i] = medianBuf[i];
  for (int i = 0; i < n-1; i++)
    for (int j = 0; j < n-1-i; j++)
      if (tmp[j] > tmp[j+1]) { float t = tmp[j]; tmp[j] = tmp[j+1]; tmp[j+1] = t; }
  return tmp[n / 2];
}

// MPU-6050 PAR REGISTRES DIRECTS

#define MPU_ADDR 0x68

void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

bool mpuInit() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x75);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 1);
  if (!Wire.available()) return false;
  uint8_t who = Wire.read();
  if (who != 0x68 && who != 0x70 && who != 0x72) return false;
  mpuWrite(0x6B, 0x00);
  delay(100);
  mpuWrite(0x1C, 0x00); // ±2g
  mpuWrite(0x1B, 0x00); // ±250°/s
  return true;
}

void mpuRead(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6);
  ax = ((int16_t)(Wire.read() << 8 | Wire.read())) / 16384.0;
  ay = ((int16_t)(Wire.read() << 8 | Wire.read())) / 16384.0;
  az = ((int16_t)(Wire.read() << 8 | Wire.read())) / 16384.0;
}

// BATTERIE

int   batPct      = 0;
unsigned long derniereBat = 0;
const unsigned long BAT_INTERVAL = 3000;

void lireBatterie() {
  long s = 0;
  for (int i = 0; i < 8; i++) {
    s += analogRead(PIN_BAT);
    delay(4);
  }
  float vADC = (s / 8.0 / 4095.0) * 3.3;
  float vBat = vADC * (R1_BAT + R2_BAT) / R2_BAT;
  Serial.print("[BAT] Vadc="); Serial.print(vADC, 3);
  Serial.print("V  Vbat="); Serial.print(vBat, 3); Serial.println("V");
  batPct = constrain((int)((vBat - 3.0) / (4.2 - 3.0) * 100.0), 0, 100);
}

// ENCODEURS

void IRAM_ATTR isrGauche() { ticksG++; }
void IRAM_ATTR isrDroite()  { ticksD++; }

// ODOMÉTRIE

void mettreAJourPosition() {
  noInterrupts();
  long tG = ticksG, tD = ticksD;
  interrupts();
  long deltaG = tG - ticksG_prev;
  long deltaD = tD - ticksD_prev;
  ticksG_prev = tG;
  ticksD_prev = tD;
  float dG_enc = (float)deltaG / TICKS_PAR_TOUR * PERIMETRE;
  float dD_enc = (float)deltaD / TICKS_PAR_TOUR * PERIMETRE;
  float dMoy   = (dG_enc + dD_enc) / 2.0;
  float dTheta = (dD_enc - dG_enc) / ECARTEMENT_ROUES;
  angle += dTheta;
  posX  += dMoy * cos(angle);
  posY  += dMoy * sin(angle);
  distanceTotale += abs(dMoy);

  //STATUT basé sur les encodeurs uniquement
  // Le choc est géré séparément dans la loop
  if (abs(dMoy) < 0.05)    statut = "ARRET";
  else if (dTheta > 0.05)  statut = "VIRAGE_DROITE";
  else if (dTheta < -0.05) statut = "VIRAGE_GAUCHE";
  else                     statut = "AVANCE";
}

// TEST BUZZER au démarrage

void testBuzzer() {
  Serial.println("  TEST BUZZER (GPIO25)");
  Serial.println("  [1/3] Tension continue ...");
  digitalWrite(BUZZER, HIGH);
  delay(600);
  digitalWrite(BUZZER, LOW);
  delay(300);
  Serial.println("Son continu = buzzer ACTIF");

  Serial.println("  [2/3] tone() 1000 Hz ...");
  tone(BUZZER, 1000);
  delay(600);
  noTone(BUZZER);
  delay(300);

  Serial.println("  [3/3] tone() 2000 Hz ...");
  tone(BUZZER, 2000);
  delay(400);
  noTone(BUZZER);
  delay(300);

  // Mélodie Do-Mi-Sol-Do
  int notes[] = {1047, 1319, 1568, 2093};
  for (int i = 0; i < 4; i++) {
    tone(BUZZER, notes[i], 150);
    delay(200);
  }
  noTone(BUZZER);
}

// SETUP

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin();

  pinMode(TRIG_G, OUTPUT);
  pinMode(ECHO_G, INPUT);
  pinMode(ENC_G,  INPUT);
  pinMode(ENC_D,  INPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED,    OUTPUT);

  attachInterrupt(digitalPinToInterrupt(ENC_G),  isrGauche, RISING);
  attachInterrupt(digitalPinToInterrupt(ENC_D),  isrDroite, RISING);
  attachInterrupt(digitalPinToInterrupt(ECHO_G), isrEcho,   CHANGE);

  delay(200);
  if (mpuInit()) Serial.println("MPU-6050 OK");
  else           Serial.println("MPU-6050 ECHEC");

  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connexion WiFi");
  for (int t = 0; t < 30 && WiFi.status() != WL_CONNECTED; t++) {
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED)
    Serial.println("\n WiFi : " + WiFi.localIP().toString());
  else
    Serial.println("\n WiFi ECHEC");

  lireBatterie();
  testBuzzer();

  // Initialise les valeurs précédentes acc
  float ax, ay, az;
  mpuRead(ax, ay, az);
  prevAccX = ax; prevAccY = ay; prevAccZ = az;

  digitalWrite(LED, HIGH); delay(300); digitalWrite(LED, LOW);
  Serial.println("Pour tester le choc : frappe fort la table ou secoue brusquement");
}

// LOOP

unsigned long dernierTrig  = 0;
unsigned long dernierBip   = 0;

void loop() {
  unsigned long now = millis();

  //Trigger SR04
  if (now - dernierTrig >= 80) {
    dernierTrig = now;
    triggerSR04();
  }

  // Distance SR04
  static float dG = 999.0;
  if (echoReady) {
    float brut = echoDur * 0.0343 / 2.0;
    pushMedian(brut);
    dG = getMedian();
    echoReady = false;
  }

  //Batterie
  if (now - derniereBat >= BAT_INTERVAL) {
    derniereBat = now;
    lireBatterie();
  }

  //MPU
  float accX, accY, accZ;
  mpuRead(accX, accY, accZ);

  //DÉTECTION CHOC par VARIATION brusque
  // Fonctionne même si MPU est monté à l'envers
  // On mesure le delta entre deux lectures consécutives
  float deltaX = accX - prevAccX;
  float deltaY = accY - prevAccY;
  float deltaZ = accZ - prevAccZ;
  float delta  = sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ);
  prevAccX = accX;
  prevAccY = accY;
  prevAccZ = accZ;

  // Seuil delta : 0.5g de variation brusque = choc
  // (bien plus sensible que la magnitude absolue)
  if (delta > 0.5 && (now - dernierChoc) > 1000) {
    chocDetecte  = true;
    dernierChoc  = now;
    statut       = "CHOC";
    digitalWrite(LED, HIGH);
    tone(BUZZER, 2000, 500);  // bip long 500ms
    Serial.print("CHOC ! delta="); Serial.print(delta, 3);
    Serial.print("g | X="); Serial.print(accX, 2);
    Serial.print(" Y="); Serial.print(accY, 2);
    Serial.print(" Z="); Serial.println(accZ, 2);
  } else {
    // Remet chocDetecte à false après 2 secondes
    if (now - dernierChoc > 2000) {
      chocDetecte = false;
      digitalWrite(LED, LOW);
    }
  }

  //Alerte obstacle , bip toutes les 400ms
  if (dG > 2.0 && dG < 30.0) {
    digitalWrite(LED, HIGH);
    if (now - dernierBip >= 400) {
      dernierBip = now;
      tone(BUZZER, 1500, 80);  // bip court 80ms
    }
  } else if (!chocDetecte) {
    digitalWrite(LED, LOW);
  }

  //Odométrie (statut ARRET/AVANCE/VIRAGE)
  // Ne remplace le statut que si pas de choc en cours
  if (!chocDetecte) {
    mettreAJourPosition();
  }

  //Log série
  Serial.print("SR04: "); Serial.print(dG, 1);
  Serial.print(" cm | Bat: "); Serial.print(batPct);
  Serial.print("% | accX="); Serial.print(accX, 2);
  Serial.print(" Y="); Serial.print(accY, 2);
  Serial.print(" Z="); Serial.print(accZ, 2);
  Serial.print(" delta="); Serial.print(delta, 3);
  Serial.print("g | tG:"); Serial.print(ticksG);
  Serial.print(" tD:"); Serial.print(ticksD);
  Serial.print(" | "); Serial.println(statut);

  //Envoi Flask
  if (now - dernierEnvoi >= 1000) {
    dernierEnvoi = now;
    if (WiFi.status() == WL_CONNECTED) {
      StaticJsonDocument<512> doc;
      doc["statut"]    = statut;
      doc["posX"]      = posX;
      doc["posY"]      = posY;
      doc["angle_deg"] = angle * 180.0 / 3.14159;
      doc["dist_cm"]   = distanceTotale;
      doc["ticks_g"]   = ticksG;
      doc["ticks_d"]   = ticksD;
      doc["dist_g"]    = dG;
      doc["dist_c"]    = 999.0;
      doc["dist_d"]    = 999.0;
      doc["acc_x"]     = accX;
      doc["acc_y"]     = accY;
      doc["acc_z"]     = accZ;
      doc["choc"]      = chocDetecte;
      doc["batterie"]  = batPct;
      String json;
      serializeJson(doc, json);
      HTTPClient http;
      http.begin("http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/data");
      http.addHeader("Content-Type", "application/json");
      int code = http.POST(json);
      Serial.println(code > 0 ? "Envoyé" : "Erreur envoi");
      http.end();
    }
  }

  delay(20);
}
