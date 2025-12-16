# Project Progress Overview

Between Days 3 and 8, our focus shifted from learning individual components to building a coordinated scanning system. Early on, we concentrated on understanding stepper motors and single-axis motion. As the project progressed, we began refining our code and integrating two stepper motors to enable scanning along both the X and Y axes, bringing the scanner closer to true 2D data collection.

This phase marked the transition from experimentation to system-level thinking.

Days 3–4: Foundations of Motion Control

During Days 3 and 4, the primary goal was to understand how stepper motors operate and how to control them accurately using an Arduino and A4988 drivers. Since a scanner relies on precise and repeatable motion, this knowledge was critical.

# We learned how:

Stepper motors move in discrete angular steps

Step counts translate directly into rotational angles

Drivers simplify motor control using STEP and DIR signals

By the end of Day 4, we had reliable single-axis motion and a scanning routine capable of rotating a sensor, collecting distance data, and outputting usable values over serial communication.

# Days 5–6: Code Refinement and Stability

Once basic scanning functionality was working, Days 5 and 6 were spent refining and cleaning up the code. Early versions worked, but they were difficult to scale and debug. Improving structure became necessary before adding more hardware.

# Key improvements during this stage included:

Breaking repeated logic into reusable functions

Standardizing direction and step control

Improving variable naming and readability

Reducing hard-coded values where possible

These refinements made the code easier to understand and allowed us to modify motion behavior without introducing new bugs. This step was especially important before adding a second motor, since errors would become harder to isolate with increased system complexity.

Days 7–8: Dual-Axis Scanning (X and Y)
Adding a Second Stepper Motor

During Days 7 and 8, we mounted two stepper motors onto the scanner frame to enable movement along both the X-axis and Y-axis. One motor controlled horizontal rotation, while the second motor introduced vertical or lateral movement.

This upgrade transformed the scanner from a single sweep system into a grid-based scanning platform, capable of collecting multiple scan lines across different positions.

# Coordinating X and Y Motion

With two motors, the scanning process followed a structured pattern:

Move the X-axis motor in small increments

Record distance data at each X position

After completing a full X sweep, step the Y-axis motor

Repeat the X scan at the new Y position

This approach is similar to how a printer or CNC machine operates and allows the scanner to build a 2D map of distance measurements.

## Conceptually, the scan now resembled a matrix:

X steps represent columns

Y steps represent rows

Each data point corresponds to a specific (X, Y) position

# Refining the Scanning Code

To support two motors, the code was expanded to include:

Separate STEP and DIR pins for X and Y axes

Independent movement functions for each motor

A nested loop structure for systematic scanning

This refinement ensured that each axis could be controlled independently while still working together during the scan.

Example structure:

for (int y = 0; y < Y_STEPS; y++) {
  moveY(1);
  for (int x = 0; x < X_STEPS; x++) {
    moveX(1);
    float distance = getDistance();
    Serial.print(x);
    Serial.print(",");
    Serial.print(y);
    Serial.print(",");
    Serial.println(distance);
  }
}


This output format makes it much easier to reconstruct scan data later during visualization or modeling.

# Challenges Encountered

Introducing a second motor also introduced new challenges:

Timing conflicts between motor movement and sensor readings

Increased risk of direction logic errors

Mechanical alignment issues affecting consistency

Solving these problems required careful testing, slower movement speeds, and frequent verification of both hardware and software behavior.

# Reflection on Days 3–8

By the end of Day 8, the project had progressed significantly:

Motion control was reliable on both axes

Code was modular, readable, and easier to debug

The scanner could collect structured 2D scan data

The system was prepared for future data processing and visualization

This phase laid the groundwork for turning raw measurements into meaningful spatial representations and pushed the project from a concept demonstration toward a functional scanner.

Credits

Project Partners: Thomas Li
Project: 3D Scanner
Development Log: Days 3–8
