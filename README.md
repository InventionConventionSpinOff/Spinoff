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
2. Measurement - Sensors continuously sample data about 1,660 times per second
3. Processing - Our custom algorithm filters noise and calculates speed, spin, and trajectory
4. Transmission - Data is sent via Bluetooth Low Energy to the web app
5. Analysis - AI examines your performance and provides personalized coaching

<details>
<summary>Click here to learn more about the science behind Spin Off</summary>

We use physics equations that NASA uses for projectile motion to convert raw sensor readings into meaningful numbers. Speed is calculated by adding up the acceleration over the moment of impact (with gravity removed) and applying a calibration factor tuned to a regulation soccer ball. Spin rate takes the raw angular velocity output from the gyroscope in degrees per second and converts it to rotations per minute. Launch angle comes from the direction of the ball's velocity at the end of the impact. Flight time is estimated using projectile motion equations once the initial velocity and angle are known. All of these calculations happen on the microcontroller, and the kick reaches the app about a quarter of a second after contact.

The signal processing pipeline is what makes all of this reliable. Raw accelerometer data is extremely noisy - even sitting still the sensor produces tiny fluctuations that would ruin the calculations if left unfiltered. We apply a digital low-pass filter with an alpha value of 0.6 that smooths out high-frequency vibration while preserving the real impact signature. On top of that, we use a peak detection algorithm that identifies the exact moment of maximum force during the kick so we are always measuring the right thing.

</details>

---

## How We Built AMIR

AMIR (Athletic Motion Intelligence and Recognition) is the AI coach in the Spin Off web app. It runs on gpt-oss-120b, an open large language model from OpenAI, through Groq's API. (It used Llama 3.3 70B until Groq retired that model in August 2026.) We didn't train that model. Our work went into what we give it: when you ask AMIR for feedback, the web app builds a message from your session (max and average speed, spin, consistency, improvement trend, kick type and your last few speeds) and tells the model how to coach, asking for a short assessment, three things to improve and one drill. AMIR can also write a 4-week training plan, or you can just chat with it about your kicks.

The ball also coaches you by itself, without the internet. Every five kicks the firmware checks your session against rules we wrote after talking to coaches and sends up to three tips along with the kick data.

After every kick the app also shows a tip from **AMIR's tip library**: 201 coaching tips we wrote by hand, each tied to ranges of speed, spin, launch angle and strike quality. The app picks the nearest tip for the kick's type (a nearest-neighbour lookup that matched our Python version in our tests), and AMIR builds on it when it coaches you.

We also started training our own AI. In a separate Python project ("AMIR Lab") we built a neural network that sorts kicks into types, a technique scorer and an LSTM that looks for signs of tiredness across 30 kicks. We didn't have thousands of recorded kicks yet, so we trained them on 120,000 kicks generated by a program we wrote. They score well on that generated data (97.9% for kick type), but that only shows they learned the patterns we designed: they haven't been tested on real kicks, and the ball can't measure some of their inputs. That's why they aren't in the app yet. The next step is already built: tag real kicks in the app ("What kick was that?"), download them, and retrain on real ball data with `retrain_on_real.py`.

<details>
<summary>Click here to learn more about the coach interviews and the rules in the ball</summary>

The most important part of building the coaching was sitting down with actual soccer coaches and asking them what specific problems look like in the data. We would show them a set of readings and ask: if a player is consistently hitting 25 mph when they should be hitting 45 mph, what is happening physically? What is the player doing wrong and what drill fixes it?

For a weak shot, coaches told us the problem is almost always one of three things: poor plant foot positioning, no follow-through, or striking with the wrong part of the foot. Low speed together with short contact and low impact force usually means the player is jabbing at the ball instead of driving through it. The advice is not just "kick harder". It's to focus on the approach angle, lock the ankle on contact, and drive the knee over the ball.

For a curve ball with too little spin, coaches explained that the player is likely hitting too close to the center instead of striking the side of the ball with the inside of the foot. The fix is to change the foot angle at contact and aim for the lower outside part of the ball.

For a shot with a high launch angle and not much distance, the player is usually leaning back at contact. The fix is to keep the body over the ball and drive through with the laces instead of scooping underneath it.

Those conversations became the rules the ball runs every five kicks:

| If the session shows... | The ball says... |
|---|---|
| Consistency score under 60 | Plant your standing foot the same way each kick |
| Spin changing by more than 80 RPM between kicks | Focus on a repeatable foot contact point |
| Average launch angle under 18° | Aim higher on the ball |
| Average launch angle over 55° | Strike through the center for more drive |
| Average speed over 40 mph but little spin | Work on adding spin for curve and dip |
| Average speed under 25 mph | Follow through fully and accelerate the kicking leg |
| None of the above | Solid session, keep repeating your technique |

The same firmware also sorts every kick into a type (power shot, curve ball, chip shot, lob pass, ground pass or header) using thresholds on speed, launch angle, spin and contact time.

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
- AI Coach: AMIR - gpt-oss-120b through the Groq API
- On-ball coaching: rule-based tips and kick classification in the firmware
- Connectivity: Web Bluetooth API
- Built inside VS Code on a Windows PC
- From start to finish, designing the AI, creating the website, and coding the ball, took around **5 MONTHS TO BUILD AND CREATE**

Key Features:
- Kick data in the app about a quarter of a second after contact
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
Tap where you kicked from and where the ball went on an interactive soccer field to track your shot placement over time.

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

## New in the web app

- **AMIR's tip library:** a tip from our 201 hand-written tips after every kick.
- **Tag your kicks:** tap what kick it really was, then download the tagged kicks as CSV or JSON to train AMIR on real ball data.
- **AMIR remembers you:** AMIR sees a short summary of your last 5 saved sessions, so it can talk about your progress.
- **Progress over time:** a chart of max speed, average speed and consistency across saved sessions.
- **Demo mode:** "Try a demo (no ball)" plays simulated kicks, clearly marked DEMO, so the app can be shown without the ball. Demo kicks are never saved.
- **Fatigue check:** after 10 kicks, a simple rule compares your last 5 kicks' speed with your best stretch (a rule, not AI).
- **Read replies aloud:** AMIR can speak its answers.
- **Install as an app:** add it to your home screen; kick tracking works offline (AMIR needs internet).
- **Automatic checks:** every push runs 45 browser and unit tests (`bash tests/run.sh`) on GitHub.

---

## Setting up the AI coach

Never put the Groq API key in `NATIONSPIT.html`. Everything in that file is public, so anyone could copy the key and use it on your account. There are two safe ways to give AMIR a key.

**Option 1: a small proxy (for the public website).** The proxy keeps the key on Cloudflare and forwards AMIR's requests to Groq. It's free for this amount of use.
1. Create a free Cloudflare account and go to **Workers & Pages → Create → Worker**.
2. Replace the Worker's code with [`worker/groq-proxy.js`](worker/groq-proxy.js) and deploy it.
3. In the Worker's **Settings → Variables and Secrets**, add a secret named `GROQ_API_KEY` with your Groq key.
4. Copy the Worker's URL (like `https://spinoff-ai.yourname.workers.dev`) into `AI_PROXY_URL` near the top of the script in `NATIONSPIT.html`, and push.

The proxy only accepts requests from the GitHub Pages site and only forwards chat messages to the gpt-oss model, so it can't be used for anything else.

**Option 2: no proxy (for a demo laptop).** Leave `AI_PROXY_URL` empty. The first time someone uses AMIR, the app asks for a Groq key and saves it only in that browser. It's never sent anywhere except Groq.

---

## Repository layout

- `index.html` - the project website
- `NATIONSPIT.html` - the web app (live tracker, AMIR coach, chat)
- `firmware/SpinOff/SpinOff.ino` - the Arduino firmware. Open it in the Arduino IDE. The website publishes it as `spinoffexplained.txt` so it can be read in a browser.
- `worker/groq-proxy.js` - the optional AI proxy described above
- `amir/tips.json` - AMIR's 201 coaching tips for the in-app tip library
- `manifest.webmanifest`, `sw.js`, `icons/` - install-as-app and offline support (the icons are placeholders)
- `tests/` - the automatic test suite (`bash tests/run.sh`)
- `.github/workflows/deploy.yml` - publishes the site to GitHub Pages on every push to `main`

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
