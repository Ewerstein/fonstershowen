import type { BusMessage } from './types';

const CHANNEL = 'fonstershowen';

export interface Bus {
  send(message: BusMessage): void;
  close(): void;
}

/** Kanal mellan kontrollpanelen och scenen. Fungerar mellan fönster på samma dator, ingen server. */
export function createBus(onMessage: (message: BusMessage) => void): Bus {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<BusMessage>) => onMessage(e.data);
  return {
    send: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
