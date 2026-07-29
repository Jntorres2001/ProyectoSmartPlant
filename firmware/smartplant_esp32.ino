/*
 * ============================================
 * SmartPlant IoT Monitor - Firmware ESP32
 * ============================================
 * Lee humedad del suelo (sensor capacitivo) y envía los datos
 * al backend Node.js por HTTP cada X segundos.
 *
 * Este proyecto usa ÚNICAMENTE un sensor capacitivo de humedad.
 * No hay ningún sensor de temperatura conectado ni simulado.
 *
 * Librerías necesarias (instalar desde el Gestor de Librerías de Arduino IDE):
 *  - WiFi.h           (incluida con el core de ESP32)
 *  - HTTPClient.h     (incluida con el core de ESP32)
 *  - ArduinoJson      (buscar "ArduinoJson" by Benoit Blanchon)
 *
 * Conexiones:
 *  - Sensor de humedad capacitivo -> pin analógico (ADC) GPIO34
 *  - (Opcional) Relé para riego automático -> GPIO26
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ----------------------------------------
// CONFIGURACIÓN - EDITA ESTOS VALORES
// ----------------------------------------
const char* WIFI_SSID     = "SmartPlant_Network";   // Nombre de tu red WiFi
const char* WIFI_PASSWORD = "tu_password_wifi";     // Contraseña de tu WiFi

// IP local de la PC donde corre el backend Node.js (no usar "localhost")
// Para saberla: en Windows -> ipconfig, en Mac/Linux -> ifconfig
const char* SERVER_URL = "http://192.168.1.100:3000/api/lecturas";

// Debe coincidir con el api_key insertado en la tabla `dispositivos`
const char* API_KEY = "sp_demo_apikey_cambiala_123456";

// ----------------------------------------
// PINES
// ----------------------------------------
const int PIN_SENSOR_HUMEDAD = 34;   // Pin ADC (entrada analógica)
const int PIN_RELE_RIEGO     = 26;   // Pin digital para activar bomba/válvula

// ----------------------------------------
// CALIBRACIÓN DEL SENSOR CAPACITIVO
// Estos valores varían según el sensor específico - calibra el tuyo:
//  - Sumerge el sensor en agua y anota la lectura -> ese es VALOR_HUMEDO
//  - Deja el sensor al aire (seco) y anota la lectura -> ese es VALOR_SECO
// ----------------------------------------
const int VALOR_SECO   = 3000;  // Lectura ADC con el sensor totalmente seco
const int VALOR_HUMEDO = 1200;  // Lectura ADC con el sensor en agua/tierra húmeda

// Intervalo de envío de datos (en milisegundos)
unsigned long INTERVALO_LECTURA = 30000; // 30 segundos
unsigned long ultimoEnvio = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELE_RIEGO, OUTPUT);
  digitalWrite(PIN_RELE_RIEGO, LOW);

  conectarWiFi();
}

void loop() {
  // Si se desconecta el WiFi, intenta reconectar
  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  unsigned long ahora = millis();
  if (ahora - ultimoEnvio >= INTERVALO_LECTURA) {
    ultimoEnvio = ahora;

    float humedad = leerHumedad();
    float voltaje = leerVoltaje();
    int senalWifi = WiFi.RSSI();

    Serial.printf("Humedad: %.1f%% | Señal: %d dBm\n", humedad, senalWifi);

    enviarLectura(humedad, voltaje, senalWifi);
  }

  delay(100);
}

// ----------------------------------------
// Conexión WiFi
// ----------------------------------------
void conectarWiFi() {
  Serial.print("Conectando a WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi conectado");
    Serial.print("IP del ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ No se pudo conectar al WiFi. Reintentando en el próximo ciclo...");
  }
}

// ----------------------------------------
// Lectura del sensor de humedad capacitivo
// Convierte el valor crudo del ADC (0-4095) a porcentaje (0-100%)
// ----------------------------------------
float leerHumedad() {
  int valorCrudo = analogRead(PIN_SENSOR_HUMEDAD);

  // Mapea el valor crudo a porcentaje, invirtiendo la escala
  // (más húmedo = valor ADC más bajo en sensores capacitivos típicos)
  float porcentaje = map(valorCrudo, VALOR_SECO, VALOR_HUMEDO, 0, 100);

  // Limita el resultado entre 0 y 100
  if (porcentaje < 0) porcentaje = 0;
  if (porcentaje > 100) porcentaje = 100;

  return porcentaje;
}

// ----------------------------------------
// Lectura de voltaje del ESP32 (simulado/fijo si no tienes divisor de voltaje)
// ----------------------------------------
float leerVoltaje() {
  return 3.3; // Voltaje nominal del ESP32. Cambia esto si mides el voltaje real.
}

// ----------------------------------------
// Envía la lectura al backend vía HTTP POST
// ----------------------------------------
void enviarLectura(float humedad, float voltaje, int senalWifi) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠ Sin conexión WiFi, no se pudo enviar la lectura");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  StaticJsonDocument<200> doc;
  doc["humedad"] = humedad;
  doc["voltaje"] = voltaje;
  doc["senal_wifi"] = senalWifi;

  String cuerpoJson;
  serializeJson(doc, cuerpoJson);

  int codigoRespuesta = http.POST(cuerpoJson);

  if (codigoRespuesta > 0) {
    Serial.printf("✅ Lectura enviada. Código: %d\n", codigoRespuesta);
  } else {
    Serial.printf("❌ Error al enviar lectura: %s\n", http.errorToString(codigoRespuesta).c_str());
  }

  http.end();
}
