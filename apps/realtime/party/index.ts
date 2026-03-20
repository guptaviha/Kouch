import type * as Party from "partykit/server";
import {
  createProtocolEnvelope,
  parseClientEvent,
  type ServerEvent,
} from '@kouch/contracts';

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );

    const handshakeEvent: ServerEvent = { type: 'pong' };
    conn.send(JSON.stringify(createProtocolEnvelope(handshakeEvent)));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const event = parseClientEvent(message);
      console.log(`connection ${sender.id} sent message: ${event.type}`);

      const response: ServerEvent = event.type === 'ping'
        ? { type: 'pong' }
        : { type: 'error', message: `Unhandled PartyKit event: ${event.type}` };

      sender.send(JSON.stringify(createProtocolEnvelope(response)));
    } catch (error) {
      const response: ServerEvent = { type: 'error', message: 'Invalid client event payload' };
      sender.send(JSON.stringify(createProtocolEnvelope(response)));
    }
  }
}

Server satisfies Party.Worker;
