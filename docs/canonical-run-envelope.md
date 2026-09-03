# Canonical Run Envelope v1 and durable Conversation / Run state

> Status: **normative M3 runtime/control contract**. This document owns the Agent Control（智能体控制层） -> Runtime Adapter（运行时适配器） envelope and the minimum durable Conversation（会话） / Run（执行） state required by the MVP.

## Purpose

ALOHA must be able to replace the current n8n Agent Runtime without redefining product identity, Conversation / Run semantics, capability policy or client protocol.

The stable southbound boundary is therefore:

```text
ALOHA Interaction Protocol
          |
          v
Agent Control
  - trusted identity
  - Conversation / Run admission
  - capability/policy projection
          |
          v
Canonical Run Envelope v1
          |
          v
Runtime Adapter
          |
          v
n8n Agent (MVP)
```

The Envelope is **not a prompt** and is **not an n8n payload model**. The MVP n8n workflow is deliberately adapted to consume the Envelope nearly unchanged.

## Canonical Run Envelope v1

The code-owned contract is `CanonicalRunEnvelopeV1` in `packages/contracts/src/runtime.ts`.

```ts
interface CanonicalRunEnvelopeV1 {
  schemaVersion: 1
  run: {
    requestId: string
    runId: string
    conversationId: string
  }
  input: {
    text?: string
    attachments?: InteractionAttachment[]
  }
  identity: {
    principal: { type: 'user'; id: string }
    actor: { type: 'agent'; id: string }
    application: { id: string }
  } | null
  context: {
    channel: 'web'
  }
  capabilities: RuntimeCapabilityDescriptor[]
}
```

### `run`

ALOHA owns all three identifiers.

- `requestId` correlates one admitted Interaction request.
- `conversationId` is the durable ALOHA Conversation identity.
- `runId` is one ALOHA execution admitted inside that Conversation.

A Runtime-native execution/session ID is only an external correlation field and never replaces `runId` or `conversationId`.

### `input`

M3 keeps the existing concrete input surface: text, plus the already-defined attachment shape for later supported slices. Unsupported attachment input still fails before Run execution.

### `identity`

For a real authenticated product Run, Identity is authoritative and has three deliberately separate roles:

```text
Principal（权限主体） = LifeSpace User / usr_*
Actor（执行者）       = ALOHA Agent / agt_*
Application（应用）  = ALOHA LifeSpace Application / application ID
```

The current user does **not** become the Agent Actor merely because the Agent acts under user authority. The ALOHA Application is also not substituted for either Principal or Actor.

Identity is resolved only through the trusted LifeSpace Identity boundary:

1. Gateway forwards the original server-visible Cloudflare Access assertion.
2. Agent Control exchanges it through LifeSpace Identity using the server-only ALOHA `lsa_*` application credential.
3. LifeSpace resolves the current `usr_*`.
4. ALOHA requires exactly one active LifeSpace Agent identity bound to that application.
5. LifeSpace's delegated Agent-token endpoint is used to validate the final Principal / Actor / Application tuple.

Client body fields such as `userId`, `principalId`, Access `sub`, email, scopes or grants are never identity authority.

#### Transitional `identity: null`

`identity: null` exists only so the already-established M1/M2 deployment smoke tests can continue before the LifeSpace ALOHA application credential is provisioned in a target environment.

This path is explicitly **deployment verification compatibility**, not anonymous product authority:

- it creates no durable user Conversation / Run;
- it does not manufacture Principal / Actor IDs;
- it does not gain scoped capabilities;
- once LifeSpace Identity is configured, a missing valid Access assertion fails closed.

M3 production acceptance is not complete merely because the identity-null M1/M2 path remains green.

### `context`

M3 includes only one concrete context field already true for the current first-party slice: `channel: 'web'`.

Time zone, locale, device state, location, surface selection and other Context（上下文） are additive future fields when a real product use requires them. They must preserve source/freshness/consent semantics where applicable and cannot become authorization proof merely because a client supplied them.

### `capabilities`

This is the already-evaluated ALOHA-managed Capability projection for the Run. In M3 it continues to contain the M2 `math.calculate` descriptor when policy permits it.

The Runtime receives callable descriptors; it does not decide the user's authority or mint ALOHA grants itself.

M4 Runtime Tools such as LifeSpace Core are intentionally separate and are not pre-designed into this contract.

## Conversation / Run durable state

Conversation / Run are ALOHA product state, not LifeSpace Shared Reality（共享现实）. They therefore remain owned by ALOHA Agent Control.

M3 stores them in a SQLite-backed Cloudflare Durable Object（持久对象） named `AlohaUserState`, sharded by the trusted LifeSpace `usr_*` Principal ID.

Why this placement:

- per-user state is isolated by the same trusted identity key;
- one user's Conversation admission is serialized, which prevents same-conversation Run races from being resolved independently by multiple Worker isolates;
- durable product state survives Worker replacement/restarts;
- no second ALOHA user-identity database is created;
- LifeSpace remains the sole identity/authority source of truth.

The Durable Object namespace uses the current SQLite storage backend. The implementation uses the strongly-consistent storage API for the actual Conversation / Run records.

## Persisted Conversation record

Minimum M3 fields:

- `id`
- `principalId`
- `createdAt`
- `updatedAt`
- `activeRunId?`
- `lastRunId?`

A client-supplied `conversationId` must already exist in the trusted Principal's Durable Object. Unknown IDs are rejected rather than silently creating a Conversation under an arbitrary identifier.

When no `conversationId` is supplied, Agent Control creates a new Conversation during Run admission.

## Persisted Run record

Minimum M3 fields:

- `id`
- `requestId`
- `conversationId`
- trusted `principalId`
- trusted `actorId`
- trusted `applicationId`
- `status`
- submitted `inputText`
- lifecycle timestamps
- Runtime-native `backendRunId?`
- final/late `outputText?`
- normalized `errorCode?`

Current persisted statuses are:

- `accepted`
- `running`
- `completed`
- `failed`
- `stopped`
- `superseded`

`stopped` is reserved by the persistent model for the already-defined product lifecycle; the public Stop action is implemented when the corresponding History / Run-control slice is added.

## Admission and supersede invariant

The normative rule from `conversation-run-lifecycle.md` is preserved:

> A same-conversation old Run is not Superseded merely because a replacement Submission began admission. It becomes Superseded only when the replacement Run has actually been accepted.

The Durable Object admission transaction therefore:

1. validates or creates the Conversation;
2. identifies the currently active Run, if any;
3. marks an `accepted` / `running` prior Run `superseded`;
4. creates the replacement Run as `accepted`;
5. makes the replacement the Conversation's `activeRunId`.

These state changes occur in one per-user serialized admission operation.

## Late output invariant

If a Runtime returns after its ALOHA Run was already `superseded` or `stopped`:

- late output / backend correlation may still be retained for History / Trace;
- the terminal marker remains `superseded` / `stopped`;
- the old Run never becomes active again;
- it may not clear or replace a newer Conversation `activeRunId`.

This is the persistence-side guarantee behind the State-first product rule that stale output must never overwrite the newer Current Work Surface（当前工作面）.

## Runtime result ordering

For trusted product Runs, Agent Control persists the lifecycle transition before announcing the corresponding successful terminal event to the client when practical:

```text
admit -> accepted
start execution -> running
Runtime success -> persist completed/output/backendRunId -> emit output/completed
Runtime failure -> persist failed/errorCode -> emit failed
```

If durable state becomes unavailable, Agent Control emits a safe normalized failure rather than pretending the Run was durably completed.

## Security boundaries

- `LIFESPACE_APPLICATION_CREDENTIAL` is a server-only `lsa_*` secret and never enters the Envelope, n8n, browser JavaScript, logs or source control.
- The raw Cloudflare Access assertion is used only for Identity exchange and is never persisted as Conversation / Run data.
- The short-lived delegated LifeSpace Agent token is used only to validate the execution tuple in M3; it is not sent to n8n. M4 will establish the appropriate credential path for real LifeSpace Core Tools.
- Capability Grants remain short-lived Run-scoped ALOHA authority. Trusted Principal / Actor IDs may be carried in their signed claims for attribution, but the M2 math capability still requires no LifeSpace scope.
- Runtime output, backend errors and upstream Identity bodies must not leak private backend detail through public errors.

## Environment activation

Source deployment can create the Durable Object before LifeSpace product identity is activated.

To activate trusted M3 product Runs in an environment, Agent Control requires both:

- `LIFESPACE_IDENTITY_BASE_URL`
- `LIFESPACE_APPLICATION_CREDENTIAL`

The target LifeSpace application must also have:

- an active trusted Web application credential (`lsa_*`);
- the correct Cloudflare Access audience registered;
- exactly one active ALOHA Agent identity bound to that application;
- `profile:read` within the application's allowed scope ceiling.

If neither LifeSpace setting exists, only the legacy non-persistent M1/M2 verification path remains available. If configuration is partial, or if identity/Agent resolution fails, Agent Control fails closed.

## M3 acceptance

M3 source-level acceptance requires:

1. Canonical Run Envelope v1 is the single Agent Control -> Runtime Adapter contract.
2. n8n Adapter forwards that Envelope rather than constructing a second competing contract.
3. trusted identity is resolved from LifeSpace and never from request-body identity claims.
4. exactly one ALOHA Agent Actor is required; no synthetic fallback exists.
5. trusted product Runs persist Conversation / Run state under the resolved `usr_*` shard.
6. same-conversation replacement Supersedes the prior active Run only after admission.
7. late output cannot resurrect a superseded Run or clear the newer active Run.
8. M1/M2 production gates remain green during staged activation.
9. real M3 deployment acceptance uses an Access-authenticated request after LifeSpace application/Agent provisioning; the identity-null smoke path does not count as M3 identity acceptance.

## Relationship to other specifications

- `interaction-protocol.md` owns the public client/channel protocol.
- `conversation-run-lifecycle.md` owns Conversation / Run product semantics.
- **This document owns Canonical Run Envelope v1 and its minimum persistent Agent Control representation.**
- `direct-capability.md` owns the M2 mediated capability path.
- LifeSpace owns Identity, Principal/Actor/Application authority and its application/Agent contracts.
