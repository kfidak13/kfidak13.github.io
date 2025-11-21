# 3d Scanner Journal


## Motivating questions

Can a small, low-cost sensor reliably detect real-world distances?

What level of accuracy is realistic before moving into full prototyping?

Is the sensor stable enough to support a future scanning device?

How does power level affect sensor behavior and consistency?

### Materials

5 V Arduino (initial tests)

Compact distance sensor (80cm)

Basic wiring + breadboard setup

Target objects placed at known distances

Excel/Sheets for logging readings and making plots

### Step-by-step process

Set up the sensor on the Arduino and record real-world distances.

Capture multiple readings at each distance to test stability.

Plot measured vs. actual distance to look for patterns or error trends.

Begin planning the next phase: moving to a 12 V system and eventually integrating stepper motors.

![3E3214B1-61B9-4B03-B1D5-E1C247488119_1_105_c](https://github.com/user-attachments/assets/c27fc1d0-8ce4-4ef0-8469-0f11461c019c)

![E44AFD03-4F3C-40AE-80E4-9E4A99D6A73B_1_105_c](https://github.com/user-attachments/assets/936d77b3-3119-4b9a-b833-928612d361c6)


### How it unfolded (testing phase results)

Initial readings at 5 V showed somewhat noticable inconsistency.

Patterns emerged when plotted, the data followed a line but needed correction.

Observed that the sensor behaved better when mounted securely and kept at consistent angles.

These early findings helped shape our ideas for a future scanning/movement mechanism.

<img width="402" height="247" alt="Screenshot 2025-11-16 at 3 45 28 PM" src="https://github.com/user-attachments/assets/31439083-6a88-423b-b915-5b28dd2c113b" />


## Personal Journey

### How did you feel?
Curious and excited to see whether such a small sensor could actually work for the concept we had in mind.

### How feelings changed as testing went on
When the readings jumped around, it became frustrating, but being patient and trying to find that consistent reading eventually made it all go better

### How these feelings relate to your journey
The mix of confusion and discovery is what pushed us into the ideation stage. The early inconsistencies didn’t shut down the project — they inspired us to think bigger and become more bizzare, which led us to our somewhat first draft of our final

![999C4AF5-1114-4729-A005-5DCE01EC6775_1_105_c](https://github.com/user-attachments/assets/41de3841-e483-4807-a0d1-e59f6d227d3a)

## Coding

A few days after working with the beginning steps of the IR scanner, me and my partner began working with the code for the Scanner. This code was required to be able to move a few degrees scan the environment and then report back distances to show that it is actually tracking the data.
![2061CA46-BA46-44C4-94AD-7B185E15DAE4_1_105_c](https://github.com/user-attachments/assets/5a29269c-1028-4147-b95c-92483a2cf9b3)

### Issues

We encountered many issues with our code whether it be it not uploading correctly or it spitting back falsified data. We changed up the code a ton experimenting with a different number of steps on the stepper motor, and different delays to get more accurate data. Away from the coding we experienced some more physical issues, for example with our sensor needing to be connected to a bread board. We fixed this by stripping the female wires a I believe and intertwining our wires for the IR sensors with the female wires which connect directly to the Arduino allowing extra mobility for the IR sensor.

![4AE8A023-24AD-4783-955B-52B8ACCA6305_1_105_c](https://github.com/user-attachments/assets/2a7dfe21-20b9-4f29-9575-21cea2adf8a7)


