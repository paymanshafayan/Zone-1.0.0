# 🏘️ Zone — Architecture Document

**Version:** 4.0.0
**Date:** 2 August 2026
**Status:** Draft for review — no code written yet
**Persian version:** `ARCHITECTURE.fa.md`

---

## 1. What Is Zone?

> In every neighbourhood there is one person who knows everything.
> Not because they have a directory — because they **live there**.

Zone plays that person. A friend who:

- You **talk to**, not search
- Knows some people, but **not everyone**
- When they don't know, they say **"I don't know anyone like that around here"**
- Can **ask around** if they don't know
- **Learns more** over time
- Helps you **find people**, not just services
- Stands beside you when you need **someone to talk to**

### Beyond Services

Zone is not just a service-finder. In a world where community has given way to isolation, Zone aims to:

- **Combat loneliness** — a friend who is always there
- **Connect neighbours** — not just for services, but for friendship
- **Enable mutual help** — advice, brainstorming, support
- **Suggest solutions** — both from neighbours and from the system itself

### What Zone Is Not

| Not | Why it matters |
|---|---|
| A marketplace | No commission, no transaction brokering |
| A business directory | Doesn't sell comprehensiveness |
| A search engine | Users talk, they don't query |
| A messenger | Conversations are not archived |
| A social network | No follower counts, no engagement metrics |

The fundamental difference: in a marketplace, an "empty result" is a **failure**. In Zone, "I don't know" is a **valid answer** — and it's exactly what builds trust.

---

## 2. Seven Architectural Principles

Any technical decision that conflicts with these is rejected.

### Principle 1 — "I don't know" is a first-class answer

```
❌ "Couldn't find an electrician, but here's a plumber"
✅ "I don't know a good electrician around here. Want me to ask around?"
```

**Technical consequence:** Every response must carry a confidence score and knowledge source.

### Principle 2 — Knowledge is local, not global

Zone in Tehran and Zone in Mashhad are separate entities. Neighbourhood knowledge does not leak.

### Principle 3 — Voice is the primary medium, not the only one

Voice is the primary interaction. Text is the alternative. A user who cannot speak (in a noisy place, privacy concern, or disability) must be able to use Zone fully.

### Principle 4 — Knowledge grows, it isn't seeded

Day one it knows almost nothing. That's design, not a defect.

### Principle 5 — Friendly suggestions are never for sale; professional suggestions are separate and transparent

Friendly suggestions are **never** influenced by payment. Professional providers appear in a **separate category** that the user explicitly chooses. Ranking in neither category is purchasable.

```
User: "I need a painter"

Zone: "Two people in the neighbourhood recommended Mr. Rezaei. [Friendly]
      Three people have professional posts. [Professional]
      Which would you like to hear about?"
              │
              ▼
     User chooses freely
     Nothing is hidden
     Nothing is reordered
     Ranking is genuine in both categories
```

### Principle 6 — Spoken, not stored (with one exception)

There is no content archive. What is said fades after a while.

**Exception:** Professional posts are explicitly published by the provider and intended to persist. When the subscription expires, the post is hidden.

### Principle 7 — Conversation-driven, not data-driven

Zone is not a database that people search. It is a conversation that people have. Data is a **side effect** of conversation, not its foundation.

```
❌ Data-driven: "First fill the database, then users can search"
✅ Conversation-driven: "First people talk, then knowledge emerges"
```

---

## 3. Two Channels

Zone operates on two distinct channels. They share the same tag system and neighbourhood boundary, but differ in medium, interaction model, and persistence.

### Voice Channel (Assistant)

| Property | Value |
|---|---|
| Medium | Voice (primary), text (alternative) |
| Input | 🎤 Speech → STT |
| Output | 🔊 TTS → Speech |
| Interaction | Conversational, linear |
| Persistence | None (reverberation only) |
| Content | Friendly suggestions, neighbourhood talk, help requests |
| Assistant role | Active — speaks, asks, decides |

### Visual Channel (Professional Feed)

| Property | Value |
|---|---|
| Medium | Visual (image + video) |
| Input | 👆 Touch (like Instagram) |
| Output | 👁️ Visual feed |
| Interaction | Scroll, tap, browse |
| Persistence | Yes (until subscription expires) |
| Content | Professional posts (image/video + text + tags) |
| Assistant role | Announces existence only — does not read or describe posts |

### How they connect

```
User: "I need a painter"

Zone (voice): "Two people recommended Mr. Rezaei. [Friendly]
              Three people have professional posts. [Professional]
              Want to hear about the recommendations, or see the posts?"

User: "See the posts"

  → Visual feed opens: professional painter posts
  → Like Instagram: scroll, image, short video (≤15s), text, tags
```

---

## 4. Core Primitive: The Hearing Space

**The entire architecture rests on one concept:**

> A Hearing Space is a boundary within which anyone present can hear.

Like a shared courtyard: if you're there you hear it, if you're not you missed it, and nobody keeps a transcript.

### Key insight — waves and spaces are the same thing

```
                Hearing Space
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
   Dynamic space              Persistent space
   (request wave)             (user-created)
        │                           │
   radius + tags               building, street,
   life: minutes               social activity
                               life: until removed
```

Both answer one question: **"Who is listening here right now?"**

This means broadcast waves are not separate infrastructure — they are **a special case of the Hearing Space**.

### Reverberation

Real sound doesn't cut off — it fades:

```
spoken → lingers in the space → fades
         (newcomers hear it)    (permanently)
```

| Space type | Reverberation |
|---|---|
| Urgent | 15 minutes |
| Service | 2 hours |
| Social | 6 hours |

Implementation: in-memory store with automatic expiry. **Never persisted to the database.** If the server restarts, reverberations are lost — and this is exactly how the real world works: if you weren't in the courtyard, you missed the conversation.

### The assistant is the intermediary

Critical: the user's voice is never transmitted directly.

```
user speaks → transcribed → assistant restates → played in Zone's voice
```

Consequences: voice impersonation is impossible, no audio files move between users, tone stays consistent.

### Presence

**Active presence + reverberation.** A user is "present" when the app is open. Latecomers hear the reverberation without mass notification. This is faithful to the metaphor and avoids the nuisance problem.

---

## 5. Tags: The Only Data Structure

**There are no search fields.** The only filtering mechanism is tags.

### Golden rule: users do not tag

Only the system applies tags. The user has no role in it. This applies to all content: conversations, professional posts, everything.

This eliminates fake and irrelevant tags — a problem social networks never solved.

### Two-level structure

```
#services/house_painting
#urgency/normal
#location/vanak
#social/sports
```

Users can subscribe to an entire branch (`#services/*`) or a single leaf.

### 🚨 Primary risk: vocabulary drift

If the system generates tags freely:

```
"paint my house"        → #house_painting
"looking for a painter" → #painter
"who paints walls"      → #wall_painting
```

Three tags, one concept. A user filtering on the first **never sees** the other two. The system fails silently with no error logged.

### Solution: closed vocabulary

```
user speech
     │
     ▼
system extracts concept
     │
     ▼
semantic match against existing vocabulary
     │
   ┌─┴──────────────┐
high similarity   low similarity
   │                    │
   ▼                    ▼
use existing      requested ≥3 times?
+ record alias         │
                    ┌──┴───┐
                   yes    no
                    │      │
                    ▼      ▼
              new tag    count only
              (pending)  in demand queue
```

### Personal filtering + emergency channel

Users choose which tags they hear. But one exception is required:

```
#urgent/help    ← always delivered, cannot be filtered
```

With hard limits: once per week per user, with abuse reporting.

---

## 6. Three Response Modes

```
              user speaks
                   │
                   ▼
            intent understanding
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────────┐
│  KNOW   │  │   ASK   │  │   UNKNOWN   │
└─────────┘  └─────────┘  └─────────────┘
```

**KNOW:** answers from neighbourhood memory
> "Two people recommended Mr. Rezaei. He worked for Mrs. Ahmadi three weeks ago."

**ASK:** opens a hearing wave
> "I don't know anyone right now. Let me ask around, I'll get back to you within half an hour."

**UNKNOWN:** admits it honestly
> "I couldn't find anyone. If you find someone yourself, tell me so I know next time."

⚠️ The third mode must be **fully implemented**, not left as a default fallback. The quality of this response determines user trust.

---

## 7. Tiered Broadcast Waves

```
request registered
      │
      ▼
Wave 1 — 0 to 10 minutes
• matching self-declared skill
• base radius 2.5 km
• max 8 people
      │
      ├── ≥2 responses? ── yes ──→ stop ✋
      ▼ no
Wave 2 — 10 to 30 minutes
• adjacent skills (painting ← plastering)
• radius up to 5 km
• max 15 people
      │
      ├── ≥2 responses? ── yes ──→ stop ✋
      ▼ no
Wave 3 — 30 to 90 minutes
• "do you know someone?" (referral)
• all active users in radius
      │
      ▼
no response → UNKNOWN mode
```

### Anti-nuisance rules

| Rule | Value |
|---|---|
| Max daily notifications | 3 |
| Quiet hours | 22:00 – 08:00 |
| Stop after sufficient responses | ≥2 |
| Down-weight after silence | 3 times |
| Opt out of a tag | Always available |

> ⚠️ **If only one section of this document gets implemented, make it this one.** A user who mutes notifications does not come back.

### Day one

Nobody has history. Wave 1 ordering:

```
1. self-declared skill
2. geographic proximity
3. recent activity
4. random (a chance for newcomers)
```

---

## 8. The Voice Chain + On-Device Processing

### Full pipeline

```
🎤 → STT → on-device processing → cloud processing → TTS → 🔊
     ~1.0s    ~0.5s                    ~1.0s            ~0.8s
```

Total ≈ 3.3 seconds — **within the 3-second target**.

### On-device processing (edge)

| Task | Model | Why on-device |
|---|---|---|
| Tag extraction | Small ONNX model | Structured, high frequency, closed vocabulary |
| Intent detection | Small classifier | Three classes only (KNOW/ASK/UNKNOWN) |
| Number extraction | Regex | Simple, no model needed |
| Read-back template | Formatter | Deterministic |

**Privacy benefit:** raw speech text never leaves the device. Only structured data reaches the server:

```
❌ Server sees: "I need a painter for my 80m² apartment"
✅ Server sees: {tags: ["#services/house_painting"], intent: "ASK", area: "80m²"}
```

### Cloud processing

| Task | Model | Why cloud |
|---|---|---|
| Conversational warmth | Cloud LLM | Nuance required |
| Three-mode decision | Cloud LLM | Most sensitive decision |

Roughly 70% of processing is local from day one: low cost, privacy-preserving, migration path already tested.

### Streaming

| Technique | Saving |
|---|---|
| STT streaming | ~1 s |
| TTS streaming | ~0.8 s |
| Fast path (without large model) | ~2 s |
| Bridging response ("let me see...") | perceptual |

### 🚨 Failure point: numbers in speech

What does "ninety per metre" mean?

| Ambiguity | Options |
|---|---|
| Unit | 90 toman or 90 thousand toman? |
| Basis | Per square metre or total? |
| Inclusion | With or without paint? |
| STT error | "ninety" vs "nine hundred"? |

**Mandatory solution — read-back confirmation:**

```
Painter: "ninety per metre, three days"
Zone:    "So ninety thousand toman per square metre, three days. Correct?"
Painter: "Yes"
✅ Number locked
```

**No number enters the system without confirmation.** Hard rule.

### 🚨 Failure point: comparison in a linear medium

Audio is linear; comparison is parallel. Reading five offers in sequence is useless.

```
❌ "First is 90, second is 85, third is..."

✅ "Three people responded.
    Cheapest is 85.
    Fastest is two days.
    One of them worked for your upstairs neighbour, who was happy.
    Which should I expand on?"
```

Three axes: cheapest, fastest, most trusted.

---

## 9. Knowledge Model

```
Zone (neighbourhood)
 ├── geographic boundary (from Iranian maps)
 └── accumulated knowledge
      │
      ├── Person
      │    ├── self-declared skills
      │    ├── response rate
      │    ├── presence
      │    └── professional status
      │         ├── normal
      │         └── professional (license + active subscription)
      │
      ├── Memory  ← the core
      │    ├── who, what, for whom
      │    ├── outcome
      │    ├── who said it
      │    ├── when
      │    └── confidence
      │
      ├── Post (professional)
      │    ├── image / short video (≤15s)
      │    ├── description text
      │    ├── tags (by system)
      │    ├── provider (Person, professional)
      │    ├── published at
      │    └── subscription status (active/expired)
      │
      ├── Request
      ├── Offer (with confirmed number)
      │
      ├── Tag
      │    ├── closed vocabulary (hierarchical)
      │    └── aliases
      │
      └── Subscription (user)
           ├── followed tags
           └── notification preferences
```

### Why "Person" and not "Provider"?

In a neighbourhood, roles are not fixed. The same person who needs a painter today may refer someone tomorrow.

### Temporal decay

```
credibility = base × e^(−λ × age)
```

Prevents "Mr. Rezaei was great five years ago but has since retired."

### Important separation

| Not archived | Stored |
|---|---|
| Conversation content | Extracted memory |
| Raw audio | Tags |
| Transcripts | Confirmed numbers |
| Momentary presence | Violation counters (no content) |

### Professional providers

```
User requests professional registration
        │
        ▼
┌─────────────────────────┐
│  Personal info           │
│  + Profession type       │
│  + License image         │
│  + License unique number │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  License verification    │
│  (image + unique number  │
│   → external verification│
│   site)                  │
└────────────┬────────────┘
             │
        ┌────┴────┐
        │         │
     rejected  verified
        │         │
        ▼         ▼
    notify    ┌──────────────────┐
    rejection │  Subscription    │
              │  payment         │
              │  (external link) │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Active professional account │
              │  → Can post professional content │
              │  → Appears in professional suggestions │
              └────────┬─────────┘
                       │
                  Subscription expires
                       │
                       ▼
              ┌──────────────────┐
              │  Normal account  │
              │  → Posts hidden  │
              │  → Removed from  │
              │  professional    │
              │  suggestions     │
              └──────────────────┘
```

---

## 10. Micro-Kernel Architecture

### Three-layer model

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│   ┌─────────────────────────────────────────────┐   │
│   │           Inner Core                        │   │
│   │                                             │   │
│   │  • User identity                            │   │
│   │  • Event bus                                │   │
│   │  • Tag system                               │   │
│   │  • Hearing space (base)                     │   │
│   │  • Data layer (DB + Redis)                  │   │
│   │  • Plugin registry                          │   │
│   │                                             │   │
│   │  ⚠️ Never changes                           │   │
│   │  ⚠️ Plugins have no direct access           │   │
│   └─────────────────────────────────────────────┘   │
│                                                       │
│   ┌─────────────────────────────────────────────┐   │
│   │           Outer Core (SDK) — Open Source     │   │
│   │                                             │   │
│   │  • Plugin API (SDK)                         │   │
│   │  • Event subscription interface              │   │
│   │  • Data access interface                    │   │
│   │  • UI route registration interface           │   │
│   │  • Notification interface                   │   │
│   │  • Tag interface                            │   │
│   │                                             │   │
│   │  ⚠️ Changeable, but backward-compatible     │   │
│   │  ⚠️ Plugins only use this layer             │   │
│   └─────────────────────────────────────────────┘   │
│                                                       │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│   │Plugin  │ │Plugin  │ │Plugin  │ │Plugin  │ ... │
│   │Services│ │Social  │ │Prof.   │ │Future  │     │
│   └────────┘ └────────┘ └────────┘ └────────┘     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Outer Core SDK

```javascript
core = {
  // ─── Events ───
  events: {
    subscribe(event, handler),    // Listen
    emit(event, data),            // Publish
    list(),                       // Available events
  },

  // ─── Data ───
  data: {
    query(model, filters),        // Read
    create(model, data),          // Create
    update(model, id, data),      // Update
    delete(model, id),            // Delete
    models(),                     // Available models
  },

  // ─── Tags ───
  tags: {
    suggest(concept),             // Suggest tag from closed vocabulary
    subscribe(tagPattern),        // Subscribe to tag
    vocabulary(),                 // List vocabulary
  },

  // ─── Hearing Space ───
  hearing: {
    createSpace(config),          // Create persistent space
    openWave(config),             // Create broadcast wave
    join(spaceId),                // Join
    leave(spaceId),               // Leave
    speak(spaceId, content),      // Speak in space
  },

  // ─── UI ───
  ui: {
    registerRoute(path, widget),    // Register route
    addMenuItem(label, icon, path), // Add to menu
    pushNotification(content),      // In-app notification
  },

  // ─── Notifications ───
  notify: {
    send(userId, content),          // Send notification
    schedule(userId, content, at),  // Schedule
  },

  // ─── Plugins ───
  plugins: {
    register(plugin),             // Register plugin
    list(),                       // List plugins
    enable(name),                 // Enable
    disable(name),                // Disable
  },
}
```

### Plugin contract

Every plugin registers three things:

```
1. Events it listens to
   → plugin.on('user.speak', handler)

2. Events it produces
   → plugin.emit('professional.post', data)

3. Pages it adds to the UI
   → plugin.registerRoute('/professional', widget)
```

### Default plugins

| Plugin | Channel | Description |
|---|---|---|
| Neighbourhood Services | Voice | Service requests, waves, memory |
| Social | Voice | Hearing spaces for friendship, activities |
| Support | Voice | Mutual help, brainstorming, system suggestions |
| Professional Posts | Visual | Professional feed (Instagram-like) |
| License Verification | Visual | Upload license image + unique number |
| Subscription Payment | Visual | External payment link |

### Open source

The Outer Core (SDK) is **open source**. Third-party developers can write plugins for Zone. The Inner Core remains closed and is maintained by the core team.

---

## 11. The Assistant Layer

### Dual-path strategy from day one

| Task | Model | Why |
|---|---|---|
| Tag extraction | 🏠 on-device | structured, high frequency |
| Number extraction | 🏠 on-device | simple |
| Intent detection | 🏠 on-device | classification |
| Conversational warmth | ☁️ cloud | nuance required |
| Three-mode decision | ☁️ cloud | most sensitive |

### Mandatory abstraction layer

```
        application logic
               │
               ▼
      ┌────────────────┐
      │ unified interface │
      └───────┬────────┘
              │
   ┌──────────┼──────────┬──────────┐
   ▼          ▼          ▼          ▼
 cloud A   cloud B    local    domestic gateway
```

No part of the codebase may depend directly on a specific provider's SDK.

⚠️ Note on Persian quality: in published benchmarks, models strong in English are not necessarily good in Persian. **Always evaluate on real colloquial Persian data**, not English benchmarks.

### Tools, not text parsing

```
search_memories(skill, radius, min_confidence)
open_wave(skill, description, budget, urgency)
readback_number(raw_speech, amount, unit, basis)
record_memory(person, skill, outcome, source)
admit_unknown(reason, alternative)
```

⚠️ `admit_unknown` must be **a real tool**, not a default state. When the model can explicitly choose "I don't know," hallucination drops sharply.

### Persona

```
You are a local. The user's close friend.

- Speak briefly. Like a person.
- If you don't know, say so. Never invent.
- One source? Say "someone said." Three? Say "a few people."
- Never guess a price. Only confirmed numbers.
- Never ask more than two questions in a row.
- You are not a broker. Don't promote anyone.
- When professional posts exist, announce them. Don't describe them.
- Always distinguish friendly suggestions from professional ones.
```

---

## 12. Technical Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 24 | 18 and 20 are end-of-life |
| Mobile | Flutter | Voice + visual + ONNX on device |
| Database | PostgreSQL + PostGIS + pgvector | place and meaning in one query |
| Cache | Redis | reverberation and presence |
| Queue | BullMQ | wave management |
| Real-time | WebSocket | hearing spaces |
| STT | domestic service | latency and access |
| TTS | domestic service, Persian voice | naturalness |
| Maps | Neshan (or similar) | Iranian market, neighbourhood-based |
| Assistant | abstraction layer | access risk |
| On-device ML | ONNX Runtime | Flutter plugin available |

### Project structure

```
Zone-1.0.0/
├── apps/
│   ├── api/              ← Main service (Node.js)
│   ├── ws/               ← WebSocket server
│   ├── worker/           ← BullMQ worker
│   └── mobile/           ← Flutter app
│       ├── lib/
│       │   ├── core/          ← Shared logic
│       │   ├── features/      ← Pages and widgets
│       │   └── edge/          ← On-device processing
│       │       ├── tagger/    ← Tag extraction (ONNX)
│       │       ├── intent/    ← Intent detection (ONNX)
│       │       ├── number/    ← Number extraction (Regex)
│       │       └── confirm/   ← Read-back template
│       └── native/            ← Native code (STT/TTS Persian)
├── packages/
│   ├── core/             ← Inner core + event bus
│   ├── sdk/              ← Outer core (open source)
│   ├── db/               ← PostgreSQL + PostGIS + pgvector
│   ├── redis/            ← Redis client + reverberation
│   ├── tags/             ← Closed vocabulary + semantic match
│   ├── assistant/        ← Assistant abstraction layer
│   └── voice/            ← STT/TTS integration
├── plugins/
│   ├── services/         ← Neighbourhood services plugin
│   ├── social/           ← Social plugin
│   ├── support/          ← Support plugin
│   ├── professional/     ← Professional posts plugin
│   └── verification/     ← License verification plugin
├── docs/
│   ├── ARCHITECTURE.en.md
│   ├── ARCHITECTURE.fa.md
│   ├── CONVENTIONS.md
│   └── HANDOFF.md
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile
└── migrations/
```

---

## 13. Phasing

| Phase | Title | Duration | Success criterion |
|---|---|---|---|
| 0 | Architectural decisions | — | This document, approved |
| 1 | Infrastructure + micro-kernel | 1.5 weeks | server, database, event bus, plugin registry |
| 2 | Hearing space | 1.5 weeks | two devices, one speaks, other hears |
| 3 | Voice loop + on-device processing | 1.5 weeks | response under 3 s + tag/intent/number on device |
| 4 | Tagging | 1 week | closed vocabulary + semantic match + device sync |
| 5 | Three response modes + professional posts | 1.5 weeks | KNOW/ASK/UNKNOWN + visual feed |
| 6 | Tiered waves | 1 week | anti-nuisance active |
| 7 | Number read-back | 1 week | extract + confirm + lock |
| 8 | Learning | 1 week | memory recording, decay |
| 9 | Professional subscription + license verification | 1 week | registration, verification, expiry |
| 10 | Flutter MVP | 1.5 weeks | mobile app with all features above |

**Total: approximately 12.5 weeks**

⚠️ **Phases 2 and 3 must precede the assistant.** If the hearing space and voice loop don't work, model intelligence is worthless.

---

## 14. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Notification nuisance | 🔴 existential | tiered waves + hard caps |
| Tag vocabulary drift | 🔴 high | closed vocabulary + semantic matching |
| Voice latency | 🔴 high | streaming + on-device processing + fast path |
| Number errors | 🔴 high | mandatory read-back |
| Presence as sensitive data | 🟠 medium | cache only, short expiry, no history |
| Empty neighbourhood | 🟠 medium | launch neighbourhood by neighbourhood |
| Professional post quality | 🟠 medium | license verification + subscription barrier |
| Plugin compatibility | 🟠 medium | SDK versioning + sandbox |
| Zero logs means zero witnesses | 🟠 medium | violation counters without content storage |

### Two concerns worth stating plainly

**1. Presence is sensitive data.** "Who is where right now" is a live map of who is home. This is more sensitive than conversation history. Proposal: cache only, short expiry, no history.

**2. Zero logs means zero witnesses.** When no content is stored, there is no evidence if someone abuses the system. Proposal: violation counters without content storage.

---

## 15. Resolved Questions

| # | Question | Resolution |
|---|---|---|
| 1 | Does "presence" mean app open or membership? | Active presence + reverberation |
| 2 | How is a neighbourhood defined? | Iranian maps are neighbourhood-based (Narak, Tehranpars, Qeytariyeh) |
| 3 | Is Zone voice-only? | Voice is primary, text is alternative |
| 4 | What is the revenue model? | Professional subscriptions (external payment) |
| 5 | Can a user dispute a memory? | Deferred to future phase |
| 6 | Which neighbourhood launches first? | Deferred to launch decision |
| 7 | Who tags content? | System only (on-device + cloud), never the user |
| 8 | Is there advertising? | No separate ads. Professional posts appear in a separate category |
| 9 | Is the system data-driven or conversation-driven? | Conversation-driven |
| 10 | Can third parties write plugins? | Yes — Outer Core SDK is open source |

---

## Appendix — Changes from Version 3

| Topic | v3 | v4 |
|---|---|---|
| Core primitive | hearing space | **unchanged** |
| Principles | 6 | **7** (conversation-driven added) |
| Channels | voice only | **voice + visual** |
| Professional providers | not addressed | **license + subscription + visual feed** |
| On-device processing | not addressed | **tags, intent, numbers on device** |
| Architecture | conventional | **micro-kernel (inner core + outer core + plugins)** |
| Plugin system | not addressed | **open source SDK, third-party plugins** |
| Tagging | assistant only | **system only (on-device + cloud)** |
| Revenue model | none | **professional subscriptions** |
| Presence | open question | **active presence + reverberation** |
| Neighbourhood | open question | **Iranian maps (neighbourhood-based)** |
