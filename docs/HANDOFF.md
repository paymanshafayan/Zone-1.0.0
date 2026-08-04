# 🔄 Zone — Handoff Document

**Last updated:** 3 August 2026
**Current phase:** 10 — Flutter MVP (Phase 10d Complete)
**Status:** 🔄 In Progress

---

## Phase 0 — Architectural Decisions

### ✅ Completed

| # | Decision | Resolution | Date |
|---|---|---|---|
| 1 | Project identity | Zone is a neighbourhood friend, not a marketplace | 2026-08-02 |
| 2 | Core primitive | Hearing Space (dynamic + persistent) | 2026-08-02 |
| 3 | Interaction model | Conversation-driven, not data-driven | 2026-08-02 |
| 4 | Voice vs text | Voice is primary, text is alternative | 2026-08-02 |
| 5 | Tag system | System-only tagging, closed vocabulary, semantic matching | 2026-08-02 |
| 6 | Three response modes | KNOW / ASK / UNKNOWN — UNKNOWN is a real tool | 2026-08-02 |
| 7 | On-device processing | Tags, intent, numbers on device; warmth and decision on cloud | 2026-08-02 |
| 8 | Two channels | Voice (assistant) + Visual (professional feed) | 2026-08-02 |
| 9 | Professional providers | Union license + subscription + visual posts (Instagram-like) | 2026-08-02 |
| 10 | Revenue model | Professional subscriptions (external payment) | 2026-08-02 |
| 11 | Architecture | Micro-kernel: inner core + outer core (SDK) + plugins | 2026-08-02 |
| 12 | Plugin system | Open source SDK, third-party plugins allowed | 2026-08-02 |
| 13 | Mobile framework | Flutter | 2026-08-02 |
| 14 | Maps | Iranian neighbourhood-based maps (Neshan or similar) | 2026-08-02 |
| 15 | Presence model | Active presence + reverberation | 2026-08-02 |
| 16 | Neighbourhood definition | Iranian maps (Narak, Tehranpars, Qeytariyeh) | 2026-08-02 |
| 17 | Professional post format | Image + short video (≤15s) + text + system tags | 2026-08-02 |
| 18 | License verification | Upload license image + unique number → external verification site | 2026-08-02 |
| 19 | Payment | External link (not in-app purchase) | 2026-08-02 |
| 20 | Professional posts in voice channel | Assistant only announces existence, does not describe | 2026-08-02 |
| 21 | Seven principles | Approved (including Principle 5 update and Principle 7) | 2026-08-02 |

---

## Phase 1 — Infrastructure + Micro-kernel

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Monorepo setup (Turborepo) | ✅ | pnpm workspace + turbo |
| 2 | PostgreSQL + PostGIS + pgvector schema | ✅ | Prisma schema with all models |
| 3 | Redis client + TTL module | ✅ | ioredis with reverberation + presence |
| 4 | BullMQ queue + worker | ✅ | Wave processing with anti-nuisance rules |
| 5 | Event bus implementation | ✅ | Full pub/sub with wildcard support |
| 6 | Plugin registry implementation | ✅ | Register/unregister/enable/disable |
| 7 | Outer Core SDK (initial version) | ✅ | Events, data, tags, hearing, UI, notify, plugins |
| 8 | Docker Compose | ✅ | PostgreSQL, Redis, API, WS, Worker |
| 9 | Structured logging | ✅ | JSON logger with context |
| 10 | Build passes | ✅ | All 15 packages compile successfully |

### 📄 Files created

| File | Description |
|---|---|
| `package.json` | Root workspace config |
| `turbo.json` | Turborepo task config |
| `pnpm-workspace.yaml` | Workspace packages |
| `.eslintrc.json` | ESLint config |
| `.gitignore` | Git ignore rules |
| `.env.example` | Environment variables template |
| `packages/core/src/event-bus.ts` | EventBus — central nervous system |
| `packages/core/src/plugin-registry.ts` | PluginRegistry — lifecycle management |
| `packages/core/src/logger.ts` | Logger — structured JSON logging |
| `packages/core/src/types.ts` | Shared types — all domain models |
| `packages/core/src/index.ts` | Core package entry point |
| `packages/sdk/src/index.ts` | Outer Core SDK — plugin interface |
| `packages/db/prisma/schema.prisma` | Full database schema (14 models) |
| `packages/redis/src/index.ts` | Redis — reverberation + presence |
| `packages/tags/src/vocabulary.ts` | Closed vocabulary + semantic matching |
| `packages/assistant/src/index.ts` | Assistant abstraction layer + persona |
| `packages/voice/src/index.ts` | STT/TTS abstraction layer |
| `apps/api/src/index.ts` | Fastify API server |
| `apps/ws/src/index.ts` | WebSocket server for hearing spaces |
| `apps/worker/src/index.ts` | BullMQ worker for tiered waves |
| `plugins/services/src/index.ts` | Services plugin |
| `plugins/social/src/index.ts` | Social plugin |
| `plugins/support/src/index.ts` | Support plugin |
| `plugins/professional/src/index.ts` | Professional posts plugin |
| `plugins/verification/src/index.ts` | License verification plugin |
| `infra/docker-compose.yml` | Docker services |
| `infra/Dockerfile` | Multi-stage build |
| `infra/init-db.sql` | PostGIS + pgvector extensions |

---

## Phase 2 — Hearing Space

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | WebSocket server with full protocol | ✅ | identify, join, leave, speak, list_spaces, ping |
| 2 | Dynamic space management | ✅ | create on-demand, expire after TTL |
| 3 | Persistent space management | ✅ | user-created, last until removed |
| 4 | Reverberation in Redis | ✅ | 15min (urgent) / 2h (service) / 6h (social) |
| 5 | Active presence tracking | ✅ | 5-min TTL, heartbeat every 1 min |
| 6 | Two-device test script | ✅ | apps/ws/src/test-two-devices.ts |
| 7 | API space management routes | ✅ | GET /api/spaces/:spaceId, members, presence |
| 8 | HearingSpaceService | ✅ | Full lifecycle: create, join, leave, speak, find, remove |

---

## Phase 3 — Voice Loop + On-Device Processing

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | EdgeProcessor — tag extraction | ✅ | Keyword matching against closed vocabulary (ONNX in production) |
| 2 | EdgeProcessor — intent detection | ✅ | Three-mode classifier: KNOW/ASK/UNKNOWN |
| 3 | EdgeProcessor — number extraction | ✅ | Persian digits + word numbers + scale words + units |
| 4 | EdgeProcessor — read-back confirmation | ✅ | Mandatory: "یعنی نود هزار تومان متر مربع؟" |
| 5 | VoicePipeline — full pipeline | ✅ | STT → Edge → Cloud/Fast → TTS |
| 6 | VoicePipeline — fast path | ✅ | Skip cloud for high-confidence structured requests |
| 7 | VoicePipeline — bridging response | ✅ | "بذار ببینم..." fills perceptual gap |
| 8 | VoicePipeline — text input | ✅ | For typed input (alternative to voice) |
| 9 | API routes for voice processing | ✅ | POST /api/voice/process, extract-tags, readback, confirm-number |
| 10 | Persian number parsing | ✅ | Digits, words, scale (هزار/میلیون/میلیارد), units |

---

## Phase 4 — Tagging

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Closed vocabulary (initial) | ✅ | 4 branches: services (12), urgency (3), social (8), support (3) |
| 2 | Semantic matching | ✅ | Jaccard similarity on keyword vectors (pgvector in production) |
| 3 | Tag suggestion | ✅ | 5 sources: exact → alias → partial → semantic → path proximity |
| 4 | Demand queue | ✅ | ≥3 requests → pending → admin approval |
| 5 | Alias management | ✅ | Prevents vocabulary drift by recording synonyms |
| 6 | Vocabulary sync to device | ✅ | GET /api/tags/sync returns full vocabulary for edge processor |
| 7 | Tag statistics | ✅ | Total, approved, pending, queued, aliases |
| 8 | API routes (12 endpoints) | ✅ | Search, paths, branch, stats, demand, alias, sync |

---

## Phase 5 — Three Response Modes + Professional Posts

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | `search_memories` tool | ✅ | Searches neighbourhood knowledge for a skill+zone |
| 2 | `open_wave` tool | ✅ | Opens a hearing space wave to ask around |
| 3 | `admit_unknown` tool | ✅ | Real tool — honest admission + learning request |
| 4 | Three-mode decision engine | ✅ | KNOW/ASK/UNKNOWN with real data queries |
| 5 | Persona implementation | ✅ | ZONE_PERSONA integrated into response generation |
| 6 | MemoryService | ✅ | Record, search, temporal decay, confidence scoring |
| 7 | PostService | ✅ | CRUD, feed, count, deactivation, media validation |
| 8 | Professional post API routes | ✅ | CRUD + feed + count + like + provider |
| 9 | Memory API routes | ✅ | Search, record, stats, list |
| 10 | Response mode API routes | ✅ | Decide, tool definitions |
| 11 | VoicePipeline integration | ✅ | Mode engine used for ASK intents |
| 12 | Professional plugin enhanced | ✅ | PostService integration, announcement generation |
| 13 | Test script (39 tests) | ✅ | All passing |

### Three Response Modes Architecture

```
User speaks → Edge Processor → ResponseModeEngine
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                   ┌─────────┐  ┌─────────┐  ┌─────────────┐
                   │  KNOW   │  │  ASK    │  │  UNKNOWN    │
                   └─────────┘  └─────────┘  └─────────────┘
                   search_      open_wave     admit_unknown
                   memories     + wave         + learning
                   from          request        request
                   MemoryService
```

### Decision Rules

| Mode | Condition | Tool |
|---|---|---|
| KNOW | ≥1 positive memory with confidence ≥ 0.5 | `search_memories` |
| ASK | Skill in vocabulary, no/few memories | `open_wave` |
| UNKNOWN | Skill NOT in vocabulary | `admit_unknown` |

### Professional Post Model

| Feature | Implementation |
|---|---|
| Media | Image + short video (≤15s) |
| Tags | System-only (from edge processor) |
| Feed | Paginated, sorted by date |
| Visibility | Active while subscription active |
| Voice channel | Only announces count, never describes |
| Deactivation | Soft delete (subscription expiry) |
| Reactivation | On subscription renewal |

### API Endpoints Added

| Method | Path | Description |
|---|---|---|
| POST | /api/response-mode/decide | Three-mode decision engine |
| GET | /api/response-mode/tools | Tool definitions |
| GET | /api/memories/search | Search neighbourhood memories |
| POST | /api/memories | Record a new memory |
| GET | /api/memories/stats | Memory statistics |
| GET | /api/memories | List memories by zone |
| POST | /api/posts | Create professional post |
| GET | /api/posts | Visual feed (paginated) |
| GET | /api/posts/:id | Get single post |
| PUT | /api/posts/:id | Update post |
| DELETE | /api/posts/:id | Deactivate post |
| GET | /api/posts/count | Count for voice announcements |
| GET | /api/posts/provider/:id | Posts by provider |
| POST | /api/posts/:id/like | Like a post |

### Files Created/Modified

| File | Description |
|---|---|
| `packages/assistant/src/tools.ts` | Three tool definitions + ToolExecutor |
| `packages/assistant/src/response-modes.ts` | ResponseModeEngine — decision engine |
| `packages/assistant/src/memory-service.ts` | MemoryService — knowledge search + temporal decay |
| `packages/assistant/src/post-service.ts` | PostService — CRUD + feed + count |
| `packages/assistant/src/index.ts` | Updated exports (Phase 5) |
| `packages/voice/src/voice-pipeline.ts` | Integrated with ResponseModeEngine |
| `packages/core/src/types.ts` | Added postCount to professional.post event |
| `apps/api/src/index.ts` | Added 14 new API routes |
| `apps/api/src/test-phase5.ts` | 39 tests — all passing |
| `plugins/professional/src/index.ts` | Enhanced with PostService + announcement |

### Decisions made during this phase

| # | Decision | Rationale |
|---|---|---|
| 1 | admit_unknown is a REAL tool | When the model can explicitly choose "I don't know", hallucination is dramatically reduced |
| 2 | MemoryService uses in-memory store for dev | Production will use PostgreSQL; in-memory is sufficient for development |
| 3 | PostService uses in-memory store for dev | Same rationale as MemoryService |
| 4 | Temporal decay: λ = 0.001 (half-life ≈ 2 years) | Prevents stale recommendations without being too aggressive |
| 5 | Video duration limit: 15 seconds | Architecture doc requirement; Instagram-like format |
| 6 | Post deactivation on subscription expiry | Soft delete; posts hidden but not destroyed |
| 7 | Skill vocabulary check for UNKNOWN mode | Tags like "services/rocket_science" are NOT in vocabulary even though they start with "services/" |
| 8 | Epsilon in credibility check | Floating point precision: freshly created memories must not be excluded |

---

## Phase 6 — Tiered Waves

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Wave 1: matching skill + 2.5km radius + max 8 | ✅ | PersonRegistry + geographic search |
| 2 | Wave 2: adjacent skill + 5km radius + max 15 | ✅ | Adjacent skills map + expanded radius |
| 3 | Wave 3: referral + all active users | ✅ | All active users in zone |
| 4 | Max 3 notifications/day | ✅ | AntiNuisanceService daily tracking |
| 5 | Quiet hours (22:00 – 08:00 Iran time) | ✅ | UTC+3:30 timezone-aware |
| 6 | Stop after ≥2 responses | ✅ | AntiNuisanceService response tracking |
| 7 | Down-weight after 3 silences | ✅ | PersonRegistry silence tracking |
| 8 | Tag opt-out | ✅ | PersonRegistry optedOutTags |
| 9 | Emergency channel | ✅ | Max 1/week, bypasses quiet hours |
| 10 | PersonRegistry | ✅ | Skills, location, silence, opt-out |
| 11 | AntiNuisanceService | ✅ | Daily limits, quiet hours, emergency |
| 12 | WaveService | ✅ | Three-tier dispatch + response tracking |
| 13 | Enhanced Worker | ✅ | Full WaveService integration |
| 14 | Test script (52 tests) | ✅ | All passing |

### Wave Architecture

```
Request created → Wave 1 (immediate)
  │  Matching skill + 2.5km + max 8
  │  10 min delay
  ▼
Wave 2
  │  Adjacent skills + 5km + max 15
  │  20 min delay
  ▼
Wave 3
  │  Referral + all active + max 30
  │
  ▼
No response → UNKNOWN mode
```

### Anti-Nuisance Rules

| Rule | Value | Implementation |
|---|---|---|
| Max daily notifications | 3 per user | AntiNuisanceService.canNotify() |
| Quiet hours | 22:00 – 08:00 (Iran) | UTC+3:30 timezone-aware |
| Stop after responses | ≥2 | AntiNuisanceService.recordResponse() |
| Down-weight threshold | 3 silences | PersonRegistry.silenceCount |
| Emergency limit | 1 per week | AntiNuisanceService weekly tracking |
| Opt-out | Per tag | PersonRegistry.hasOptedOut() |

### Adjacent Skills Map

| Primary | Adjacent |
|---|---|
| house_painting | tiling, carpentry, repair |
| plumbing | repair, appliance_repair |
| electrical | repair, air_conditioning, appliance_repair |
| carpentry | house_painting, repair, tiling |
| locksmith | repair, carpentry |

### Wave Delays by Urgency

| Urgency | Wave 1→2 | Wave 2→3 |
|---|---|---|
| Normal | 10 min | 20 min |
| Urgent | 5 min | 10 min |
| Emergency | 2 min | 5 min |

### Files Created/Modified

| File | Description |
|---|---|
| `packages/assistant/src/wave-service.ts` | WaveService — three-tier dispatch |
| `packages/assistant/src/anti-nuisance.ts` | AntiNuisanceService — all anti-nuisance rules |
| `packages/assistant/src/person-registry.ts` | PersonRegistry — skills, location, silence, opt-out |
| `packages/assistant/src/index.ts` | Updated exports (Phase 6) |
| `packages/core/src/types.ts` | Added wave.unknown and wave.dispatched events |
| `apps/worker/src/index.ts` | Enhanced with WaveService + sample data |
| `apps/api/src/test-phase6.ts` | 52 tests — all passing |

### Decisions made during this phase

| # | Decision | Rationale |
|---|---|---|
| 1 | PersonRegistry in-memory for dev | Production will use PostgreSQL+PostGIS; in-memory sufficient for dev |
| 2 | Iran timezone for quiet hours | Target market is Iran; UTC+3:30 offset |
| 3 | Adjacent skills map is hardcoded | Production will use semantic similarity from tags package |
| 4 | Emergency bypasses quiet hours | Safety first; but weekly limit prevents abuse |
| 5 | Silence tracking in both PersonRegistry and AntiNuisance | PersonRegistry tracks for filtering, AntiNuisance for logging |
| 6 | Wave 1 excludes down-weighted users | First wave should be high-quality; Wave 2+ includes them |
| 7 | Haversine distance for radius filtering | Standard geographic distance calculation |

---

## Phase 7 — Number Read-back

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Number extraction from speech | ✅ | EdgeProcessor (Phase 3) + NumberService |
| 2 | Read-back confirmation | ✅ | Mandatory: «یعنی نود هزار تومان متر مربع، درسته؟» |
| 3 | Number locking | ✅ | NumberStatus.LOCKED after confirmation |
| 4 | Basis detection | ✅ | 7 patterns: per_square_metre, total, per_day, per_hour, per_month, per_kilo, per_unit |
| 5 | Comparison: cheapest | ✅ | Normalized per-unit comparison |
| 6 | Comparison: fastest | ✅ | Duration parsing (روز/هفته/ماه/سال) |
| 7 | Comparison: most trusted | ✅ | Trust scores from recommendations |
| 8 | Voice-friendly comparison summary | ✅ | «۳ نفر جواب دادن. ارزان‌ترین X. سریع‌ترین Y. کدوم رو بیشتر توضیح بدم؟» |
| 9 | Number lifecycle | ✅ | Extracted → Readback → Confirmed → Locked |
| 10 | Number rejection | ✅ | User says "no" → number rejected |
| 11 | Test script (51 tests) | ✅ | All passing |

### Number Lifecycle

```
Extracted → Read-back → Confirm → Lock
    │           │          │         │
    │           │          │         └── Number enters system
    │           │          └── User says "yes"
    │           └── «یعنی نود هزار تومان متر مربع، درسته؟»
    └── EdgeProcessor extracts from speech
```

### Basis Detection Patterns

| Pattern | Basis | Label |
|---|---|---|
| متر مربع, هر متر, متری | per_square_metre | متر مربع |
| کل, جمع, مجموع | total | کل |
| هر روز, روزانه | per_day | هر روز |
| هر ساعت, ساعتی | per_hour | هر ساعت |
| هر ماه, ماهانه | per_month | هر ماه |
| هر کیلو, کیلویی | per_kilo | هر کیلو |
| (default) | per_unit | هر واحد |

### Comparison Axes

| Axis | Logic | Example |
|---|---|---|
| ارزان‌ترین | Normalized per-unit comparison | ارزان‌ترین استاد حسینی با هفتاد و پنج هزار تومان |
| سریع‌ترین | Duration parsing to days | سریع‌ترین آقای محمدی با ۲ روز |
| معتمدترین | Trust scores from recommendations | معتمدترین آقای محمدی با ۸ معرفی |

### Files Created/Modified

| File | Description |
|---|---|
| `packages/assistant/src/number-service.ts` | NumberService — full lifecycle + comparison |
| `packages/assistant/src/index.ts` | Updated exports (Phase 7) |
| `apps/api/src/test-phase7.ts` | 51 tests — all passing |

### Decisions made during this phase

| # | Decision | Rationale |
|---|---|---|
| 1 | No number enters system without confirmation | Architecture doc hard rule — prevents disputes |
| 2 | Three comparison axes | Voice is linear; reading 5 offers is useless. Cheapest, fastest, most trusted |
| 3 | Duration parsing for fastest | Supports Persian: روز/هفته/ماه/سال |
| 4 | NumberService in @zone/assistant | Natural home — assistant decides and confirms numbers |
| 5 | NumberStatus enum | Clear lifecycle tracking: extracted → readback → confirmed → locked |
| 6 | Rejection is a first-class action | User can say "no" and correct the number |

---

## Phase 8 — Learning

**Status:** ✅ Complete
**Duration:** 1 week
**Success criteria:** Memory recording, temporal decay, confidence, memory demand

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | `record_memory` tool | ✅ | Fourth tool in ASSISTANT_TOOLS — records memories from user reports |
| 2 | MemoryDemandService | ✅ | Full lifecycle: create, fulfill, expire, cancel, search |
| 3 | LearningService | ✅ | Orchestrates full learning loop: demand → learn → record |
| 4 | Enhanced confidence scoring | ✅ | 6 factors: source diversity, positive consistency, recency, professional, verified, learning loop |
| 5 | Auto-matching demands | ✅ | User reports back without demandId → system finds matching open demand |
| 6 | admit_unknown creates demand | ✅ | Every UNKNOWN mode now creates a learning demand |
| 7 | Demand TTL (7 days default) | ✅ | Customizable, auto-expire, max 10 open per user |
| 8 | Learning statistics | ✅ | Total memories, demands, learning rate, top skills |
| 9 | Learning API routes (7 endpoints) | ✅ | Learn, record, demands, search, stats |
| 10 | Test script (67 tests) | ✅ | All passing |

### Learning Loop Architecture

```
User asks → UNKNOWN mode → admit_unknown tool
    │
    ├── Creates MemoryDemand (skill + zone + requester)
    └── Response: "اگه خودت پیدا کردی، بهم بگو تا دفعه بعد بدونم"
    
    │
    ▼ (user comes back later)
    
User reports → record_memory tool / POST /api/learning/learn
    │
    ├── Auto-matches open demand (by skill + zone + requester)
    ├── Fulfills the demand
    ├── Records memory with enhanced confidence
    └── Response: "یادداشت کردم. دفعه بعد از اول می‌شناسم."
    
    │
    ▼ (next time)
    
User asks again → KNOW mode → search_memories
    └── Memory found! Zone now knows.
```

### Enhanced Confidence Scoring

| Factor | Boost | Max |
|---|---|---|
| Base confidence | 0.5 | — |
| Source diversity (per additional source) | +0.1 | +0.3 |
| Positive consistency (≥80% positive) | +0.15 | +0.15 |
| Recency (within 7 days) | +0.1 | +0.1 |
| Professional status | +0.05 | +0.05 |
| Verified numbers | +0.1 | +0.1 |
| Learning loop feedback | +0.1 | +0.1 |
| **Maximum** | | **1.0** |

### Demand Lifecycle

```
Created (open) → Fulfilled (user reports back)
                → Expired (TTL exceeded, default 7 days)
                → Cancelled (user cancels)
```

### API Endpoints Added

| Method | Path | Description |
|---|---|---|
| POST | /api/learning/learn | Core learning endpoint — user reports back |
| POST | /api/learning/record | Simple memory recording (no learning loop) |
| GET | /api/learning/demands | List learning demands |
| GET | /api/learning/demands/:demandId | Get specific demand |
| POST | /api/learning/demands/:demandId/cancel | Cancel a demand |
| GET | /api/learning/stats | Learning statistics |
| GET | /api/learning/search | Search memories with learning context |

### Files Created/Modified

| File | Description |
|---|---|
| `packages/assistant/src/memory-demand.ts` | MemoryDemandService — demand lifecycle |
| `packages/assistant/src/learning-service.ts` | LearningService — orchestrates full learning loop |
| `packages/assistant/src/tools.ts` | Added record_memory tool, admit_unknown creates demand |
| `packages/assistant/src/index.ts` | Updated exports (Phase 8) |
| `packages/core/src/types.ts` | Added 4 learning event types |
| `apps/api/src/index.ts` | Added LearningService + 7 new API routes |
| `apps/api/src/test-phase8.ts` | 67 tests — all passing |

### Decisions made during this phase

| # | Decision | Rationale |
|---|---|---|
| 1 | record_memory is a separate tool | The assistant needs to explicitly choose to record — not automatic |
| 2 | admit_unknown creates a demand | Every "I don't know" becomes a learning opportunity |
| 3 | Auto-matching demands by skill+zone+requester | User doesn't need to remember the demandId |
| 4 | Max 10 open demands per user | Prevents abuse; oldest auto-expired when limit reached |
| 5 | Default TTL: 7 days | Reasonable window for learning; not too long, not too short |
| 6 | Learning loop boost: +0.1 | Feedback from a demand fulfillment is more valuable than random info |
| 7 | Negative outcomes also fulfill demands | Even bad experiences are valuable knowledge |
| 8 | MemoryDemandService is separate from MemoryService | Separation of concerns — demands are about learning, memories are about knowledge |

---

## Phase 9 — Professional Subscription + License Verification

**Status:** ✅ Complete
**Duration:** 1 week
**Success criteria:** Registration, verification, expiry

### ✅ Completed

| # | Task | Status | Details |
|---|---|---|---|
| 1 | LicenseVerificationService | ✅ | Submit, verify, reject, search, stats |
| 2 | License number validation | ✅ | Iranian formats: ۱۲۳۴۵/م, ۱۲۳۴۵, ۱۲۳-۴۵۶ |
| 3 | ProfessionalSubscriptionService | ✅ | Register, activate, renew, cancel, expire |
| 4 | Three subscription plans | ✅ | Monthly (150K), quarterly (400K), annual (1.4M) |
| 5 | External payment link | ✅ | App never processes payment — only links to external site |
| 6 | License verification flow | ✅ | Submit → external verification → approve/reject |
| 7 | Subscription activation | ✅ | Requires verified license + external payment reference |
| 8 | Subscription expiry → post deactivation | ✅ | Auto-expire + post hiding |
| 9 | Subscription renewal → post reactivation | ✅ | Posts restored on renewal |
| 10 | Subscription cancellation | ✅ | Post deactivation on cancellation |
| 11 | Professional status check | ✅ | Normal ↔ Professional based on active subscription |
| 12 | Duplicate license prevention | ✅ | Same license number can't be used by different people |
| 13 | API routes (13 endpoints) | ✅ | Register, activate, verify, status, plans, etc. |
| 14 | Test script (69 tests) | ✅ | All passing |

### Professional Provider Flow

```
User requests registration → submit license (image + unique number)
    │
    ├── External verification callback
    │   ├── Approved → license.verified
    │   └── Rejected → license.rejected (reason recorded)
    │
    ├── If verified → external payment link
    │   └── App NEVER processes payment
    │
    ├── Payment confirmed → subscription activated
    │   ├── Professional account status
    │   ├── Can create professional posts
    │   └── Posts appear in visual feed
    │
    ├── Subscription expires → account downgraded
    │   ├── Posts hidden (not deleted)
    │   └── Status: normal
    │
    └── Subscription renewed → posts reactivated
```

### Subscription Plans

| Plan | Duration | Price | Discount |
|---|---|---|---|
| ماهانه | 30 days | 150,000 toman | — |
| سه‌ماهه | 90 days | 400,000 toman | 10% |
| سالانه | 365 days | 1,400,000 toman | 22% |

### API Endpoints Added

| Method | Path | Description |
|---|---|---|
| POST | /api/professional/register | Register as professional |
| POST | /api/professional/activate | Activate after payment |
| POST | /api/professional/license/verify | Verify/reject license |
| GET | /api/professional/status/:personId | Get professional status |
| GET | /api/professional/plans | Get subscription plans |
| GET | /api/professional/subscription/:id | Get subscription details |
| POST | /api/professional/renew | Renew a subscription |
| POST | /api/professional/cancel/:id | Cancel a subscription |
| POST | /api/professional/check-expirations | Check and expire subscriptions |
| GET | /api/professional/license/stats | License statistics |
| GET | /api/professional/subscription/stats | Subscription statistics |
| GET | /api/professional/licenses | Search licenses |
| GET | /api/professional/subscriptions | Search subscriptions |

### Files Created/Modified

| File | Description |
|---|---|
| `packages/assistant/src/license-service.ts` | LicenseVerificationService — full lifecycle |
| `packages/assistant/src/subscription-service.ts` | ProfessionalSubscriptionService — full lifecycle |
| `packages/assistant/src/index.ts` | Updated exports (Phase 9) |
| `packages/core/src/types.ts` | Added 7 professional event types |
| `apps/api/src/index.ts` | Added 13 new API routes |
| `apps/api/src/test-phase9.ts` | 69 tests — all passing |

### Decisions made during this phase

| # | Decision | Rationale |
|---|---|---|
| 1 | Payment via external link | Architecture doc: no in-app purchase. App never stores payment info |
| 2 | License must be verified before activation | Prevents fraud — only verified professionals can subscribe |
| 3 | Same license number can't be used by different people | Prevents one person using another's license |
| 4 | Same person can re-use their verified license | Renewal should use existing verified license |
| 5 | Posts hidden (not deleted) on expiry | Principle 7 exception — professional posts are meant to persist |
| 6 | Posts reactivated on renewal | Provider shouldn't lose their content when they renew |
| 7 | Three plan tiers with discounts | Industry standard; encourages longer subscriptions |
| 8 | Iranian license number formats | Target market is Iran; unions have specific formats |
| 9 | External verification site per profession | Different unions have different verification sites |
| 10 | Expiry check is a separate endpoint | Designed for cron job execution |

---

## Phase 10 — Flutter MVP

**Status:** 🔄 In Progress (Phase 10a + 10b + 10c Complete)
**Duration:** 1.5 weeks
**Success criteria:** Mobile app with all features above

### ✅ Completed (Phase 10a — Skeleton)

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Flutter project setup | ✅ | Flutter 3.44.8, Dart 3.12.2, `apps/mobile/` |
| 2 | Project structure | ✅ | core/ + features/ + shared/ + edge/ (matches architecture doc) |
| 3 | Theme (light + dark) | ✅ | Warm amber/gold, Vazirmatn font, RTL-first |
| 4 | Riverpod state management | ✅ | All providers: voice, visual, hearing, professional, auth |
| 5 | API client (Dio) | ✅ | All 50+ API endpoints from phases 1-9 |
| 6 | WebSocket service | ✅ | Hearing space protocol: identify, join, leave, speak, ping |
| 7 | Navigation (GoRouter) | ✅ | Shell route with bottom nav, auth redirect, onboarding |
| 8 | On-device processing | ✅ | EdgeProcessor: tag extraction, intent detection, number extraction, read-back |
| 9 | Voice channel UI | ✅ | Conversation screen, voice bubbles, mode indicator, number confirmation |
| 10 | Visual channel UI | ✅ | Instagram-like feed, post cards, professional badge |
| 11 | Hearing space UI | ✅ | Space list, active space, join/leave/speak, presence |
| 12 | Professional hub UI | ✅ | Registration flow, license upload, subscription plans, status |
| 13 | Settings screen | ✅ | Tag subscriptions, anti-nuisance info, notification preferences |
| 14 | Auth screen | ✅ | Phone number entry (OTP placeholder for production) |
| 15 | Onboarding screen | ✅ | 4-step: welcome → neighbourhood → skills → tag preferences |
| 16 | Domain models | ✅ | All models mirroring backend types.ts |
| 17 | Flutter analyze | ✅ | 0 errors, only info/warnings |
| 18 | Backend build | ✅ | All 15 packages still compile successfully |

### ✅ Completed (Phase 10b — Polish & Integration)

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Create professional post screen | ✅ | Media picker, description, auto-extracted tags, validation |
| 2 | Post detail screen | ✅ | Full-size media, provider info, tags, actions |
| 3 | User profile screen | ✅ | Name, zone, skills, tag subscriptions, stats, privacy info |
| 4 | Notification service | ✅ | Anti-nuisance rules: 3/day, quiet hours, emergency bypass |
| 5 | Notifications screen | ✅ | Notification list with type icons, read/unread |
| 6 | Wave status screen | ✅ | 3-tier wave visualization, response tracking |
| 7 | Tag subscription management | ✅ | Toggle per branch, SharedPreferences persistence |
| 8 | Shared widgets | ✅ | Loading, error, empty state, section header, status chip, pulse animation |
| 9 | Integration tests | ✅ | 26 tests: EdgeProcessor, TagExtractor, IntentDetector, NumberExtractor, ReadbackFormatter, Models, Privacy |
| 10 | Vazirmatn font | ✅ | 5 weights, RTL-first, Persian text |
| 11 | Extended navigation | ✅ | Post detail, create post, profile, notifications routes |
| 12 | Profile persistence | ✅ | SharedPreferences: name, zone, skills, tag subscriptions |

### Architecture Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Riverpod over BLoC | Most flexible for this complexity; modern Dart patterns |
| 2 | Neshan maps (deferred) | SDK not available on pub.dev yet; placeholder for now |
| 3 | Vazirmatn font | Best Persian font for UI; supports all weights |
| 4 | GoRouter for navigation | Declarative routing, deep linking, shell routes |
| 5 | withValues() over withOpacity() | Flutter 3.44 deprecates withOpacity for precision |
| 6 | EdgeProcessor mirrors backend | Same keyword matching for dev; ONNX in production |
| 7 | Privacy: raw text stays on device | Only structured data sent to server (matches architecture) |
| 8 | Voice-first UI | Large mic button, text input as alternative |
| 9 | Mode indicator colors | KNOW=green, ASK=blue, UNKNOWN=orange (matches architecture) |
| 10 | Professional badge | Gold badge + verified icon for professional providers |
| 11 | SharedPreferences for persistence | Simple, reliable for MVP; production: encrypted storage |
| 12 | Anti-nuisance in Flutter | Notification service respects same rules as backend |
| 13 | 26 integration tests | Core on-device processing + models + privacy verified |

### Files Created (Phase 10b)

| File | Description |
|---|---|
| `apps/mobile/lib/features/professional/providers/post_creation_provider.dart` | Post creation state management |
| `apps/mobile/lib/features/professional/screens/create_post_screen.dart` | Create professional post screen |
| `apps/mobile/lib/features/visual/screens/post_detail_screen.dart` | Post detail screen |
| `apps/mobile/lib/features/settings/providers/profile_provider.dart` | Profile state + SharedPreferences persistence |
| `apps/mobile/lib/features/settings/screens/profile_screen.dart` | User profile screen |
| `apps/mobile/lib/features/settings/screens/notifications_screen.dart` | Notifications list |
| `apps/mobile/lib/shared/services/notification_service.dart` | Notification service with anti-nuisance |
| `apps/mobile/lib/features/voice/screens/wave_status_screen.dart` | 3-tier wave status visualization |
| `apps/mobile/lib/shared/widgets/shared_widgets.dart` | Loading, error, empty, status chip, pulse |
| `apps/mobile/test/integration_test.dart` | 26 integration tests (all passing) |

### ✅ Completed (Phase 10c — Production Readiness)

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Connectivity service | ✅ | Online/offline detection with connectivity_plus |
| 2 | Global error handler | ✅ | ZoneError types, Persian error messages, snackbar integration |
| 3 | Cache service | ✅ | SharedPreferences-based with TTL, offline data access |
| 4 | Environment configuration | ✅ | Dev/staging/prod, feature flags, dart-define support |
| 5 | Android build config | ✅ | minSdk 24, RTL support, ProGuard rules, deep linking |
| 6 | AndroidManifest permissions | ✅ | Internet, mic, camera, storage, location, vibration |
| 7 | Deep linking | ✅ | zone://app scheme |
| 8 | State management tests | ✅ | Voice state, notification anti-nuisance, models, privacy |
| 9 | Comprehensive model tests | ✅ | All 10 models with fromJson |
| 10 | Privacy guarantee tests | ✅ | Structured data never contains raw text |
| 11 | Neshan map SDK (نشان) | ✅ | neshan_maps_flutter ^1.1.0, map + location picker, placeholder fallback |
| 12 | Chabok push notifications (چابک) | ✅ | chabokpush_flutter ^3.2.0, replaces Firebase, channel-based pub/sub |
| 13 | Avanegar STT/TTS (آوانگار) | ✅ | REST API + WebSocket, Persian speech recognition, placeholder mode |
| 14 | Upload service (ابر آروان) | ✅ | Image/video upload via API → Arvan Cloud, validation, offline support |
| 15 | Voice service dual backend | ✅ | On-device (MVP) + Avanegar (production), feature flags |
| 16 | dart analyze | ✅ | 0 errors, 10 warnings (unused variables/placeholder methods) |
| 17 | flutter pub get | ✅ | All dependencies resolved successfully |
| 18 | Backend build | ✅ | 15 packages compile successfully |

### Files Created (Phase 10c)

| File | Description |
|---|---|
| `apps/mobile/lib/shared/services/connectivity_service.dart` | Online/offline detection |
| `apps/mobile/lib/shared/services/error_handler.dart` | Global error handling |
| `apps/mobile/lib/shared/services/cache_service.dart` | Offline caching with TTL |
| `apps/mobile/lib/core/constants/environment.dart` | Environment config + feature flags + Iranian service URLs |
| `apps/mobile/lib/shared/services/neshan_map_service.dart` | Neshan map widget (نشان) with location picker |
| `apps/mobile/lib/shared/services/chabok_service.dart` | Chabok push notifications (چابک) — replaces Firebase |
| `apps/mobile/lib/shared/services/avanegar_service.dart` | Avanegar STT/TTS (آوانگار) via REST API + WebSocket |
| `apps/mobile/lib/shared/services/upload_service.dart` | Image/video upload to API → Arvan Cloud |
| `apps/mobile/lib/shared/services/voice_service.dart` | Voice service with dual backend (on-device + Avanegar) |
| `apps/mobile/android/app/build.gradle.kts` | Build config (minSdk 24, RTL, ProGuard) |
| `apps/mobile/android/app/proguard-rules.pro` | ProGuard rules for release |
| `apps/mobile/android/app/src/main/AndroidManifest.xml` | Permissions + deep linking |
| `apps/mobile/test/state_management_test.dart` | State management + model + privacy tests |

### Architecture Decisions (Phase 10c)

| # | Decision | Rationale |
|---|---|---|
| 1 | Chabok replaces Firebase | Iranian push notification platform, no Google dependency, channel-based pub/sub |
| 2 | Avanegar for STT/TTS | Domestic Persian AI service, higher quality than on-device, REST API + WebSocket |
| 3 | Arvan Cloud via API server | Client doesn't need S3 credentials (more secure), minio_new conflicts with neshan_maps_flutter |
| 4 | neshan_maps_flutter ^1.1.0 | Available on pub.dev, cross-platform, Web key required (not Android/iOS key) |
| 5 | Dual voice backend | On-device (MVP, privacy) + Avanegar (production, quality), feature flags control |
| 6 | intl ^0.20.2 | Pinned by flutter_localizations, newer than minio_new requires |
| 7 | geolocator ^14.0.2 | Required by neshan_maps_flutter ^1.1.0 |
| 8 | Import paths: neshan_maps_flutter/map.dart + location_picker.dart | Package exports separate files, not a single barrel import |

### Remaining Tasks (Production Deployment)

- [x] Neshan map SDK integration ✅ (neshan_maps_flutter ^1.1.0)
- [x] STT/TTS provider integration ✅ (Avanegar + on-device dual backend)
- [x] Push notifications ✅ (Chabok replaces Firebase)
- [x] CDN/image upload ✅ (API server → Arvan Cloud)
- [x] GitHub Actions CI/CD ✅ (Android APK + iOS + analyze + tests)
- [x] Admin panel: External API keys CRUD ✅ (Redis-backed)
- [x] Android build.gradle.kts fix ✅ (kotlinOptions + remove evaluationDependsOn)
- [ ] iOS build configuration (needs Apple Developer account)
- [ ] App signing (release keystore)
- [ ] Sentry/Crashlytics integration
- [ ] Performance profiling on device
- [ ] Real device testing (APK build via GitHub Actions)

### Blockers (Resolved)

- ~~Neshan map SDK not available on pub.dev~~ → ✅ neshan_maps_flutter ^1.1.0 available
- ~~No STT/TTS providers configured~~ → ✅ Avanegar + on-device dual backend
- ~~No push notification service~~ → ✅ Chabok replaces Firebase
- ~~No CDN/image upload~~ → ✅ Upload service via API → Arvan Cloud
- ~~Android build.gradle.kts Kotlin DSL fails in CI~~ → ✅ kotlinOptions + remove evaluationDependsOn
- ~~No CI/CD pipeline~~ → ✅ GitHub Actions workflow pushed

### Remaining Blockers

- iOS build configuration needed (Apple Developer account)
- No real device testing yet (GitHub Actions will produce APK)
- Need to configure GitHub Secrets (NESHAN_MAP_KEY, CHABOK_APP_ID, etc.)

### Phase 10d — CI/CD + Admin Panel

| # | Task | Status | Details |
|---|---|---|---|
| 1 | GitHub Actions workflow | ✅ | Backend build, Flutter analyze, Android APK, iOS IPA, Flutter tests |
| 2 | Admin external API keys | ✅ | CRUD endpoints (Redis-backed), client masked endpoint |
| 3 | Upload endpoint | ✅ | POST/DELETE /api/upload + file serving |
| 4 | build.gradle.kts fix | ✅ | kotlinOptions inside android {} + remove evaluationDependsOn |
| 5 | Workflow artifact paths | ✅ | apps/mobile/build/... (consistent) |
| 6 | Assets .gitkeep | ✅ | images/ + animations/ with .gitkeep |
| 7 | New PAT with workflow scope | ✅ | Pushed successfully |

### Files Created (Phase 10d)

| File | Description |
|---|---|
| `.github/workflows/main.yml` | CI/CD pipeline |
| `apps/mobile/assets/images/.gitkeep` | Empty asset directory |
| `apps/mobile/assets/animations/.gitkeep` | Empty asset directory |

### API Endpoints Added (Phase 10d)

| Method | Path | Description |
|---|---|---|
| GET | /api/admin/external-keys | List all external API keys |
| GET | /api/admin/external-keys/:service | Get a single key |
| PUT | /api/admin/external-keys/:service | Create/update a key |
| DELETE | /api/admin/external-keys/:service | Delete a key |
| GET | /api/client/external-keys | Client keys (masked) |
| POST | /api/upload | Upload file (multipart) |
| GET | /uploads/:filename | Serve uploaded file |
| DELETE | /api/upload | Delete uploaded file |

---

## Overall Progress

| Phase | Status | Start | End |
|---|---|---|---|
| 0 — Architectural Decisions | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 1 — Infrastructure + Micro-kernel | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 2 — Hearing Space | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 3 — Voice Loop + On-Device | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 4 — Tagging | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 5 — Three Modes + Professional | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 6 — Tiered Waves | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 7 — Number Read-back | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 8 — Learning | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 9 — Professional Subscription | ✅ Complete | 2026-08-02 | 2026-08-02 |
| 10 — Flutter MVP | 🔄 In Progress (10a+10b+10c+10d) | 2026-08-02 | — |

**Total estimated duration:** ~12.5 weeks
**Elapsed:** Phase 0–5
