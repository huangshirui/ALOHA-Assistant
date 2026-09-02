# PWA interaction baseline

> Status: **normative product target for the ALOHA MVP**. This document defines intended product behavior. A behavior is not considered implemented or verified until the corresponding code and automated tests exist.

## Purpose

The ALOHA PWA is the primary personal interaction surface. It should feel like a current working surface with an assistant, not a traditional chat transcript.

The core interaction principle is **State-first, History-backed（状态优先、历史托底）**:

- the main screen emphasizes the current task, latest input and latest ALOHA output;
- historical Context / Trace（上下文 / 轨迹） remains available but does not continuously stack in the main surface;
- hiding information from the current surface never implies deleting history, context or memory.

## Main screen

```text
+-----------------------------+
| Header                      |
+-----------------------------+
|                             |
| Current Work Surface        |
| 当前工作面                   |
|                             |
+-----------------------------+
| Pending Submission Area     |  shown only when resources exist
+-----------------------------+
| Composer / Input Area       |
+-----------------------------+
```

### Header

The Header stays visually quiet and does not compete with the Current Work Surface.

- left: More / navigation entry;
- center: `ALOHA` by default; may later show a lightweight Context Title（上下文标题） when a task has a meaningful stable title;
- right: **New Context（新上下文）**.

`New Context` opens a new Conversation / Context（新会话 / 新上下文） with a clean Current Work Surface. It does **not** delete History（历史） or Memory（记忆）.

`Clear Surface（仅清理当前显示）`, `New Context（新上下文）`, Stop（停止当前 Run）, and clearing History / Memory are different operations. For the MVP, only `New Context` is promoted to the Header primary action; a standalone Clear Surface action is not required as a first-class control.

#### New Context lifecycle

- if the current conversation has a Working Run, `New Context` does **not** Stop it; the old Run continues in the background and its later output belongs to the old conversation / History;
- if there is no unsent draft, `New Context` opens the new conversation immediately;
- if unsent text or pending resources exist, the user must confirm discarding that draft before a new conversation is created;
- cancelling that confirmation keeps the current conversation and draft unchanged;
- navigating to History, Settings or other non-destructive screens does not discard the current draft.

The final iconography remains a visual-design detail, but the action semantics are fixed.

### Current Work Surface（当前工作面）

The Current Work Surface prioritizes the current interaction state rather than a chronological message list.

It may contain:

- Latest User Input（最新用户输入）;
- Current ALOHA Output（当前 ALOHA 输出）;
- Tool / Capability execution state;
- future structured surfaces, cards, charts and Facet content;
- Annotation Layer（标注层） for selecting, circling or commenting on current content.

Historical turns are not permanently stacked on the main screen.

### Working and progressive result

After a Submission is accepted, the Surface uses a **process state -> progressive result** model:

- show meaningful current execution state while ALOHA / Tool / Capability work is in progress;
- progressively render result content as usable output becomes available instead of waiting for the entire run to finish;
- do not expose private chain-of-thought or internal reasoning traces;
- the user may continue preparing a new Composer draft while the current run is Working;
- the user may explicitly Stop the current run;
- sending a new Submission **inside the same current conversation** while a run is Working is an interrupting action: the accepted new Submission supersedes the current run and starts the new instruction rather than queueing behind it.

This is intentionally different from `New Context`: a same-conversation Submission can interrupt the active Run, while `New Context` leaves the old conversation's Run running in the background.

#### Interrupt ordering

A new interrupting Submission does **not** cancel the current run optimistically.

1. the existing run continues while the new Submission is being admitted;
2. only after the new Submission is accepted does the runtime mark the old run as superseded and request best-effort cancellation;
3. if the new Submission is rejected / not accepted, the old run continues normally;
4. after supersession, any late result from the old run must never overwrite the new Current Work Surface. It may be retained in History / Trace（历史 / 轨迹） with a superseded marker.

This avoids losing both runs when the new request fails.

#### Stop / superseded presentation

Already-rendered progressive output remains visible after a run is stopped or superseded; it is not erased as if the work never happened.

- explicit user Stop -> mark the run/output as **Stopped（已停止）**;
- accepted new instruction supersedes old run -> mark old run/output as **Superseded（已被新指令中断）**;
- no further stream updates from that run may update the active Current Work Surface after the terminal marker;
- external side effects already committed remain facts and are never presented as automatically rolled back.

Stop/interruption is best-effort for work that can still be cancelled. An operation already committed to an external system cannot be treated as automatically rolled back.

### Result-state input source

After ALOHA completes a result, the surface prioritizes the result rather than leaving the full user input permanently expanded.

**Result Input Source（结果态输入来源） defaults to ON.** The default presentation is a lightweight collapsed source summary, for example the submitted text excerpt and/or resource count. The user may expand it when source context is useful.

A Settings toggle may disable this presentation entirely. This changes presentation only; the original input remains in Context / Trace / History and is not forgotten or deleted.

## History（历史）

History is intentionally allowed to use a conventional interaction model even though the main screen is State-first.

- entry: `More -> History`;
- top level: a conventional Conversation List（会话列表）;
- opening a historical conversation shows its chronological Message Flow（消息流）, including user submissions, ALOHA outputs and relevant terminal markers such as Stopped / Superseded;
- history is for recall, inspection and search; it does not turn the main Current Work Surface back into a message stream;
- **the MVP does not support starting / branching a new conversation from a historical message or historical conversation**;
- historical conversations are read-only interaction records from the product perspective.

A future version may add explicit historical Reference（引用） semantics, but that is intentionally deferred rather than approximated with rollback or in-place branching.

## Composer cross-device model

The Composer uses **one shared interaction model** across Desktop, Mobile and Tablet.

The device difference is intentionally small:

- **Mobile / Tablet**: idle input uses a Compact Capsule（胶囊态）.
- **Desktop**: there is no Compact Capsule; it starts directly in Expanded Composer（展开态）.
- once Mobile / Tablet enters Expanded Composer, its behavior is the same as Desktop.

This means there is one Composer state machine, not separate Mobile and Desktop implementations.

### Compact Capsule（Mobile / Tablet only）

The idle capsule has a stable visual skeleton:

- left circular button: Camera（拍照）;
- center: tap to enter Expanded Composer; long-press to start real-time speech-to-text;
- right circular button: `+` resource entry.

Long-press voice behavior is defined in [`composer-state-machine.md`](./composer-state-machine.md).

### Expanded Composer（all devices）

Expanded Composer contains a **text-only editor** in the middle.

Images, files and other resources never render inside the text editor.

The expanded state supports:

- keyboard text editing;
- resource attachment through `+`;
- real-time speech-to-text by tapping the microphone;
- explicit Send;
- resource-only, text-only and mixed submissions.

Keyboard submission semantics:

- Desktop: `Enter` sends when `canSend` is true; `Shift + Enter` inserts a newline;
- Mobile / Tablet system-keyboard Enter inserts a newline; explicit Send remains the submission action.

During Expanded dictation, the `+` resource entry is disabled. The user stops dictation before opening a resource picker.

### Mobile collapse policy

When the Mobile / Tablet system keyboard closes or Expanded Composer loses editing focus:

- no text and no pending resources -> collapse to Compact Capsule;
- text draft exists -> remain Expanded;
- no text but pending resources exist -> collapse to Compact while keeping Pending Submission Area and all resources.

### Draft persistence

An unsent Draft（草稿） should survive ordinary PWA lifecycle interruptions.

- persist `textDraft` locally;
- persist references/metadata for pending resources that have successfully reached Ready state;
- refresh, normal navigation away/back, or OS/browser PWA process reclamation restores the recoverable draft;
- transient Uploading resources must never be restored as falsely Ready; after recovery they require a valid Ready reference or explicit retry/reselection;
- successful Submission clears the consumed draft;
- explicit user deletion clears the deleted content/resource;
- confirmed `New Context` with an unsent draft clears that draft as part of the confirmed discard action.

## Pending Submission Area（待提交区）

Pending Submission Area is a separate staging area above Composer.

Rules:

1. it is hidden when no pending resource exists;
2. images, files and future structured references live here, never inside the text editor;
3. multiple images and mixed resource types are allowed;
4. a resource can be tapped to preview;
5. every resource has an explicit remove action (`×`);
6. deleting the final resource hides the area;
7. text draft and pending resources are combined only when creating one Submission（提交） snapshot;
8. if any selected resource is still Uploading, Send is disabled; Send becomes eligible only after all resources required by the Submission are Ready.

### MVP resource boundary

The first MVP intentionally keeps resource handling narrow:

- images: common web/mobile image formats;
- files: PDF, plain-text and Markdown documents;
- Office documents and broader file families are deferred;
- maximum resources per Submission: **10**;
- maximum size per resource: **20 MB**;
- image upload must not destructively replace the user's original with an aggressively compressed version merely for transport convenience;
- the UI may generate a separate lightweight thumbnail/preview derivative for Pending Submission Area;
- later processing pipelines may derive optimized representations without changing the original resource identity.

## Voice input modes

ALOHA intentionally has two voice interaction paths.

### Compact long-press voice（Mobile / Tablet only）

The user keeps a finger pressed on the capsule, so transcription must not be hidden under that finger.

- transcription is shown in a top-layer Voice Transcript Overlay（语音转写浮层） above the Composer;
- release with recognized text: send immediately;
- release without recognized text: do not send;
- swipe upward with recognized text: stop voice, open Expanded Composer, put recognized text in the editor, place the caret after the final character and open the system keyboard;
- swipe upward without recognized text: return to the capsule without opening an empty editor;
- existing pending resources remain independent and are included only if an actual submission occurs;
- no independent Cancel gesture is required for MVP: swipe-up enters editable text and the user may delete it there.

#### Initial gesture parameters

Gesture thresholds are tunable UX parameters rather than protocol constants. The MVP starts with:

- long-press activation: approximately **400 ms**;
- swipe-up edit threshold: approximately **60 px** vertical displacement;
- one light Haptic（触觉反馈） when voice capture successfully activates;
- one light Haptic when the swipe-up edit transition is successfully committed.

These values may be tuned after real-device testing without changing the semantic state machine.

### Expanded dictation（all devices）

Tapping the microphone starts continuous real-time speech-to-text without requiring the user to keep pressing.

- recognized text is written directly into the text editor in real time at the active insertion point;
- microphone changes to Stop;
- Send and `+` are disabled while dictation is active;
- tapping Stop ends recognition, keeps all recognized text and returns to normal Expanded Composer;
- stopping dictation never auto-sends;
- pending resources remain unchanged.

### First microphone permission

If microphone permission has not yet been granted, the first attempted voice action is used only to request browser / OS permission.

- do not pretend recording started while the permission prompt is open;
- after permission is granted, return to the stable pre-voice state and give a clear cue that microphone access is ready;
- the user explicitly triggers voice input again to start STT; do not automatically resume the original long-press/tap after the system permission dialog closes.

## Annotation direction

Future circling/drawing/selection should use an independent Annotation Layer rather than mutating source content.

Annotations should become structured Interaction Events（交互事件） that can be fed back to the Agent, preferably through Facet-compatible Surface / Annotation / Event contracts.

## Development source of truth

The executable Composer behavior, guards, invariants, transitions and test cases are defined in:

- [`docs/composer-state-machine.md`](./composer-state-machine.md)

That file is the implementation/test specification. This file stays at the product-interaction level.

## Product decisions still open

The main PWA interaction, Composer behavior and conversation lifecycle are now functionally specified. Remaining open items are primarily presentation/tuning details:

1. detailed visual iconography for New Context, Stop, Stopped and Superseded;
2. detailed wording and visual treatment of process states and progressive-result transitions;
3. resource preview UI details and exact MIME/extension allow-list within the already-fixed MVP resource families;
4. visual layout, animation and real-device tuning for Header, Surface, Composer and voice gestures;
5. later Annotation（标注） interaction details and Facet integration;
6. future historical-reference / branch-from-history semantics, intentionally out of MVP.
