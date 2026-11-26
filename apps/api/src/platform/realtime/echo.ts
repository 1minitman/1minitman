import { ECHO_EVENT, EchoDataSchema } from '@1minitman/contracts';
import { userChannel } from './channels';
import type { SocketEventDefinition } from './gateway';

/**
 * The test-only `echo` event (MOD-00 plan section 4.2): relayed through `ch:user:{user_id}` to
 * every socket of the sender, on every instance. Never registered by the composition root;
 * tests register it to prove the cross-instance relay.
 */
export const echoEvent: SocketEventDefinition<typeof EchoDataSchema> = {
  type: ECHO_EVENT,
  schema: EchoDataSchema,
  handle: (context, data) =>
    context.publish(userChannel(context.principal.memberId), { type: ECHO_EVENT, data }),
};
