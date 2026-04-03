# Weekly Game Mode - Feasibility Analysis

## Idea

Organizer creates a game that stays **live for 1 week**. Users can come anytime during the week, play, and claim wins. But **results are announced to everyone together on Sunday** (weekend).

---

## Current System vs Proposed System

| Aspect | Current (Live Event) | Proposed (Week-long) |
|---|---|---|
| Duration | 30 min - 2 hours | 7 days |
| Number calling | Organizer real-time manual | Pre-generated / auto |
| Players | Everyone plays together | Anyone, anytime |
| Results | Instant claim (first come first serve) | Sunday batch announcement |
| Feel | Live housie/kitty party | Lottery-style async game |

---

## Challenges

### 1. Number Calling - Who calls?

Currently the organizer manually calls numbers one-by-one in real-time. For a week-long game:

**Options:**
- **Option A**: Pre-generate all 90 numbers in a fixed random order, store encrypted
- **Option B**: Auto-call — every X minutes a new number is automatically called
- **Option C**: Player-paced — each player reveals numbers at their own speed

**Risk**: If all players see the same numbers in the same order, early players can leak the sequence to others, giving late joiners an unfair advantage.

### 2. Win Claiming - Instant vs Delayed

**Current flow**: Player marks 5 numbers → instantly clicks "claim win" → first come first serve.

**Proposed flow challenges**:
- If players **claim instantly during the week** → whoever plays first wins → unfair to late joiners
- If results are **calculated on Sunday** → multiple players can complete the same category → **how to split prize?**
- For **Early 5**: Player A completes it at the 20th called number, Player B at the 35th → winner should be Player A (fewer numbers needed). This requires tracking *when* (at which call number) each player completed each category.

**Proposed resolution**: Winner = the player who completed the pattern in the **fewest called numbers** (by call sequence order, not by time).

### 3. Fairness & Information Leakage

- Player A plays on Monday, sees 40 called numbers
- Player A tells friend Player B which numbers were called
- Player B joins later with foreknowledge of called numbers

**Mitigation options**:
- Player-paced reveals (each player gets their own reveal sequence — but then fairness of "fewest calls" breaks)
- Time-locked reveals (numbers only revealed at scheduled intervals)
- Encrypt/hide future numbers server-side

### 4. Ticket Uniqueness at Scale

- Current: 50-100 players per game → unique tickets easily generated
- Week-long: Potentially thousands of players → increased collision risk
- Math: 15 numbers from 90 → ~30 billion combinations → mathematically fine, but generation algorithm must be efficient at scale

### 5. Redis / State Management

- Current: Game state cached in Redis with **2-hour TTL**
- Week-long: Redis TTL needs to be **7+ days** or state must be served directly from PostgreSQL
- Redis memory usage increases significantly with thousands of players
- Consider: Use PostgreSQL as primary state store for weekly mode, Redis only for active sessions

### 6. Batch Result Calculation (Sunday)

Algorithm needed:
```
For each prize category (Early 5, Top Line, Middle Line, Bottom Line, Full House):
  For each player:
    Simulate: at which call number (1st, 2nd, ..., 90th) did this player complete the category?
    Record: (playerId, completedAtCallNumber)
  Winner = player with lowest completedAtCallNumber
  If tie → split prize or random selection
```

This is a **batch compute job** that needs to:
- Process potentially thousands of players
- Run reliably on Sunday (cron job / scheduled task)
- Handle edge cases (ties, no winner for a category, etc.)

### 7. User Engagement & Retention

- Player plays on Monday → has to wait until Sunday for results
- No immediate feedback = **low dopamine hit** = users may lose interest
- 6 days of no interaction with the game

**Mitigation ideas**:
- Daily leaderboard: "You're in top 10 for Early 5!"
- Progress notifications: "3 more numbers needed for Top Line"
- Daily number reveals with push notifications
- Mini-rewards for daily check-ins
- Show how many players have joined so far

---

## Suggested Implementation Approach

### New Game Mode: `WEEKLY`

```
Game Modes:
- LIVE (existing) → real-time event, organizer calls numbers
- WEEKLY (new) → async week-long game, auto number calling
```

### Flow

```
1. CREATE WEEKLY GAME
   - Organizer sets: start date, end date (Sunday), prize pool
   - Backend pre-generates random sequence of 1-90 numbers
   - Sequence stored encrypted in DB
   - Game status: SCHEDULED → ACTIVE → RESULT_PENDING → COMPLETED

2. ACTIVE PHASE (Mon-Sat)
   - Numbers revealed on schedule (e.g., every 2 hours = ~12/day = 84 in 7 days)
   - OR all numbers available, player reveals at own pace
   - Player joins anytime → gets unique ticket
   - Player marks numbers, system tracks completion internally
   - NO instant win claims
   - Show progress: "You've marked 8/15 numbers"

3. RESULT CALCULATION (Sunday)
   - Cron job / scheduled task triggers
   - For each category, find player who completed in fewest calls
   - Handle ties (split or random)
   - Store results in DB

4. RESULT ANNOUNCEMENT (Sunday)
   - Push notification to all players
   - Results page shows all winners
   - Prize distribution triggered

5. PRIZE DISTRIBUTION
   - Same async queue system as current
   - Batch process all winners
```

### Architecture Changes Required

| Component | Change |
|---|---|
| Database | New `gameMode` field (`LIVE` / `WEEKLY`), `numberSequence` field, `completedAtCall` tracking per player |
| Backend API | New endpoints for weekly game CRUD, number reveal, progress check |
| WebSocket | Not needed for weekly mode (polling/REST sufficient) |
| Frontend | New weekly game UI, progress dashboard, results page |
| Scheduler | Cron job for auto number reveals + Sunday result computation |
| Notifications | Push notification service for daily updates + result announcement |

### New Database Models

```
WeeklyGame:
  - id, startDate, endDate, status, prizes
  - numberSequence: Int[] (pre-generated order of 1-90)
  - revealedUpTo: Int (how many numbers revealed so far)

WeeklyPlayer:
  - id, gameId, userId, ticket, joinedAt
  - markedNumbers: Int[]
  - categoryCompletions: JSON { EARLY_5: callNumber, TOP_LINE: callNumber, ... }

WeeklyResult:
  - id, gameId, category, winnerId, completedAtCall, prizeAmount
  - calculatedAt, distributedAt
```

---

## Honest Assessment

### Pros
- Players can play at their convenience (async, no need to be online at specific time)
- Longer engagement window (7 days vs 2 hours)
- Potentially larger player pool per game
- Builds anticipation for Sunday results

### Cons
- Loses the **core thrill** of live Tambola (real-time number calling, instant wins)
- Becomes more like a **lottery** than a game
- Engagement drop risk during the week
- More complex architecture (scheduler, batch processing, notifications)
- Fairness concerns with information leakage
- Result disputes harder to resolve

### Recommendation

The weekly mode is **feasible but fundamentally changes** what makes Tambola exciting. Consider a **hybrid approach**:

1. Keep the live mode as primary
2. Add a "Daily Tambola" mode (auto-call, results same day at 9 PM) as a stepping stone
3. If daily mode works, then extend to weekly

This reduces risk while testing the async game concept.

---

*Document created: March 2026*
*Status: Analysis Phase - Not yet approved for implementation*
