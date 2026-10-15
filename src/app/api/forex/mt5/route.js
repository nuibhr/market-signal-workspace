import { connectorEndpoint } from "../../../../components/forex/connection-setup.mjs";
import { cookies } from "next/headers";
import {
  configuration,
  BridgeError,
  fail,
} from "../../../../forex-mt5/protocol.mjs";
import {
  localFiles,
  localFileDirectory,
} from "../../../../forex-mt5/local-files.mjs";
import { storeFor } from "../../../../forex-mt5/store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const cookieName = "forex_local_session";
const loopback = (request) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
async function ownerFor(request, store, config) {
  if (config.local && loopback(request))
    return store.localOwner((await cookies()).get(cookieName)?.value);
  const { currentMember } = await import("../../../../membership/server.mjs");
  const member = await currentMember();
  return member ? `member:${member.id}` : null;
}
function sameSite(request) {
  const origin = request.headers.get("origin");
  fail(
    origin && origin === new URL(process.env.APP_ORIGIN || request.url).origin,
    "FORBIDDEN",
    403,
  );
}
async function readBody(request) {
  fail(
    /^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") || "",
    ),
    "CONTENT_TYPE_REQUIRED",
    415,
  );
  fail(
    Number(request.headers.get("content-length")) <= 512000,
    "PAYLOAD_TOO_LARGE",
    413,
  );
  const reader = request.body?.getReader();
  fail(reader, "INVALID_JSON");
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512000) {
        await reader.cancel();
        throw new BridgeError("PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    fail(body && typeof body === "object" && !Array.isArray(body));
    return body;
  } catch {
    throw new BridgeError("INVALID_JSON");
  }
}
function errorResponse(error) {
  return Response.json(
    {
      error:
        error instanceof BridgeError ? error.message : "BRIDGE_UNAVAILABLE",
    },
    { status: error instanceof BridgeError ? error.status : 503, headers },
  );
}
export async function GET(request) {
  try {
    const config = configuration();
    const local = config.local && loopback(request);
    const publicOrigin = process.env.APP_ORIGIN || (local ? new URL(request.url).origin : "");
    let endpoint = null;
    try { endpoint = connectorEndpoint(publicOrigin, local); } catch { /* No public endpoint configured. */ }
    const { isConfigured } = await import("../../../../membership/store.mjs");
    const capabilities = {
      enabled: config.enabled,
      endpoint,
      memberLoginConfigured: isConfigured(),
      servers: config.servers,
      local: config.local && loopback(request),
      localFiles:
        config.enabled &&
        config.local &&
        loopback(request) &&
        Boolean(localFileDirectory()),
    };
    if (!config.enabled)
      return Response.json(
        {
          capabilities,
          authorized: false,
          status: "disconnected",
          snapshot: null,
          quotes: {},
          chart: null,
        },
        { headers },
      );
    const store = storeFor(config),
      owner = await ownerFor(request, store, config);
    if (!owner)
      return Response.json(
        {
          capabilities,
          authorized: false,
          status: "disconnected",
          snapshot: null,
          quotes: {},
          chart: null,
        },
        { headers },
      );
    store.limit("view", owner, 120);
    const url = new URL(request.url);
    const selection = {
      symbol: url.searchParams.get("symbol"),
      frame: url.searchParams.get("frame") || "1h",
    };
    store.view(owner, config, selection);
    if (capabilities.localFiles) await localFiles.pump(owner, store, config);
    return Response.json(
      {
        capabilities,
        authorized: true,
        local_file: capabilities.localFiles ? localFiles.state(owner) : null,
        ...store.view(owner, config, {
          symbol: url.searchParams.get("symbol"),
          frame: url.searchParams.get("frame") || "1h",
        }),
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request) {
  try {
    const config = configuration();
    fail(config.enabled, "BRIDGE_DISABLED", 503);
    const body = await readBody(request);
    const store = storeFor(config);
    if (body.kind) {
      fail(
        new URL(process.env.APP_ORIGIN || request.url).protocol === "https:" ||
          (config.local && loopback(request)),
        "HTTPS_REQUIRED",
        403,
      );
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      return Response.json(store.ingest(token, body, config, Date.now(), request.headers.get("x-forex-retry") === "same-packet"), { headers });
    }
    sameSite(request);
    fail(
      Object.keys(body).every((key) => ["action", "server"].includes(key)),
      "UNSUPPORTED_FIELDS",
    );
    if (body.action === "local-session") {
      fail(config.local && loopback(request), "FORBIDDEN", 403);
      // The development server must be bound to loopback; this path never opens in production.
      store.limit("local-session", "loopback", 10, 3600000);
      const token = store.localSession();
      const response = Response.json({ authorized: true }, { headers });
      response.headers.set(
        "Set-Cookie",
        `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/forex/mt5; Max-Age=86400${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      );
      return response;
    }
    const owner = await ownerFor(request, store, config);
    fail(owner, "SIGN_IN_REQUIRED", 401);
    if (body.action === "local-file") {
      fail(
        config.local && loopback(request) && localFileDirectory(),
        "FORBIDDEN",
        403,
      );
      const pairing = store.pair(owner, body.server, config);
      try {
        const result = await localFiles.start(
          owner,
          pairing,
          localFileDirectory(),
        );
        return Response.json(result, { status: 201, headers });
      } catch (error) {
        store.revoke(owner);
        throw error;
      }
    }
    if (body.action === "pair") {
      fail(
        new URL(process.env.APP_ORIGIN || request.url).protocol === "https:" ||
          (config.local && loopback(request)),
        "HTTPS_REQUIRED",
        403,
      );
      fail(Boolean(process.env.APP_ORIGIN) || (config.local && loopback(request)), "PUBLIC_ORIGIN_REQUIRED", 503);
      connectorEndpoint(process.env.APP_ORIGIN || new URL(request.url).origin, config.local && loopback(request));
      const pairing = store.pair(owner, body.server, config);
      localFiles.stop(owner);
      return Response.json(pairing, {
        status: 201,
        headers,
      });
    }
    fail(body.action === "revoke");
    store.revoke(owner);
    localFiles.stop(owner);
    return Response.json({ revoked: true }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
