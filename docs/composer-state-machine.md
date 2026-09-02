# Composer state machine and test baseline

> Status: **Development Ready（可开发） product specification**. This file defines the intended Composer behavior and the baseline for implementation tests. It does not claim that the behavior is already implemented or verified.

## Why this is a state machine

The Composer has a small number of interaction states. Text content, resources and upload metadata are **context data**, not separate states. Keeping these separate prevents combinatorial state explosion.

## State tree

```text
Composer
├── Compact                         # Mobile / Tablet only
│   ├── Idle
│   └── VoiceCapturing
│
├── Expanded                        # Desktop + Mobile + Tablet
│   ├── Ready
│   └── Dictating
│
└── Submitting
```

Initial state:

- Mobile / Tablet -> `Compact.Idle`
- Desktop -> `Expanded.Ready`

`AI Working / Result` belongs to the Current Work Surface / interaction lifecycle, not to the Composer state machine. The two state machines coordinate through Submission events and product policy.

## State context

A minimal implementation context should be able to represent:

```ts
type ComposerContext = {
  platform: 'mobile' | 'tablet' | 'desktop'
  textDraft: string
  pendingResources: PendingResource[]
  voiceTranscriptBuffer: string
  submissionSnapshot: SubmissionPayload | null
  caretPosition?: number
}
```

Resource transport/upload state belongs to each `PendingResource`; it should not create a separate Composer state.

## Derived guards

The UI and transitions should derive behavior from explicit guards rather than ad-hoc button logic.

```text
hasValidText     = trim(textDraft).length > 0
hasResources     = pendingResources.length > 0
hasVoiceText     = trim(voiceTranscriptBuffer).length > 0
isVoiceActive    = state is Compact.VoiceCapturing or Expanded.Dictating
canSend          = state is Expanded.Ready
                   and (hasValidText or hasResources)
                   and resource-upload policy allows submission
```

`resource-upload policy allows submission` is currently a Product TBD. A half-uploaded resource must never be silently included as if it were ready.

## Invariants（不变量）

These rules must hold in every implementation:

1. **Text/resource separation**: Composer editor stores text only; images/files/resources exist only in Pending Submission Area.
2. **Pending area on demand**: no resources -> hidden; resources exist -> visible; deleting the final resource -> hidden.
3. **One immutable submission snapshot**: a Submission is created from the current text draft + all current pending resources. Once submission begins, that payload is isolated from later edits.
4. **Resource-only submission is valid**: empty text + at least one ready resource may be sent.
5. **Empty submission is invalid**: empty/whitespace-only text + no resources must never create a request.
6. **Expanded dictation never auto-sends**: Stop ends speech recognition and preserves the draft only.
7. **Send is disabled during Expanded dictation**.
8. **Compact release semantics are fixed**: release with recognized text sends; release without recognized text does not send.
9. **Compact swipe-up semantics are fixed**: swipe up with recognized text opens Expanded editing; without recognized text it returns to Compact.
10. **Voice operations do not mutate pending resources** unless an actual successful Submission consumes them or the user explicitly deletes them.
11. **Duplicate submit prevention**: one user send action may create at most one logical Submission.
12. **Failure is lossless**: if submission is not accepted, text and resources must be recoverable together.

## Events and transitions

### Compact.Idle（Mobile / Tablet only）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `TAP_CENTER` | - | `Expanded.Ready` | focus editor; open system keyboard |
| `LONG_PRESS_CENTER` | microphone permission available | `Compact.VoiceCapturing` | start STT; clear voice buffer; show transcript overlay |
| `LONG_PRESS_CENTER` | microphone permission denied | remain | show permission/error feedback; preserve resources |
| `CAMERA_ADD_SUCCESS` | - | remain | add resource to pending area |
| `RESOURCE_ADD_SUCCESS` | - | remain | add resource to pending area |

### Compact.VoiceCapturing（Mobile / Tablet only）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `STT_UPDATE` | - | remain | update `voiceTranscriptBuffer`; render overlay |
| `RELEASE` | `hasVoiceText` | `Submitting` | build Submission from voice text + pending resources |
| `RELEASE` | no voice text | `Compact.Idle` | stop STT; close overlay; do not submit; preserve resources |
| `SWIPE_UP` | `hasVoiceText` | `Expanded.Ready` | stop STT; move voice text into editor; caret at end; focus editor; open keyboard |
| `SWIPE_UP` | no voice text | `Compact.Idle` | stop STT; close overlay; do not open keyboard |
| `STT_ERROR` | - | `Compact.Idle` | do not auto-send partial text; preserve resources; show error |

An independent Cancel gesture remains Product TBD and is not part of the current transition contract.

### Expanded.Ready（all devices）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `TEXT_CHANGE` | - | remain | update text draft |
| `RESOURCE_ADD_SUCCESS` | - | remain | add resource; show pending area |
| `RESOURCE_REMOVE` | - | remain | remove resource; hide area if empty |
| `TAP_RESOURCE` | - | remain | preview resource |
| `TAP_MIC` | microphone permission available | `Expanded.Dictating` | start STT at current insertion point; Mic -> Stop; disable Send |
| `TAP_MIC` | microphone permission denied | remain | preserve text/resources; show permission/error feedback |
| `TAP_SEND` | `canSend` | `Submitting` | create immutable submission snapshot |
| `TAP_SEND` | not `canSend` | remain | no request |

### Expanded.Dictating（all devices）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `STT_UPDATE` | - | remain | write recognized text directly into editor at active insertion point; update caret |
| `TAP_STOP` | - | `Expanded.Ready` | stop STT; preserve text/resources; Stop -> Mic; recalculate Send |
| `STT_ERROR` | - | `Expanded.Ready` | preserve all already written text/resources; Stop -> Mic; show error; recalculate Send |

During this state, Send is always disabled. Whether `+` remains interactive is a Product TBD.

### Submitting

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `SUBMISSION_ACCEPTED` | Mobile/Tablet | `Compact.Idle` | clear consumed draft/resources; hand snapshot to Surface/Interaction Working |
| `SUBMISSION_ACCEPTED` | Desktop | `Expanded.Ready` | clear consumed draft/resources; hand snapshot to Surface/Interaction Working |
| `SUBMISSION_REJECTED` | originated from Expanded | `Expanded.Ready` | restore full snapshot text + resources; show failure/retry |
| `SUBMISSION_REJECTED` | originated from Compact voice | `Expanded.Ready` | recover recognized text + resources into editable form; show failure/retry |

While `Submitting`, repeated Send/release events must not create another logical Submission.

## Surface / Composer coordination

The Composer state and the Current Work Surface lifecycle are separate:

```text
Composer.Submitting
       |
       | SUBMISSION_ACCEPTED(payload)
       v
Surface.Working -> Surface.Result
```

The unresolved policy is whether Composer becomes immediately available for the **next** draft while `Surface.Working` is still active. This policy must not be encoded implicitly inside UI components.

## Formal test cases

`Scope = Common` means Desktop + Mobile + Tablet expanded behavior. `Mobile/Tablet only` covers the Compact entry path.

### CMP — Composer basics

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| CMP-001 | Mobile/Tablet only | no text/resources | open interaction | Compact capsule is shown; left Camera, center trigger, right `+`; pending area hidden |
| CMP-002 | Desktop only | no text/resources | open interaction | Expanded Composer is shown directly; empty editor; pending area hidden; Send disabled |
| CMP-003 | Mobile/Tablet only | Compact idle | tap center | enters Expanded.Ready; editor focused; system keyboard opens |
| CMP-004 | Common | Expanded empty | type valid text | text remains in editor; Send becomes enabled |
| CMP-005 | Common | Expanded empty | type whitespace only | Send remains disabled |
| CMP-006 | Common | existing draft | move caret/edit text | draft updates without changing pending resources |

### RES — Pending resources

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| RES-001 | Mobile/Tablet only | Compact idle | capture photo successfully | photo enters Pending Submission Area; editor is not created merely to display the photo |
| RES-002 | Common | Expanded | add image via resource entry | image appears only in pending area; text editor unchanged |
| RES-003 | Common | one image pending | add second image | both resources remain available |
| RES-004 | Common | image pending | add file | mixed resource types coexist |
| RES-005 | Common | resource pending | tap resource | opens preview without moving resource into editor |
| RES-006 | Common | multiple resources | remove one | only selected resource is removed |
| RES-007 | Common | one resource | remove it | pending area disappears |
| RES-008 | Common | text draft exists | add/remove resources | text draft and caret content are preserved |
| RES-009 | Common | no text; at least one ready resource | observe Send | Send is enabled for resource-only Submission |
| RES-010 | Mobile/Tablet only | Compact + pending resources | tap center | Expanded editor opens; all pending resources remain above it |

### VCP — Compact long-press voice

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| VCP-001 | Mobile/Tablet only | Compact idle | long-press center | enters VoiceCapturing and starts STT |
| VCP-002 | Mobile/Tablet only | VoiceCapturing | speech recognized | live text appears in Voice Transcript Overlay above Composer, not under the finger |
| VCP-003 | Mobile/Tablet only | resources already pending | start/continue voice | resources remain unchanged in pending area |
| VCP-004 | Mobile/Tablet only | recognized text; no resources | release | immediately creates text Submission |
| VCP-005 | Mobile/Tablet only | recognized text + pending resources | release | one Submission contains recognized text + all pending resources |
| VCP-006 | Mobile/Tablet only | no recognized text; no resources | release | no Submission; returns to Compact idle |
| VCP-007 | Mobile/Tablet only | no recognized text; resources pending | release | no Submission; returns to Compact; resources remain pending |
| VCP-008 | Mobile/Tablet only | recognized text | swipe up | enters Expanded.Ready; recognized text in editor; caret after final character; keyboard opens |
| VCP-009 | Mobile/Tablet only | no recognized text | swipe up | returns to Compact; no empty editor; keyboard stays closed |
| VCP-010 | Mobile/Tablet only | recognized text + resources | swipe up | enters Expanded with text while all resources remain pending and separate |

### VCX — Expanded dictation

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| VCX-001 | Common | Expanded.Ready | tap Mic | enters Expanded.Dictating; STT starts |
| VCX-002 | Common | Dictating | observe controls | Mic is replaced by Stop; Send is disabled |
| VCX-003 | Common | Dictating | STT emits recognized text | text is written directly into editor in real time |
| VCX-004 | Common | existing text + caret position | start dictation and speak | recognized text is inserted from the active insertion point; existing text is preserved |
| VCX-005 | Common | resources pending | dictate | resources remain unchanged and outside editor |
| VCX-006 | Common | Dictating with text | tap Stop | STT ends; text remains; returns to Expanded.Ready; no auto-send |
| VCX-007 | Common | Stop after valid text | observe Send | Send becomes enabled according to current text/resources |
| VCX-008 | Common | Stop with no text/resources | observe Send | Send is disabled |
| VCX-009 | Common | one dictation session stopped | tap Mic again | a new dictation session may start without clearing draft/resources |
| VCX-010 | Common | Expanded dictation | observe transcription UI | no Compact Voice Transcript Overlay is required; editor itself is live transcription surface |

### SUB — Submission

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| SUB-001 | Common | valid text only | tap Send | creates one text-only Submission |
| SUB-002 | Common | no text; resources exist | tap Send | creates one resource-only Submission |
| SUB-003 | Common | text + mixed resources | tap Send | creates one Submission containing current text + all current resources |
| SUB-004 | Common | empty/whitespace text; no resources | attempt Send | Send disabled; no request |
| SUB-005 | Common | sendable state | rapidly tap Send repeatedly | at most one logical Submission is created |
| SUB-006 | Common | send accepted | transition | payload is frozen as snapshot; consumed draft/resources are removed from Composer; Surface enters Working |
| SUB-007 | Common | normal Send request rejected/not accepted | receive failure | full text + resource snapshot is restored together; retry is possible |
| SUB-008 | Mobile/Tablet only | Compact release-send rejected/not accepted | receive failure | recognized text and resources are recoverable; failure never silently discards input |

### ERR — Failure paths

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| ERR-001 | Mobile/Tablet only | microphone permission unavailable | long-press center | no fake recording state; clear feedback; return/remain Compact; resources preserved |
| ERR-002 | Common | microphone permission unavailable | tap Mic | remains Expanded.Ready; text/resources preserved; Send remains correct |
| ERR-003 | Mobile/Tablet only | Compact VoiceCapturing | STT fails | no partial auto-send; return to stable Compact; resources preserved; show error |
| ERR-004 | Common | Expanded.Dictating | STT fails | stop dictation; already written text/resources preserved; return Ready; Send recalculated |
| ERR-005 | Common | add/upload resource | operation fails | failed resource is not presented as ready; existing text and successful resources are preserved |
| ERR-006 | Common | Submission transport/service fails before acceptance | receive failure | same lossless recovery rule as SUB-007; no partial restore |

### WRK — Surface Working coordination

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| WRK-001 | Common | Submission accepted | Surface enters Working | submitted payload is no longer an editable Composer draft; it is owned by the interaction/Surface lifecycle; whether a new next-turn draft may start concurrently remains Product TBD |

### RST — Result completion

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| RST-001 | Mobile/Tablet only | Surface completes result and no next-turn draft exists | settle interaction | Composer is available from Compact idle; prior submitted draft/resources do not reappear |
| RST-002 | Desktop only | Surface completes result and no next-turn draft exists | settle interaction | Composer is available as empty Expanded.Ready; prior submitted draft/resources do not reappear |

Total formal baseline: **53 test cases**.

## Product TBDs that must not be decided implicitly in code

The state machine is Development Ready, but these policies remain open:

1. **Working concurrency**: can the user prepare the next draft while the current Surface is still Working?
2. **Uploading resource + Send**: disable Send until every resource is ready, or allow Send to wait/queue for uploads?
3. **Expanded dictation + `+`**: can resources be added while live dictation is active?
4. **Mobile keyboard close / blur**: does Expanded automatically collapse to Compact?
5. **Compact voice Cancel**: is a separate cancel gesture required; if so, what direction/threshold?
6. **Gesture/haptic parameters**: long-press duration, swipe threshold, vibration and animation details.

### Development readiness

- **Now**: Development Ready（可正式开发） — states, context, guards, invariants, transitions, success/failure semantics and test IDs are explicit.
- **After TBD 1–3**: Feature Spec Complete（功能规格完整） — all functional policies required for feature completion are fixed.
- **After TBD 4–6 and hands-on tuning**: Interaction Frozen（交互冻结） — interaction details are stable enough for final UX regression baselines.
