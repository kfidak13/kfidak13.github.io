# 9-21-26 · Arduino & Piezo Buzzer: Composing Music in Code

## Overview

This project started as a way to learn how a piezo buzzer actually makes sound, and turned into writing a full four-part original composition entirely in Arduino code. The setup is simple: a piezo buzzer wired into a breadboard connected to an Arduino Uno, with sound generated through `tone()` calls sequenced note-by-note from arrays of frequencies and note lengths. A lot of this got built during free periods, laptop and breadboard on whatever table was open.

## Phase 1: Für Elise — learning to play notes in code

I started with one piezo buzzer on the breadboard and picked Für Elise as my first target, mostly because I already know how it's supposed to sound, so I'd immediately notice if a note or timing value was wrong. That made it the fastest way to learn the actual mechanics: how `tone(pin, frequency, duration)` works, why `delay()` has to line up with each note so they don't overlap or leave dead air, and how to store a whole melody as parallel arrays (one for pitch, one for length) instead of writing a separate line of code for every single note.

<img width="1080" height="1920" alt="48805C60-A084-4241-9B00-126957C0E12A_1_102_o" src="https://github.com/user-attachments/assets/3ac533af-f5f2-4e5c-9cfd-f92330cefb46" />

## Phase 2: chasing a human voice

Once the basics clicked, I tried to get the buzzer to sound less like a beep and more like a human voice. The catch is that `tone()` only outputs a flat square wave, so a single piezo can't actually change timbre the way vocal cords can (WebbGpt), no amount of clever code turns it into a "voice." So instead I worked on the parts of voice-like sound I actually had control over: phrasing, small tempo bends, and layering. I added a second and then a third piezo to the breadboard so I could run a melody line against a bass/harmony line at the same time, which got a lot closer to something that felt sung rather than just beeped.

## Phase 3: writing an original piece

With the mechanics and the layering worked out, I moved from playing existing songs to writing my own. The final sketch structures the piece into four labeled "acts," each built the same way,
 a melody array, a bass array, a duration array, but fed into one shared `playSection()` function with different tempo, note-length, and duration-scaling values:

<img width="1080" height="1920" alt="42336171-AAFD-4D98-B20D-05C2BB48B5A5_1_102_o" src="https://github.com/user-attachments/assets/dcc6d3cd-7901-4bed-991f-29077ac9f8e1" />

Building it this way meant the "feel" of each act came down to tuning a handful of parameters — tempo, gap between notes, duration scaling — instead of rewriting the playback logic four separate times.

## Adding volume control

The built-in `tone()` function doesn't have a volume knob — it always drives the buzzer with a fixed 50% duty cycle square wave, so every note comes out at the same loudness no matter what. To get actual dynamics into the piece, I dropped `tone()` entirely and wrote my own note-playing function, `playTwoNotes()`, that bit-bangs the pins directly with `digitalWrite()` and `delayMicroseconds()`.

The trick is that a piezo doesn't get louder from higher voltage the way a speaker does — it gets louder (or thinner and quieter) based on how long the pin is held HIGH within each cycle of the wave, i.e. the duty cycle. So for every note I calculate the full period of the wave from its frequency:

```cpp
long period1 = (f1 > 0) ? 1000000L / f1 : 0;
```

and then use `vol` to decide what fraction of that period the pin actually stays HIGH:

```cpp
long high1 = period1 * vol / 1000;
if (period1 > 0 && high1 < 2) high1 = 2;
```

A low `vol` (like the default `10`) means the pin is only HIGH for a tiny sliver of each cycle — a narrow pulse that reads as quiet and thin. A higher `vol` widens that pulse toward a full square wave, which sounds louder and fuller. The `if (high1 < 2) high1 = 2` line just guards against the pulse shrinking to nothing and going silent by accident.

Doing this for two notes at once (melody on pin 3, bass on pin 11) meant I couldn't just use one blocking loop — I run two independent timers (`next1` and `next2`, tracked with `micros()`) inside the same `while` loop, so each pin fires its own pulses on its own schedule without waiting on the other.

Once I had volume as a real, tunable parameter instead of a fixed constant, I could use it for actual dynamics instead of just a flat setting. In `setup()`, the B section gets a gentle swell by nudging the volume up for that stretch of notes:

```cpp
int v = volume;
if (i >= 24 && i <= 35) v = volume + 2;
```

So the loudest part of the piece lines up with the same stretch where the rubato tempo is also fastest, instead of the two effects fighting each other.

## Reflection

The biggest lesson was that a piezo can be timed and pitched precisely but can't blend timbre the way a real instrument or voice can, so any expressiveness had to come from structure: tempo, dynamics through duration scaling, and repetition with variation rather than from the sound itself. It also pushed me to think about music more structurally than I had before, breaking a piece into named sections, deciding what each one should feel like, then translating something like "wistful" or "triumphant" into actual tempo and note values.

## What's next

I want to try real chords using multiple piezos firing at once with a non-blocking timer instead of `delay()` (which currently blocks the whole board), and eventually look at a small speaker/DAC setup so I have real control over volume and timbre instead of just square waves.
