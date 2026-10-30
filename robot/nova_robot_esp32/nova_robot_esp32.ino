// Nova Robot: an ESP32 body for Nova AI's talking avatar.
// Receives one JSON message per line over Bluetooth LE (Nordic UART service)
// or USB serial (115200 baud) and moves a jaw, nods, turns and lights the eyes.
// Libraries: ESP32Servo, ArduinoJson 7. Wiring and messages: robot/README.md

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// ---- pins ----
const int JAW_PIN = 13, NOD_PIN = 12, TURN_PIN = 14;
const int LED_R = 25, LED_G = 26, LED_B = 27;
const int BUTTON_PIN = 4;

// ---- servo angles (adjust for your build) ----
const int JAW_CLOSED = 90, JAW_OPEN = 125;
const int NOD_CENTER = 90, TURN_CENTER = 90;

#define UART_SERVICE "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_RX      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // app writes here
#define UART_TX      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // we notify here

Servo jaw, nod, turn;
BLECharacteristic *txChar = nullptr;
bool bleConnected = false;
String bleBuffer, serialBuffer;

float mouthTarget = 0, mouthNow = 0;
String state = "idle";
unsigned long gestureUntil = 0;
String gesture = "";
unsigned long lastButton = 0;

void setEyes(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

void showEmotion(const String &e) {
  if (e == "happy") setEyes(255, 200, 0);
  else if (e == "caring") setEyes(255, 80, 160);
  else if (e == "thinking") setEyes(120, 80, 255);
  else if (e == "curious") setEyes(0, 255, 160);
  else if (e == "sorry") setEyes(40, 60, 255);
  else setEyes(0, 160, 255);  // calm
}

// Send a JSON line to the app (over BLE if connected, and always over USB)
void sendLine(const String &line) {
  Serial.println(line);
  if (bleConnected && txChar) {
    String out = line + "\n";
    for (size_t i = 0; i < out.length(); i += 20) {
      String part = out.substring(i, i + 20);
      txChar->setValue((uint8_t *)part.c_str(), part.length());
      txChar->notify();
      delay(5);
    }
  }
}

void handleLine(const String &line) {
  if (!line.startsWith("{")) return;
  JsonDocument doc;
  if (deserializeJson(doc, line)) return;
  String t = doc["t"] | "";
  if (t == "mouth") {
    mouthTarget = constrain((float)(doc["v"] | 0.0), 0.0f, 1.0f);
  } else if (t == "state") {
    state = doc["v"] | "idle";
    if (state != "speaking") mouthTarget = 0;
    if (state == "listening") setEyes(255, 40, 40);
  } else if (t == "emotion") {
    showEmotion(doc["v"] | "calm");
  } else if (t == "gesture") {
    gesture = doc["v"] | "";
    gestureUntil = millis() + 1500;
  } else if (t == "hello") {
    sendLine("{\"t\":\"hello\",\"name\":\"Nova Robot\"}");
  }
  // "say" carries the spoken sentence: show it on a screen if you add one
}

void feed(String &buffer, const char *data, size_t len) {
  for (size_t i = 0; i < len; i++) {
    char c = data[i];
    if (c == '\n') {
      handleLine(buffer);
      buffer = "";
    } else if (buffer.length() < 600) {
      buffer += c;
    }
  }
}

class ServerEvents : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override { bleConnected = true; }
  void onDisconnect(BLEServer *s) override {
    bleConnected = false;
    bleBuffer = "";
    mouthTarget = 0;
    BLEDevice::startAdvertising();  // let the app reconnect
  }
};

class RxEvents : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    String v = c->getValue();
    feed(bleBuffer, v.c_str(), v.length());
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  jaw.attach(JAW_PIN);
  nod.attach(NOD_PIN);
  turn.attach(TURN_PIN);
  jaw.write(JAW_CLOSED);
  nod.write(NOD_CENTER);
  turn.write(TURN_CENTER);
  showEmotion("calm");

  BLEDevice::init("Nova Robot");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerEvents());
  BLEService *service = server->createService(UART_SERVICE);
  txChar = service->createCharacteristic(UART_TX, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());
  BLECharacteristic *rx = service->createCharacteristic(UART_RX, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxEvents());
  service->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(UART_SERVICE);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Nova Robot ready");
}

void loop() {
  // USB serial messages
  while (Serial.available()) {
    char c = Serial.read();
    feed(serialBuffer, &c, 1);
  }

  // Jaw: smooth movement so it doesn't jitter
  mouthNow += (mouthTarget - mouthNow) * 0.35;
  jaw.write(JAW_CLOSED + (int)((JAW_OPEN - JAW_CLOSED) * mouthNow));

  // Gestures and idle movement
  unsigned long now = millis();
  if (now < gestureUntil) {
    float phase = (gestureUntil - now) / 1500.0;
    if (gesture == "nod") nod.write(NOD_CENTER + (int)(12 * sin(phase * 4 * PI)));
    else if (gesture == "wave") turn.write(TURN_CENTER + (int)(25 * sin(phase * 4 * PI)));
    else if (gesture == "think") { nod.write(NOD_CENTER - 10); turn.write(TURN_CENTER + 15); }
  } else if (state == "speaking") {
    nod.write(NOD_CENTER + (int)(3 * sin(now / 400.0)));  // small natural movement
    turn.write(TURN_CENTER);
  } else {
    nod.write(NOD_CENTER);
    turn.write(TURN_CENTER + (int)(4 * sin(now / 2500.0)));  // looks around a little
  }

  // Talk button
  if (digitalRead(BUTTON_PIN) == LOW && now - lastButton > 600) {
    lastButton = now;
    sendLine("{\"t\":\"button\",\"v\":\"talk\"}");
  }
  delay(20);
}
