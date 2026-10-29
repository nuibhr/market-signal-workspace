import { connectorEndpoint } from "../components/forex/connection-setup.mjs";
import {
  BridgeError,
  fail,
} from "./protocol.mjs";
import {
  localFiles,
  localFileDirectory,
} from "./local-files.mjs";
import { storeFor } from "./store.mjs";
import {receiverConfiguration,developmentTransport} from "./runtime-policy.mjs";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const cookieName = "forex_local_session";
export function createForexHandlers({currentMember,cookieStore,isLoginConfigured,env=process.env,getStore=storeFor,ownerPrefix="member",allowLocalSession=true}) {
  async function ownerFor(request, config) {
    const member=await currentMember(request);
    if(member)return `${ownerPrefix}:${member.id}`;
    if(allowLocalSession&&config.local&&developmentTransport(request,env))
      return getStore(config).localOwner((await cookieStore(request)).get(cookieName)?.value);
    return null;
  }
  function sameSite(request) {
    const origin = request.headers.get("origin");
    fail(
      origin && origin === new URL(env.APP_ORIGIN || request.url).origin,
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
  async function GET(request) {
    try {
      const config = receiverConfiguration(env);
      const local = developmentTransport(request,env);
      const publicOrigin = env.APP_ORIGIN || (local ? new URL(request.url).origin : "");
      let endpoint = null;
      try { endpoint = connectorEndpoint(publicOrigin, local); } catch { /* No public endpoint configured. */ }
      const capabilities = {
        enabled: config.enabled,
        endpoint,
        memberLoginConfigured: isLoginConfigured(),
        disabledReason: config.disabledReason,
        loopback: local,
        servers: config.servers,
        local: config.local && local,
        localFiles:
          config.enabled &&
          developmentTransport(request,env) &&
          Boolean(localFileDirectory(env)),
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
      const owner = await ownerFor(request, config);
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
      const store=getStore(config);
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
  async function POST(request) {
    try {
      const config = receiverConfiguration(env);
      fail(config.enabled, config.disabledReason || "BRIDGE_DISABLED", 503);
      const body = await readBody(request);
      const store = getStore(config);
      if (body.kind) {
        fail(
          new URL(env.APP_ORIGIN || request.url).protocol === "https:" ||
            (developmentTransport(request,env)),
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
        fail(allowLocalSession && config.local && developmentTransport(request,env), "FORBIDDEN", 403);
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
      const owner = await ownerFor(request, config);
      fail(owner, "SIGN_IN_REQUIRED", 401);
      if (body.action === "local-file") {
        fail(
          developmentTransport(request,env) && localFileDirectory(env),
          "FORBIDDEN",
          403,
        );
        const pairing = store.pair(owner, body.server, config);
        try {
          const result = await localFiles.start(
            owner,
            pairing,
            localFileDirectory(env),
          );
          return Response.json(result, { status: 201, headers });
        } catch (error) {
          store.revoke(owner);
          throw error;
        }
      }
      if (body.action === "pair") {
        fail(
          new URL(env.APP_ORIGIN || request.url).protocol === "https:" ||
            (developmentTransport(request,env)),
          "HTTPS_REQUIRED",
          403,
        );
        fail(Boolean(env.APP_ORIGIN) || (developmentTransport(request,env)), "PUBLIC_ORIGIN_REQUIRED", 503);
        connectorEndpoint(env.APP_ORIGIN || new URL(request.url).origin, developmentTransport(request,env));
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

  return {GET,POST};
}
