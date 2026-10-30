# Give Nova AI a body: the robot guide

Nova AI's talking avatar (**⋯ menu → Talk to Nova**, or type `/talk`) can drive a real robot.
While Nova talks, the robot opens and closes its mouth in time with the voice, changes its eye
colour to match Nova's mood, nods, waves and turns to "think". The robot can also listen: a
button on it starts Nova listening, and a robot with its own speech-to-text can send questions.

Nova speaks through the phone, tablet or laptop running Nova AI. Put that device inside or
behind the robot, or connect a Bluetooth speaker to it, so the voice seems to come from the robot.

## What you need (about ₹1,500 to ₹2,500)

| Part | Job |
|---|---|
| ESP32 dev board (ESP32-WROOM-32) | The robot's brain; talks to Nova AI over Bluetooth |
| 2 × SG90 micro servo | Jaw (mouth) and head nod |
| 1 × SG90 micro servo (optional) | Head turn (left and right) |
| 1 × RGB LED (common cathode) + 3 × 220 Ω resistors | Eye colour (mood) |
| 1 × push button | "Talk" button |
| 5 V 2 A power supply or power bank | Servos need more power than USB from a laptop |
| A head and jaw | Cardboard, a 3D print, or a soft toy with a hinged jaw |

## Wiring

| ESP32 pin | Goes to |
|---|---|
| GPIO 13 | Jaw servo signal |
| GPIO 12 | Nod servo signal |
| GPIO 14 | Turn servo signal (optional) |
| GPIO 25, 26, 27 | LED red, green, blue (each through a 220 Ω resistor) |
| GPIO 4 | Button (other leg to GND) |
| 5 V and GND | Servo power (share GND with the ESP32) |

## Flash the program

1. Install the **Arduino IDE** and add ESP32 boards (Boards Manager → "esp32" by Espressif, version 3.0 or newer).
2. Library Manager: install **ESP32Servo** and **ArduinoJson** (version 7).
3. Open `nova_robot_esp32/nova_robot_esp32.ino`, choose your ESP32 board and port, and upload.
4. Open Nova AI → **Talk to Nova** → ⚙ → **Bluetooth** → choose **Nova Robot**.

Bluetooth works in Chrome on Android, Windows and Mac (not on iPhone).
**USB cable** works in Chrome or Edge on a computer: the same program also listens on USB
serial at 115200 baud. **Wi-Fi** connects to a WebSocket on the same computer, such as
`ws://localhost:8765` from a Raspberry Pi or PC bridge. Browsers block plain `ws://` to other
devices from a secure page, so use Bluetooth or USB for a robot on its own.

## The messages

One JSON object per line. Nova AI sends:

```json
{"t":"hello","app":"Nova AI"}
{"t":"state","v":"listening"}        // idle | listening | thinking | speaking
{"t":"emotion","v":"happy"}          // calm | happy | caring | thinking | curious | sorry
{"t":"mouth","v":0.6}                // 0 = closed, 1 = wide open; about 10 a second while speaking
{"t":"say","text":"Hello there!"}    // the sentence being spoken (for a screen or captions)
{"t":"gesture","v":"nod"}            // wave | nod | think
```

The robot can send:

```json
{"t":"hello","name":"Nova Robot"}    // shown in the app
{"t":"button","v":"talk"}            // start listening
{"t":"heard","text":"What's the weather today?"}   // ask Nova a question
```

Anything that isn't a JSON line is ignored, so debug prints are fine.

## Ideas

- **Eyes:** use two small round displays (GC9A01) or an 8×8 LED matrix and draw eyes that blink.
- **Screen captions:** show the `say` text on an OLED for people who can't hear well.
- **Wheels:** add `{"t":"gesture","v":"wave"}` handling to drive forward and back a little.
- **Better jaw:** smooth the `mouth` value (the example does) so the jaw doesn't jitter.

## Safety

Keep fingers away from moving servos, don't power servos from the ESP32's 3.3 V pin, and
unplug the power before changing wires. Nova AI is a helper, not a doctor, counsellor or
financial adviser: a robot running it should say so, and point people to real help
(Tele-MANAS 14416, emergency 112) the way the app does.
