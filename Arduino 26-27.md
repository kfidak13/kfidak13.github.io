# 9-21-26 · Arduino & Piezo Buzzer: Composing Music in Code

## Overview

This project started as a way to learn how a piezo buzzer actually makes sound, and turned into writing a full four-part original composition entirely in Arduino code. The setup is simple: a piezo buzzer wired into a breadboard connected to an Arduino Uno, with sound generated through `tone()` calls sequenced note-by-note from arrays of frequencies and note lengths. A lot of this got built during free periods, laptop and breadboard on whatever table was open.

## Phase 1: Für Elise — learning to play notes in code

I started with one piezo buzzer on the breadboard and picked Für Elise as my first target, mostly because I already know how it's supposed to sound, so I'd immediately notice if a note or timing value was wrong. That made it the fastest way to learn the actual mechanics: how `tone(pin, frequency, duration)` works, why `delay()` has to line up with each note so they don't overlap or leave dead air, and how to store a whole melody as parallel arrays (one for pitch, one for length) instead of writing a separate line of code for every single note.

<img width="600" height="1000" alt="48805C60-A084-4241-9B00-126957C0E12A_1_102_o" src="https://github.com/user-attachments/assets/3ac533af-f5f2-4e5c-9cfd-f92330cefb46" />

## Phase 2: Human voice

Once the basics clicked, I tried to get the buzzer to sound less like a beep and more like a human voice. The catch is that `tone()` only outputs a flat square wave, so a single piezo can't actually change timbre the way vocal cords can (WebbGpt); no amount of clever code turns it into a "voice." So instead I worked on the parts of voice-like sound I actually had control over: phrasing, small tempo bends, and layering. I added a second and then a third piezo to the breadboard so I could run a melody line against a bass/harmony line at the same time, which got a lot closer to something that felt sung rather than just beeped.

## Phase 3: writing an original piece

With the mechanics and the layering worked out with webbgpt, I moved from playing existing songs to writing my own. The first version structures the piece into four labeled "acts," each built the same way: a melody array, a bass array, a duration array, but fed into one shared `playSection()` function with different tempo, note-length, and duration-scaling values:

- **Act 1 — Welcome and wistful:** a slow, quiet opening.
- **Act 2 — Slow, dark, flowing:** lower notes, longer note lengths.
- **Act 3 — The chase:** played twice, with the second pass sped up to build tension.
- **Act 4 — Triumph:** a real crescendo to close it out.

<img width="600" height="1000" alt="42336171-AAFD-4D98-B20D-05C2BB48B5A5_1_102_o" src="https://github.com/user-attachments/assets/dcc6d3cd-7901-4bed-991f-29077ac9f8e1" />

Building it this way meant the "feel" of each act came down to tuning a handful of limits - tempo, gap between notes, duration scaling - instead of having webbgpt rewrite the playback logic four separate times.

## Phase 4: Volume control

I rewrote the piece again as "Gymnopédie in A Minor," this time going after two things the first version didn't have: a tempo that breathes instead of staying locked to fixed values, and actual volume control.

**Rubato.** Instead of a flat tempo per section, I map each note's position in the piece through a sine curve so the tempo forms a smooth arc — slowest at the very start and end, fastest through the middle — plus a ritardando on the last four notes that stretches them out progressively:

```cpp
float progress = (float)i / (numNotes - 1);   // 0.0 -> 1.0
float arc = sin(progress * 3.14159);          // hill: 0 -> 1 -> 0
int t = 2100 - (int)(arc * 700);

if (i >= numNotes - 4) {
  t += (i - (numNotes - 5)) * 150;            // +150, +300, +450, +600
}
```

**Volume.** The built-in `tone()` function doesn't have a volume knob — it always drives the buzzer with a fixed 50% duty cycle square wave, so every note comes out at the same loudness no matter what. To get real dynamics, I dropped `tone()` entirely and wrote my own note-playing function, `playTwoNotes()`, that bit-bangs the pins directly with `digitalWrite()` and `delayMicroseconds()`.

The trick is that a piezo doesn't get louder from higher voltage the way a speaker does; it gets louder (or thinner and quieter) based on how long the pin is held HIGH within each cycle of the wave, i.e. the duty cycle. So for every note Webbgpt calculated the full period of the wave from its frequency, then use a `vol` parameter to decide what fraction of that period the pin actually stays HIGH:

```cpp
long period1 = (f1 > 0) ? 1000000L / f1 : 0;
long high1 = period1 * vol / 1000;
if (period1 > 0 && high1 < 2) high1 = 2;
```

A low `vol` means the pin is only HIGH for a tiny sliver of each cycle — a narrow pulse that reads as quiet and thin. A higher `vol` widens that pulse toward a full square wave, which sounds louder and fuller. The `if (high1 < 2)` line just guards against the pulse shrinking to nothing and going silent by accident.

Doing this for two notes at once (melody on pin 3, bass on pin 11) meant I couldn't just use one blocking loop; Webbgpt ran two independent timers (`next1` and `next2`, tracked with `micros()`) inside the same `while` loop, so each pin fires its own pulses on its own schedule without waiting on the other.

Once volume was a real, tunable parameter instead of a fixed constant, I could use it for actual dynamics. In `setup()`, the B section gets a gentle swell by nudging the volume up for that stretch of notes, timed to land on the same stretch where the rubato tempo is also fastest:

```cpp
int v = volume;
if (i >= 24 && i <= 35) v = volume + 2;
```

Full sketch:

```cpp
#include "pitches.h"

// ============================================================
//  "GYMNOPÉDIE IN A MINOR" - original composition, v2
//  Now with RUBATO: smooth tempo arc + ritardando ending
//  Slowest at the edges, most urgent at the center
//  Pin 3 = melody | Pin 11 = bass
// ============================================================

int volume = 10;

int melody[] = {
  // — A section: floating —
  NOTE_A4, 0, 0,
  NOTE_G4, 0, 0,
  NOTE_A4, NOTE_B4, NOTE_C5,
  NOTE_B4, 0, 0,
  NOTE_C5, 0, 0,
  NOTE_D5, NOTE_C5, NOTE_A4,
  NOTE_GS4, 0, 0,
  NOTE_A4, 0, 0,

  // — B section: lifting, then letting go —
  NOTE_C5, 0, 0,
  NOTE_E5, 0, 0,
  NOTE_D5, NOTE_E5, NOTE_F5,
  NOTE_E5, 0, 0,
  NOTE_C5, NOTE_B4, NOTE_A4,
  NOTE_B4, 0, 0,
  NOTE_GS4, NOTE_B4, NOTE_D5,
  NOTE_A4, 0, NOTE_A4
};

int bass[] = {
  NOTE_F3, NOTE_A3, NOTE_C4,
  NOTE_C3, NOTE_G3, NOTE_E4,
  NOTE_F3, NOTE_A3, NOTE_C4,
  NOTE_C3, NOTE_G3, NOTE_B3,
  NOTE_A3, NOTE_C4, NOTE_E4,
  NOTE_D3, NOTE_F3, NOTE_A3,
  NOTE_E3, NOTE_GS3, NOTE_B3,
  NOTE_A3, NOTE_E4, NOTE_C4,

  NOTE_F3, NOTE_A3, NOTE_C4,
  NOTE_C3, NOTE_G3, NOTE_B3,
  NOTE_D3, NOTE_A3, NOTE_F4,
  NOTE_E3, NOTE_B3, NOTE_GS4,
  NOTE_A3, NOTE_E4, NOTE_A4,
  NOTE_D3, NOTE_F3, NOTE_A3,
  NOTE_E3, NOTE_GS3, NOTE_D4,
  NOTE_A3, NOTE_E4, NOTE_A4
};

int noteDurations[] = {
  4, 4, 4,  4, 4, 4,  4, 4, 4,  4, 4, 4,
  4, 4, 4,  4, 4, 4,  4, 4, 4,  4, 4, 4,
  4, 4, 4,  4, 4, 4,  4, 4, 4,  4, 4, 4,
  4, 4, 4,  4, 4, 4,  4, 4, 4,  4, 4, 1
};

// ---- The whisper engine ----
void playTwoNotes(long f1, long f2, long durationMs, int vol) {
  if (vol < 1) vol = 1;
  if (vol > 500) vol = 500;

  long period1 = (f1 > 0) ? 1000000L / f1 : 0;
  long period2 = (f2 > 0) ? 1000000L / f2 : 0;
  long high1 = period1 * vol / 1000;
  long high2 = period2 * vol / 1000;
  if (period1 > 0 && high1 < 2) high1 = 2;
  if (period2 > 0 && high2 < 2) high2 = 2;

  unsigned long start = millis();
  unsigned long next1 = micros(), next2 = micros();

  while (millis() - start < durationMs) {
    unsigned long now = micros();
    if (period1 > 0 && (long)(now - next1) >= 0) {
      digitalWrite(3, HIGH);
      delayMicroseconds(high1);
      digitalWrite(3, LOW);
      next1 += period1;
    }
    if (period2 > 0 && (long)(now - next2) >= 0) {
      digitalWrite(11, HIGH);
      delayMicroseconds(high2);
      digitalWrite(11, LOW);
      next2 += period2;
    }
  }
  digitalWrite(3, LOW);
  digitalWrite(11, LOW);
}

void setup() {
  pinMode(3, OUTPUT);
  pinMode(11, OUTPUT);

  int numNotes = sizeof(melody) / sizeof(melody[0]);

  for (int i = 0; i < numNotes; i++) {

    // ===== RUBATO: smooth tempo arc =====
    // Slowest at start (2100) and end (2100+), fastest mid-song (1400)
    float progress = (float)i / (numNotes - 1);   // 0.0 -> 1.0
    float arc = sin(progress * 3.14159);          // hill: 0 -> 1 -> 0
    int t = 2100 - (int)(arc * 700);

    // Ritardando: last 4 notes stretch progressively longer
    if (i >= numNotes - 4) {
      t += (i - (numNotes - 5)) * 150;            // +150, +300, +450, +600
    }
    // ====================================

    int d = t / noteDurations[i];

    // Dynamics: B section swells gently (matches the tempo peak!)
    int v = volume;
    if (i >= 24 && i <= 35) v = volume + 2;

    playTwoNotes(melody[i], bass[i], d, v);
    delay(d * 0.08);
  }
}

void loop() {
  // ...douloureux. RESET to play again.
}
```

## Reflection

The biggest lesson was that a piezo can be timed and pitched precisely but can't blend timbre the way a real instrument or voice can, so any expressiveness had to come from structure: tempo, dynamics through duty-cycle volume, and repetition with variation rather than from the sound itself. Rewriting the piece as "Gymnopédie in A Minor" pushed that further; instead of hardcoding a mood per section as the first version did, the rubato arc and the volume swell are both derived from the note's position in the piece, so the expression is generated rather than hand-placed. It also pushed me to think about music more structurally than I had before: breaking a piece into named sections, deciding what each one should feel like, then translating something like "wistful" or "triumphant" into actual tempo, duration, and volume values.

## What's next

I want to try real chords using multiple piezos firing at once rather than just melody-plus-bass, and eventually look at a small speaker/DAC setup so I have more headroom on volume and can start shaping timbre instead of just duty cycle.
