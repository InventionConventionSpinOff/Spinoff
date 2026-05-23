# SPIN OFF - Soccer Ball Analytics

Professional-Grade Sports Technology for Everyone

Created by Sahil & Skyler | 7th Grade Inventors
Invention Convention 2026

---

## What is Spin Off?

Have you ever wanted to know exactly how fast you kicked a soccer ball? Or how much spin you put on that perfect curve shot? Spin Off makes this possible using sensor technology and artificial intelligence previously available only to professional athletes.

Our smart soccer ball tracking system measures:
- Speed - Real-time kick velocity up to 70 mph
- Spin Rate - Rotations per minute for curve shots
- Launch Angle - Optimal trajectory analysis
- Flight Time - How long the ball stays airborne
- Impact Force - G-force measurement at contact
- AI Coaching - Personalized feedback and training plans

---

## Check out our app!

[Launch Spin Off Web App](https://inventionconventionspinoff.github.io/Spinoff/NATIONSPIT.html)

[View Arduino Code](https://inventionconventionspinoff.github.io/Spinoff/spinoffexplained.txt)

---

## The Problem We're Solving

Professional soccer players have access to expensive tracking systems that cost thousands of dollars. But what about youth players, school teams, or anyone who just loves the sport? We realized that with modern technology, these same analytics could be made affordable and accessible to everyone.

That's why we built Spin Off - to democratize sports science and help every player improve their game through data-driven insights.

---

## How It Works

### The Hardware
At the heart of Spin Off is a Seeed Studio XIAO nRF52840 Sense - a powerful microcontroller packed with sensors:

- LSM6DS3TR-C Accelerometer - Measures acceleration in all three axes
- LSM6DS3TR-C Gyroscope - Tracks rotational movement
- PDM Microphone - Analyzes strike quality at contact
- Bluetooth 5.0 - Wirelessly transmits data to your device

All of this fits inside a lightweight, impact-resistant enclosure that attaches to a regulation soccer ball.

### The Process
1. Detection - When you kick the ball, the accelerometer detects a sudden change in motion
2. Measurement - Sensors continuously sample data at 416 times per second
3. Processing - Our custom algorithm filters noise and calculates speed, spin, and trajectory
4. Transmission - Data is sent via Bluetooth Low Energy to the web app
5. Analysis - AI examines your performance and provides personalized coaching

<details>
<summary>Click here to learn more about the science behind Spin Off</summary>

We use physics equations that NASA uses for projectile motion to convert raw sensor readings into meaningful numbers. Speed is calculated from the peak acceleration during impact using an impulse model with calibration factors tuned to a regulation soccer ball. Spin rate takes the raw angular velocity output from the gyroscope in degrees per second and converts it to rotations per minute. Launch angle is derived from the tilt of the acceleration vector at the moment of contact. Flight time is estimated using projectile motion equations once the initial velocity and angle are known. All of these calculations happen in under 100 milliseconds on the microcontroller before the data is ever sent to the app.

The signal processing pipeline is what makes all of this reliable. Raw accelerometer data is extremely noisy - even sitting still the sensor produces tiny fluctuations that would ruin the calculations if left unfiltered. We apply a digital low-pass filter with an alpha value of 0.6 that smooths out high-frequency vibration while preserving the real impact signature. On top of that, we use a peak detection algorithm that identifies the exact moment of maximum force during the kick so we are always measuring the right thing.

</details>

---

## How We Built AMIR

AMIR (Athletic Motion Intelligence and Recognition) is the AI coaching engine at the heart of Spin Off. We built and trained it ourselves using PyTorch, the same deep learning framework used by researchers at Meta and Tesla. Unlike a generic AI API, AMIR was designed specifically for soccer ball sensor data, trained on hundreds of kicks we collected ourselves, and shaped by real conversations with soccer coaches about what the numbers actually mean. It looks at speed, spin, impact force, launch angle, and contact duration all at once to recognize patterns in technique and generate feedback that is specific to what the data actually shows - not just generic advice.

<details>
<summary>Click here to learn more about how AMIR was built</summary>

Before we could train anything, we had to build our own dataset. Every kick produced a stream of accelerometer and gyroscope readings across all three axes, and we had to label all of it manually - tagging each kick with its type, quality, speed range, spin classification, and whether the contact was clean or off-center. That process alone took weeks, and we learned quickly that bad data produces a bad model. Early versions of AMIR would confidently misclassify kicks or give coaching advice that made no sense at all, and almost every time we traced it back to a labeling error or a gap in the training data.

The neural network itself was designed in PyTorch with multiple layers that each learn different things. Early layers detect basic features like peak impact force and contact duration. Deeper layers learn more complex relationships, like how spin rate and launch angle interact to determine whether a curve ball will actually bend or just die in the air, or how the ratio between impact G-force and exit speed reveals whether a player is making clean contact or hitting through the ball poorly.

The most important part of building AMIR was sitting down with actual soccer coaches and asking them what specific problems look like in the data. We would show them a set of readings and ask - if a player is consistently hitting 25 mph when they should be hitting 45 mph, what is happening physically? What is the player doing wrong and what drill fixes it? Those conversations shaped every feedback rule in the system.

For a weak shot, coaches told us the problem is almost always one of three things - poor plant foot positioning, no follow-through, or striking with the wrong part of the foot. AMIR was trained to look at the combination of low exit speed, short contact duration, and low impact G-force together, because that specific pattern almost always means the player is jabbing at the ball rather than driving through it. The feedback it gives is not just "kick harder" - it tells the player to focus on their approach angle, lock their ankle on contact, and drive their knee over the ball.

For a curve ball with too little spin, coaches explained that the player is likely hitting too close to center rather than striking the inside of the ball with the inside of their foot. AMIR detects this through the spin axis data - a true curve ball has a dominant sidespin signature, and when that signature is weak relative to the speed, the feedback directs the player to adjust their foot angle at contact and aim for the lower outside quadrant of the ball.

For a shot with a high launch angle and low distance, the model learned to recognize the combination of high vertical acceleration and low horizontal momentum as a sign that the player is leaning back at contact. The coaching response walks them through keeping their body over the ball and driving through with their laces rather than scooping underneath.

For a shot that is consistently off-center according to the microphone data, AMIR cross-references the strike classification with the spin axis to figure out which direction the player is mishitting. If the contact is off-center to the outside with a weak spin signature, the feedback focuses on approach angle. If it is off-center with a strong but erratic spin reading, the feedback focuses on foot placement and follow-through consistency.

Training AMIR was one of the hardest parts of the entire project. We ran training loops for hours only to find the model had overfit on our limited dataset and was basically memorizing kicks rather than learning from them. We had to go back repeatedly to add more data, adjust the learning rate, apply dropout to prevent overfitting, and retune the model from scratch. There were nights where nothing worked and we had no idea why. But every failure taught us something about how the model was thinking, and slowly it started producing results that actually made sense. By the end, AMIR could classify kick types with high accuracy and generate coaching feedback that real coaches agreed with when we showed it to them. It took about two months from rough idea to something reliable, and it is the part of Spin Off we are most proud of.

</details>

---

## Technology Stack

Hardware:
- Seeed Studio XIAO nRF52840 Sense
- LSM6DS3TR-C 6-axis IMU (accelerometer + gyroscope)
- Built-in PDM microphone
- Nordic nRF52840 Bluetooth 5.0 module
- 1000mAh LiPo battery

Software:
- Firmware: C++ (Arduino Framework)
- Web App: HTML5, CSS3, JavaScript
- Data Visualization: Chart.js library
- AI Engine: AMIR - custom trained using PyTorch
- Connectivity: Web Bluetooth API
- Built inside VS Code on a Windows PC
- From start to finish, designing the AI, creating the website, and coding the ball, took around **5 MONTHS TO BUILD AND CREATE**

Key Features:
- Real-time data streaming (< 100ms latency)
- Advanced signal filtering (low-pass filter with 0.6 alpha)
- Automatic calibration for realistic speed measurements
- Cross-platform compatibility (Windows, Mac, Android)

---

## Features

### Live Performance Tracking
Monitor your kicks in real-time with instant feedback on speed, spin, and trajectory. Every metric is displayed clearly with professional-grade charts that show your improvement over time.

### AI-Powered Coaching
Our AI coach analyzes your performance data and provides:
- Personalized feedback on technique
- Identification of strengths and weaknesses
- Specific drills to improve your skills
- 4-week progressive training plans

### Shot Mapping
Visualize exactly where your shots are going with an interactive soccer field display. Mark your position and target to see shot trajectories and accuracy patterns.

### Session Analytics
Track your progress with detailed statistics:
- Total kicks per session
- Maximum and average speeds
- Consistency scores
- Improvement trends over time

### Data Export
Download your session data in JSON or CSV format to:
- Share with coaches or teammates
- Analyze in spreadsheet software
- Track long-term progress
- Create custom visualizations

---

## What We Learned

Building Spin Off taught us way more than we expected:

Engineering Challenges:
- How to accurately measure motion using IMU sensors
- The importance of signal filtering to reduce noise
- Calibrating sensors for real-world conditions
- Balancing battery life with performance

Programming Skills:
- Writing efficient C++ code for embedded systems
- Creating responsive web applications
- Working with Bluetooth protocols
- Writing HTML5, CSS3, JavaScript (ES6+)

Physics & Math:
- Projectile motion equations
- Vector mathematics for 3D acceleration
- Angular velocity calculations
- Statistical analysis

Design Thinking:
- Understanding user needs through testing
- Iterative prototyping and refinement
- Creating intuitive user interfaces
- Balancing features with simplicity

---

## Future Plans

### Short Term (Next 6 Months)
- Native iOS and Android apps
- Video analysis integration
- Multiplayer comparison features
- Expanded training program library
- Social sharing capabilities

### Long Term (1-2 Years)
- Expand to other sports (basketball, football, volleyball)
- Coach dashboard for team management
- Open-source platform for sports IoT

---

## Acknowledgments

Special Thanks To:
- Our STEAM teacher, who encouraged us to keep going when it was tough
- Our families for supporting our project (and dealing with soccer balls flying around the house)
- Everyone who tested early prototypes and gave us honest feedback

---

## Feedback

If you have any feedback about the project feel free to email us at inventionconventionspinoff@gmail.com or you can fill out [this](https://forms.gle/feNw5kNKt2TsMMKo9) survey. Thank you!

---

## Final Thoughts

<details>
<summary>Click Here</summary>

Now that we look back at Spin Off, we see how far we've come. The obstacles we've overcome, the moments that challenged us, and the progress we didn't always recognize while it was happening.

When we first started, it was just an idea, a soccer ball that could measure performance. But turning that idea into something real was far from simple. There were moments when the data didn't make sense, when our system failed in ways we didn't expect, and when we had to step back and rethink everything we had built. At times, it felt like we were going in circles, fixing one problem only to discover another.

But looking back, those moments weren't setbacks in the way we first saw them. They were part of the process. Every error forced us to understand our system more deeply, every failure pushed us to improve our design, and every revision brought us one step closer to something that actually worked.

And even when things got hard, we weren't alone. We had people who supported us in different ways—through simple encouragement like "keep going," through advice when we were stuck, and through late night conversations that helped us stay motivated when things weren't working the way we hoped. Those moments didn't always feel significant at the time, but they became part of what carried us forward.

Right now, it's 10:30 PM as we write this. And maybe that says something about the project itself. Spin Off wasn't built in a single moment of inspiration. It was built across late nights, early mornings, long debugging sessions, and quiet moments of thinking things through when no one else was around. Most of those moments we won't remember clearly, but together they shaped everything that we've built here.

The good and the bad are both part of this journey. The successes gave us confidence, and the failures taught us patience. Together, they shaped not only our invention but also how we think as engineers, problem solvers, and learners.

In the end, Spin Off represents something bigger than technology, it represents the belief that improvement should never be guesswork, but something you can see, measure, and build on every day.

</details>

<br>

<div align="center">

Built by young inventors who love soccer and technology.

"It always seems impossible until you start, then every step makes it more possible than you ever expected."

</div>
