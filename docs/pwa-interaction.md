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
- right: a current-surface reset/new-surface action. Its final icon and exact semantics still require product validation.

`Clear Surface（清理当前工作面）`, `New Context（新短期上下文）`, and clearing history/memory are different operations and must not be collapsed into one destructive action.

### Current Work Surface（当前工作面）

The Current Work Surface prioritizes the current interaction state rather than a chronological message list.

It may contain:

- Latest User Input（最新用户输入）;
- Current ALOHA Output（当前 ALOHA 输出）;
- Tool / Capability execution state;
- future structured surfaces, cards, charts and Facet content;
- Annotation Layer（标注层） for selecting, circling or commenting on current content.

Historical turns are not permanently stacked on the main screen.

### Result-state input source

After ALOHA completes a result, the surface should prioritize the result rather than leaving the full user input permanently expanded.

The product may expose a **Result Input Source（结果态输入来源）** presentation setting. This setting changes presentation only; the original input remains in Context / Trace / History.

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

## Pending Submission Area（待提交区）

Pending Submission Area is a separate staging area above Composer.

Rules:

1. it is hidden when no pending resource exists;
2. images, files and future structured references live here, never inside the text editor;
3. multiple images and mixed resource types are allowed;
4. a resource can be tapped to preview;
5. every resource has an explicit remove action (`×`);
6. deleting the final resource hides the area;
7. text draft and pending resources are combined only when creating one Submission（提交） snapshot.

## Voice input modes

ALOHA intentionally has two voice interaction paths.

### Compact long-press voice（Mobile / Tablet only）

The user keeps a finger pressed on the capsule, so transcription must not be hidden under that finger.

- transcription is shown in a top-layer Voice Transcript Overlay（语音转写浮层） above the Composer;
- release with recognized text: send immediately;
- release without recognized text: do not send;
- swipe upward with recognized text: stop voice, open Expanded Composer, put recognized text in the editor, place the caret after the final character and open the system keyboard;
- swipe upward without recognized text: return to the capsule without opening an empty editor;
- existing pending resources remain independent and are included only if an actual submission occurs.

### Expanded dictation（all devices）

Tapping the microphone starts continuous real-time speech-to-text without requiring the user to keep pressing.

- recognized text is written directly into the text editor in real time at the active insertion point;
- microphone changes to Stop;
- Send is disabled while dictation is active;
- tapping Stop ends recognition, keeps all recognized text and returns to normal Expanded Composer;
- stopping dictation never auto-sends;
- pending resources remain unchanged.

## Annotation direction

Future circling/drawing/selection should use an independent Annotation Layer rather than mutating source content.

Annotations should become structured Interaction Events（交互事件） that can be fed back to the Agent, preferably through Facet-compatible Surface / Annotation / Event contracts.

## Development source of truth

The executable Composer behavior, guards, invariants, transitions and test cases are defined in:

- [`docs/composer-state-machine.md`](./composer-state-machine.md)

That file is the implementation/test specification. This file stays at the product-interaction level.

## Product decisions still open

These items are intentionally not treated as implementation facts yet:

1. whether a new draft can be prepared while the previous ALOHA request is still Working;
2. whether Send is disabled while any resource is still uploading, or whether Send may queue until uploads finish;
3. whether `+` remains interactive during Expanded dictation;
4. whether closing the Mobile system keyboard automatically collapses Expanded Composer back to the capsule;
5. whether Compact long-press voice needs an independent Cancel gesture beyond release/send and swipe-up/edit;
6. final gesture thresholds, haptic feedback and animation details;
7. detailed Header iconography and current-surface reset semantics.
