# Composer state machine and test baseline

> Status: **Feature Spec Complete for the core Composer behavior**. This file defines intended Composer behavior and the implementation-test baseline. It does not claim the behavior is already implemented or verified.

## Model

The Composer has a small number of interaction states. Text, resources, upload metadata and permission state are Context（上下文数据）, not separate UI states. This prevents combinatorial state explosion.

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

`Surface.Working / Result` is a separate interaction lifecycle. Composer remains usable while Surface is Working.

## State context

```ts
type ComposerContext = {
  platform: 'mobile' | 'tablet' | 'desktop'
  textDraft: string
  pendingResources: PendingResource[]
  voiceTranscriptBuffer: string
  submissionSnapshot: SubmissionPayload | null
  caretPosition?: number
  microphonePermission: 'unknown' | 'granted' | 'denied'
}

type PendingResource = {
  id: string
  kind: 'image' | 'file' | string
  status: 'uploading' | 'ready' | 'failed'
}
```

Resource upload state is orthogonal to Composer state.

## Derived guards

```text
hasValidText       = trim(textDraft).length > 0
hasResources       = pendingResources.length > 0
hasVoiceText       = trim(voiceTranscriptBuffer).length > 0
allResourcesReady  = every pending resource has status=ready
isVoiceActive      = state is Compact.VoiceCapturing or Expanded.Dictating
canSend            = state is Expanded.Ready
                     and (hasValidText or hasResources)
                     and allResourcesReady
```

If any pending resource is Uploading, Send is disabled. Failed resources are never treated as Ready.

## Invariants（不变量）

1. **Text/resource separation**: Composer editor stores text only; images/files/resources exist only in Pending Submission Area.
2. **Pending area on demand**: no resources -> hidden; resources exist -> visible; deleting the final resource -> hidden.
3. **One immutable submission snapshot**: a Submission is created from the current text draft + all current pending resources. Once submission begins, that payload is isolated from later edits.
4. **Resource-only submission is valid**: empty text + at least one Ready resource may be sent.
5. **Empty submission is invalid**: empty/whitespace-only text + no resources never creates a request.
6. **Uploading blocks Send**: any Uploading resource disables Send.
7. **Expanded dictation never auto-sends**: Stop ends recognition and preserves draft only.
8. **Expanded dictation disables Send and `+`**.
9. **Compact release semantics are fixed**: release with recognized text sends; release without recognized text does not send.
10. **Compact swipe-up semantics are fixed**: swipe up with recognized text opens Expanded editing; without recognized text returns to Compact.
11. **No independent Compact Cancel gesture in MVP**: swipe-up converts recognition into editable text; the user may delete it there.
12. **Voice operations do not mutate pending resources** unless a successful Submission consumes them or the user explicitly deletes them.
13. **First permission request never auto-resumes voice**: after browser/OS permission resolves, the user must explicitly trigger voice again.
14. **Duplicate submit prevention**: one user send/release action creates at most one logical Submission.
15. **Failure is lossless**: if a Submission is not accepted, text and resources are recoverable together.
16. **Working does not lock Composer**: a next-turn draft may be prepared while Surface is Working.
17. **Accepted next-turn Submission interrupts current Working run**: it supersedes the current run rather than queueing behind it.
18. **Stop is best-effort, not rollback**: committed external side effects are not silently undone.

## Events and transitions

### Compact.Idle（Mobile / Tablet only）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `TAP_CENTER` | - | `Expanded.Ready` | focus editor; open keyboard |
| `LONG_PRESS_CENTER` | permission=granted | `Compact.VoiceCapturing` | start STT; clear voice buffer; show overlay |
| `LONG_PRESS_CENTER` | permission=unknown | remain | request permission; do not start STT |
| `LONG_PRESS_CENTER` | permission=denied | remain | show permission guidance; preserve resources |
| `CAMERA_ADD_SUCCESS` | - | remain | add resource |
| `RESOURCE_ADD_SUCCESS` | - | remain | add resource |

Permission resolution never continues the original gesture automatically. After grant, remain stable and require another long-press.

### Compact.VoiceCapturing（Mobile / Tablet only）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `STT_UPDATE` | - | remain | update `voiceTranscriptBuffer`; render overlay |
| `RELEASE` | `hasVoiceText` | `Submitting` | build Submission from voice text + pending resources |
| `RELEASE` | no voice text | `Compact.Idle` | stop STT; close overlay; preserve resources; no submit |
| `SWIPE_UP` | `hasVoiceText` | `Expanded.Ready` | stop STT; move text to editor; caret at end; focus; open keyboard |
| `SWIPE_UP` | no voice text | `Compact.Idle` | stop STT; close overlay; no keyboard |
| `STT_ERROR` | - | `Compact.Idle` | do not auto-send partial text; preserve resources; show error |

There is no independent Cancel gesture in the MVP transition contract.

### Expanded.Ready（all devices）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `TEXT_CHANGE` | - | remain | update draft |
| `RESOURCE_ADD_SUCCESS` | - | remain | add resource; show pending area |
| `RESOURCE_UPLOAD_UPDATE` | - | remain | update resource status; recompute `canSend` |
| `RESOURCE_REMOVE` | - | remain | remove resource; hide area if empty |
| `TAP_RESOURCE` | - | remain | preview resource |
| `TAP_MIC` | permission=granted | `Expanded.Dictating` | start STT at insertion point; Mic -> Stop; disable Send and `+` |
| `TAP_MIC` | permission=unknown | remain | request permission; do not start STT |
| `TAP_MIC` | permission=denied | remain | show permission guidance; preserve text/resources |
| `TAP_SEND` | `canSend` | `Submitting` | create immutable snapshot |
| `TAP_SEND` | not `canSend` | remain | no request |
| `EDITOR_BLUR` | Mobile/Tablet and no text and no resources | `Compact.Idle` | close keyboard |
| `EDITOR_BLUR` | Mobile/Tablet and text exists | remain | preserve Expanded draft |
| `EDITOR_BLUR` | Mobile/Tablet and no text and resources exist | `Compact.Idle` | close keyboard; keep resources/pending area |
| `EDITOR_BLUR` | Desktop | remain | no Compact state exists |

After first-time microphone permission is granted, the user explicitly taps Mic again to start dictation.

### Expanded.Dictating（all devices）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `STT_UPDATE` | - | remain | write recognized text directly at active insertion point; update caret |
| `TAP_STOP` | - | `Expanded.Ready` | stop STT; preserve text/resources; Stop -> Mic; recompute Send |
| `STT_ERROR` | - | `Expanded.Ready` | preserve written text/resources; Stop -> Mic; show error; recompute Send |
| `TAP_SEND` | - | remain | disabled; no request |
| `TAP_RESOURCE_ADD` | - | remain | disabled; no picker opens |

### Submitting

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `SUBMISSION_ACCEPTED` | Mobile/Tablet | `Compact.Idle` | clear consumed draft/resources; hand snapshot to Surface.Working; Composer becomes available for next draft |
| `SUBMISSION_ACCEPTED` | Desktop | `Expanded.Ready` | clear consumed draft/resources; hand snapshot to Surface.Working; Composer becomes available for next draft |
| `SUBMISSION_REJECTED` | originated from Expanded | `Expanded.Ready` | restore full snapshot; show failure/retry |
| `SUBMISSION_REJECTED` | originated from Compact voice | `Expanded.Ready` | recover voice text + resources into editable form; show failure/retry |

Repeated Send/release while `Submitting` must not create another logical Submission.

## Surface / Composer coordination

```text
Composer.Submitting
       |
       | SUBMISSION_ACCEPTED(payload)
       v
Surface.Working -----------------------> Surface.Result
       |                                      ^
       | meaningful status / progressive      |
       | result updates                        |
       +---------------------------------------+

Composer is available for the next draft while Surface.Working.
```

### Working concurrency

- the user may type, dictate, attach resources and prepare the next draft while the current run is Working;
- explicit Stop is available on the Working interaction;
- if the user sends a new Submission and that Submission is accepted, the current Working run is interrupted/superseded and the new instruction begins immediately;
- the new instruction is not queued behind the previous run;
- interruption/Stop cancels work that is still cancellable, but does not imply rollback of external side effects already committed;
- Current Work Surface shows meaningful process state and progressively renders usable output as it becomes available; private chain-of-thought is never exposed.

The exact acceptance/cancellation ordering for a new interrupting Submission remains a Product TBD and must be resolved before protocol implementation.

## Formal test cases

`Scope = Common` means Desktop + Mobile + Tablet expanded behavior. `Mobile/Tablet only` covers Compact entry behavior.

### CMP — Composer basics

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| CMP-001 | Mobile/Tablet only | no text/resources | open | Compact shown; Camera / center trigger / `+`; pending hidden |
| CMP-002 | Desktop only | no text/resources | open | Expanded empty; pending hidden; Send disabled |
| CMP-003 | Mobile/Tablet only | Compact idle | tap center | Expanded.Ready; editor focused; keyboard opens |
| CMP-004 | Common | Expanded empty | type valid text | text retained; Send enabled if no Uploading resources |
| CMP-005 | Common | Expanded empty | type whitespace only | Send disabled unless ready resources exist |
| CMP-006 | Common | existing draft | move caret/edit | draft updates; resources unchanged |
| CMP-007 | Mobile/Tablet only | Expanded; no text/resources | close keyboard / blur | collapse to Compact |
| CMP-008 | Mobile/Tablet only | Expanded; text exists | close keyboard / blur | remain Expanded; draft preserved |
| CMP-009 | Mobile/Tablet only | Expanded; resource-only | close keyboard / blur | collapse to Compact; resources remain visible/pending |

### RES — Pending resources

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| RES-001 | Mobile/Tablet only | Compact idle | capture photo | photo enters pending area; no editor created just to display it |
| RES-002 | Common | Expanded | add image | image appears only in pending area |
| RES-003 | Common | one image | add second image | both remain |
| RES-004 | Common | image pending | add file | mixed types coexist |
| RES-005 | Common | resource pending | tap | preview opens |
| RES-006 | Common | multiple resources | remove one | only selected item removed |
| RES-007 | Common | one resource | remove it | pending area disappears |
| RES-008 | Common | text exists | add/remove resources | text/caret preserved |
| RES-009 | Common | no text; ready resource exists | observe Send | Send enabled |
| RES-010 | Mobile/Tablet only | Compact + resources | tap center | Expanded opens; resources remain above editor |
| RES-011 | Common | at least one resource Uploading | observe Send | Send disabled |
| RES-012 | Common | last Uploading resource becomes Ready; draft/resource payload valid | upload completes | Send recomputes to enabled |

### VCP — Compact long-press voice

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| VCP-001 | Mobile/Tablet only | Compact; permission granted | long-press | enters VoiceCapturing; STT starts |
| VCP-002 | Mobile/Tablet only | VoiceCapturing | speech recognized | live text in overlay above Composer |
| VCP-003 | Mobile/Tablet only | resources pending | voice input | resources unchanged |
| VCP-004 | Mobile/Tablet only | recognized text; no resources | release | immediate text Submission |
| VCP-005 | Mobile/Tablet only | recognized text + resources | release | one mixed Submission |
| VCP-006 | Mobile/Tablet only | no recognized text; no resources | release | no Submission; Compact idle |
| VCP-007 | Mobile/Tablet only | no recognized text; resources | release | no Submission; resources remain |
| VCP-008 | Mobile/Tablet only | recognized text | swipe up | Expanded.Ready; text inserted; caret at end; keyboard opens |
| VCP-009 | Mobile/Tablet only | no recognized text | swipe up | Compact; no empty editor/keyboard |
| VCP-010 | Mobile/Tablet only | recognized text + resources | swipe up | Expanded text + resources remain separate |
| VCP-011 | Mobile/Tablet only | permission unknown | first long-press | permission requested; STT does not start |
| VCP-012 | Mobile/Tablet only | permission grant completes | release/system prompt closes | remain stable; require a second explicit long-press to start voice |

### VCX — Expanded dictation

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| VCX-001 | Common | Ready; permission granted | tap Mic | enters Dictating; STT starts |
| VCX-002 | Common | Dictating | observe controls | Mic -> Stop; Send disabled; `+` disabled |
| VCX-003 | Common | Dictating | STT text | text written directly into editor |
| VCX-004 | Common | existing text + caret | dictate | recognized text inserted at active insertion point |
| VCX-005 | Common | resources pending | dictate | resources unchanged/outside editor |
| VCX-006 | Common | Dictating | tap Stop | STT ends; text remains; Ready; no auto-send |
| VCX-007 | Common | Stop after valid text | observe Send | Send recalculated from text/resources/upload status |
| VCX-008 | Common | Stop with no text/resources | observe Send | Send disabled |
| VCX-009 | Common | dictation stopped | tap Mic again | new session starts without clearing draft/resources |
| VCX-010 | Common | Dictating | observe transcription | editor itself is transcription surface; no Compact overlay |
| VCX-011 | Common | Dictating | tap `+` | no picker opens; `+` remains disabled |
| VCX-012 | Common | permission unknown | first tap Mic | permission requested; STT does not start |
| VCX-013 | Common | permission grant completes | prompt closes | remain Ready; require second explicit tap Mic |

### SUB — Submission

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| SUB-001 | Common | valid text only | Send | one text Submission |
| SUB-002 | Common | no text; ready resources | Send | one resource-only Submission |
| SUB-003 | Common | text + ready mixed resources | Send | one mixed Submission |
| SUB-004 | Common | empty/whitespace; no resources | attempt Send | disabled; no request |
| SUB-005 | Common | sendable | rapidly click Send | at most one logical Submission |
| SUB-006 | Common | accepted | transition | snapshot frozen; consumed draft/resources cleared; Surface.Working; Composer available for next draft |
| SUB-007 | Common | normal Send rejected/not accepted | failure | full text/resource snapshot restored together |
| SUB-008 | Mobile/Tablet only | Compact release-send rejected/not accepted | failure | voice text/resources recover into editable state |

### ERR — Failure paths

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| ERR-001 | Mobile/Tablet only | permission denied | long-press | no fake recording; feedback; Compact stable; resources preserved |
| ERR-002 | Common | permission denied | tap Mic | Ready stable; text/resources preserved |
| ERR-003 | Mobile/Tablet only | VoiceCapturing | STT fails | no partial auto-send; Compact; resources preserved; error shown |
| ERR-004 | Common | Dictating | STT fails | Ready; already written text/resources preserved; Send recalculated |
| ERR-005 | Common | add/upload resource | operation fails | failed resource not treated Ready; existing draft/successful resources preserved |
| ERR-006 | Common | Submission fails before acceptance | failure | lossless restore; no partial restore |

### WRK — Surface Working coordination

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| WRK-001 | Common | Submission accepted | Surface enters Working | Composer immediately available for next draft |
| WRK-002 | Common | Surface Working | type/dictate/add resources | next draft may be prepared without mutating the active run |
| WRK-003 | Common | Surface Working; next draft ready | new Submission accepted | active run is interrupted/superseded; new instruction starts immediately, not queued |
| WRK-004 | Common | Surface Working | tap Stop | system requests best-effort cancellation; does not create a new Submission |
| WRK-005 | Common | Surface Working | execution produces status/result chunks | Surface moves from meaningful process state to progressively rendered usable result |
| WRK-006 | Common | external side effect already committed | Stop / interrupt | UI/runtime must not pretend the committed effect was rolled back automatically |

### RST — Result completion

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| RST-001 | Mobile/Tablet only | result complete; no next draft | settle | Composer available from Compact; submitted draft/resources do not reappear |
| RST-002 | Desktop only | result complete; no next draft | settle | Composer available empty Expanded.Ready; submitted draft/resources do not reappear |

Total formal baseline: **68 test cases**.

## Product TBDs that must not be decided implicitly in code

Core Composer behavior is functionally specified. The remaining unresolved items are cross-run/presentation/limits details:

1. **Interrupt acceptance ordering**: when a new Submission is sent during Working, should the previous run continue until the new Submission is accepted, so a failed new request does not kill the old run?
2. **Stopped/interrupted Surface presentation**: whether partial progressive output remains visible and how it is marked after Stop / supersede.
3. **Resource support and limits**: MVP file/image types, per-file size, resource count, and image compression policy.
4. **Gesture/haptic parameters**: long-press duration, swipe threshold, vibration and animation tuning.

### Development readiness

- **Composer state machine**: Feature Spec Complete（功能规格完整） for the core interaction behavior.
- **Run interruption protocol**: Development Ready conceptually, but TBD 1 must be fixed before final client/Gateway/Agent contract semantics are implemented.
- **Interaction Frozen**: after TBD 2–4 and hands-on UX tuning.
