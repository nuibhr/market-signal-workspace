// Development-only transport within the operator-configured MT5 Files sandbox.
// Channel names are identifiers; the actual ingestion token stays in process memory.
import { constants } from "node:fs";
import { mkdir, open, rename, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { BridgeError, configuration, fail } from "./protocol.mjs";

export function localFileDirectory(env = process.env) {
  const path = env.FOREX_MT5_LOCAL_FILES_PATH;
  return configuration(env).local &&
    typeof path === "string" &&
    isAbsolute(path)
    ? path
    : null;
}
export class LocalFilesBridge {
  constructor() {
    this.sessions = new Map();
  }
  async start(owner, pairing, directory, now = Date.now()) {
    fail(isAbsolute(directory), "LOCAL_FILES_UNAVAILABLE", 503);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const resolved = await realpath(directory);
    for (const [key, session] of this.sessions)
      if (session.expires <= now) this.stop(key);
    const session = {
      channel: randomBytes(16).toString("hex"),
      token: pairing.token,
      expires: Date.parse(pairing.expires_at),
      directory: resolved,
      lastSequence: 0,
      lastDigest: null,
      reply: null,
      pending: null,
      error: null,
    };
    this.sessions.set(owner, session);
    return { channel: session.channel, expires_at: pairing.expires_at };
  }
  stop(owner) {
    this.sessions.delete(owner);
  }
  state(owner, now = Date.now()) {
    const session = this.sessions.get(owner);
    if (!session || session.expires <= now) {
      this.stop(owner);
      return null;
    }
    return { channel: session.channel, error: session.error };
  }
  async pump(owner, store, config, now = Date.now()) {
    if (!config.local || !config.enabled) return;
    const session = this.sessions.get(owner);
    if (!this.state(owner, now)) return;
    if (session.pending) return session.pending;
    session.pending = this.read(session, store, config, now).finally(() => {
      session.pending = null;
    });
    return session.pending;
  }
  async read(session, store, config, now) {
    const packetPath = join(
      session.directory,
      `${session.channel}.packet.json`,
    );
    let file;
    try {
      file = await open(
        packetPath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const stat = await file.stat();
      fail(
        stat.isFile() && stat.size > 0 && stat.size <= 512000,
        "INVALID_LOCAL_FILE",
      );
      const bytes = Buffer.alloc(512001);
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      fail(bytesRead <= 512000, "PAYLOAD_TOO_LARGE", 413);
      const body = bytes.subarray(0, bytesRead).toString("utf8");
      let packet;
      try {
        packet = JSON.parse(body);
      } catch {
        throw new BridgeError("INVALID_JSON");
      }
      const digest = createHash("sha256").update(body).digest("hex");
      if (
        packet.sequence !== session.lastSequence ||
        digest !== session.lastDigest
      ) {
        try {
          const result = store.ingest(session.token, packet, config, now);
          session.reply = {
            sequence: String(packet.sequence),
            status: "200",
            ...result,
          };
          session.error = null;
        } catch (error) {
          session.error =
            error instanceof BridgeError ? error.message : "BRIDGE_UNAVAILABLE";
          session.reply = {
            sequence: String(packet.sequence),
            status: String(error instanceof BridgeError ? error.status : 503),
          };
        }
        session.lastSequence = packet.sequence;
        session.lastDigest = digest;
      }
      // Cache the acceptance result: an acknowledgement write failure must not re-ingest a packet.
      const target = join(session.directory, `${session.channel}.reply.json`);
      const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(session.reply), {
          flag: "wx",
          mode: 0o600,
        });
        await rename(temporary, target);
        if (session.reply.status === "200") session.error = null;
      } finally {
        await rm(temporary, { force: true });
      }
    } catch (error) {
      if (error.code !== "ENOENT")
        session.error =
          error instanceof BridgeError
            ? error.message
            : "LOCAL_FILES_UNAVAILABLE";
    } finally {
      await file?.close();
    }
  }
}
const key = Symbol.for("nugaom.forex.local-files");
export const localFiles = (globalThis[key] ??= new LocalFilesBridge());
