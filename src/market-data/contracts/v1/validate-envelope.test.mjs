import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  API_ERROR_CODES,
  API_ERROR_HTTP_STATUS,
  DATA_MODES,
  ENTITLEMENT_CAPS,
  MARKET_IDS,
  STATUS_CODES,
  isLiveMode,
} from './status-codes.mjs';
import { validateApiErrorEnvelope, validateEnvelopeInvariants } from './validate-envelope.mjs';

const NOW = '2026-10-26T12:00:02.000Z';
const STAMP = '2026-10-26T12:00:00.000Z';

function makeState(patch = {}) {
  return {
    availability: 'AVAILABLE',
    freshness: 'FRESH',
    usability: 'SIGNAL_ELIGIBLE',
    provider: 'READY',
    rights: 'CONFIRMED',
    codes: ['AVAILABLE', 'SIGNAL_ELIGIBLE'],
    ...patch,
  };
}

function makeRecord(market, index, { status = makeState(), source = {}, eligibility = {}, projection = 'FULL' } = {}) {
  const dataMode = source.dataMode ?? 'EOD';
  const rightsStatus = source.rightsStatus ?? status.rights;
  const base = {
    projection,
    status,
    timestamps: { dataAsOf: STAMP, observedAt: STAMP, receivedAt: STAMP, generatedAt: NOW },
    freshness: { state: status.freshness, basis: 'BAR_CLOSE_AT', ageSeconds: 2, maxAgeSeconds: 86400, evaluatedAt: NOW, policyId: `${market}-fixture-v1` },
    session: { state: 'CLOSED', closed: true, timezone: market === 'forex' ? 'UTC' : 'Asia/Bangkok', calendarId: market === 'forex' ? null : market.toUpperCase() },
    source: {
      providerId: 'fixture-source', type: 'LICENSED_VENDOR', dataMode,
      sourceTimestampKnown: true, isLiveFeed: false, rightsStatus, fallback: false,
      ...source,
    },
    eligibility: { chart: true, signal: true, performance: false, execution: false, ...eligibility },
    statusCodes: ['AVAILABLE'],
    data: { fixtureOnly: true },
  };

  if (projection === 'REDACTED') {
    return {
      ...base,
      status: { ...status, usability: 'DISPLAY_ONLY', codes: ['AVAILABLE', 'DISPLAY_ONLY'] },
      instrument: { symbol: `SAMPLE${index}`, market },
      source: {
        providerId: 'fixture-source', type: 'LICENSED_VENDOR', dataMode: 'EOD',
        sourceTimestampKnown: true, isLiveFeed: false, rightsStatus: 'CONFIRMED', fallback: false,
      },
      eligibility: { chart: false, signal: false, performance: false, execution: false },
      statusCodes: ['AVAILABLE', 'DISPLAY_ONLY'],
      data: { name: 'Fixture sample', changePct: null },
    };
  }

  return {
    ...base,
    instrument: {
      instrumentId: `FIXTURE:${market}:${index}`,
      symbol: `FIX${index}`,
      market,
      assetType: market === 'dr' ? 'DR' : market === 'us' ? 'EQUITY' : market === 'tfex' ? 'FUTURE' : market === 'forex' ? 'FX_PAIR' : 'EQUITY',
      displayName: 'Test Fixture',
      currency: market === 'forex' ? 'USD' : 'THB',
      exchange: null,
      underlying: null,
    },
    dataKind: 'TEST_FIXTURE',
  };
}

function makeEnvelope({ market = 'dr', tier = 'TRIAL', fullCount = 1, redactedCount = 0, records, status, disclosureScope = 'ENTITLED_PROJECTION' } = {}) {
  const caps = ENTITLEMENT_CAPS[tier];
  const rows = records ?? [
    ...Array.from({ length: fullCount }, (_, index) => makeRecord(market, index + 1)),
    ...Array.from({ length: redactedCount }, (_, index) => makeRecord(market, index + 1, { projection: 'REDACTED' })),
  ];
  const fullCards = rows.filter(row => row.projection === 'FULL').length;
  const redactedSamples = rows.filter(row => row.projection === 'REDACTED').length;
  const rootState = status ?? makeState({
    availability: rows.length ? 'AVAILABLE' : 'UNAVAILABLE',
    usability: rows.length ? (tier === 'GUEST' ? 'DISPLAY_ONLY' : 'SIGNAL_ELIGIBLE') : 'BLOCKED',
    provider: rows.length ? 'READY' : 'NOT_CONFIGURED',
    freshness: rows.length ? 'FRESH' : 'UNKNOWN',
    codes: rows.length ? (tier === 'GUEST' ? ['AVAILABLE', 'DISPLAY_ONLY'] : ['AVAILABLE', 'SIGNAL_ELIGIBLE']) : ['UNAVAILABLE', 'BLOCKED', 'UNKNOWN_FRESHNESS'],
  });

  return {
    schemaVersion: 'nugaom.market-data.v1',
    requestId: 'req_fixture_001',
    snapshotId: 'snap_fixture_001',
    market,
    selectedScope: { market, kind: 'MARKET_SCAN', scanId: 'scan_fixture_001' },
    status: rootState,
    timestamps: { dataAsOf: rows.length ? STAMP : null, observedAt: rows.length ? STAMP : null, receivedAt: rows.length ? STAMP : null, generatedAt: NOW },
    freshness: { state: rootState.freshness, basis: rows.length ? 'BAR_CLOSE_AT' : 'UNKNOWN', ageSeconds: rows.length ? 2 : null, maxAgeSeconds: rows.length ? 86400 : null, evaluatedAt: NOW, policyId: `${market}-fixture-v1` },
    session: { state: 'CLOSED', closed: true, timezone: market === 'forex' ? 'UTC' : 'Asia/Bangkok', calendarId: market === 'forex' ? null : market.toUpperCase() },
    providers: rows.length ? [{ id: 'fixture-source', type: 'LICENSED_VENDOR', status: 'READY', rightsStatus: 'CONFIRMED', dataMode: 'EOD' }] : [],
    coverage: {
      disclosureScope,
      catalogTotal: null,
      computedTotal: rows.length,
      availableTotal: rows.length,
      visibleTotal: rows.length,
      staleTotal: 0,
      unavailableTotal: 0,
      chartOnlyTotal: 0,
      visibleFullCards: fullCards,
      visibleRedactedSamples: redactedSamples,
    },
    entitlement: {
      tier,
      selectedMarket: market,
      maxFullCards: caps.maxFullCards,
      fullCardsReturned: fullCards,
      redactedSampleLimit: caps.redactedSampleLimit,
      redactedSamplesReturned: redactedSamples,
      resolvedServerSide: true,
    },
    records: rows,
  };
}

const isValid = envelope => validateEnvelopeInvariants(envelope).valid;

test('validates a safe EOD research record without claiming a live feed', () => {
  const result = validateEnvelopeInvariants(makeEnvelope());
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('valid no-data state is explicit and contains no records or provider values', () => {
  const result = validateEnvelopeInvariants(makeEnvelope({ tier: 'GUEST', fullCount: 0, redactedCount: 0 }));
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('accepts one redacted Guest sample and rejects full Guest cards', () => {
  const guest = makeEnvelope({ tier: 'GUEST', fullCount: 0, redactedCount: 1 });
  assert.equal(isValid(guest), true);

  const badGuest = makeEnvelope({ tier: 'GUEST', fullCount: 1, redactedCount: 0 });
  assert.equal(isValid(badGuest), false);
  assert.ok(validateEnvelopeInvariants(badGuest).errors.some(error => error.code === 'GUEST_PROJECTION_INVALID'));
});

test('enforces the exact approved card caps for Trial and all paid tiers', () => {
  for (const [tier, cap] of Object.entries({ TRIAL: 8, STARTER: 3, PRO: 5, ULTIMATE: 8 })) {
    const envelope = makeEnvelope({ tier, fullCount: cap });
    assert.equal(isValid(envelope), true, `${tier} cap ${cap} should validate`);
  }
  const overCap = makeEnvelope({ tier: 'STARTER', fullCount: 4 });
  assert.ok(validateEnvelopeInvariants(overCap).errors.some(error => error.code === 'FULL_CARD_CAP_EXCEEDED'));
  const wrongCap = makeEnvelope({ tier: 'PRO', fullCount: 1 });
  wrongCap.entitlement.maxFullCards = 8;
  assert.ok(validateEnvelopeInvariants(wrongCap).errors.some(error => error.code === 'TIER_CAP_MISMATCH'));
});

test('applies the same envelope contract to each supported market id', () => {
  for (const market of MARKET_IDS) {
    const result = validateEnvelopeInvariants(makeEnvelope({ market }));
    assert.deepEqual(result, { valid: true, errors: [] }, `${market} should validate`);
  }
});

test('stale records cannot be signal-eligible or performance-eligible', () => {
  const staleState = makeState({ freshness: 'STALE', usability: 'CHART_ONLY', codes: ['STALE', 'CHART_ONLY'] });
  const staleRecord = makeRecord('dr', 1, {
    status: staleState,
    eligibility: { chart: true, signal: false, performance: false },
  });
  const envelope = makeEnvelope({ records: [staleRecord], status: makeState({ freshness: 'STALE', usability: 'CHART_ONLY', codes: ['STALE', 'CHART_ONLY'] }) });
  envelope.freshness = { state: 'STALE', basis: 'BAR_CLOSE_AT', ageSeconds: 86401, maxAgeSeconds: 86400, evaluatedAt: NOW, policyId: 'dr-fixture-v1' };
  envelope.coverage.staleTotal = 1;
  envelope.coverage.chartOnlyTotal = 1;
  assert.equal(isValid(envelope), true);

  const invalid = structuredClone(envelope);
  invalid.records[0].eligibility.signal = true;
  assert.ok(validateEnvelopeInvariants(invalid).errors.some(error => error.code === 'STALE_DATA_CANNOT_SIGNAL'));
});

test('performance eligibility requires verified closed-trade evidence, not a price-change proxy', () => {
  const envelope = makeEnvelope();
  envelope.records[0].eligibility.performance = true;
  envelope.records[0].data = { changePct: 1.2 };
  assert.ok(validateEnvelopeInvariants(envelope).errors.some(error => error.code === 'VERIFIED_CLOSED_TRADE_EVIDENCE_REQUIRED'));

  envelope.records[0].data.performanceEvidence = {
    closed: true,
    sampleSize: 24,
    windowStart: '2026-09-01T00:00:00.000Z',
    windowEnd: NOW,
    tradeSemantics: 'closed-trade-fixture',
    methodologyId: 'fixture-method-v1',
    sourceId: 'fixture-ledger',
  };
  assert.equal(isValid(envelope), true);
});

test('EOD, reference, and fallback records cannot claim isLiveFeed', () => {
  const eodLive = makeEnvelope();
  eodLive.records[0].source.isLiveFeed = true;
  assert.ok(validateEnvelopeInvariants(eodLive).errors.some(error => error.code === 'NON_REALTIME_MODE_CANNOT_BE_LIVE'));

  const fallbackLive = makeEnvelope();
  fallbackLive.records[0].source.dataMode = 'REALTIME_POLL';
  fallbackLive.records[0].source.isLiveFeed = true;
  fallbackLive.records[0].source.fallback = true;
  assert.ok(validateEnvelopeInvariants(fallbackLive).errors.some(error => error.code === 'LIVE_FALLBACK_FORBIDDEN'));
});

test('unconfirmed rights cannot return value-bearing customer data', () => {
  const envelope = makeEnvelope();
  envelope.records[0].status.rights = 'UNCONFIRMED';
  envelope.records[0].status.usability = 'BLOCKED';
  envelope.records[0].source.rightsStatus = 'UNCONFIRMED';
  assert.ok(validateEnvelopeInvariants(envelope).errors.some(error => error.code === 'UNCONFIRMED_RIGHTS_VALUE_LEAK'));
});

test('customer responses cannot disclose owner-internal coverage', () => {
  const envelope = makeEnvelope({ disclosureScope: 'OWNER_INTERNAL' });
  assert.ok(validateEnvelopeInvariants(envelope).errors.some(error => error.code === 'OWNER_INTERNAL_SCOPE_NOT_PUBLIC'));
});

test('validates sanitized API errors separately from data unavailability', () => {
  const body = {
    schemaVersion: 'nugaom.api-error.v1',
    requestId: 'req_error_001',
    generatedAt: NOW,
    error: { code: 'DISPLAY_RIGHTS_NOT_CONFIRMED', messageKey: 'market_data.unavailable', retryable: false },
  };
  assert.deepEqual(validateApiErrorEnvelope(body), { valid: true, errors: [] });
  assert.equal(API_ERROR_HTTP_STATUS[body.error.code], 503);

  const unsafe = structuredClone(body);
  unsafe.error.rawProviderResponse = 'must-not-be-returned';
  assert.ok(validateApiErrorEnvelope(unsafe).errors.some(error => error.code === 'ERROR_DETAIL_FORBIDDEN'));
});

test('status and error registries stay aligned with the JSON Schema enums', () => {
  const schema = JSON.parse(readFileSync(new URL('../../../../schemas/nugaom-market-data-envelope.v1.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.$defs.dataState.properties.codes.items.enum, [...STATUS_CODES]);
  assert.deepEqual(schema.$defs.marketDataMode.enum, [...DATA_MODES]);
  assert.deepEqual(schema.$defs.market.enum, [...MARKET_IDS]);
  assert.deepEqual(schema.$defs.apiError.properties.error.properties.code.enum, [...API_ERROR_CODES]);
  for (const code of API_ERROR_CODES) assert.ok(Number.isInteger(API_ERROR_HTTP_STATUS[code]), `missing HTTP status for ${code}`);
  assert.equal(isLiveMode('REALTIME_STREAM'), true);
  assert.equal(isLiveMode('EOD'), false);
});
