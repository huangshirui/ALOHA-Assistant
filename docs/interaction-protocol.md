# ALOHA Interaction Protocol — MVP slice 1

> Status: **normative contract for the first text-only vertical slice**. It deliberately defines only semantics required to prove `PWA -> Gateway -> Agent Control -> Runtime Adapter -> Runtime Backend`.

## Scope

The first slice exposes one first-party interaction entry point:

`POST /v1/interactions`

The request uses the shared `InteractionInput` contract. The response is `text/event-stream` and contains ALOHA canonical `RunEvent` objects.

The protocol is owned by ALOHA. Runtime-native n8n webhook/execution payloads are not part of this contract.

## Input

The first slice accepts:

- optional client correlation `requestId`;
- optional `conversationId` to continue the current Conversation（会话）;
- text input;
- attachment metadata reserved for later slices.

For the first runnable slice, Agent Control requires non-empty text. Resource-only submission remains a product requirement but is not implemented by this slice.

Client-supplied Principal（权限主体）, grant, scope or Space identifiers are intentionally absent from this request contract. Authorization authority will be derived from trusted server-side context in a later slice rather than being accepted as request-body proof.

## Conversation and Run identity

- if `conversationId` is absent, Agent Control creates a new Conversation identifier;
- every accepted interaction creates a new Run（运行） identifier;
- `requestId` is correlation only and is not an authority identifier;
- Conversation / Run durable persistence, background execution and supersession are not claimed as implemented by slice 1. Their target semantics remain defined by `conversation-run-lifecycle.md`.

## Canonical events

Every event carries `eventId`, `runId`, `conversationId`, `sequence` and `occurredAt`.

The first slice defines four event types:

1. `run.started` — the Run has been admitted and execution has started;
2. `output.delta` — progressive ALOHA output. Slice 1 may emit the complete backend result as one delta while preserving a streaming-compatible client contract;
3. `run.completed` — normal terminal completion;
4. `run.failed` — terminal failure with a machine-readable code, safe user-facing message and retryability flag.

Events are ordered by increasing `sequence` within one Run.

## Transport

MVP transport is HTTP + SSE（Server-Sent Events，服务器发送事件）.

Each SSE frame uses:

```text
event: <RunEvent.type>
data: <JSON encoded RunEvent>
```

Transport choice is not product semantics. A future WebSocket or channel adapter may carry the same canonical events without redefining them.

## Runtime boundary

Agent Control translates the accepted interaction into a `RuntimeRunRequest` and calls the selected Runtime Adapter（运行时适配器）.

The minimal Runtime Contract contains:

- ALOHA request / Conversation / Run correlation;
- normalized input;
- the Capability（能力） descriptors exposed to the Runtime;
- a normalized `RuntimeRunResult` containing output text and optional backend correlation.

The n8n-specific request/response contract belongs to the n8n Runtime Adapter package, not to this first-party protocol.

## Deliberately deferred

This slice does not yet implement or freeze:

- trusted Identity / Authorization Context;
- Context Envelope（上下文信封） fields;
- confirmation / approval events;
- Stop / Superseded execution control;
- artifacts / structured output / clarification events;
- durable Conversation / Run persistence;
- voice, image, file or location handling.

These are added only when the next vertical slice requires them, without allowing a specific Runtime Backend to redefine the northbound protocol.
