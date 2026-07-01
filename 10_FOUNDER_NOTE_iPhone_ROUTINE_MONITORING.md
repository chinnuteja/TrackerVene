# Phone-Only Routine Monitoring for Eldercare

*A practical direction, written after our conversation at Vene about tracking movement in a home without extra sensors or wearables.*

---

## A quick note before the detail

This isn't a claim that one iPhone solves eldercare — it's an honest direction, and I built a small working demo on my own phone so it isn't just theory. The gist: use the phone to read a person's daily rhythm, feed it into the routine engine you already saw running, and be upfront about where the phone can and can't see.

---

## 1. What's already there — and proven

You already saw the **Routine Topology Engine** run — built and tested on 200+ days of CASAS data (one older adult, simple ambient sensors). Two things about it matter for what follows:

- it thinks in **rooms, dwells, and transitions**, and keeps a running **"worry" score** that rises on the unusual and quietly fades on the normal — and it also catches slow drift over days, which is often how real decline shows up;
- it already treats **an expected event that never happens** as a signal, not missing data. That "silence can be meaningful" idea is the heart of it, and it's already running.

One metaphor to hold onto: the engine is **a recipe plus an ingredient**. The recipe is the math, and it's general. The ingredient is what it learned about one specific home. For CASAS, the ingredient was Mary's routine.

---

## 2. The reframe — and why the phone forces it

You asked the real question: most people already carry a phone, so can we read movement between rooms from the phone itself, instead of installing sensors or asking an elder to wear something? My first instinct was the obvious one: figure out which room she's in. I spent a fair bit of time down that path, and I kept hitting the same closed doors — the ones you already know well from the platform side:

- **Wi-Fi CSI** — the fine signal detail research leans on for presence and breathing, not exposed to apps.
- **Wi-Fi FTM / 802.11mc ranging** — there on Android, not for third-party iOS apps.
- **UWB channel data** (the U1 chip) — only between two cooperating devices like a phone and an AirTag, no raw ranging.
- **Background camera / LiDAR** — no background access, and a camera in an elder's home is a hard no anyway.
- **High-rate barometer** — the altimeter sits around 1 Hz, fine for floor changes, not for door-level detail.

After enough of that, coordinate-level indoor location on a stock iPhone stopped feeling practical to me — the hardware can do it, but the platform keeps those doors shut. Rather than keep pushing on it, I let the goal move.

So instead of *"which room is she in?"*, I leaned toward *"does today look like a normal day for her, and is she okay?"* Location stops being the target and becomes a background detail the system is allowed to stay unsure about.

What made me comfortable with that trade: the thing that's hard to get (exact position) turned out to be the thing the product doesn't really need. You can be quite unsure of the room and still fairly sure about her wellbeing — "no movement, no water, no TV, no door, at 8am" reads clearly even when the room stays fuzzy.

Everything the approach relies on sits on the reachable side of the platform:

| Reachable on iOS (what this uses) | What it gives |
|---|---|
| `CMMotionActivity`, `CMPedometer` | moving vs still, steps, floors — near-free, runs all day on the motion coprocessor |
| `CMAltimeter` (~1 Hz) | floor changes, coarse air pressure |
| `CMDeviceMotion` (up to 100 Hz) | detailed motion + raw magnetometer, used in short bursts |
| `CoreBluetooth` | ambient signal-strength changes = "a body moved nearby" |
| `SoundAnalysis` | on-device sound labels ("water", "TV"), no audio ever stored |
| `Core ML` on the Neural Engine | efficient on-device learning |

Nothing here needs a special entitlement, and nothing depends on the blocked list above.

---

## 3. How the phone becomes the sensor

The phone isn't always in her hand, and instead of fighting that, the design leans on it. There are two situations, and the moment she switches between them is one of the most useful signals of all.

**When the phone is carried — she is the sensor.**
Movement, steps, and floor changes come straight from the low-power motion chip, so they're reliable and cost almost no battery. While she walks, the phone also picks up a rough "magnetic path" through the home, since the building's steel bends the magnetic field differently in each spot.

**When the phone is set down — it becomes a still watcher.**
Once it's resting somewhere, that spot becomes a known anchor, and the phone quietly watches the area around it: nearby Bluetooth signal wobble (someone moving through the space), small air-pressure changes from a door, and the occasional on-device sound label.

**The moment she puts it down or picks it up is a free, time-stamped routine event.** "Phone set down in the kitchen at 6:10pm" places her in time and space with no active sensing at all. And "the phone hasn't been carried in a day" felt worth treating as a signal in its own right rather than a gap. That was the part I liked — the set-down moment, which usually means losing the person, becomes the phone just changing jobs.

All of this comes out in the same **rooms / dwells / transitions** shape the engine already eats. That's deliberate — the phone layer's whole job is to produce that stream, so the proven engine sits behind it unchanged.

```
   iPhone signals (motion, steps, floors, BLE, sound labels, carry state)
                              |
                     turn into events
                              |
              rooms  /  dwells  /  transitions
                              |
            the existing Routine Topology Engine
                              |
     surprise score  +  slow-drift detection  +  "expected but absent"
                              |
        observe  →  check-in call  →  escalate to family
```

New senses, same brain.

---

## 4. Silence as a signal — and knowing when it can't be trusted

The most useful thing the system ever notices is often **something that didn't happen**. If she normally stirs, gets up, and uses water within a certain window each morning, then the *absence* of all of that, past the point where it's normally arrived, is meaningful on its own. The engine already learns, per place and time of day, how long quiet is normal — so ordinary night-time stillness stays calm, while quiet that runs past its usual budget starts to raise concern.

But that idea is only safe with a guardrail, because a quiet phone has more than one explanation:

- she's genuinely resting and fine
- the battery died
- iOS suspended the app
- the phone is charging in another room
- she's fallen and can't reach it

A weaker system reads all of these as "no alerts, all good." That's the one failure I really don't want to ship — a dead phone must never be mistaken for a calm afternoon.

So the system continuously estimates one thing first: **could I even have seen an event right now, if one had happened?** I think of it as a small set of deterministic states rather than a vague confidence number:

| State | Conditions | What silence means |
|---|---|---|
| **OBSERVING** | heartbeat alive, battery healthy, and either carried or the ambient signal floor is present | quiet is trustworthy → it counts as evidence |
| **DEGRADED** | some signals dropped (e.g. set down, low battery) | widen the thresholds, tell the family coverage has narrowed |
| **BLIND** | heartbeat lost, or battery critically low, or sensors stopped delivering | never infer wellness — declare it |

The "heartbeat" here is concrete: is the ambient Bluetooth floor still there, is the motion stream still arriving, is the app still being woken. If those stop, the state drops by construction.

This is also how the system separates a **dead battery** from a **fallen person**, which look identical if you only listen for silence:

- If the last battery readings were low and falling and then everything went quiet → the cause of silence is *known and mechanical* → state is **BLIND**, and it escalates as *"lost visibility — please check, and charge the phone,"* not as reassurance.
- If the heartbeat is alive, battery is fine, and sensors are still delivering, but the expected next event never arrives → the system is **OBSERVING**, so the silence is real evidence → that's the case that earns a genuine wellbeing check-in.

Same silence, different state, different action. The rule underneath it all: quiet only counts as "she's fine" when the system is sure it could have seen trouble. When it can't see, it says so.

---

## 5. What the demo actually shows (built on real data, not slides)

To keep this honest, I recorded real data on my own iPhone 12 Pro using the off-the-shelf "Sensor Logger" app — no custom app, no special access. Two raw logs:

- **`2026-06-29_12-00-50.json`** — about 11 minutes walking through the home: accelerometer at 100 Hz, plus barometer, magnetometer, and pedometer streams.
- **`2026-06-29_15-34-05.json`** — a 60-second clip of the phone being held, set on a table, then picked up, to test the carry signal.

A small converter reads those raw streams and does the honest work: it measures per-second motion energy to split time into *moving* (a walk) versus *still* (a dwell in a place), labels the dwells using the known route of the walk, and emits events in the exact same format the engine already consumes. The carry clip becomes a clean trace showing the phone go from on-body, to set-down, to picked-up.

From there, the engine runs untouched. The demo walks through:

1. **A calm stretch** — real movement through the rooms, worry score low, plain-language read: "moving like a normal day."
2. **The carry beat** — the panel shows, from the real 60-second clip, that it can tell the phone is on a body versus flat on a table.
3. **Places** — the dwells grouped into a handful of discovered places (rough on 11 minutes, and labelled as rough).
4. **A concerning gap** — this one is staged on purpose, and I say so: the gap before one arrival is widened so the absence logic fires — "left the bedroom and the expected next step never came" — and a check-in triggers.
5. **Escalation** — no reply, so it moves to alerting family.
6. **Visibility lost** — a `sensor_offline` marker at the end drives the safety beat: the amber "we can't see her — this is *not* all-clear" state, instead of going quietly green.

Two things are staged, and both are marked clearly on screen: the concerning gap and the phone-going-dark marker. Everything else — the signal processing, the carry detection, the per-person model, and the reasoning — runs on the real recording. The one caveat I keep visible the whole time is that 11 minutes is thin data, so "normal" here is shallow; with continuous data it learns her real routine and can start flagging slow change.

The point of the demo isn't to prove accuracy. It's to show the whole path works end to end on data that actually came off a phone: **same brain you already saw, new sandbox-legal senses.**

---

## 6. The hard parts (and how they can be handled)

The hard parts are worth stating directly. These are the real constraints, rated by how much they matter to a family actually keeping the app installed.

| Constraint | Why it's hard | Possible mitigation | Honest uncertainty |
|---|---|---|---|
| **Battery & heat** *(high)* | continuous high-rate sensing drains and heats the phone | cheap coprocessor signals run always-on and act as triggers; expensive sensing only wakes on a trigger; heavy learning runs overnight on the charger | it's a frugal monitor, not free — a few % a day, like a fitness app |
| **Phone dies / app suspended** *(critical)* | silence from failure looks like silence from calm | observability state — low visibility is *declared*, never read as "all-clear" | depends on the heartbeat being right, so that heartbeat has to be tested hardest |
| **Phone left behind** *(high)* | phone and person separate | carry state + a coarse "is the phone even home" check; long no-carry stretches flagged gently | a person who rarely carries it gives a sparser signal |
| **Multiple people at home** *(high)* | shared signals don't carry identity | two people carry two phones = two separate routines; gait on the carried phone helps | true shared-room attribution is unsolved from a phone alone — this is where your sensor data would genuinely help |
| **Cold start** *(medium)* | a personal routine takes ~1–2 weeks to sharpen | start conservative on population priors, optional 60–90s onboarding walk, the nightly charging spot anchors the bedroom on night one | week-one confidence is genuinely lower, and it says so |
| **Privacy / mic** *(medium)* | any mic use lights the indicator and worries people | mic is gated hard and mostly off; only on-device labels, never stored audio; works without the mic too | some users will want zero mic, at some cost to room labeling |
| **Sensor noise & iOS quirks** *(medium)* | Bluetooth addresses rotate ~every 15 min; the *calibrated* magnetometer strips the very anomalies that make a fingerprint | cluster only on the stable device subset and use signal geometry; use the *raw* magnetometer for fingerprinting | room labels from raw signal alone are only an estimate at this stage; real measurements are still needed |
| **Validation without real emergencies** *(medium)* | you can't wait for real falls, and there's no public labelled home dataset | inject synthetic anomalies into real recorded baselines, plus N-of-1 self-instrumentation with a diary | early numbers are from injection and self-recording, labelled as exactly that |

---

## 7. How this could be proved, and how the data can scale

One thing worth saying plainly: the demo's raw logs are large because Sensor Logger dumps everything (that 11-minute file is tens of MB of 100 Hz samples). Storing raw streams for days would run into the tens of gigabytes, so the real product path cannot be raw logging forever.

A practical approach is to process on the phone and keep almost none of the raw data: turn the high-rate streams into small per-second features and a compact event log, keep raw samples only in a short rolling buffer around interesting moments, and store days as events and summaries, not samples. A full day then becomes kilobytes, not gigabytes.

For validation, the useful numbers are not just "accuracy %", but the things that decide whether a family keeps it installed:

- **detection latency** — how fast a real problem is caught
- **false alarms per week** — target under one, since that's the churn line
- **missed events at a fixed false-alarm budget** — the honest trade-off point
- **observability uptime** — the share of high-risk hours the system was *not* blind, which is the metric this design lives or dies on

---

## 8. The two hardest gaps

Two places still feel like the hardest parts of the phone-only version, and they are worth naming clearly instead of smoothing over.

The first is **shared-space attribution**. When more than one person is home, phone signals can mix, and a single phone cannot always say who caused which event. Two people carrying two phones helps, and gait on the carried phone may help, but it does not fully solve the shared-room case.

The second is the **far-room night case**. If the phone is charging in the bedroom, it cannot directly see a silent fall down the hall. The routine model can reason about it if an expected return never happens, but that is still inference, not direct coverage.

Those are not things to hand-wave away. They are the parts where the phone-only approach needs the most careful validation. The important thing is that the system should be honest about both: when attribution is uncertain, say it is uncertain; when coverage is partial, say coverage is partial.

---

## 9. In one paragraph

Locating someone precisely inside a home isn't really practical on an iPhone — Apple keeps the sensors that would allow it off-limits — so this leans on a smaller, more useful question: does the day look normal for her, and is she okay? The phone reads her rhythm through the sensors iOS *does* allow, turns it into the same event stream the existing engine already reasons over, treats an expected-but-absent event as real evidence, and — most importantly — knows when it can't see and refuses to call that "all-clear." The demo runs that whole path on real data recorded on my own phone. It's early, and the thin spots are real, but this is where my thinking landed after digging into the iPhone direction. If even a small part of it is useful to the way Vene is thinking about this problem, the work was worth doing.
