// Canonical status vocabulary for the five-market data contract.
// Keep this registry aligned with schemas/nugaom-market-data-envelope.v1.schema.json.

export const MARKET_IDS = Object.freeze(['thai', 'dr', 'us', 'tfex', 'forex']);

export const AVAILABILITY_STATES = Object.freeze(['AVAILABLE', 'PARTIAL', 'UNAVAILABLE']);
export const FRESHNESS_STATES = Object.freeze(['FRESH', 'STALE', 'UNKNOWN', 'NOT_APPLICABLE']);
export const USABILITY_STATES = Object.freeze([
  'SIGNAL_ELIGIBLE',
  'CHART_ONLY',
  'DISPLAY_ONLY',
  'BLOCKED',
]);
export const PROVIDER_STATES = Object.freeze([
  'READY',
  'DEGRADED',
  'UNAVAILABLE',
  'NOT_CONFIGURED',
  'UNKNOWN',
]);
export const RIGHTS_STATES = Object.freeze([
  'CONFIRMED',
  'UNCONFIRMED',
  'DENIED',
  'EXPIRED',
  'UNKNOWN',
]);
export const DATA_MODES = Object.freeze([
  'REALTIME_STREAM',
  'REALTIME_POLL',
  'DELAYED',
  'EOD',
  'HISTORICAL',
  'REFERENCE',
  'SYNTHETIC',
  'UNKNOWN',
]);

// These are stable API/domain codes. Do not put raw provider messages here.
export const STATUS_CODES = Object.freeze([
  'AVAILABLE',
  'PARTIAL',
  'STALE',
  'UNAVAILABLE',
  'CHART_ONLY',
  'DISPLAY_ONLY',
  'SIGNAL_ELIGIBLE',
  'BLOCKED',
  'DISPLAY_RIGHTS_NOT_CONFIRMED',
  'DISPLAY_RIGHTS_DENIED',
  'DISPLAY_RIGHTS_EXPIRED',
  'SOURCE_NOT_CONFIGURED',
  'SOURCE_UNAVAILABLE',
  'SOURCE_TIMEOUT',
  'SOURCE_RATE_LIMITED',
  'PROVIDER_DEGRADED',
  'UNKNOWN_FRESHNESS',
  'MISSING_SOURCE_TIMESTAMP',
  'INVALID_TIMESTAMP',
  'FUTURE_TIMESTAMP',
  'STALE_QUOTE',
  'STALE_BAR',
  'INCOMPLETE_BAR',
  'WRONG_SESSION',
  'INSUFFICIENT_HISTORY',
  'INVALID_OHLC',
  'DUPLICATE_DATA',
  'QUALITY_REJECTED',
  'NOT_MAPPED',
  'MISSING_UNDERLYING',
  'MISSING_FX',
  'AS_OF_NOT_ALIGNED',
  'CURRENCY_MISMATCH',
  'BROKER_PERMISSION_DENIED',
  'WARMUP_REQUIRED',
  'ENTITLEMENT_REQUIRED',
  'INVALID_MARKET',
  'INVALID_SYMBOL',
  'PARTIAL_DATA',
  'UNKNOWN',
]);

// User-approved full candidate-card caps. Guest preview is redacted, not a full card.
export const ENTITLEMENT_CAPS = Object.freeze({
  GUEST: Object.freeze({ maxFullCards: 0, redactedSampleLimit: 1 }),
  TRIAL: Object.freeze({ maxFullCards: 8, redactedSampleLimit: 0 }),
  STARTER: Object.freeze({ maxFullCards: 3, redactedSampleLimit: 0 }),
  PRO: Object.freeze({ maxFullCards: 5, redactedSampleLimit: 0 }),
  ULTIMATE: Object.freeze({ maxFullCards: 8, redactedSampleLimit: 0 }),
});

export const API_ERROR_CODES = Object.freeze([
  'INVALID_REQUEST',
  'INVALID_MARKET',
  'INVALID_SYMBOL',
  'INVALID_VIEW',
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'OWNER_ONLY',
  'MEMBERSHIP_REQUIRED',
  'INVALID_ORIGIN',
  'NOT_FOUND',
  'CONFLICT',
  'REPLAYED_REQUEST',
  'STALE_WRITE',
  'INVALID_DATA_REQUEST',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'DISPLAY_RIGHTS_NOT_CONFIRMED',
  'SOURCE_NOT_CONFIGURED',
  'INTERNAL_ERROR',
]);

export const API_ERROR_HTTP_STATUS = Object.freeze({
  INVALID_REQUEST: 400,
  INVALID_MARKET: 400,
  INVALID_SYMBOL: 400,
  INVALID_VIEW: 400,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  OWNER_ONLY: 403,
  MEMBERSHIP_REQUIRED: 403,
  INVALID_ORIGIN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  REPLAYED_REQUEST: 409,
  STALE_WRITE: 409,
  INVALID_DATA_REQUEST: 422,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  DISPLAY_RIGHTS_NOT_CONFIRMED: 503,
  SOURCE_NOT_CONFIGURED: 503,
  INTERNAL_ERROR: 500,
});

export const isLiveMode = mode => mode === 'REALTIME_STREAM' || mode === 'REALTIME_POLL';
