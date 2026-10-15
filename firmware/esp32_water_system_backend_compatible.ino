#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <RTClib.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>

// ---------------------------------------------------------------------------
// 2-house pilot firmware for Smart Automated Rural Water Distribution System
// Hardware profile:
// - 1 overhead tank ultrasonic sensor
// - 1 main outlet flow sensor
// - 2 household flow sensors
// - TDS, pH, and turbidity sensors
// - 1 pump relay
// - 1 main valve relay
// - 2 household valve relays
// - DS3231 RTC
// - 16x2 I2C LCD
//
// The control loop (sensors, relays, safety) runs in loop(). All WiFi and HTTP
// work runs in a separate task, so a slow or unreachable backend can never
// delay a pump or valve decision.
//
// Limits, schedules, pump thresholds, and valve switches come from the admin
// dashboard on every sync. In automatic mode the valves follow the tank level and the
// schedules; the valve switches are only used in manual mode. The constants below marked "until the first sync"
// only apply while the backend has not been reached.
// ---------------------------------------------------------------------------

// Fill these in before flashing.
// API_BASE_URL is the laptop that runs the backend (npm run start:server). An ESP32 cannot use
// "localhost": put that laptop's WiFi IP address here (run ipconfig on it), and keep the
// laptop and the ESP32 on the same WiFi network.
const char *WIFI_SSID = "inba";
const char *WIFI_PASSWORD = "12345678";
const char *API_BASE_URL = "http://10.10.56.3:4000/api/esp32";
const char *DEVICE_SECRET = "Water-demo";

// Replace these with the real household service numbers from user registration.
const char *HOUSE_1_SERVICE_NUMBER = "SRV-001";
const char *HOUSE_2_SERVICE_NUMBER = "SRV-002"; 

// Valve names as stored in the backend valve_status table.
const char *MAIN_VALVE_NAME = "Main Distribution Valve";
const char *HOUSE_1_VALVE_NAME = "House 1 Intake Valve";
const char *HOUSE_2_VALVE_NAME = "House 2 Intake Valve";

// Relay pins from your connection table.
const uint8_t PUMP_RELAY_PIN = 26;
const uint8_t TANK_OUTLET_VALVE_RELAY_PIN = 27;
const uint8_t HOUSE_1_VALVE_RELAY_PIN = 14;
const uint8_t HOUSE_2_VALVE_RELAY_PIN = 25;

// Sensor pins from your connection table.
// GPIO 34 and 35 have no internal pull-up: fit an external 10k pull-up to 3.3V
// on those two flow sensor lines, otherwise a floating pin counts phantom pulses.
const uint8_t ULTRASONIC_TRIG_PIN = 5;
const uint8_t ULTRASONIC_ECHO_PIN = 18;
const uint8_t MAIN_FLOW_PIN = 34;
const uint8_t HOUSE_1_FLOW_PIN = 35;
const uint8_t HOUSE_2_FLOW_PIN = 32;

const uint8_t TDS_PIN = 36;
const uint8_t PH_PIN = 39;
const uint8_t TURBIDITY_PIN = 33;

// Shared I2C for RTC and LCD.
const uint8_t I2C_SDA_PIN = 21;
const uint8_t I2C_SCL_PIN = 22;

const bool RELAY_ACTIVE_LOW = true;
// Depth of water between an empty and a full tank.
const float TANK_HEIGHT_CM = 25.0f;
// Distance from the ultrasonic sensor down to the water when the tank is full. The sensor
// cannot measure closer than about 2 cm, so "full" has to sit below that or the pump would
// never see the stop level. With the sensor at the rim, the tank counts as full 3 cm below it.
const float SENSOR_GAP_CM = 3.0f;
// Pump thresholds used until the first sync brings the ones from the admin Settings page.
const float TANK_PUMP_OFF_THRESHOLD = 95.0f;
const float TANK_PUMP_ON_THRESHOLD = 65.0f;
// After a manual "Pump ON" fills the tank, wait for the level to fall this far below the
// stop level before restarting.
const float TANK_MANUAL_RESUME_GAP = 5.0f;
const float FLOW_CALIBRATION_FACTOR = 7.5f;
// Consecutive readings with no echo before the level sensor is treated as faulty.
const uint8_t SENSOR_FAULT_THRESHOLD = 3;

// Tank level filtering. Each reading is the median of several pings, and echoes from beyond
// the tank bottom are discarded. A reading close to the last one is accepted at once. A
// reading that differs a lot is only believed once the next readings agree with it, so a
// single bad echo cannot start the pump on a full tank, while a real change (or a hand moved
// under the sensor on the bench) is followed within a few seconds.
//
// An HC-SR04 cannot measure closer than about 2 cm. Anything nearer is treated as 2 cm, which
// reads as a full tank and keeps the pump off. Mount the sensor a few cm above the top level.
const float SENSOR_MIN_DISTANCE_CM = 2.0f;
const float SENSOR_MAX_DISTANCE_CM = TANK_HEIGHT_CM + SENSOR_GAP_CM + 10.0f;
const uint8_t LEVEL_PINGS = 5;
const uint8_t LEVEL_MIN_VALID_PINGS = 3;
const unsigned long LEVEL_PING_GAP_MS = 25;
// A change up to this size from the last accepted level is believed immediately.
const float LEVEL_NOISE_ALLOWANCE_PERCENT = 6.0f;
// A bigger change must be repeated: this many readings in a row within this much of each other.
const uint8_t LEVEL_CONFIRM_READINGS = 3;
const float LEVEL_AGREE_PERCENT = 4.0f;
// With no believable reading for this long the sensor is treated as faulty.
const unsigned long LEVEL_STALE_MS = 15000;

// Flow sensor noise rejection. A YF-S201 tops out near 30 L/min (about 225 pulses a second),
// so pulses closer together than this, or a rate above the plausible maximum, are electrical
// noise from a floating or badly wired signal line, not water.
const unsigned long FLOW_PULSE_MIN_GAP_US = 2000;
const float MAX_PLAUSIBLE_FLOW_LPM = 40.0f;

const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
const unsigned long SENSOR_READ_INTERVAL_MS = 1000;
const unsigned long TELEMETRY_INTERVAL_MS = 10000;
const unsigned long FLOW_UPLOAD_INTERVAL_MS = 30000;
const unsigned long WATER_QUALITY_INTERVAL_MS = 60000;
// Heartbeats carry the live readings the dashboards show, so they are frequent.
const unsigned long ADMIN_HEARTBEAT_INTERVAL_MS = 5000;
const unsigned long USER_HEARTBEAT_INTERVAL_MS = 10000;
const unsigned long LCD_REFRESH_INTERVAL_MS = 1200;
const unsigned long STATUS_SYNC_INTERVAL_MS = 5000;
const unsigned long DIAGNOSTICS_INTERVAL_MS = 5000;
// Long enough for a sleeping Render instance to wake up.
const uint16_t HTTP_TIMEOUT_MS = 15000;

// Supply runs during the active schedules on the admin Schedules page. This window is used
// until the first sync, and whenever the admin has no active schedule at all.
const unsigned long DISTRIBUTION_START_MINUTES = 0 * 60;     // 00:00
const unsigned long DISTRIBUTION_END_MINUTES = 23 * 60 + 59; // 23:59

// Dry-run protection: while the pump runs, the tank level must keep rising.
// (The main flow sensor is on the tank outlet, so it reads zero during a refill.)
const unsigned long DRY_RUN_TIMEOUT_MS = 60000;
const float DRY_RUN_MIN_RISE_PERCENT = 1.0f;
const unsigned long DRY_RUN_LOCKOUT_MS = 300000;

// Leak detection: the main outlet flow must match what the houses draw.
// For a dry bench test with freely spinning sensors, raise both to 5000.0f so it cannot trip.
const float LEAK_MARGIN_LPM = 3.0f;
const float LEAK_MIN_MAIN_FLOW_LPM = 2.0f;
const uint8_t LEAK_CONFIRM_READINGS = 3;
const unsigned long LEAK_LOCKOUT_MS = 60000;

// Each household's daily limit, family size, and usage so far today come from the backend:
// admin LPCD limit x registered family members + extra water approved for today.
// These values are only used until the first sync.
const float FALLBACK_LPCD_LIMIT = 55.0f;
const int HOUSE_1_FAMILY_MEMBERS = 1;
const int HOUSE_2_FAMILY_MEMBERS = 2;

// Bench-test helpers. Both must be false in the field.
// Restart the cycle (and clear the daily usage) shortly after it completes.
const bool TEST_AUTO_RESTART_CYCLE = false;
const unsigned long TEST_RESTART_DELAY_MS = 15000;
// Click every relay once at boot. This briefly runs the pump.
const bool RUN_RELAY_SELF_TEST = false;

// Water quality sensors. Calibrate each one against a known sample and adjust its constants.
// The ESP32 ADC accepts 3.3V at most: a sensor with a 5V output needs a voltage divider,
// and its DIVIDER_RATIO must be set to (R1 + R2) / R2 (1.0 = wired directly).
const uint8_t ADC_SAMPLES = 20;
const float TDS_DIVIDER_RATIO = 1.0f;
const float TDS_CALIBRATION_FACTOR = 0.5f;   // ppm = polynomial(volts) x this
const float PH_DIVIDER_RATIO = 1.0f;
const float PH_NEUTRAL_VOLTAGE = 2.5f;       // sensor output in pH 7 buffer
const float PH_VOLTS_PER_PH = 0.18f;         // output drops by this much per pH unit
const float TURBIDITY_DIVIDER_RATIO = 1.0f;
const float TURBIDITY_CLEAR_VOLTAGE = 4.2f;  // sensor output in clear water
const float TURBIDITY_NTU_PER_VOLT = 400.0f; // NTU added for each volt below the clear level

// Which sensors are validated: calibrated against a known sample so their readings can be
// trusted. The water counts as good until a validated sensor says otherwise. A sensor left
// at false is still measured and shown on the dashboard, but never judges the water, so an
// uncalibrated or unplugged probe cannot stop supply. Set one to true after calibrating it.
const bool PH_SENSOR_VALIDATED = false;
const bool TDS_SENSOR_VALIDATED = false;
const bool TURBIDITY_SENSOR_VALIDATED = false;

// Limits a validated reading must stay inside to count as safe.
// These are widened for the prototype so slightly off water still passes.
// Drinking-water values for the field: TDS 500, pH 6.5 to 8.5, turbidity 5.
const float TDS_MAX_PPM = 1000.0f;
const float PH_MIN = 5.0f;
const float PH_MAX = 10.0f;
const float TURBIDITY_MAX_NTU = 50.0f;
// How quickly a reading follows the sensor: 1.0 = no smoothing, smaller = steadier.
const float WATER_QUALITY_SMOOTHING = 0.2f;
// true: water that a validated sensor finds outside the limits holds supply to the houses.
// The pump keeps the tank filled either way.
const bool ENFORCE_WATER_QUALITY = true;

// Used when the RTC is missing or has lost power. India Standard Time = UTC+5:30.
const long GMT_OFFSET_SECONDS = 19800;
const char *NTP_SERVER_1 = "pool.ntp.org";
const char *NTP_SERVER_2 = "time.google.com";

const uint8_t MAX_SCHEDULE_WINDOWS = 4;
const uint32_t NETWORK_TASK_STACK_BYTES = 16384;

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
  float dailyLimitLiters = 0.0f;
  int familyMembers = 1;
  bool exceededLimit = false;
  // The backend usage token last applied to totalLitersToday (0 = none yet).
  uint32_t appliedUsageToken = 0;
};

struct SystemState {
  float tankDistanceCm = 0.0f;
  float tankWaterHeightCm = 0.0f;
  float tankPercentage = 0.0f;
  bool leakDetected = false;
  bool distributionActive = false;
  // Stays true until the first valid ultrasonic reading arrives.
  bool sensorFault = true;
  bool dryRunAlert = false;
  bool clockValid = false;
  // The controller's own time of day, in minutes since midnight.
  uint16_t clockMinutes = 0;
  // Day of the week, 0 = Sunday ... 6 = Saturday.
  uint8_t weekday = 0;
  // Why the level sensor counts as faulty, for the dashboard.
  const char *sensorFaultReason = "";
  const char *leakMessage = "";
  // Plain-language reason for what the controller is doing, shown on the dashboard.
  const char *supplyStatus = "Starting up";
};

struct WaterQuality {
  float tds = 0.0f;
  float ph = 7.0f;
  float turbidity = 0.0f;
  bool isSafe = true;
  // Smoothed voltage at each sensor's output. Shown on the dashboard for calibration.
  float tdsVolts = 0.0f;
  float phVolts = 0.0f;
  float turbidityVolts = 0.0f;
  bool sampled = false;
};

enum SystemCycleState {
  STATE_IDLE,
  STATE_CHECK_TANK,
  STATE_REFILL_TANK,
  STATE_DISTRIBUTING,
  STATE_COMPLETED
};

enum PumpMode {
  PUMP_MODE_AUTO,
  PUMP_MODE_ON,
  PUMP_MODE_OFF
};

// Which houses a supply window serves, as bits.
const uint8_t HOUSE_1_BIT = 1;
const uint8_t HOUSE_2_BIT = 2;
const uint8_t ALL_HOUSES = HOUSE_1_BIT | HOUSE_2_BIT;

struct ScheduleWindow {
  uint16_t startMinutes;
  uint16_t endMinutes;
  // One bit per weekday: 1 = Sunday, 2 = Monday ... 64 = Saturday.
  uint8_t daysMask;
  // HOUSE_1_BIT, HOUSE_2_BIT, or both.
  uint8_t houses;
};

// One household's allowance as the backend calculates it.
struct HouseholdAllowance {
  bool received = false;
  float dailyLimitLiters = 0.0f;
  int familyMembers = 1;
  float litersToday = 0.0f;
};

// Latest commands from the backend. Defaults apply until the first successful sync.
struct BackendCommands {
  // true: the admin chose Manual mode. The pump and every valve follow the dashboard
  // switches directly instead of the automatic cycle.
  bool manualControl = false;
  PumpMode pumpMode = PUMP_MODE_AUTO;
  bool mainValveOpen = true;
  bool house1ValveOpen = true;
  bool house2ValveOpen = true;
  // 0 = not received yet, use the firmware thresholds.
  float pumpOnThreshold = 0.0f;
  float pumpOffThreshold = 0.0f;
  HouseholdAllowance house1;
  HouseholdAllowance house2;
  // Changes when the admin resets usage; see applyHouseholdAllowance.
  uint32_t usageToken = 0;
  uint8_t scheduleCount = 0;
  ScheduleWindow schedules[MAX_SCHEDULE_WINDOWS];
};

// Live readings for one household, sent with its heartbeat.
struct HouseTelemetry {
  bool valveOpen = false;
  float flowLitersPerMinute = 0.0f;
  float litersToday = 0.0f;
  float lpcdUsed = 0.0f;
  float dailyLimitLiters = 0.0f;
  bool limitReached = false;
  // Liters measured since the last successful upload.
  float pendingLiters = 0.0f;
};

// Copy of the control state handed to the network task.
struct TelemetrySnapshot {
  float tankPercentage = 0.0f;
  float tankWaterHeightCm = 0.0f;
  bool pumpOn = false;
  bool mainValveOpen = false;
  bool leakDetected = false;
  bool distributionActive = false;
  bool sensorFault = false;
  bool dryRunAlert = false;
  bool clockValid = false;
  bool manualControl = false;
  const char *supplyStatus = "Starting up";
  const char *sensorFaultReason = "";
  uint16_t clockMinutes = 0;
  float tdsVolts = 0.0f;
  float phVolts = 0.0f;
  float turbidityVolts = 0.0f;
  uint8_t cycleState = 0;
  float mainFlowLitersPerMinute = 0.0f;
  float tds = 0.0f;
  float ph = 7.0f;
  float turbidity = 0.0f;
  bool waterSafe = true;
  HouseTelemetry house1;
  HouseTelemetry house2;
  bool leakAlertPending = false;
  const char *leakMessage = "";
};

RelayState relays;
FlowReading flow;
HouseholdUsage house1Usage;
HouseholdUsage house2Usage;
SystemState systemState;
WaterQuality waterQuality;
SystemCycleState cycleState = STATE_IDLE;

// Owned by the control loop. Refreshed from sharedCommands once per cycle.
BackendCommands commands;

// Shared between the control loop and the network task. Guard with sharedMutex.
SemaphoreHandle_t sharedMutex = nullptr;
TelemetrySnapshot sharedTelemetry;
BackendCommands sharedCommands;
volatile bool wifiConnected = false;

// Network task only.
WiFiClient plainClient;
WiFiClientSecure secureClient;
HTTPClient http;
unsigned long lastWifiAttemptAt = 0;

// Control loop only.
unsigned long lastSensorReadAt = 0;
unsigned long lastLcdRefreshAt = 0;
unsigned long lastDiagnosticsAt = 0;
unsigned long stateEnteredAt = 0;
unsigned long pumpReferenceAt = 0;
float pumpReferenceLevel = 0.0f;
unsigned long dryRunTrippedAt = 0;
unsigned long leakDetectedAt = 0;
uint8_t leakSuspectReadings = 0;
bool leakAlertToSend = false;
uint8_t tankReadFailures = 0;
// true from the moment the tank falls below the pump start level until it reaches the stop level.
bool tankRefilling = false;
bool tankLevelAccepted = false;
unsigned long tankLevelAcceptedAt = 0;
// A level reading that differs a lot from the accepted one, waiting to be confirmed.
float levelCandidate = 0.0f;
uint8_t levelCandidateCount = 0;
// Set when a flow reading was discarded as noise since the last diagnostics print.
bool flowNoiseSeen = false;
bool rtcFound = false;
bool rtcReady = false;
int lastRtcDay = -1;

volatile unsigned long mainFlowLastPulseUs = 0;
volatile unsigned long house1FlowLastPulseUs = 0;
volatile unsigned long house2FlowLastPulseUs = 0;

// Each pulse is counted only if it arrives a plausible time after the previous one.
void IRAM_ATTR onMainFlowPulse() {
  const unsigned long nowUs = micros();
  if (nowUs - mainFlowLastPulseUs >= FLOW_PULSE_MIN_GAP_US) {
    mainFlowLastPulseUs = nowUs;
    mainFlowPulses++;
  }
}

void IRAM_ATTR onHouse1FlowPulse() {
  const unsigned long nowUs = micros();
  if (nowUs - house1FlowLastPulseUs >= FLOW_PULSE_MIN_GAP_US) {
    house1FlowLastPulseUs = nowUs;
    house1FlowPulses++;
  }
}

void IRAM_ATTR onHouse2FlowPulse() {
  const unsigned long nowUs = micros();
  if (nowUs - house2FlowLastPulseUs >= FLOW_PULSE_MIN_GAP_US) {
    house2FlowLastPulseUs = nowUs;
    house2FlowPulses++;
  }
}

// ---------------------------------------------------------------------------
// Relays
// ---------------------------------------------------------------------------

void writeRelay(uint8_t pin, bool active) {
  const uint8_t level = RELAY_ACTIVE_LOW ? (active ? LOW : HIGH) : (active ? HIGH : LOW);
  digitalWrite(pin, level);
}

void setPump(bool on) {
  if (relays.pumpOn == on) return;
  relays.pumpOn = on;

  if (on) {
    pumpReferenceAt = millis();
    pumpReferenceLevel = systemState.tankPercentage;
  }

  Serial.print(on ? "[PUMP] ON" : "[PUMP] OFF");
  Serial.print(" | Tank %: ");
  Serial.println(systemState.tankPercentage);

  writeRelay(PUMP_RELAY_PIN, on);
}

void setMainValve(bool open) {
  if (relays.mainValveOpen == open) return;
  relays.mainValveOpen = open;
  Serial.println(open ? "[VALVE] Main ON" : "[VALVE] Main OFF");
  writeRelay(TANK_OUTLET_VALVE_RELAY_PIN, open);
}

void setHouse1Valve(bool open) {
  if (relays.house1ValveOpen == open) return;
  relays.house1ValveOpen = open;
  Serial.println(open ? "[VALVE] House 1 ON" : "[VALVE] House 1 OFF");
  writeRelay(HOUSE_1_VALVE_RELAY_PIN, open);
}

void setHouse2Valve(bool open) {
  if (relays.house2ValveOpen == open) return;
  relays.house2ValveOpen = open;
  Serial.println(open ? "[VALVE] House 2 ON" : "[VALVE] House 2 OFF");
  writeRelay(HOUSE_2_VALVE_RELAY_PIN, open);
}

void closeAllValves() {
  setMainValve(false);
  setHouse1Valve(false);
  setHouse2Valve(false);
}

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------

// One ultrasonic ping. Returns -1 when no echo comes back.
float pingDistanceCm() {
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1.0f;
  }

  return (duration * 0.0343f) / 2.0f;
}

// Median of several pings, ignoring echoes that cannot come from inside the tank.
// Returns -1 when too few pings were usable.
float measureDistanceCm() {
  float samples[LEVEL_PINGS];
  uint8_t count = 0;

  for (uint8_t i = 0; i < LEVEL_PINGS; i++) {
    const float distance = pingDistanceCm();
    if (distance >= 0.0f && distance <= SENSOR_MAX_DISTANCE_CM) {
      // Closer than the sensor can measure: count it as the closest it can.
      samples[count++] = distance < SENSOR_MIN_DISTANCE_CM ? SENSOR_MIN_DISTANCE_CM : distance;
    }
    delay(LEVEL_PING_GAP_MS);
  }

  if (count < LEVEL_MIN_VALID_PINGS) {
    return -1.0f;
  }

  for (uint8_t i = 1; i < count; i++) {
    const float value = samples[i];
    int8_t j = i - 1;
    while (j >= 0 && samples[j] > value) {
      samples[j + 1] = samples[j];
      j--;
    }
    samples[j + 1] = value;
  }

  return samples[count / 2];
}

// A level sensor fault stops the pump and closes the valves until a believable reading returns.
// The reason is sent to the dashboard so the cause can be seen without a serial cable.
void setSensorFault(const char *reason) {
  systemState.sensorFaultReason = reason;
  if (!systemState.sensorFault) {
    systemState.sensorFault = true;
    Serial.print("[SENSOR] Level sensor fault: ");
    Serial.println(reason);
  }
}

void updateTankState() {
  const float distance = measureDistanceCm();
  const unsigned long nowMs = millis();

  if (distance < 0) {
    // One missed echo is normal. Only a run of them is a fault.
    if (tankReadFailures < 255) tankReadFailures++;
    if (tankReadFailures >= SENSOR_FAULT_THRESHOLD) {
      setSensorFault("No echo from the ultrasonic sensor. Check its wiring and that it faces the water.");
    }
    return;
  }
  tankReadFailures = 0;

  float waterHeightCm = TANK_HEIGHT_CM - (distance - SENSOR_GAP_CM);
  if (waterHeightCm < 0) waterHeightCm = 0;
  if (waterHeightCm > TANK_HEIGHT_CM) waterHeightCm = TANK_HEIGHT_CM;
  const float percentage = (waterHeightCm / TANK_HEIGHT_CM) * 100.0f;

  bool accept = !tankLevelAccepted || fabsf(percentage - systemState.tankPercentage) <= LEVEL_NOISE_ALLOWANCE_PERCENT;

  if (!accept) {
    // A big change is believed once consecutive readings agree with each other.
    if (levelCandidateCount > 0 && fabsf(percentage - levelCandidate) <= LEVEL_AGREE_PERCENT) {
      levelCandidateCount++;
    } else {
      levelCandidateCount = 1;
    }
    levelCandidate = percentage;
    accept = levelCandidateCount >= LEVEL_CONFIRM_READINGS;

    if (!accept) {
      if (nowMs - tankLevelAcceptedAt > LEVEL_STALE_MS) {
        setSensorFault("Level readings keep jumping around. Check the sensor mounting and wiring.");
      }
      return;
    }
  }

  levelCandidateCount = 0;
  tankLevelAccepted = true;
  tankLevelAcceptedAt = nowMs;
  systemState.sensorFaultReason = "";
  if (systemState.sensorFault) {
    systemState.sensorFault = false;
    Serial.println("[SENSOR] Level sensor OK");
  }

  systemState.tankDistanceCm = distance;
  systemState.tankWaterHeightCm = waterHeightCm;
  systemState.tankPercentage = percentage;
}

// Averaged voltage at the sensor output, undoing any voltage divider in front of the ADC.
float readSensorVolts(uint8_t pin, float dividerRatio) {
  uint32_t totalMillivolts = 0;
  for (uint8_t i = 0; i < ADC_SAMPLES; i++) {
    totalMillivolts += analogReadMilliVolts(pin);
  }
  return (static_cast<float>(totalMillivolts) / ADC_SAMPLES / 1000.0f) * dividerRatio;
}

// Each sensor's voltage is smoothed so one noisy sample does not flip the result.
float smoothVolts(float previous, float sample) {
  return waterQuality.sampled ? previous + WATER_QUALITY_SMOOTHING * (sample - previous) : sample;
}

void measureWaterQuality() {
  waterQuality.tdsVolts = smoothVolts(waterQuality.tdsVolts, readSensorVolts(TDS_PIN, TDS_DIVIDER_RATIO));
  waterQuality.phVolts = smoothVolts(waterQuality.phVolts, readSensorVolts(PH_PIN, PH_DIVIDER_RATIO));
  waterQuality.turbidityVolts = smoothVolts(waterQuality.turbidityVolts, readSensorVolts(TURBIDITY_PIN, TURBIDITY_DIVIDER_RATIO));
  waterQuality.sampled = true;

  const float tdsVolts = waterQuality.tdsVolts;
  // Standard curve for analog TDS probes at 25 C.
  float tds = (133.42f * tdsVolts * tdsVolts * tdsVolts - 255.86f * tdsVolts * tdsVolts + 857.39f * tdsVolts) * TDS_CALIBRATION_FACTOR;
  if (tds < 0.0f) tds = 0.0f;

  float ph = 7.0f + (PH_NEUTRAL_VOLTAGE - waterQuality.phVolts) / PH_VOLTS_PER_PH;
  if (ph < 0.0f) ph = 0.0f;
  if (ph > 14.0f) ph = 14.0f;

  float turbidity = (TURBIDITY_CLEAR_VOLTAGE - waterQuality.turbidityVolts) * TURBIDITY_NTU_PER_VOLT;
  if (turbidity < 0.0f) turbidity = 0.0f;

  waterQuality.tds = tds;
  waterQuality.ph = ph;
  waterQuality.turbidity = turbidity;
  // Only validated sensors judge the water; the others are shown but assumed fine.
  const bool tdsOk = !TDS_SENSOR_VALIDATED || tds < TDS_MAX_PPM;
  const bool phOk = !PH_SENSOR_VALIDATED || (ph >= PH_MIN && ph <= PH_MAX);
  const bool turbidityOk = !TURBIDITY_SENSOR_VALIDATED || turbidity < TURBIDITY_MAX_NTU;
  waterQuality.isSafe = tdsOk && phOk && turbidityOk;
}

// Whether water quality allows supply right now.
bool waterQualityAllowsSupply() {
  return waterQuality.isSafe || !ENFORCE_WATER_QUALITY;
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
  const float litersPerMinute = pulsesPerSecond / FLOW_CALIBRATION_FACTOR;

  // More than the sensor can physically pass is noise on the signal line, not water.
  // Counting it would bill the household and use up its daily limit.
  if (litersPerMinute > MAX_PLAUSIBLE_FLOW_LPM) {
    flowNoiseSeen = true;
    return 0.0f;
  }
  return litersPerMinute;
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
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

// Reads the day of month and minutes since midnight. Returns false with no time source.
//
// Network time is the reference whenever it is available, and the RTC is corrected from it if
// the two disagree. A schedule set for 06:00 therefore runs at 06:00 even if the RTC was set
// wrongly or has drifted. Without a network the RTC carries on alone.
bool readClock(int &dayOfMonth, unsigned long &minutesOfDay) {
  struct tm timeInfo;
  if (getLocalTime(&timeInfo, 0)) {
    dayOfMonth = timeInfo.tm_mday;
    minutesOfDay = (timeInfo.tm_hour * 60UL) + timeInfo.tm_min;
    systemState.clockMinutes = static_cast<uint16_t>(minutesOfDay);
    systemState.weekday = static_cast<uint8_t>(timeInfo.tm_wday);

    if (rtcFound) {
      const DateTime network(timeInfo.tm_year + 1900, timeInfo.tm_mon + 1, timeInfo.tm_mday, timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
      const long difference = static_cast<long>(network.unixtime()) - static_cast<long>(rtc.now().unixtime());
      if (!rtcReady || difference > 60 || difference < -60) {
        rtc.adjust(network);
        rtcReady = true;
        Serial.println("[CLOCK] RTC set from network time");
      }
    }
    return true;
  }

  if (rtcReady) {
    const DateTime now = rtc.now();
    dayOfMonth = now.day();
    minutesOfDay = (now.hour() * 60UL) + now.minute();
    systemState.clockMinutes = static_cast<uint16_t>(minutesOfDay);
    systemState.weekday = now.dayOfTheWeek();
    return true;
  }

  return false;
}

bool minuteInWindow(unsigned long minutesNow, unsigned long startMinutes, unsigned long endMinutes) {
  if (startMinutes <= endMinutes) {
    return minutesNow >= startMinutes && minutesNow < endMinutes;
  }
  // Window that runs past midnight.
  return minutesNow >= startMinutes || minutesNow < endMinutes;
}

// Which houses the schedule allows to be supplied right now: the houses of every window
// that is running at this time on this weekday. 0 means no window is running.
// A window that runs past midnight is checked against the weekday it is now, not the one it started on.
uint8_t housesInSchedule(unsigned long minutesNow, uint8_t weekday) {
  if (commands.scheduleCount > 0) {
    uint8_t houses = 0;
    for (uint8_t i = 0; i < commands.scheduleCount; i++) {
      const ScheduleWindow &window = commands.schedules[i];
      const bool today = (window.daysMask & (1 << weekday)) != 0;
      if (today && minuteInWindow(minutesNow, window.startMinutes, window.endMinutes)) {
        houses |= window.houses;
      }
    }
    return houses;
  }

  return minuteInWindow(minutesNow, DISTRIBUTION_START_MINUTES, DISTRIBUTION_END_MINUTES) ? ALL_HOUSES : 0;
}

void resetDailyUsage() {
  house1Usage.totalLitersToday = 0.0f;
  house2Usage.totalLitersToday = 0.0f;
  house1Usage.lpcdUsed = 0.0f;
  house2Usage.lpcdUsed = 0.0f;
  house1Usage.exceededLimit = false;
  house2Usage.exceededLimit = false;
}

void resetDailyUsageIfNeeded(int dayOfMonth) {
  if (lastRtcDay == -1) {
    lastRtcDay = dayOfMonth;
    return;
  }

  if (dayOfMonth != lastRtcDay) {
    lastRtcDay = dayOfMonth;
    resetDailyUsage();
  }
}

// ---------------------------------------------------------------------------
// Protection and state machine
// ---------------------------------------------------------------------------

const char *cycleStateName(SystemCycleState state) {
  switch (state) {
    case STATE_IDLE: return "IDLE";
    case STATE_CHECK_TANK: return "CHECK_TANK";
    case STATE_REFILL_TANK: return "REFILL_TANK";
    case STATE_DISTRIBUTING: return "DISTRIBUTING";
    case STATE_COMPLETED: return "COMPLETED";
  }
  return "UNKNOWN";
}

const char *pumpModeName(PumpMode mode) {
  switch (mode) {
    case PUMP_MODE_AUTO: return "auto";
    case PUMP_MODE_ON: return "on";
    case PUMP_MODE_OFF: return "off";
  }
  return "auto";
}

void enterState(SystemCycleState next) {
  if (cycleState == next) return;
  cycleState = next;
  stateEnteredAt = millis();
  Serial.print("[STATE] ");
  Serial.println(cycleStateName(next));
}

// The admin's thresholds are only trusted when they make sense together.
bool backendThresholdsValid() {
  return commands.pumpOnThreshold >= 5.0f &&
         commands.pumpOffThreshold <= 98.0f &&
         commands.pumpOnThreshold + 5.0f <= commands.pumpOffThreshold;
}

float pumpOnThreshold() {
  return backendThresholdsValid() ? commands.pumpOnThreshold : TANK_PUMP_ON_THRESHOLD;
}

float pumpOffThreshold() {
  return backendThresholdsValid() ? commands.pumpOffThreshold : TANK_PUMP_OFF_THRESHOLD;
}

// Takes over the backend's limit and family size for one household.
//
// The backend sends a usage token with its figure for today's usage. Whenever the token is
// one this household has not applied yet, the local counter is set to the backend's figure.
// That happens after a restart here (the counter starts at zero), and whenever the admin
// resets usage on the dashboard, so a reset there reopens the valves here.
void applyHouseholdAllowance(HouseholdUsage &usage, const HouseholdAllowance &allowance) {
  if (allowance.received) {
    usage.dailyLimitLiters = allowance.dailyLimitLiters;
    usage.familyMembers = allowance.familyMembers < 1 ? 1 : allowance.familyMembers;

    // An older backend sends no token; treating that as one fixed token still syncs once at start.
    const uint32_t token = commands.usageToken == 0 ? 1 : commands.usageToken;
    if (usage.appliedUsageToken != token) {
      usage.appliedUsageToken = token;
      usage.totalLitersToday = allowance.litersToday;
      Serial.print("[USAGE] Counter set from the backend: ");
      Serial.println(allowance.litersToday);
    }
  }

  usage.lpcdUsed = usage.totalLitersToday / usage.familyMembers;
  usage.exceededLimit = usage.dailyLimitLiters > 0.0f && usage.totalLitersToday >= usage.dailyLimitLiters;
}

void applyLpcdProtection() {
  applyHouseholdAllowance(house1Usage, commands.house1);
  applyHouseholdAllowance(house2Usage, commands.house2);
}

// A detected leak stays latched for LEAK_LOCKOUT_MS so the valves do not chatter
// open and closed, and so the alert is reported exactly once.
void detectLeakage() {
  if (systemState.leakDetected) {
    if (millis() - leakDetectedAt >= LEAK_LOCKOUT_MS) {
      systemState.leakDetected = false;
      systemState.leakMessage = "";
      leakSuspectReadings = 0;
      Serial.println("[LEAK] Lockout over, supply may resume");
    }
    return;
  }

  if (!relays.mainValveOpen) {
    leakSuspectReadings = 0;
    return;
  }

  const float summedHouseFlow = flow.house1LitersPerMinute + flow.house2LitersPerMinute;
  const bool abnormalGap = flow.mainLitersPerMinute > (summedHouseFlow + LEAK_MARGIN_LPM);
  const bool inactiveBranchWhileMainFlows = flow.mainLitersPerMinute > LEAK_MIN_MAIN_FLOW_LPM &&
                                            flow.house1LitersPerMinute < 0.1f && flow.house2LitersPerMinute < 0.1f;

  if (!abnormalGap && !inactiveBranchWhileMainFlows) {
    leakSuspectReadings = 0;
    return;
  }

  if (++leakSuspectReadings < LEAK_CONFIRM_READINGS) {
    return;
  }

  systemState.leakDetected = true;
  systemState.leakMessage = abnormalGap ? "Main flow exceeds house totals" : "Main flow without household consumption";
  leakDetectedAt = millis();
  leakAlertToSend = true;
  Serial.println("[LEAK DETECTED] Shutting down solenoids!");
  closeAllValves();
}

// A pump that runs without the tank level rising is running dry (or the level
// sensor is stuck). Either way it is stopped and locked out for a while.
void detectDryRun() {
  if (systemState.dryRunAlert) {
    if (millis() - dryRunTrippedAt >= DRY_RUN_LOCKOUT_MS) {
      systemState.dryRunAlert = false;
      Serial.println("[DRY RUN] Lockout over, pump may run again");
    }
    return;
  }

  if (!relays.pumpOn) return;

  if (systemState.tankPercentage >= pumpReferenceLevel + DRY_RUN_MIN_RISE_PERCENT) {
    pumpReferenceLevel = systemState.tankPercentage;
    pumpReferenceAt = millis();
    return;
  }

  if (millis() - pumpReferenceAt > DRY_RUN_TIMEOUT_MS) {
    systemState.dryRunAlert = true;
    dryRunTrippedAt = millis();
    Serial.println("[PUMP STOP] Dry run: tank level is not rising");
    setPump(false);
  }
}

// Applies the admin pump command on top of what the state machine wants.
// Overflow, sensor-fault, and dry-run protection win over every mode.
void applyPump(bool autoWantsPump) {
  bool wantPump = autoWantsPump;

  if (commands.pumpMode == PUMP_MODE_OFF) {
    wantPump = false;
  } else if (commands.pumpMode == PUMP_MODE_ON) {
    wantPump = relays.pumpOn || systemState.tankPercentage < (pumpOffThreshold() - TANK_MANUAL_RESUME_GAP);
  }

  const bool safeToRun = !systemState.sensorFault &&
                         !systemState.dryRunAlert &&
                         systemState.tankPercentage < pumpOffThreshold();

  setPump(wantPump && safeToRun);
}

// The tank refills whenever it falls below the start level (65% by default) and keeps
// refilling until it reaches the stop level (95%). This runs at all times, inside and
// outside supply windows, so the tank is ready when supply starts.
void updateRefillState() {
  if (systemState.tankPercentage < pumpOnThreshold()) {
    tankRefilling = true;
  } else if (systemState.tankPercentage >= pumpOffThreshold()) {
    tankRefilling = false;
  }
}

// Manual mode: the pump and each valve do exactly what the dashboard switch says, at once.
// Schedules, daily limits, and water quality are not applied. Protection still is: a leak
// closes the valves, and the pump never runs past the stop level, dry, or without a level reading.
void runManualControl() {
  enterState(STATE_IDLE);

  int dayOfMonth = 0;
  unsigned long minutesNow = 0;
  systemState.clockValid = readClock(dayOfMonth, minutesNow);
  if (systemState.clockValid) {
    resetDailyUsageIfNeeded(dayOfMonth);
  }

  const bool valvesAllowed = !systemState.leakDetected;
  setMainValve(valvesAllowed && commands.mainValveOpen);
  setHouse1Valve(valvesAllowed && commands.house1ValveOpen);
  setHouse2Valve(valvesAllowed && commands.house2ValveOpen);
  systemState.distributionActive = relays.mainValveOpen && (relays.house1ValveOpen || relays.house2ValveOpen);

  // With the pump switch on Automatic, keep the tank between the two thresholds.
  if (!systemState.sensorFault) {
    updateRefillState();
  }
  applyPump(tankRefilling);

  if (systemState.leakDetected) {
    systemState.supplyStatus = "Manual mode: leak detected, valves closed";
  } else if (systemState.sensorFault) {
    systemState.supplyStatus = "Manual mode: level sensor fault, pump held off";
  } else if (systemState.dryRunAlert) {
    systemState.supplyStatus = "Manual mode: pump locked out, tank level did not rise";
  } else {
    systemState.supplyStatus = "Manual mode: following the dashboard switches";
  }
}

void runStateMachine() {
  detectDryRun();
  detectLeakage();
  applyLpcdProtection(); // Step 7 & 8

  if (commands.manualControl) {
    runManualControl();
    return;
  }

  if (systemState.sensorFault) {
    // Tank level unknown: nothing may run.
    setPump(false);
    closeAllValves();
    systemState.distributionActive = false;
    systemState.supplyStatus = "Stopped: tank level sensor fault";
    return;
  }

  int dayOfMonth = 0;
  unsigned long minutesNow = 0;
  systemState.clockValid = readClock(dayOfMonth, minutesNow);
  if (systemState.clockValid) {
    resetDailyUsageIfNeeded(dayOfMonth);
  }
  const uint8_t scheduledHouses = systemState.clockValid ? housesInSchedule(minutesNow, systemState.weekday) : 0;
  const bool inWindow = scheduledHouses != 0;
  // In automatic mode the dashboard valve switches are not used: a house takes water whenever a
  // running window serves it. The switches only apply in manual mode.
  const bool house1Enabled = (scheduledHouses & HOUSE_1_BIT) != 0;
  const bool house2Enabled = (scheduledHouses & HOUSE_2_BIT) != 0;

  // The pump follows the tank level in every state. Supply to the houses is what the
  // states below decide, and it waits while the tank is refilling.
  updateRefillState();
  const bool autoWantsPump = tankRefilling;

  switch (cycleState) {
    case STATE_IDLE:
      closeAllValves();
      systemState.distributionActive = false;

      if (!systemState.clockValid) {
        systemState.supplyStatus = tankRefilling ? "Refilling the tank. Supply is waiting: clock is not set" : "Waiting: clock is not set";
      } else if (!inWindow) {
        systemState.supplyStatus = tankRefilling ? "Refilling the tank. Supply starts in the next window" : "Waiting for the next supply window";
      } else if (!waterQualityAllowsSupply()) {
        systemState.supplyStatus = "Held: water quality is outside safe limits";
      } else {
        systemState.supplyStatus = "Starting a supply cycle";
        enterState(STATE_CHECK_TANK);
      }
      break;

    case STATE_CHECK_TANK:
      // Step 1: Check Tank Level
      // Step 2: Supply starts only with a full tank. Below the stop level the pump tops it up
      // first, even when the level is above the start level, and supply begins at the stop level.
      systemState.supplyStatus = "Checking the tank level";
      if (systemState.tankPercentage < pumpOffThreshold()) {
        tankRefilling = true;
      }
      enterState(tankRefilling ? STATE_REFILL_TANK : STATE_DISTRIBUTING);
      break;

    case STATE_REFILL_TANK:
      // The pump runs until the tank reaches the stop level (95%), then supply starts.
      closeAllValves();
      systemState.distributionActive = false;

      if (!tankRefilling) {
        enterState(STATE_CHECK_TANK);
      } else {
        if (systemState.dryRunAlert) {
          systemState.supplyStatus = "Pump locked out: tank level did not rise while pumping";
        } else if (commands.pumpMode == PUMP_MODE_OFF) {
          systemState.supplyStatus = "Waiting: supply needs a full tank and the pump is switched off";
        } else {
          systemState.supplyStatus = "Refilling the tank before supply";
        }
      }
      break;

    case STATE_DISTRIBUTING: {
      if (!inWindow || !waterQualityAllowsSupply()) {
        enterState(STATE_COMPLETED);
        break;
      }

      // If the tank drops below the pump start level during distribution, pause supply
      // until the pump has filled it back to the stop level.
      if (tankRefilling) {
        Serial.println("[DISTRIBUTION PAUSED] Tank level low. Refilling...");
        closeAllValves();
        systemState.distributionActive = false;
        enterState(STATE_REFILL_TANK);
        break;
      }

      // Step 3: Distribute Water
      systemState.distributionActive = true;
      if (systemState.leakDetected) {
        systemState.supplyStatus = "Leak detected: valves closed";
      } else {
        systemState.supplyStatus = "Supplying water";
      }

      // Every valve follows the schedule, the leak latch, and the daily limit on each pass.
      const bool supplyAllowed = !systemState.leakDetected;
      setMainValve(supplyAllowed);
      setHouse1Valve(supplyAllowed && house1Enabled && !house1Usage.exceededLimit);
      setHouse2Valve(supplyAllowed && house2Enabled && !house2Usage.exceededLimit);

      // Step 4: Daily limit reached?
      // A house the running window does not serve counts as finished, but at least one house must
      // actually have reached its limit for the cycle to complete.
      const bool house1Done = house1Usage.exceededLimit || !house1Enabled;
      const bool house2Done = house2Usage.exceededLimit || !house2Enabled;
      if (house1Done && house2Done && (house1Usage.exceededLimit || house2Usage.exceededLimit)) {
        // Step 9: Stop Pump and Close Valves (Cycle complete)
        enterState(STATE_COMPLETED);
      }
      break;
    }

    case STATE_COMPLETED:
      closeAllValves();
      systemState.distributionActive = false;
      if (!waterQualityAllowsSupply()) {
        systemState.supplyStatus = "Held: water quality is outside safe limits";
      } else if (house1Usage.exceededLimit || house2Usage.exceededLimit) {
        systemState.supplyStatus = "Done: daily limits reached";
      } else {
        systemState.supplyStatus = "Done: supply window ended";
      }

      if (TEST_AUTO_RESTART_CYCLE) {
        if (millis() - stateEnteredAt > TEST_RESTART_DELAY_MS) {
          // Reset daily usage limits so it can distribute again
          resetDailyUsage();
          enterState(STATE_IDLE);
        }
      } else {
        // Step 11: stand by until the window has passed. Go back earlier only if a house can
        // take water again (its limit was raised by an approved request) and the water is safe.
        const bool house1CanTake = house1Enabled && !house1Usage.exceededLimit;
        const bool house2CanTake = house2Enabled && !house2Usage.exceededLimit;
        if (!inWindow || ((house1CanTake || house2CanTake) && waterQualityAllowsSupply())) {
          enterState(STATE_IDLE);
        }
      }
      break;
  }

  applyPump(autoWantsPump);
}

// ---------------------------------------------------------------------------
// Hand-off between the control loop and the network task
// ---------------------------------------------------------------------------

void pullBackendCommands() {
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  commands = sharedCommands;
  xSemaphoreGive(sharedMutex);
}

// Fills everything except pendingLiters, which only ever accumulates.
void fillHouseTelemetry(HouseTelemetry &target, const HouseholdUsage &usage, bool valveOpen, float flowLitersPerMinute, float litersThisCycle) {
  target.valveOpen = valveOpen;
  target.flowLitersPerMinute = flowLitersPerMinute;
  target.litersToday = usage.totalLitersToday;
  target.lpcdUsed = usage.lpcdUsed;
  target.dailyLimitLiters = usage.dailyLimitLiters;
  target.limitReached = usage.exceededLimit;
  target.pendingLiters += litersThisCycle;
}

void publishTelemetry() {
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  sharedTelemetry.tankPercentage = systemState.tankPercentage;
  sharedTelemetry.tankWaterHeightCm = systemState.tankWaterHeightCm;
  sharedTelemetry.pumpOn = relays.pumpOn;
  sharedTelemetry.mainValveOpen = relays.mainValveOpen;
  sharedTelemetry.leakDetected = systemState.leakDetected;
  sharedTelemetry.distributionActive = systemState.distributionActive;
  sharedTelemetry.sensorFault = systemState.sensorFault;
  sharedTelemetry.dryRunAlert = systemState.dryRunAlert;
  sharedTelemetry.clockValid = systemState.clockValid;
  sharedTelemetry.manualControl = commands.manualControl;
  sharedTelemetry.supplyStatus = systemState.supplyStatus;
  sharedTelemetry.sensorFaultReason = systemState.sensorFaultReason;
  sharedTelemetry.clockMinutes = systemState.clockMinutes;
  sharedTelemetry.tdsVolts = waterQuality.tdsVolts;
  sharedTelemetry.phVolts = waterQuality.phVolts;
  sharedTelemetry.turbidityVolts = waterQuality.turbidityVolts;
  sharedTelemetry.cycleState = static_cast<uint8_t>(cycleState);
  sharedTelemetry.mainFlowLitersPerMinute = flow.mainLitersPerMinute;
  sharedTelemetry.tds = waterQuality.tds;
  sharedTelemetry.ph = waterQuality.ph;
  sharedTelemetry.turbidity = waterQuality.turbidity;
  sharedTelemetry.waterSafe = waterQuality.isSafe;
  fillHouseTelemetry(sharedTelemetry.house1, house1Usage, relays.house1ValveOpen, flow.house1LitersPerMinute, flow.house1LitersThisCycle);
  fillHouseTelemetry(sharedTelemetry.house2, house2Usage, relays.house2ValveOpen, flow.house2LitersPerMinute, flow.house2LitersThisCycle);
  if (leakAlertToSend) {
    sharedTelemetry.leakAlertPending = true;
    sharedTelemetry.leakMessage = systemState.leakMessage;
    leakAlertToSend = false;
  }
  xSemaphoreGive(sharedMutex);
}

TelemetrySnapshot readTelemetry() {
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  const TelemetrySnapshot snapshot = sharedTelemetry;
  xSemaphoreGive(sharedMutex);
  return snapshot;
}

// ---------------------------------------------------------------------------
// Network task
// ---------------------------------------------------------------------------

void maintainWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.print("[WIFI] Connected, IP ");
      Serial.println(WiFi.localIP());
    }
    return;
  }

  wifiConnected = false;
  if (lastWifiAttemptAt != 0 && millis() - lastWifiAttemptAt < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  lastWifiAttemptAt = millis();
  Serial.println("[WIFI] Connecting...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// Posts JSON to the backend and returns the HTTP status (negative on a transport error).
// The connection is kept open between calls, so only the first one pays for the TLS handshake.
int postJson(const char *path, JsonDocument &doc, String *response) {
  if (WiFi.status() != WL_CONNECTED) {
    return -1;
  }

  doc["device_secret"] = DEVICE_SECRET;

  const String url = String(API_BASE_URL) + path;
  const bool begun = url.startsWith("https") ? http.begin(secureClient, url) : http.begin(plainClient, url);
  if (!begun) {
    Serial.println("[NET] Could not start HTTP request");
    return -1;
  }

  http.addHeader("Content-Type", "application/json");

  String payload;
  serializeJson(doc, payload);
  const int httpCode = http.POST(payload);

  if (httpCode >= 200 && httpCode < 300) {
    if (response != nullptr) {
      *response = http.getString();
    }
  } else {
    Serial.print("[NET] POST ");
    Serial.print(path);
    Serial.print(" failed: ");
    Serial.println(httpCode);
  }

  http.end();
  return httpCode;
}

bool postOk(const char *path, JsonDocument &doc) {
  const int httpCode = postJson(path, doc, nullptr);
  return httpCode >= 200 && httpCode < 300;
}

// "06:00" or "06:00:00" -> minutes since midnight, or -1 if malformed.
int parseClockMinutes(const char *text) {
  if (text == nullptr) return -1;
  const char *colon = strchr(text, ':');
  if (colon == nullptr) return -1;

  const int hours = atoi(text);
  const int minutes = atoi(colon + 1);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return -1;
  return (hours * 60) + minutes;
}

void fetchBackendCommands() {
  JsonDocument doc;
  JsonArray serviceNumbers = doc["service_numbers"].to<JsonArray>();
  serviceNumbers.add(HOUSE_1_SERVICE_NUMBER);
  serviceNumbers.add(HOUSE_2_SERVICE_NUMBER);

  String response;
  const int httpCode = postJson("/commands", doc, &response);
  if (httpCode < 200 || httpCode >= 300) return;

  JsonDocument respDoc;
  if (deserializeJson(respDoc, response)) {
    Serial.println("[NET] Could not parse commands");
    return;
  }

  // Start from the current commands so a field the backend leaves out keeps its value.
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  BackendCommands next = sharedCommands;
  xSemaphoreGive(sharedMutex);

  if (respDoc["control_mode"].is<const char *>()) {
    const char *controlMode = respDoc["control_mode"];
    next.manualControl = strcmp(controlMode, "manual") == 0;
  }

  if (respDoc["pump_mode"].is<const char *>()) {
    const char *mode = respDoc["pump_mode"];
    if (strcmp(mode, "on") == 0) {
      next.pumpMode = PUMP_MODE_ON;
    } else if (strcmp(mode, "off") == 0) {
      next.pumpMode = PUMP_MODE_OFF;
    } else {
      next.pumpMode = PUMP_MODE_AUTO;
    }
  }

  if (respDoc["pump_on_threshold"].is<float>() && respDoc["pump_off_threshold"].is<float>()) {
    next.pumpOnThreshold = respDoc["pump_on_threshold"].as<float>();
    next.pumpOffThreshold = respDoc["pump_off_threshold"].as<float>();
  }

  if (respDoc["valves"].is<JsonArray>()) {
    for (JsonObject valve : respDoc["valves"].as<JsonArray>()) {
      const char *name = valve["valve_name"] | "";
      const bool status = valve["status"] | false;
      if (strcmp(name, MAIN_VALVE_NAME) == 0) next.mainValveOpen = status;
      if (strcmp(name, HOUSE_1_VALVE_NAME) == 0) next.house1ValveOpen = status;
      if (strcmp(name, HOUSE_2_VALVE_NAME) == 0) next.house2ValveOpen = status;
    }
  }

  if (respDoc["usage_token"].is<uint32_t>()) {
    next.usageToken = respDoc["usage_token"].as<uint32_t>();
  }

  if (respDoc["households"].is<JsonArray>()) {
    for (JsonObject house : respDoc["households"].as<JsonArray>()) {
      const char *serviceNumber = house["service_number"] | "";
      HouseholdAllowance allowance;
      allowance.received = true;
      allowance.dailyLimitLiters = house["daily_limit_liters"] | 0.0f;
      allowance.familyMembers = house["family_members"] | 1;
      allowance.litersToday = house["liters_today"] | 0.0f;
      if (strcmp(serviceNumber, HOUSE_1_SERVICE_NUMBER) == 0) next.house1 = allowance;
      if (strcmp(serviceNumber, HOUSE_2_SERVICE_NUMBER) == 0) next.house2 = allowance;
    }
  }

  if (respDoc["schedules"].is<JsonArray>()) {
    next.scheduleCount = 0;
    for (JsonObject schedule : respDoc["schedules"].as<JsonArray>()) {
      if (next.scheduleCount >= MAX_SCHEDULE_WINDOWS) break;
      const char *startText = schedule["start_time"] | "";
      const char *endText = schedule["end_time"] | "";
      const int startMinutes = parseClockMinutes(startText);
      const int endMinutes = parseClockMinutes(endText);
      if (startMinutes < 0 || endMinutes < 0) continue;
      next.schedules[next.scheduleCount].startMinutes = static_cast<uint16_t>(startMinutes);
      next.schedules[next.scheduleCount].endMinutes = static_cast<uint16_t>(endMinutes);
      // An older backend sends neither field: every day, every house.
      next.schedules[next.scheduleCount].daysMask = static_cast<uint8_t>((schedule["days_mask"] | 127) & 127);
      const char *target = schedule["target"] | "all";
      next.schedules[next.scheduleCount].houses = strcmp(target, "house1") == 0 ? HOUSE_1_BIT : strcmp(target, "house2") == 0 ? HOUSE_2_BIT : ALL_HOUSES;
      next.scheduleCount++;
    }
  }

  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  sharedCommands = next;
  xSemaphoreGive(sharedMutex);
}

void fillHeartbeat(JsonDocument &doc, const char *deviceKey, const char *serviceNumber, const char *scope,
                   const String &label, unsigned long intervalMs, bool degraded) {
  doc["device_key"] = deviceKey;
  if (serviceNumber != nullptr) {
    doc["service_number"] = serviceNumber;
  }
  doc["scope"] = scope;
  doc["device_label"] = label;
  doc["status"] = degraded ? "warning" : "online";
  doc["wifi_rssi"] = static_cast<int>(WiFi.RSSI());
  doc["heartbeat_interval_seconds"] = static_cast<int>(intervalMs / 1000);
}

// System-wide live state: what every dashboard shows about the tank, pump, and supply.
void uploadControllerHeartbeat(const TelemetrySnapshot &snapshot, PumpMode pumpMode) {
  const bool degraded = snapshot.sensorFault || snapshot.dryRunAlert || snapshot.leakDetected || !snapshot.waterSafe;

  JsonDocument doc;
  fillHeartbeat(doc, "SYSTEM-ESP32", nullptr, "admin", String("Village Controller ESP32"), ADMIN_HEARTBEAT_INTERVAL_MS, degraded);
  doc["meta"]["pump_status"] = snapshot.pumpOn;
  doc["meta"]["pump_mode"] = pumpModeName(pumpMode);
  doc["meta"]["control_mode"] = snapshot.manualControl ? "manual" : "auto";
  doc["meta"]["supply_status"] = snapshot.supplyStatus;
  doc["meta"]["main_valve_open"] = snapshot.mainValveOpen;
  doc["meta"]["house1_valve_open"] = snapshot.house1.valveOpen;
  doc["meta"]["house2_valve_open"] = snapshot.house2.valveOpen;
  doc["meta"]["distribution_active"] = snapshot.distributionActive;
  doc["meta"]["cycle_state"] = cycleStateName(static_cast<SystemCycleState>(snapshot.cycleState));
  doc["meta"]["tank_percentage"] = snapshot.tankPercentage;
  doc["meta"]["water_level_cm"] = snapshot.tankWaterHeightCm;
  doc["meta"]["main_flow_lpm"] = snapshot.mainFlowLitersPerMinute;
  doc["meta"]["leak_detected"] = snapshot.leakDetected;
  doc["meta"]["dry_run_alert"] = snapshot.dryRunAlert;
  doc["meta"]["sensor_fault"] = snapshot.sensorFault;
  doc["meta"]["sensor_fault_reason"] = snapshot.sensorFaultReason;
  doc["meta"]["clock_valid"] = snapshot.clockValid;
  char clockText[6];
  snprintf(clockText, sizeof(clockText), "%02u:%02u", static_cast<unsigned>(snapshot.clockMinutes / 60), static_cast<unsigned>(snapshot.clockMinutes % 60));
  doc["meta"]["clock"] = clockText;
  doc["meta"]["tds_volts"] = snapshot.tdsVolts;
  doc["meta"]["ph_volts"] = snapshot.phVolts;
  doc["meta"]["turbidity_volts"] = snapshot.turbidityVolts;
  doc["meta"]["water_safe"] = snapshot.waterSafe;
  doc["meta"]["ph_validated"] = PH_SENSOR_VALIDATED;
  doc["meta"]["tds_validated"] = TDS_SENSOR_VALIDATED;
  doc["meta"]["turbidity_validated"] = TURBIDITY_SENSOR_VALIDATED;
  doc["meta"]["tds"] = snapshot.tds;
  doc["meta"]["ph"] = snapshot.ph;
  doc["meta"]["turbidity"] = snapshot.turbidity;

  postOk("/heartbeat", doc);
}

// One household's live readings: valve, flow rate, and usage against today's limit.
void uploadHouseHeartbeat(const HouseTelemetry &house, const char *serviceNumber, const String &label) {
  JsonDocument doc;
  fillHeartbeat(doc, serviceNumber, serviceNumber, "user", label, USER_HEARTBEAT_INTERVAL_MS, false);
  doc["meta"]["valve_open"] = house.valveOpen;
  doc["meta"]["flow_lpm"] = house.flowLitersPerMinute;
  doc["meta"]["liters_today"] = house.litersToday;
  doc["meta"]["lpcd_used"] = house.lpcdUsed;
  doc["meta"]["daily_limit_liters"] = house.dailyLimitLiters;
  doc["meta"]["limit_reached"] = house.limitReached;

  postOk("/heartbeat", doc);
}

void uploadTankTelemetry(const TelemetrySnapshot &snapshot) {
  // No valid level reading to report while the sensor is faulty.
  if (snapshot.sensorFault) return;

  JsonDocument doc;
  doc["tank_percentage"] = snapshot.tankPercentage;
  doc["water_level"] = snapshot.tankWaterHeightCm;
  doc["pump_status"] = snapshot.pumpOn;
  postOk("/tank-level", doc);
}

void uploadWaterQuality(const TelemetrySnapshot &snapshot) {
  JsonDocument doc;
  doc["tds_value"] = snapshot.tds;
  doc["ph_value"] = snapshot.ph;
  doc["turbidity_value"] = snapshot.turbidity;
  doc["is_safe"] = snapshot.waterSafe;
  postOk("/water-quality", doc);
}

bool postHouseFlow(const char *serviceNumber, const char *sensorId, float liters, float lpcdUsed) {
  JsonDocument doc;
  doc["service_number"] = serviceNumber;
  doc["flow_sensor_id"] = sensorId;
  doc["liters_used"] = liters;
  doc["lpcd_used"] = lpcdUsed;
  return postOk("/flow", doc);
}

// Uploads the liters accumulated since the last successful upload, so nothing
// measured between uploads is lost. A failed upload puts the liters back.
void uploadFlowUsage() {
  // The backend stores liters to two decimals; smaller amounts keep accumulating.
  const float minimumLiters = 0.01f;
  float house1Liters = 0.0f;
  float house2Liters = 0.0f;

  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  if (sharedTelemetry.house1.pendingLiters >= minimumLiters) {
    house1Liters = sharedTelemetry.house1.pendingLiters;
    sharedTelemetry.house1.pendingLiters = 0.0f;
  }
  if (sharedTelemetry.house2.pendingLiters >= minimumLiters) {
    house2Liters = sharedTelemetry.house2.pendingLiters;
    sharedTelemetry.house2.pendingLiters = 0.0f;
  }
  const float house1Lpcd = sharedTelemetry.house1.lpcdUsed;
  const float house2Lpcd = sharedTelemetry.house2.lpcdUsed;
  xSemaphoreGive(sharedMutex);

  float house1Unsent = 0.0f;
  float house2Unsent = 0.0f;
  if (house1Liters > 0.0f && !postHouseFlow(HOUSE_1_SERVICE_NUMBER, "FLOW-HOUSE-01", house1Liters, house1Lpcd)) {
    house1Unsent = house1Liters;
  }
  if (house2Liters > 0.0f && !postHouseFlow(HOUSE_2_SERVICE_NUMBER, "FLOW-HOUSE-02", house2Liters, house2Lpcd)) {
    house2Unsent = house2Liters;
  }

  if (house1Unsent > 0.0f || house2Unsent > 0.0f) {
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
    sharedTelemetry.house1.pendingLiters += house1Unsent;
    sharedTelemetry.house2.pendingLiters += house2Unsent;
    xSemaphoreGive(sharedMutex);
  }
}

void uploadLeakAlertIfPending() {
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
  const bool pending = sharedTelemetry.leakAlertPending;
  const char *message = sharedTelemetry.leakMessage;
  sharedTelemetry.leakAlertPending = false;
  xSemaphoreGive(sharedMutex);

  if (!pending) return;

  JsonDocument doc;
  doc["affected_house"] = message;
  doc["severity"] = "high";
  if (!postOk("/leakage", doc)) {
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
    sharedTelemetry.leakAlertPending = true;
    xSemaphoreGive(sharedMutex);
  }
}

bool intervalElapsed(unsigned long &lastRunAt, unsigned long intervalMs) {
  const unsigned long now = millis();
  if (lastRunAt != 0 && now - lastRunAt < intervalMs) {
    return false;
  }
  lastRunAt = now == 0 ? 1 : now;
  return true;
}

void networkTask(void *parameter) {
  unsigned long lastCommandsAt = 0;
  unsigned long lastTelemetryAt = 0;
  unsigned long lastFlowUploadAt = 0;
  unsigned long lastWaterQualityAt = 0;
  unsigned long lastAdminHeartbeatAt = 0;
  unsigned long lastUserHeartbeatAt = 0;
  bool timeConfigured = false;

  const String house1Label = String("Household Device ") + HOUSE_1_SERVICE_NUMBER;
  const String house2Label = String("Household Device ") + HOUSE_2_SERVICE_NUMBER;

  // The backend is authenticated by the device secret; the TLS certificate is not pinned.
  secureClient.setInsecure();
  http.setReuse(true);
  http.setTimeout(HTTP_TIMEOUT_MS);

  for (;;) {
    maintainWifi();

    if (WiFi.status() == WL_CONNECTED) {
      if (!timeConfigured) {
        configTime(GMT_OFFSET_SECONDS, 0, NTP_SERVER_1, NTP_SERVER_2);
        timeConfigured = true;
      }

      if (intervalElapsed(lastCommandsAt, STATUS_SYNC_INTERVAL_MS)) {
        fetchBackendCommands();
      }

      if (intervalElapsed(lastAdminHeartbeatAt, ADMIN_HEARTBEAT_INTERVAL_MS)) {
        xSemaphoreTake(sharedMutex, portMAX_DELAY);
        const PumpMode pumpMode = sharedCommands.pumpMode;
        xSemaphoreGive(sharedMutex);
        uploadControllerHeartbeat(readTelemetry(), pumpMode);
      }

      if (intervalElapsed(lastUserHeartbeatAt, USER_HEARTBEAT_INTERVAL_MS)) {
        const TelemetrySnapshot snapshot = readTelemetry();
        uploadHouseHeartbeat(snapshot.house1, HOUSE_1_SERVICE_NUMBER, house1Label);
        uploadHouseHeartbeat(snapshot.house2, HOUSE_2_SERVICE_NUMBER, house2Label);
      }

      uploadLeakAlertIfPending();

      if (intervalElapsed(lastTelemetryAt, TELEMETRY_INTERVAL_MS)) {
        uploadTankTelemetry(readTelemetry());
      }

      if (intervalElapsed(lastFlowUploadAt, FLOW_UPLOAD_INTERVAL_MS)) {
        uploadFlowUsage();
      }

      if (intervalElapsed(lastWaterQualityAt, WATER_QUALITY_INTERVAL_MS)) {
        uploadWaterQuality(readTelemetry());
      }
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ---------------------------------------------------------------------------
// Display and diagnostics
// ---------------------------------------------------------------------------

// Writes a full 16-character row. Overwriting instead of lcd.clear() avoids flicker.
void lcdPrintRow(uint8_t row, String text) {
  while (text.length() < 16) {
    text += ' ';
  }
  lcd.setCursor(0, row);
  lcd.print(text.substring(0, 16));
}

void updateLcd() {
  const String tankText = String("Tank:") + static_cast<int>(systemState.tankPercentage) + "%";

  if (!wifiConnected) {
    lcdPrintRow(0, "WiFi: RECONNECT");
    lcdPrintRow(1, tankText);
    return;
  }

  if (!waterQuality.isSafe) {
    lcdPrintRow(0, "WATER IS UNSAFE");
  } else {
    lcdPrintRow(0, tankText + (relays.pumpOn ? " P:ON" : " P:OFF"));
  }

  if (systemState.sensorFault) {
    lcdPrintRow(1, "Level sensor ERR");
  } else if (systemState.leakDetected) {
    lcdPrintRow(1, "Leak Alert!");
  } else if (systemState.dryRunAlert) {
    lcdPrintRow(1, "Pump dry-run!");
  } else if (!systemState.clockValid) {
    lcdPrintRow(1, "Clock not set");
  } else if (systemState.distributionActive) {
    lcdPrintRow(1, "Supply: ACTIVE");
  } else {
    lcdPrintRow(1, "Supply: IDLE");
  }
}

void printSystemDiagnostics() {
  Serial.println("--- Diagnostics ---");
  Serial.print("Tank Distance: "); Serial.println(systemState.tankDistanceCm);
  Serial.print("Tank Percentage: "); Serial.println(systemState.tankPercentage);
  Serial.print("Pump Thresholds (on/off): ");
  Serial.print(pumpOnThreshold()); Serial.print("/"); Serial.println(pumpOffThreshold());
  Serial.print("Control Mode: "); Serial.println(commands.manualControl ? "manual" : "auto");
  Serial.print("Current State: "); Serial.println(cycleStateName(cycleState));
  Serial.print("Status: "); Serial.println(systemState.supplyStatus);
  Serial.print("Pump Status: "); Serial.println(relays.pumpOn);
  Serial.print("Pump Mode: "); Serial.println(pumpModeName(commands.pumpMode));
  Serial.print("Main Valve Status: "); Serial.println(relays.mainValveOpen);
  Serial.print("House1 Valve Status: "); Serial.println(relays.house1ValveOpen);
  Serial.print("House2 Valve Status: "); Serial.println(relays.house2ValveOpen);
  Serial.print("Admin Valves (main/h1/h2): ");
  Serial.print(commands.mainValveOpen); Serial.print("/");
  Serial.print(commands.house1ValveOpen); Serial.print("/");
  Serial.println(commands.house2ValveOpen);
  Serial.print("Schedules From Admin: "); Serial.println(commands.scheduleCount);
  Serial.print("Sensor Fault: "); Serial.println(systemState.sensorFault);
  Serial.print("Dry Run Alert: "); Serial.println(systemState.dryRunAlert);
  Serial.print("Leak Detected: "); Serial.println(systemState.leakDetected);
  Serial.print("Clock Valid: "); Serial.println(systemState.clockValid);
  Serial.print("WiFi: "); Serial.println(wifiConnected);
  Serial.print("Water TDS/pH/NTU: ");
  Serial.print(waterQuality.tds); Serial.print("/");
  Serial.print(waterQuality.ph); Serial.print("/");
  Serial.print(waterQuality.turbidity);
  Serial.println(waterQuality.isSafe ? " (safe)" : " (UNSAFE)");
  Serial.print("Water sensor volts TDS/pH/turbidity: ");
  Serial.print(waterQuality.tdsVolts); Serial.print("/");
  Serial.print(waterQuality.phVolts); Serial.print("/");
  Serial.println(waterQuality.turbidityVolts);
  if (systemState.sensorFault) {
    Serial.print("Level sensor fault reason: "); Serial.println(systemState.sensorFaultReason);
  }
  Serial.print("Main Flow: "); Serial.println(flow.mainLitersPerMinute);
  Serial.print("House1 Flow: "); Serial.println(flow.house1LitersPerMinute);
  Serial.print("House2 Flow: "); Serial.println(flow.house2LitersPerMinute);
  if (flowNoiseSeen) {
    flowNoiseSeen = false;
    Serial.println("[FLOW] Noise discarded on a flow sensor line. Check its wiring and pull-up resistor.");
  }
  Serial.print("House1 Liters Today/Limit: ");
  Serial.print(house1Usage.totalLitersToday); Serial.print("/"); Serial.println(house1Usage.dailyLimitLiters);
  Serial.print("House2 Liters Today/Limit: ");
  Serial.print(house2Usage.totalLitersToday); Serial.print("/"); Serial.println(house2Usage.dailyLimitLiters);
  Serial.println("-------------------");
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

void initializePeripherals() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  rtcFound = rtc.begin();
  if (!rtcFound) {
    Serial.println("[CLOCK] RTC not found, waiting for network time");
  } else if (rtc.lostPower()) {
    Serial.println("[CLOCK] RTC lost power, waiting for network time");
  } else {
    rtcReady = true;
  }

  lcd.init();
  lcd.backlight();
}

// Sets the off level before the pin becomes an output, so an active-low relay
// does not switch on while the board boots.
void initializeRelayPin(uint8_t pin) {
  writeRelay(pin, false);
  pinMode(pin, OUTPUT);
  writeRelay(pin, false);
}

void initializePins() {
  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);

  initializeRelayPin(PUMP_RELAY_PIN);
  initializeRelayPin(TANK_OUTLET_VALVE_RELAY_PIN);
  initializeRelayPin(HOUSE_1_VALVE_RELAY_PIN);
  initializeRelayPin(HOUSE_2_VALVE_RELAY_PIN);

  pinMode(MAIN_FLOW_PIN, INPUT);
  pinMode(HOUSE_1_FLOW_PIN, INPUT);
  pinMode(HOUSE_2_FLOW_PIN, INPUT_PULLUP);

  pinMode(TDS_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);

  attachInterrupt(digitalPinToInterrupt(MAIN_FLOW_PIN), onMainFlowPulse, RISING);
  attachInterrupt(digitalPinToInterrupt(HOUSE_1_FLOW_PIN), onHouse1FlowPulse, RISING);
  attachInterrupt(digitalPinToInterrupt(HOUSE_2_FLOW_PIN), onHouse2FlowPulse, RISING);
}

void testRelay(const char *name, uint8_t pin) {
  Serial.print("[RELAY TEST] ");
  Serial.print(name);
  Serial.println(" ON");
  writeRelay(pin, true);
  delay(2000);
  Serial.print("[RELAY TEST] ");
  Serial.print(name);
  Serial.println(" OFF");
  writeRelay(pin, false);
  delay(1000);
}

void setup() {
  Serial.begin(115200);
  initializePins();
  initializePeripherals();

  if (RUN_RELAY_SELF_TEST) {
    testRelay("Pump", PUMP_RELAY_PIN);
    testRelay("Main Valve", TANK_OUTLET_VALVE_RELAY_PIN);
    testRelay("House 1 Valve", HOUSE_1_VALVE_RELAY_PIN);
    testRelay("House 2 Valve", HOUSE_2_VALVE_RELAY_PIN);
  }

  house1Usage.familyMembers = HOUSE_1_FAMILY_MEMBERS;
  house2Usage.familyMembers = HOUSE_2_FAMILY_MEMBERS;
  house1Usage.dailyLimitLiters = FALLBACK_LPCD_LIMIT * HOUSE_1_FAMILY_MEMBERS;
  house2Usage.dailyLimitLiters = FALLBACK_LPCD_LIMIT * HOUSE_2_FAMILY_MEMBERS;

  // Pulses counted during the relay test are not real consumption.
  consumePulseCounter(mainFlowPulses);
  consumePulseCounter(house1FlowPulses);
  consumePulseCounter(house2FlowPulses);

  sharedMutex = xSemaphoreCreateMutex();
  WiFi.mode(WIFI_STA);
  xTaskCreatePinnedToCore(networkTask, "network", NETWORK_TASK_STACK_BYTES, nullptr, 1, nullptr, 0);
}

void loop() {
  const unsigned long nowMs = millis();

  if (nowMs - lastSensorReadAt >= SENSOR_READ_INTERVAL_MS) {
    const unsigned long elapsed = lastSensorReadAt == 0 ? SENSOR_READ_INTERVAL_MS : nowMs - lastSensorReadAt;
    lastSensorReadAt = nowMs;

    updateTankState();
    measureWaterQuality();
    updateFlowState(elapsed);
    pullBackendCommands();
    runStateMachine();
    publishTelemetry();
  }

  if (nowMs - lastDiagnosticsAt >= DIAGNOSTICS_INTERVAL_MS) {
    lastDiagnosticsAt = nowMs;
    printSystemDiagnostics();
  }

  if (nowMs - lastLcdRefreshAt >= LCD_REFRESH_INTERVAL_MS) {
    lastLcdRefreshAt = nowMs;
    updateLcd();
  }
}
