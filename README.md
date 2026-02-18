#  SPIN OFF - Smart Soccer Ball Analytics

**Professional-Grade Sports Technology for Everyone**

Created by **Sahil & Skyler** | 7th Grade Inventors  
Invention Convention 2026

---

##  What is Spin Off?

Have you ever wanted to know exactly how fast you kicked a soccer ball? Or how much spin you put on that perfect curve shot? Spin Off makes this possible using cutting-edge sensor technology and artificial intelligence that was previously only available to professional athletes.

Our smart soccer ball tracking system measures:
- ** Speed** - Real-time kick velocity up to 70 mph
- ** Spin Rate** - Rotations per minute for curve shots
- ** Launch Angle** - Optimal trajectory analysis
- ** Flight Time** - How long the ball stays airborne
- ** Impact Force** - G-force measurement at contact
- ** AI Coaching** - Personalized feedback and training plans

---

##  Check out our app!

** [Launch Spin Off Web App](https://inventionconventionspinoff.github.io/Spinoff/finalspit.html)**


---
## Here is the code for the Arduino inside the ball!

** [Launch Spin Off code](https://inventionconventionspinoff.github.io/Spinoff/spinoffexplained.txt)**
##  The Problem We're Solving

Professional soccer players have access to expensive tracking systems that cost thousands of dollars. But what about youth players, school teams, or anyone who just loves the sport? We realized that with modern technology, these same analytics could be made affordable and accessible to everyone.

That's why we built Spin Off - to democratize sports science and help every player improve their game through data-driven insights.

---

##  How It Works

### The Hardware
At the heart of Spin Off is an **Arduino Nano 33 BLE Sense Rev 2** - a powerful microcontroller packed with sensors:

- **BMI270 Accelerometer** - Measures acceleration in all three axes
- **BMI270 Gyroscope** - Tracks rotational movement
- **Bluetooth 5.0** - Wirelessly transmits data to your device

All of this fits inside a lightweight, impact-resistant enclosure that attaches to a regulation soccer ball.

### The Process
1. **Detection** - When you kick the ball, the accelerometer detects a sudden change in motion
2. **Measurement** - Sensors continuously sample data at 100 times per second
3. **Processing** - Our custom algorithm filters noise and calculates speed, spin, and trajectory
4. **Transmission** - Data is sent via Bluetooth Low Energy to the web app
5. **Analysis** - AI examines your performance and provides personalized coaching

### The Science
We use physics equations that NASA uses for projectile motion:
- **Speed Calculation:** Uses peak acceleration during impact with calibration factors
- **Spin Rate:** Converts angular velocity (degrees/second) to rotations per minute (RPM)
- **Launch Angle:** Derived from flight time using: θ = arcsin(gt/2v)
- **Flight Time:** Measured when acceleration drops near zero-g (free fall)

---

##  Technology Stack

**Hardware:**
- Arduino Nano 33 BLE Sense Rev 2
- Bosch BMI270 6-axis IMU
- Nordic nRF52840 Bluetooth module
- 3000 mAH attom tech slim battery
- Bubble wrap enclosure

**Software:**
- **Firmware:** C++ (Arduino Framework)
- **Web App:** HTML5, CSS3, JavaScript
- **Data Visualization:** Chart.js library
- **AI Engine:** Groq API (Llama 3.3 70B model)
- **Connectivity:** Web Bluetooth API

**Key Features:**
- Real-time data streaming (< 100ms latency)
- Advanced signal filtering (low-pass filter with 0.6 alpha)
- Automatic calibration for realistic speed measurements
- Cross-platform compatibility (Windows, Mac, Android)

---

##  Features

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
Download your session data in JSON format to:
- Share with coaches or teammates
- Analyze in spreadsheet software
- Track long-term progress
- Create custom visualizations

---

##  What We Learned

Building Spin Off taught us way more than we expected:

**Engineering Challenges:**
- How to accurately measure motion using IMU sensors
- The importance of signal filtering to reduce noise
- Calibrating sensors for real-world conditions
- Balancing battery life with performance

**Programming Skills:**
- Writing efficient C++ code for embedded systems
- Creating responsive web applications
- Working with Bluetooth protocols
- Integrating AI APIs
- Writing HTML5, CSS3, JavaScript (ES6+)

**Physics & Math:**
- Projectile motion equations
- Vector mathematics for 3D acceleration
- Angular velocity calculations
- Statistical analysis

**Design Thinking:**
- Understanding user needs through testing
- Iterative prototyping and refinement
- Creating intuitive user interfaces
- Balancing features with simplicity

---


##  Future Plans

### Short Term (Next 6 Months)
- [ ] Native iOS and Android apps
- [ ] Video analysis integration
- [ ] Multiplayer comparison features
- [ ] Expanded training program library
- [ ] Social sharing capabilities

### Long Term (1-2 Years)
- [ ] Expand to other sports (basketball, football, volleyball)
- [ ] Partnership with youth sports leagues
- [ ] Coach dashboard for team management
- [ ] Machine learning for technique analysis
- [ ] Open-source platform for sports IoT


---


---

##  Acknowledgments

**Special Thanks To:**
- Our STEAM teacher, who encouraged us to keep going when it was tough
- Our families for supporting our project (and dealing with soccer balls flying around the house)
- Everyone who tested early prototypes and gave us honest feedback


---


<div align="center">

**Built by young inventors who love soccer and technology**

*"Making professional sports analytics accessible to everyone, one kick at a time."*

</div>
