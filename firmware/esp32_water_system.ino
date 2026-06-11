#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <RTClib.h>
#include <LiquidCrystal_I2C.h>

// ---------------------------------------------------------------------------
// 2-house pilot firmware for Smart Automated Rural Water Distribution System
// Hardware profile:
// - 1 overhead tank ultrasonic sensor
// - 1 main outlet flow sensor
// - 2 household flow sensors
// - 1 pump relay
// - 1 main valve relay
// - 2 household valve relays
// - DS3231 RTC
// - 16x2 I2C LCD
// ---------------------------------------------------------------------------

// Fill these with your local demo network and backend values before flashing.
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *API_BASE_URL = "http://YOUR_SERVER_IP:4000/api/esp32";
const char *DEVICE_SECRET = "YOUR_ESP32_SHARED_SECRET";

// Replace these with the real household service numbers from user registration.
const char *HOUSE_1_SERVICE_NUMBER = "SRV-001";
const char *HOUSE_2_SERVICE_NUMBER = "SRV-002";

// Relay pins from your connection table.
const uint8_t PUMP_RELAY_PIN = 26;
const uint8_t TANK_OUTLET_VALVE_RELAY_PIN = 27;
const uint8_t HOUSE_1_VALVE_RELAY_PIN = 14;
const uint8_t HOUSE_2_VALVE_RELAY_PIN = 12;

// Sensor pins from your connection table.
const uint8_t ULTRASONIC_TRIG_PIN = 5;
const uint8_t ULTRASONIC_ECHO_PIN = 18;
const uint8_t MAIN_FLOW_PIN = 34;
const uint8_t HOUSE_1_FLOW_PIN = 35;
const uint8_t HOUSE_2_FLOW_PIN = 32;

// Shared I2C for RTC and LCD.
const uint8_t I2C_SDA_PIN = 21;
const uint8_t I2C_SCL_PIN = 22;

const bool RELAY_ACTIVE_LOW = true;
const float TANK_HEIGHT_CM = 200.0f;
const float TANK_PUMP_ON_THRESHOLD = 70.0f;
const float TANK_PUMP_OFF_THRESHOLD = 95.0f;
const float FLOW_CALIBRATION_FACTOR = 7.5f;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
const unsigned long SENSOR_READ_INTERVAL_MS = 1000;
const unsigned long TELEMETRY_INTERVAL_MS = 10000;
const unsigned long ADMIN_HEARTBEAT_INTERVAL_MS = 15000;
const unsigned long USER_HEARTBEAT_INTERVAL_MS = 60000;
const unsigned long LCD_REFRESH_INTERVAL_MS = 1200;
const unsigned long STATUS_SYNC_INTERVAL_MS = 10000;
const unsigned long DISTRIBUTION_START_MINUTES = 6 * 60;
const unsigned long DISTRIBUTION_END_MINUTES = 8 * 60;
const unsigned long DRY_RUN_TIMEOUT_MS = 30000;
const float DRY_RUN_MIN_MAIN_FLOW_LPM = 0.15f;
const float LEAK_MARGIN_LPM = 1.5f;
const float DEFAULT_HOUSEHOLD_LPCD_LIMIT = 135.0f;
const int HOUSE_1_FAMILY_MEMBERS = 4;
const int HOUSE_2_FAMILY_MEMBERS = 5;

RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);

volatile unsigned long mainFlowPulses = 0;
volatile unsigned long house1FlowPulses = 0;
volatile unsigned long house2FlowPulses = 0;

struct RelayState {
  bool pumpOn = false;
  bool mainValveOpen = false;
  bool house1ValveOpen = false;
  bool house2ValveOpen = false;
};

struct FlowReading {
  float mainLitersPerMinute = 0.0f;
  float house1LitersPerMinute = 0.0f;
  float house2LitersPerMinute = 0.0f;
  float mainLitersThisCycle = 0.0f;
  float house1LitersThisCycle = 0.0f;
  float house2LitersThisCycle = 0.0f;
};

struct HouseholdUsage {
  float totalLitersToday = 0.0f;
  float lpcdUsed = 0.0f;
  float lpcdLimit = DEFAULT_HOUSEHOLD_LPCD_LIMIT;
  bool exceededLimit = false;
};

struct SystemState {
  float tankDistanceCm = 0.0f;
  float tankWaterHeightCm = 0.0f;
  float tankPercentage = 0.0f;
  bool leakDetected = false;
  bool wifiConnected = false;
  bool distributionActive = false;
  bool sensorFault = false;
  bool dryRunAlert = false;
  String leakMessage = "";
};

RelayState relays;
FlowReading flow;
HouseholdUsage house1Usage;
HouseholdUsage house2Usage;
SystemState systemState;

unsigned long lastWifiAttemptAt = 0;
unsigned long lastSensorReadAt = 0;
unsigned long lastTelemetryAt = 0;
unsigned long lastLcdRefreshAt = 0;
unsigned long lastStatusSyncAt = 0;
unsigned long lastAdminHeartbeatAt = 0;
unsigned long lastUserHeartbeatAt = 0;
unsigned long pumpLastFlowSeenAt = 0;
int lastRtcDay = -1;

void IRAM_ATTR onMainFlowPulse() {
  mainFlowPulses++;
}

void IRAM_ATTR onHouse1FlowPulse() {
  house1FlowPulses++;
}

void IRAM_ATTR onHouse2FlowPulse() {
  house2FlowPulses++;
}

void writeRelay(uint8_t pin, bool active) {
  const uint8_t level = RELAY_ACTIVE_LOW ? (active ? LOW : HIGH) : (active ? HIGH : LOW);
  digitalWrite(pin, level);
}

void setPump(bool on) {
  if (relays.pumpOn == on) return;
  relays.pumpOn = on;
  writeRelay(PUMP_RELAY_PIN, on);
}

void setMainValve(bool open) {
  if (relays.mainValveOpen == open) return;
  relays.mainValveOpen = open;
  writeRelay(TANK_OUTLET_VALVE_RELAY_PIN, open);
}

void setHouse1Valve(bool open) {
  if (relays.house1ValveOpen == open) return;
  relays.house1ValveOpen = open;
  writeRelay(HOUSE_1_VALVE_RELAY_PIN, open);
}

void setHouse2Valve(bool open) {
  if (relays.house2ValveOpen == open) return;
  relays.house2ValveOpen = open;
  writeRelay(HOUSE_2_VALVE_RELAY_PIN, open);
}

void connectWifiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) {
    systemState.wifiConnected = true;
    return;
  }

  systemState.wifiConnected = false;
  if (millis() - lastWifiAttemptAt < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  lastWifiAttemptAt = millis();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

float measureDistanceCm() {
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    systemState.sensorFault = true;
    return -1.0f;
  }

  systemState.sensorFault = false;
  return (duration * 0.0343f) / 2.0f;
}

void updateTankState() {
  const float distance = measureDistanceCm();
  if (distance < 0) return;

  systemState.tankDistanceCm = distance;
  systemState.tankWaterHeightCm = TANK_HEIGHT_CM - distance;

  if (systemState.tankWaterHeightCm < 0) systemState.tankWaterHeightCm = 0;
  if (systemState.tankWaterHeightCm > TANK_HEIGHT_CM) systemState.tankWaterHeightCm = TANK_HEIGHT_CM;

  systemState.tankPercentage = (systemState.tankWaterHeightCm / TANK_HEIGHT_CM) * 100.0f;
  if (systemState.tankPercentage < 0) systemState.tankPercentage = 0;
  if (systemState.tankPercentage > 100) systemState.tankPercentage = 100;
}

unsigned long consumePulseCounter(volatile unsigned long &counter) {
  noInterrupts();
  const unsigned long pulses = counter;
  counter = 0;
  interrupts();
  return pulses;
}

float pulsesToLitersPerMinute(unsigned long pulses, unsigned long intervalMs) {
  if (intervalMs == 0) return 0.0f;
  const float pulsesPerSecond = static_cast<float>(pulses) / (static_cast<float>(intervalMs) / 1000.0f);
  return pulsesPerSecond / FLOW_CALIBRATION_FACTOR;
}

float litersPerMinuteToLiters(float litersPerMinute, unsigned long intervalMs) {
  return litersPerMinute * (static_cast<float>(intervalMs) / 60000.0f);
}

void updateFlowState(unsigned long intervalMs) {
  const unsigned long mainPulses = consumePulseCounter(mainFlowPulses);
  const unsigned long house1Pulses = consumePulseCounter(house1FlowPulses);
  const unsigned long house2Pulses = consumePulseCounter(house2FlowPulses);

  flow.mainLitersPerMinute = pulsesToLitersPerMinute(mainPulses, intervalMs);
  flow.house1LitersPerMinute = pulsesToLitersPerMinute(house1Pulses, intervalMs);
  flow.house2LitersPerMinute = pulsesToLitersPerMinute(house2Pulses, intervalMs);

  flow.mainLitersThisCycle = litersPerMinuteToLiters(flow.mainLitersPerMinute, intervalMs);
  flow.house1LitersThisCycle = litersPerMinuteToLiters(flow.house1LitersPerMinute, intervalMs);
  flow.house2LitersThisCycle = litersPerMinuteToLiters(flow.house2LitersPerMinute, intervalMs);

  house1Usage.totalLitersToday += flow.house1LitersThisCycle;
  house2Usage.totalLitersToday += flow.house2LitersThisCycle;

  house1Usage.lpcdUsed = house1Usage.totalLitersToday / HOUSE_1_FAMILY_MEMBERS;
  house2Usage.lpcdUsed = house2Usage.totalLitersToday / HOUSE_2_FAMILY_MEMBERS;

  if (flow.mainLitersPerMinute > DRY_RUN_MIN_MAIN_FLOW_LPM) {
    pumpLastFlowSeenAt = millis();
  }
}

void applyOverflowLogic() {
  if (systemState.sensorFault) return;

  if (systemState.tankPercentage >= TANK_PUMP_OFF_THRESHOLD) {
    setPump(false);
  } else if (systemState.tankPercentage <= TANK_PUMP_ON_THRESHOLD) {
    setPump(true);
  }
}

void applyRtcDistributionLogic() {
  DateTime now = rtc.now();
  const unsigned long minutesNow = (now.hour() * 60UL) + now.minute();
  const bool shouldDistribute = minutesNow >= DISTRIBUTION_START_MINUTES && minutesNow < DISTRIBUTION_END_MINUTES;

  systemState.distributionActive = shouldDistribute;
  setMainValve(shouldDistribute);

  if (shouldDistribute && !house1Usage.exceededLimit) {
    setHouse1Valve(true);
  }
  if (shouldDistribute && !house2Usage.exceededLimit) {
    setHouse2Valve(true);
  }
  if (!shouldDistribute) {
    setHouse1Valve(false);
    setHouse2Valve(false);
  }
}

void applyLpcdProtection() {
  house1Usage.exceededLimit = house1Usage.lpcdUsed >= house1Usage.lpcdLimit;
  house2Usage.exceededLimit = house2Usage.lpcdUsed >= house2Usage.lpcdLimit;

  if (house1Usage.exceededLimit) {
    setHouse1Valve(false);
  }
  if (house2Usage.exceededLimit) {
    setHouse2Valve(false);
  }
}

void detectLeakage() {
  systemState.leakDetected = false;
  systemState.leakMessage = "";

  const float summedHouseFlow = flow.house1LitersPerMinute + flow.house2LitersPerMinute;
  const bool abnormalGap = relays.mainValveOpen && flow.mainLitersPerMinute > (summedHouseFlow + LEAK_MARGIN_LPM);
  const bool inactiveBranchWhileMainFlows = relays.mainValveOpen && flow.mainLitersPerMinute > 2.0f &&
                                            flow.house1LitersPerMinute < 0.1f && flow.house2LitersPerMinute < 0.1f;

  if (abnormalGap || inactiveBranchWhileMainFlows) {
    systemState.leakDetected = true;
    systemState.leakMessage = abnormalGap ? "Main flow exceeds house totals" : "Main flow without household consumption";
    setMainValve(false);
    setHouse1Valve(false);
    setHouse2Valve(false);
  }
}

void detectDryRun() {
  systemState.dryRunAlert = relays.pumpOn && (millis() - pumpLastFlowSeenAt > DRY_RUN_TIMEOUT_MS);
  if (systemState.dryRunAlert) {
    setPump(false);
  }
}

void resetDailyUsageIfNeeded() {
  DateTime now = rtc.now();
  if (lastRtcDay == -1) {
    lastRtcDay = now.day();
    return;
  }

  if (now.day() != lastRtcDay) {
    lastRtcDay = now.day();
    house1Usage.totalLitersToday = 0.0f;
    house2Usage.totalLitersToday = 0.0f;
    house1Usage.lpcdUsed = 0.0f;
    house2Usage.lpcdUsed = 0.0f;
    house1Usage.exceededLimit = false;
    house2Usage.exceededLimit = false;
  }
}

bool postJson(const char *path, JsonDocument &doc) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + path;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload;
  serializeJson(doc, payload);
  const int httpCode = http.POST(payload);
  http.end();
  return httpCode >= 200 && httpCode < 300;
}

void uploadHeartbeat(const char *deviceKey, const char *serviceNumber, const char *scope, const char *label, unsigned long intervalMs) {
  JsonDocument doc;
  doc["device_key"] = deviceKey;
  if (serviceNumber != nullptr) {
    doc["service_number"] = serviceNumber;
  }
  doc["scope"] = scope;
  doc["device_label"] = label;
  doc["status"] = systemState.wifiConnected ? "online" : "warning";
  doc["wifi_rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -120;
  doc["heartbeat_interval_seconds"] = static_cast<int>(intervalMs / 1000);
  doc["meta"]["pump_status"] = relays.pumpOn;
  doc["meta"]["main_valve_open"] = relays.mainValveOpen;
  doc["meta"]["tank_percentage"] = systemState.tankPercentage;
  doc["meta"]["leak_detected"] = systemState.leakDetected;
  doc["device_secret"] = DEVICE_SECRET;

  const bool ok = postJson("/heartbeat", doc);
  Serial.print("Heartbeat ");
  Serial.print(deviceKey);
  Serial.println(ok ? " posted successfully" : " failed");
}

void uploadTankTelemetry() {
  JsonDocument tankDoc;
  tankDoc["tank_percentage"] = systemState.tankPercentage;
  tankDoc["water_level"] = systemState.tankWaterHeightCm;
  tankDoc["device_secret"] = DEVICE_SECRET;
  postJson("/tank-level", tankDoc);

  JsonDocument pumpDoc;
  pumpDoc["pump_status"] = relays.pumpOn;
  pumpDoc["device_secret"] = DEVICE_SECRET;
  postJson("/pump-state", pumpDoc);
}

void uploadHouseFlow(const char *serviceNumber, const char *sensorId, float litersThisCycle, float lpcdUsed) {
  if (litersThisCycle <= 0.0f) return;

  JsonDocument doc;
  doc["service_number"] = serviceNumber;
  doc["flow_sensor_id"] = sensorId;
  doc["liters_used"] = litersThisCycle;
  doc["lpcd_used"] = lpcdUsed;
  doc["device_secret"] = DEVICE_SECRET;
  postJson("/flow", doc);
}

void uploadLeakAlert(const String &message) {
  JsonDocument doc;
  doc["affected_house"] = message;
  doc["severity"] = "high";
  doc["device_secret"] = DEVICE_SECRET;
  postJson("/leakage", doc);
}

void updateLcd() {
  lcd.clear();
  if (!systemState.wifiConnected) {
    lcd.setCursor(0, 0);
    lcd.print("WiFi: RECONNECT");
    lcd.setCursor(0, 1);
    lcd.print("Tank:");
    lcd.print(static_cast<int>(systemState.tankPercentage));
    lcd.print("%");
    return;
  }

  lcd.setCursor(0, 0);
  lcd.print("Tank:");
  lcd.print(static_cast<int>(systemState.tankPercentage));
  lcd.print("% ");
  lcd.print(relays.pumpOn ? "P:ON" : "P:OFF");

  lcd.setCursor(0, 1);
  if (systemState.leakDetected) {
    lcd.print("Leak Alert!");
  } else if (systemState.distributionActive) {
    lcd.print("Supply: ACTIVE");
  } else {
    lcd.print("Supply: IDLE  ");
  }
}

void initializePeripherals() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  rtc.begin();
  lcd.init();
  lcd.backlight();
}

void initializePins() {
  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);

  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(TANK_OUTLET_VALVE_RELAY_PIN, OUTPUT);
  pinMode(HOUSE_1_VALVE_RELAY_PIN, OUTPUT);
  pinMode(HOUSE_2_VALVE_RELAY_PIN, OUTPUT);

  pinMode(MAIN_FLOW_PIN, INPUT);
  pinMode(HOUSE_1_FLOW_PIN, INPUT);
  pinMode(HOUSE_2_FLOW_PIN, INPUT);

  attachInterrupt(digitalPinToInterrupt(MAIN_FLOW_PIN), onMainFlowPulse, RISING);
  attachInterrupt(digitalPinToInterrupt(HOUSE_1_FLOW_PIN), onHouse1FlowPulse, RISING);
  attachInterrupt(digitalPinToInterrupt(HOUSE_2_FLOW_PIN), onHouse2FlowPulse, RISING);

  setPump(false);
  setMainValve(false);
  setHouse1Valve(false);
  setHouse2Valve(false);
}

void setup() {
  Serial.begin(115200);
  initializePeripherals();
  initializePins();
  connectWifiIfNeeded();
  pumpLastFlowSeenAt = millis();
}

void loop() {
  connectWifiIfNeeded();
  resetDailyUsageIfNeeded();

  const unsigned long nowMs = millis();

  if (nowMs - lastSensorReadAt >= SENSOR_READ_INTERVAL_MS) {
    const unsigned long elapsed = lastSensorReadAt == 0 ? SENSOR_READ_INTERVAL_MS : nowMs - lastSensorReadAt;
    lastSensorReadAt = nowMs;

    updateTankState();
    updateFlowState(elapsed);
    applyOverflowLogic();
    applyRtcDistributionLogic();
    applyLpcdProtection();
    detectLeakage();
    detectDryRun();
  }

  if (nowMs - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = nowMs;
    uploadTankTelemetry();
    uploadHouseFlow(HOUSE_1_SERVICE_NUMBER, "FLOW-HOUSE-01", flow.house1LitersThisCycle, house1Usage.lpcdUsed);
    uploadHouseFlow(HOUSE_2_SERVICE_NUMBER, "FLOW-HOUSE-02", flow.house2LitersThisCycle, house2Usage.lpcdUsed);

    if (systemState.leakDetected) {
      uploadLeakAlert(systemState.leakMessage);
    }
  }

  if (nowMs - lastAdminHeartbeatAt >= ADMIN_HEARTBEAT_INTERVAL_MS) {
    lastAdminHeartbeatAt = nowMs;
    uploadHeartbeat("SYSTEM-ESP32", nullptr, "admin", "Village Controller ESP32", ADMIN_HEARTBEAT_INTERVAL_MS);
  }

  if (nowMs - lastUserHeartbeatAt >= USER_HEARTBEAT_INTERVAL_MS) {
    lastUserHeartbeatAt = nowMs;
    uploadHeartbeat("SRV-001", HOUSE_1_SERVICE_NUMBER, "user", "Household Device SRV-001", USER_HEARTBEAT_INTERVAL_MS);
    uploadHeartbeat("SRV-002", HOUSE_2_SERVICE_NUMBER, "user", "Household Device SRV-002", USER_HEARTBEAT_INTERVAL_MS);
  }

  if (nowMs - lastStatusSyncAt >= STATUS_SYNC_INTERVAL_MS) {
    lastStatusSyncAt = nowMs;
    Serial.print("Tank %: ");
    Serial.print(systemState.tankPercentage);
    Serial.print(" | Main LPM: ");
    Serial.print(flow.mainLitersPerMinute);
    Serial.print(" | H1 LPM: ");
    Serial.print(flow.house1LitersPerMinute);
    Serial.print(" | H2 LPM: ");
    Serial.println(flow.house2LitersPerMinute);
  }

  if (nowMs - lastLcdRefreshAt >= LCD_REFRESH_INTERVAL_MS) {
    lastLcdRefreshAt = nowMs;
    updateLcd();
  }
}
