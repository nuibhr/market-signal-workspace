import { EventEmitter } from "node:events";

class StudioBroadcaster extends EventEmitter {}

const broadcasterKey = Symbol.for("forex.studio.broadcaster");
if (!globalThis[broadcasterKey]) {
  const emitter = new StudioBroadcaster();
  emitter.setMaxListeners(200);
  globalThis[broadcasterKey] = emitter;
}

export const studioBroadcaster = globalThis[broadcasterKey];
