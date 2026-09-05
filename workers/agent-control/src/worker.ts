export { default } from './index'
export { AlohaUserState as AlohaConversationState } from './conversation-run-state'

/**
 * Compatibility export for prior Agent Control deployments.
 *
 * Current Agent Control code does not bind or use this class for product state.
 * Keep the export inert so older provisioned Durable Object namespaces remain
 * forward-upgradable without making a destructive lifecycle decision here.
 */
export class AlohaUserState {
  async fetch(): Promise<Response> {
    return Response.json(
      { error: 'legacy_durable_object_not_in_use' },
      { status: 410 },
    )
  }
}
