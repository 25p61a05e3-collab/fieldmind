# FieldMind design brief

## Initial directions considered

### 1. Instrument Panel Minimalism

A quiet, high-trust industrial console using warm paper, graphite ink, and a single signal orange. Probability: 0.06.

### 2. Night Shift Operations

A dark navy operations room with cyan telemetry accents and dense monitoring surfaces. Probability: 0.04.

### 3. Workshop Ledger

A tactile maintenance notebook language with ruled surfaces, steel blue tabs, and amber annotations. Probability: 0.03.

## Chosen direction: Instrument Panel Minimalism

FieldMind is a serious B2B tool for technicians, not a consumer chatbot. The visual system should feel like a well-maintained service instrument: calm, legible, and evidence-forward. The product should make the memory loop visible without turning it into a novelty animation.

### Design movement

Editorial industrial software: a field log meets a modern diagnostic console. Use generous paper-colored space, compact labels, and strong alignment so the technician can scan under time pressure.

### Core principles

1. **Evidence before theatrics:** every recalled memory carries a source, outcome, and relevance explanation.
2. **Actionable density:** forms and recommendations are compact, but never cramped.
3. **Honest status:** unavailable integrations use clear amber or red states and never become fake green success.
4. **Memory as a first-class surface:** Hindsight is a permanent right-rail presence, not a hidden tab.
5. **One workflow:** every control should help diagnose, resolve, or learn from recurring equipment issues.

### Color philosophy

- Background: warm mineral `#F4F1EA` rather than bright white.
- Ink: charcoal `#1F2523` for high-contrast text.
- Surface: `#FCFBF7` with thin stone borders.
- Brand signal: safety orange `#D76435` for active analysis, retain, and primary actions.
- Memory signal: deep teal `#1F6B69` for Hindsight recall and evidence.
- Caution: brass `#B7832F` for service degradation and warnings.
- Failure: dark rust `#A64736` for explicit errors.

### Layout paradigm

A three-part responsive workspace: a narrow left intake rail, a dominant central recommendation canvas, and a right evidence rail. On small screens, the rails stack beneath the recommendation; the memory panel remains visible immediately after the recommendation rather than disappearing into navigation.

### Signature elements

- Vertical orange incident marker beside the current case.
- Teal `Hindsight` pill and count badge for actual recalled evidence.
- Thin timeline spine showing Interaction 1 → 5 → 10 → 20 and the number of persisted interactions where available.
- Small monospace equipment IDs and timestamps for field-log authenticity.
- Expandable memory cards using a document icon and a one-line relevance statement.

### Interaction philosophy

Prefer direct manipulation and informative empty states over modal layers. The incident form shows the exact minimum required inputs. Submit buttons name the operation (`Analyze incident`, `Retain resolution`) and show disabled/loading states from actual request state. After analysis, the resolution form appears in context so the technician can close the loop without losing the evidence.

### Animation

Use only short, functional transitions: panel reveal, accordion expansion, and status badge color change. No looping spinners that imply progress without a request. While an API call is active, show a text status such as `Querying Hindsight…` or `Asking Groq to compare evidence…`.

### Typography system

- Display/wordmark: `Space Grotesk`, semibold, with restrained tracking.
- Body: `DM Sans`, regular/medium for approachable field readability.
- Metadata/equipment IDs: `IBM Plex Mono`, uppercase, small size.
- Use sentence case for actions and labels; reserve all caps for compact metadata labels.

### Brand essence and voice

FieldMind speaks like an experienced lead technician: concise, practical, and specific. It says what was found, why it matters, and what to do next. It never claims certainty when the evidence is absent and never exposes hidden chain-of-thought.

### Wordmark and logo

The wordmark is `fieldmind` in lowercase with a compact orange signal notch between “field” and “mind.” The icon is a square graphite field containing two offset orange/teal brackets around a small central dot—an abstract visual of a technician framing a recurring fault. The mark is flat, opaque, and legible at favicon scale.

### Signature brand color

Safety orange `#D76435` is the FieldMind signature. Deep teal `#1F6B69` is reserved for real Hindsight memory states, so memory is visually distinct from generic product chrome.
