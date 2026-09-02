# Composer state machine and interaction lifecycle test baseline

> Status: **Feature Spec Complete（功能规格完整） for the Composer, run-interruption and MVP conversation-lifecycle interaction contract**. This file defines intended behavior and the implementation-test baseline. It does not claim the behavior is already implemented or verified.

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

`Surface.Working / Result` and Conversation / Context lifecycle are separate from the Composer state tree. Composer remains usable while Surface is Working.

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
  sizeBytes?: number
  mimeType?: string
}
```

Resource upload state is orthogonal to Composer state.

## Derived guards

```text
hasValidText       = trim(textDraft).length > 0
hasResources       = pendingResources.length > 0
hasDraft           = hasValidText or hasResources
hasVoiceText       = trim(voiceTranscriptBuffer).length > 0
allResourcesReady  = every pending resource has status=ready
resourceCountValid = pendingResources.length <= 10
resourceSizesValid = every resource size <= 20 MB
isVoiceActive      = state is Compact.VoiceCapturing or Expanded.Dictating
canSend            = state is Expanded.Ready
                     and (hasValidText or hasResources)
                     and allResourcesReady
                     and resourceCountValid
                     and resourceSizesValid
```

If any pending resource is Uploading, Send is disabled. Failed, unsupported or over-limit resources are never treated as Ready.

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
17. **Accepted next-turn Submission interrupts current Working run**: inside the same conversation it supersedes the current run rather than queueing behind it.
18. **New-request acceptance precedes old-run cancellation**: a failed replacement request must not kill the old run.
19. **Superseded late output never wins the active surface**: late output from an old run may enter History / Trace but cannot overwrite the new Current Work Surface.
20. **Stop is best-effort, not rollback**: committed external side effects are not silently undone.
21. **Stopped/superseded partial output is retained**: already rendered progressive content remains visible with a terminal marker.
22. **Resource limits are enforced before submission**: MVP permits at most 10 resources, each at most 20 MB, from the supported resource families.
23. **Original image identity is preserved**: thumbnails/optimized derivatives may be generated separately; transport must not silently replace the original resource with a destructive compressed substitute.
24. **Gesture semantics are stable, thresholds are tunable**: initial long-press and swipe thresholds may be tuned without changing the state-machine meaning.
25. **Voice entry/edit transition provides Haptic feedback where supported**.
26. **New Context is not Stop**: leaving a Working conversation for a new context does not cancel its active Run; that Run may finish in the background and write to the old conversation/history.
27. **Dirty-draft New Context requires confirmation**: unsent text or resources are never silently discarded by New Context.
28. **Non-destructive navigation preserves Draft**: History, Settings and ordinary navigation do not clear unsent text/resources.
29. **Draft survives ordinary PWA lifecycle loss**: recoverable text and Ready-resource references are restored after refresh/process reclamation.
30. **Keyboard semantics are platform-specific only at submission gesture level**: Desktop `Enter` sends and `Shift+Enter` inserts newline; Mobile/Tablet keyboard Enter inserts newline and explicit Send submits.
31. **History is recall-only in MVP**: conventional conversation-list/message-flow viewing is supported, but starting/branching a conversation from history is not.

## Events and transitions

### Compact.Idle（Mobile / Tablet only）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `TAP_CENTER` | - | `Expanded.Ready` | focus editor; open keyboard |
| `LONG_PRESS_CENTER` | permission=granted and threshold met | `Compact.VoiceCapturing` | start STT; clear voice buffer; show overlay; light Haptic |
| `LONG_PRESS_CENTER` | permission=unknown | remain | request permission; do not start STT |
| `LONG_PRESS_CENTER` | permission=denied | remain | show permission guidance; preserve resources |
| `CAMERA_ADD_SUCCESS` | resource allowed and limits valid | remain | add resource |
| `RESOURCE_ADD_SUCCESS` | resource allowed and limits valid | remain | add resource |
| `RESOURCE_ADD_REJECTED` | unsupported / over-count / over-size | remain | show validation feedback; do not add as Ready |

Permission resolution never continues the original gesture automatically. After grant, remain stable and require another long-press.

Initial gesture parameter: approximately **400 ms** long-press activation. Treat this as a tunable UX parameter, not a transport/protocol constant.

### Compact.VoiceCapturing（Mobile / Tablet only）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `STT_UPDATE` | - | remain | update `voiceTranscriptBuffer`; render overlay |
| `RELEASE` | `hasVoiceText` | `Submitting` | build Submission from voice text + pending resources |
| `RELEASE` | no voice text | `Compact.Idle` | stop STT; close overlay; preserve resources; no submit |
| `SWIPE_UP` | `hasVoiceText` and edit threshold met | `Expanded.Ready` | stop STT; move text to editor; caret at end; focus; open keyboard; light Haptic |
| `SWIPE_UP` | no voice text and edit threshold met | `Compact.Idle` | stop STT; close overlay; no keyboard; light Haptic |
| `STT_ERROR` | - | `Compact.Idle` | do not auto-send partial text; preserve resources; show error |

There is no independent Cancel gesture in the MVP transition contract.

Initial swipe-up edit threshold: approximately **60 px** vertical displacement. Treat this as tunable after real-device testing.

### Expanded.Ready（all devices）

| Event | Guard | Target | Actions |
| --- | --- | --- | --- |
| `TEXT_CHANGE` | - | remain | update draft |
| `RESOURCE_ADD_SUCCESS` | resource allowed and limits valid | remain | add resource; show pending area |
| `RESOURCE_ADD_REJECTED` | unsupported / over-count / over-size | remain | show validation feedback; preserve current draft/resources |
| `RESOURCE_UPLOAD_UPDATE` | - | remain | update resource status; recompute `canSend` |
| `RESOURCE_REMOVE` | - | remain | remove resource; hide area if empty |
| `TAP_RESOURCE` | - | remain | preview resource |
| `TAP_MIC` | permission=granted | `Expanded.Dictating` | start STT at insertion point; Mic -> Stop; disable Send and `+` |
| `TAP_MIC` | permission=unknown | remain | request permission; do not start STT |
| `TAP_MIC` | permission=denied | remain | show permission guidance; preserve text/resources |
| `TAP_SEND` | `canSend` | `Submitting` | create immutable snapshot |
| `TAP_SEND` | not `canSend` | remain | no request |
| `KEY_ENTER` | Desktop and `canSend` | `Submitting` | create immutable snapshot; same semantics as Send |
| `KEY_ENTER` | Desktop and not `canSend` | remain | no request |
| `KEY_SHIFT_ENTER` | Desktop | remain | insert newline |
| `KEY_ENTER` | Mobile/Tablet | remain | insert newline; do not submit |
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
| `SUBMISSION_ACCEPTED` | Mobile/Tablet | `Compact.Idle` | clear consumed draft/resources and persisted draft; hand snapshot to Surface.Working; Composer becomes available for next draft |
| `SUBMISSION_ACCEPTED` | Desktop | `Expanded.Ready` | clear consumed draft/resources and persisted draft; hand snapshot to Surface.Working; Composer becomes available for next draft |
| `SUBMISSION_REJECTED` | originated from Expanded | `Expanded.Ready` | restore full snapshot and persistence; show failure/retry |
| `SUBMISSION_REJECTED` | originated from Compact voice | `Expanded.Ready` | recover voice text + resources into editable persisted form; show failure/retry |

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

### Working concurrency and interruption protocol

- the user may type, dictate, attach resources and prepare the next draft while the current run is Working;
- explicit Stop is available on the Working interaction;
- a new Submission sent **inside the same conversation** during Working is an interrupting candidate, not a queued follow-up;
- the old run continues while the new Submission is being admitted;
- **only after the new Submission is accepted** is the old run marked Superseded and best-effort cancellation requested;
- if the new Submission is rejected/not accepted, the old run continues normally;
- after supersession, late output from the old run may be stored in History / Trace but must never overwrite the active Current Work Surface for the new run;
- interruption/Stop cancels work that is still cancellable, but does not imply rollback of external side effects already committed;
- Current Work Surface shows meaningful process state and progressively renders usable output as it becomes available; private chain-of-thought is never exposed.

### New Context coordination

`New Context` is a conversation-lifecycle action, not a Run-control action.

- when invoked while the current conversation has a Working Run, the old Run keeps running in the background;
- its later progress/result belongs to the old conversation and may be viewed from History;
- the newly created conversation owns the active Current Work Surface;
- New Context does not mark the old Run Stopped or Superseded merely because the user navigated away;
- if an unsent Draft exists, require explicit discard confirmation before switching;
- if confirmation is cancelled, remain in the old conversation with its Draft unchanged.

### Stopped / superseded presentation contract

- progressive output already rendered before termination remains visible;
- explicit user Stop adds a **Stopped（已停止）** terminal marker;
- replacement by an accepted new instruction adds a **Superseded（已被新指令中断）** terminal marker to the old run;
- after the terminal marker, that run may not append further content to the active Current Work Surface;
- committed external effects remain visible facts even if the run was later stopped/interrupted.

## Draft persistence contract

Draft persistence is local-client recovery, not Conversation history.

- persist current `textDraft` locally;
- persist references/metadata for pending resources already confirmed Ready;
- refresh, ordinary route navigation and PWA process reclamation restore the recoverable Draft;
- a resource that was only Uploading at lifecycle interruption must never be restored as Ready without a valid completed resource reference;
- navigation to History / Settings does not clear Draft;
- successful Submission clears the consumed persisted Draft;
- user deletion clears the corresponding persisted content/resource;
- confirmed discard during New Context clears the old Draft before creating the new active conversation.

## MVP resource policy

Supported families for the first MVP:

- common web/mobile image formats;
- PDF;
- plain-text documents;
- Markdown documents.

Deferred: Office document families and broader arbitrary-file support.

Limits:

- maximum **10 resources** in one Submission;
- maximum **20 MB per resource**;
- unsupported/over-limit resources are rejected before becoming Ready;
- image previews may use separate generated thumbnails;
- the original uploaded resource identity/content must not be silently replaced by a destructive compressed derivative merely for UI or transport convenience.

The exact MIME / extension allow-list within these families is an implementation detail that must be explicit in code/config and tests once the upload stack is selected.

## History contract

History uses conventional UI semantics:

- `More -> History` opens a Conversation List（会话列表）;
- opening one conversation shows chronological Message Flow（消息流）;
- Stopped / Superseded terminal markers are visible where relevant;
- History is recall/inspection/search only in MVP;
- no action starts, branches or resumes a new conversation from a historical conversation/message in the MVP.

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

### KBD — Keyboard submission

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| KBD-001 | Desktop only | Expanded.Ready and `canSend` | press Enter | same as Send: one Submission starts |
| KBD-002 | Desktop only | Expanded.Ready | press Shift + Enter | newline inserted; no Submission |
| KBD-003 | Mobile/Tablet only | Expanded.Ready | keyboard Enter | newline inserted; no Submission; explicit Send remains required |

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
| RES-012 | Common | last Uploading resource becomes Ready; payload valid | upload completes | Send recomputes to enabled |
| RES-013 | Common | 10 resources already pending | add an 11th | resource is rejected; existing 10 and text draft preserved |
| RES-014 | Common | selected resource > 20 MB | add | resource is rejected before Ready; clear validation feedback |
| RES-015 | Common | unsupported resource family | add | resource is rejected; existing draft/resources preserved |
| RES-016 | Common | image accepted | render pending preview | lightweight thumbnail may be used; original resource remains the submission identity/source |

### VCP — Compact long-press voice

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| VCP-001 | Mobile/Tablet only | Compact; permission granted | hold less than long-press threshold | voice capture does not activate |
| VCP-002 | Mobile/Tablet only | Compact; permission granted | hold through ~400 ms threshold | enters VoiceCapturing; STT starts; one light Haptic where supported |
| VCP-003 | Mobile/Tablet only | VoiceCapturing | speech recognized | live text in overlay above Composer |
| VCP-004 | Mobile/Tablet only | resources pending | voice input | resources unchanged |
| VCP-005 | Mobile/Tablet only | recognized text; no resources | release | immediate text Submission |
| VCP-006 | Mobile/Tablet only | recognized text + resources | release | one mixed Submission |
| VCP-007 | Mobile/Tablet only | no recognized text; no resources | release | no Submission; Compact idle |
| VCP-008 | Mobile/Tablet only | no recognized text; resources | release | no Submission; resources remain |
| VCP-009 | Mobile/Tablet only | recognized text; swipe-up threshold met | swipe up | Expanded.Ready; text inserted; caret at end; keyboard opens; light Haptic |
| VCP-010 | Mobile/Tablet only | no recognized text; swipe-up threshold met | swipe up | Compact; no empty editor/keyboard; light Haptic |
| VCP-011 | Mobile/Tablet only | recognized text + resources | swipe up | Expanded text + resources remain separate |
| VCP-012 | Mobile/Tablet only | permission unknown | first long-press | permission requested; STT does not start |
| VCP-013 | Mobile/Tablet only | permission grant completes | prompt closes | remain stable; require a second explicit long-press to start voice |
| VCP-014 | Mobile/Tablet only | VoiceCapturing; movement below ~60 px edit threshold | move upward then release | movement alone does not commit edit transition; release semantics remain applicable |

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
| SUB-006 | Common | accepted | transition | snapshot frozen; consumed draft/resources/persistence cleared; Surface.Working; Composer available for next draft |
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
| WRK-003 | Common | Surface Working; next draft sent | replacement request pending admission | old run continues until replacement is accepted |
| WRK-004 | Common | replacement request rejected/not accepted | receive failure | old Working run continues; new draft is recoverable; old run was not killed |
| WRK-005 | Common | replacement request accepted | acceptance | old run marked Superseded; cancellation requested; new run becomes active immediately, not queued |
| WRK-006 | Common | old run emits late output after supersession | receive late chunk/result | may enter History/Trace; must not overwrite new active Current Work Surface |
| WRK-007 | Common | Surface Working | tap Stop | best-effort cancellation requested; no new Submission |
| WRK-008 | Common | partial progressive output exists | Stop accepted | partial output remains visible and gains Stopped marker; no further active-surface chunks from that run |
| WRK-009 | Common | partial progressive output exists | replacement accepted | partial old output remains historically visible with Superseded marker; new run owns active Surface |
| WRK-010 | Common | external side effect already committed | Stop / interrupt | UI/runtime never pretends committed effect was rolled back automatically |
| WRK-011 | Common | Surface Working | execution produces status/result chunks | Surface moves from meaningful process state to progressively rendered usable result |
| WRK-012 | Common | run terminally Stopped/Superseded | later stream event arrives | event cannot append to that run's active Current Work Surface presentation |

### CTX — New Context lifecycle

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| CTX-001 | Common | current conversation Working; no unsent draft | New Context | new conversation opens; old Run continues in background; no Stop/Superseded caused by navigation |
| CTX-002 | Common | no Working run; no unsent draft | New Context | new clean conversation opens immediately |
| CTX-003 | Common | unsent text and/or resources exist | New Context | discard confirmation shown; no silent loss |
| CTX-004 | Common | discard confirmation shown | cancel | remain current conversation; Draft unchanged |
| CTX-005 | Common | discard confirmation shown | confirm discard | old Draft cleared; new clean conversation becomes active; any old Working Run continues independently |

### DRF — Draft persistence

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| DRF-001 | Common | unsent text draft exists | refresh / PWA process reclaimed then reopen | text draft restored |
| DRF-002 | Common | Ready resources pending | refresh / reopen | completed resource references/metadata restored in Pending Submission Area |
| DRF-003 | Common | resource was only Uploading at lifecycle loss | reopen | resource is not falsely restored as Ready; retry/reselection or valid completed reference required |
| DRF-004 | Common | unsent Draft exists | navigate to History/Settings and return | Draft remains intact |
| DRF-005 | Common | Submission accepted | return/reopen | consumed Draft does not reappear |

### HIS — History

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| HIS-001 | Common | history exists | open `More -> History`, select conversation | conventional conversation list then chronological message flow is shown |
| HIS-002 | Common | historical conversation/message open | inspect available actions | MVP offers no start/branch/resume-new-conversation-from-history action |

### RST — Result completion

| ID | Scope | Scenario | Action | Expected |
| --- | --- | --- | --- | --- |
| RST-001 | Mobile/Tablet only | result complete; no next draft | settle | Composer available from Compact; submitted draft/resources do not reappear |
| RST-002 | Desktop only | result complete; no next draft | settle | Composer available empty Expanded.Ready; submitted draft/resources do not reappear |

Total formal baseline: **97 test cases**.

## Remaining product decisions

The functional MVP interaction contract is no longer blocked by product semantics. Remaining items are presentation/detail or explicitly deferred capabilities:

1. detailed visual iconography for New Context, Stop, Stopped and Superseded;
2. detailed visual wording/layout for process states and progressive-result transitions;
3. exact MIME / extension allow-list inside the approved MVP resource families and resource-preview presentation;
4. final tuning of gesture thresholds / Haptic intensity / animation after real-device testing;
5. Annotation（标注） interaction details / Facet integration;
6. historical Reference / branch-from-history semantics, intentionally deferred beyond MVP.

### Development readiness

- **Composer state machine**: Feature Spec Complete（功能规格完整）.
- **Run interruption contract**: Feature Spec Complete（功能规格完整） at the product/interaction level; Gateway / Agent Runtime implementation must preserve acceptance-before-cancel ordering and run identity.
- **Conversation lifecycle / Draft recovery / History MVP contract**: Feature Spec Complete（功能规格完整） at the product/interaction level.
- **Interaction Frozen（交互冻结）**: only after remaining presentation/detail items and hands-on device tuning are finalized.
