import {
  API_ERROR_CODES,
  AVAILABILITY_STATES,
  DATA_MODES,
  ENTITLEMENT_CAPS,
  FRESHNESS_STATES,
  MARKET_IDS,
  PROVIDER_STATES,
  RIGHTS_STATES,
  STATUS_CODES,
  USABILITY_STATES,
  isLiveMode,
} from './status-codes.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);
const isIntegerAtLeastZero = value => Number.isInteger(value) && value >= 0;
const isIsoDateTime = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));

function add(errors, path, code) {
  errors.push({ path, code });
}

function checkEnum(value, allowed, path, errors, code = 'INVALID_ENUM') {
  if (!allowed.includes(value)) add(errors, path, code);
}

function checkNullableDate(value, path, errors) {
  if (value !== null && !isIsoDateTime(value)) add(errors, path, 'INVALID_TIMESTAMP');
}

function checkTimestampSet(timestamps, path, errors) {
  if (!isObject(timestamps)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return;
  }
  for (const key of ['dataAsOf', 'observedAt', 'receivedAt']) {
    if (!hasOwn(timestamps, key)) add(errors, `${path}.${key}`, 'REQUIRED_FIELD');
    else checkNullableDate(timestamps[key], `${path}.${key}`, errors);
  }
  if (!isIsoDateTime(timestamps.generatedAt)) add(errors, `${path}.generatedAt`, 'INVALID_TIMESTAMP');
}

function checkFreshness(freshness, path, errors) {
  if (!isObject(freshness)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return;
  }
  checkEnum(freshness.state, FRESHNESS_STATES, `${path}.state`, errors);
  checkEnum(freshness.basis, ['DATA_AS_OF', 'OBSERVED_AT', 'BAR_CLOSE_AT', 'HEARTBEAT_AT', 'UNKNOWN'], `${path}.basis`, errors);
  if (freshness.ageSeconds !== null && !isIntegerAtLeastZero(freshness.ageSeconds)) add(errors, `${path}.ageSeconds`, 'INVALID_AGE');
  if (freshness.maxAgeSeconds !== null && !isIntegerAtLeastZero(freshness.maxAgeSeconds)) add(errors, `${path}.maxAgeSeconds`, 'INVALID_MAX_AGE');
  if (!isIsoDateTime(freshness.evaluatedAt)) add(errors, `${path}.evaluatedAt`, 'INVALID_TIMESTAMP');
  if (freshness.policyId !== null && (typeof freshness.policyId !== 'string' || freshness.policyId.length === 0)) add(errors, `${path}.policyId`, 'INVALID_POLICY_ID');
}

function checkSession(session, path, errors) {
  if (!isObject(session)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return;
  }
  checkEnum(session.state, ['OPEN', 'PRE_OPEN', 'POST_CLOSE', 'CLOSED', 'HALTED', 'UNKNOWN', 'NOT_APPLICABLE'], `${path}.state`, errors);
  if (session.closed !== null && typeof session.closed !== 'boolean') add(errors, `${path}.closed`, 'INVALID_SESSION_CLOSED');
  if (session.timezone !== null && typeof session.timezone !== 'string') add(errors, `${path}.timezone`, 'INVALID_TIMEZONE');
  if (session.calendarId !== null && typeof session.calendarId !== 'string') add(errors, `${path}.calendarId`, 'INVALID_CALENDAR_ID');
}

function checkDataState(state, path, errors) {
  if (!isObject(state)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return;
  }
  checkEnum(state.availability, AVAILABILITY_STATES, `${path}.availability`, errors);
  checkEnum(state.freshness, FRESHNESS_STATES, `${path}.freshness`, errors);
  checkEnum(state.usability, USABILITY_STATES, `${path}.usability`, errors);
  checkEnum(state.provider, PROVIDER_STATES, `${path}.provider`, errors);
  checkEnum(state.rights, RIGHTS_STATES, `${path}.rights`, errors);
  if (!Array.isArray(state.codes)) add(errors, `${path}.codes`, 'REQUIRED_ARRAY');
  else {
    if (new Set(state.codes).size !== state.codes.length) add(errors, `${path}.codes`, 'DUPLICATE_STATUS_CODE');
    state.codes.forEach((code, index) => checkEnum(code, STATUS_CODES, `${path}.codes[${index}]`, errors));
    for (const key of ['availability', 'freshness', 'usability']) {
      const value = state[key];
      if (['PARTIAL', 'STALE', 'UNAVAILABLE', 'CHART_ONLY', 'DISPLAY_ONLY', 'SIGNAL_ELIGIBLE', 'BLOCKED'].includes(value)
        && !state.codes.includes(value)) {
        add(errors, `${path}.codes`, 'PRIMARY_STATE_CODE_MISSING');
      }
    }
  }
}

function checkSource(source, path, state, timestamps, errors) {
  if (!isObject(source)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return;
  }
  if (typeof source.providerId !== 'string' || !source.providerId) add(errors, `${path}.providerId`, 'INVALID_PROVIDER_ID');
  checkEnum(source.type, ['EXCHANGE', 'LICENSED_VENDOR', 'BROKER_API', 'REFERENCE', 'INTERNAL_INGEST', 'CACHE', 'UNKNOWN'], `${path}.type`, errors);
  checkEnum(source.dataMode, DATA_MODES, `${path}.dataMode`, errors);
  checkEnum(source.rightsStatus, RIGHTS_STATES, `${path}.rightsStatus`, errors);
  if (typeof source.sourceTimestampKnown !== 'boolean') add(errors, `${path}.sourceTimestampKnown`, 'INVALID_BOOLEAN');
  if (source.sourceTimestampKnown === true && timestamps?.observedAt == null) add(errors, `${path}.sourceTimestampKnown`, 'SOURCE_TIMESTAMP_MISSING');
  if (typeof source.isLiveFeed !== 'boolean') add(errors, `${path}.isLiveFeed`, 'INVALID_BOOLEAN');
  if (source.fallback !== undefined && typeof source.fallback !== 'boolean') add(errors, `${path}.fallback`, 'INVALID_BOOLEAN');

  if (source.isLiveFeed === true) {
    if (!isLiveMode(source.dataMode)) add(errors, `${path}.dataMode`, 'LIVE_MODE_REQUIRED');
    if (source.sourceTimestampKnown !== true) add(errors, `${path}.sourceTimestampKnown`, 'LIVE_TIMESTAMP_REQUIRED');
    if (source.rightsStatus !== 'CONFIRMED') add(errors, `${path}.rightsStatus`, 'LIVE_RIGHTS_REQUIRED');
    if (source.fallback === true) add(errors, `${path}.fallback`, 'LIVE_FALLBACK_FORBIDDEN');
  }
  if (['DELAYED', 'EOD', 'HISTORICAL', 'REFERENCE', 'SYNTHETIC', 'UNKNOWN'].includes(source.dataMode) && source.isLiveFeed === true) {
    add(errors, `${path}.isLiveFeed`, 'NON_REALTIME_MODE_CANNOT_BE_LIVE');
  }
  if (source.fallback === true && source.isLiveFeed === true) add(errors, `${path}.isLiveFeed`, 'FALLBACK_CANNOT_BE_LIVE');
  if (state && state.rights !== source.rightsStatus) add(errors, `${path}.rightsStatus`, 'RIGHTS_STATE_MISMATCH');
}

function checkEligibility(eligibility, path, status, errors) {
  if (!isObject(eligibility)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return;
  }
  for (const key of ['chart', 'signal', 'performance', 'execution']) {
    if (typeof eligibility[key] !== 'boolean') add(errors, `${path}.${key}`, 'INVALID_BOOLEAN');
  }
  if (eligibility.execution !== false) add(errors, `${path}.execution`, 'CUSTOMER_EXECUTION_FORBIDDEN');
  if (eligibility.signal === true) {
    if (status?.usability !== 'SIGNAL_ELIGIBLE') add(errors, `${path}.signal`, 'SIGNAL_STATE_MISMATCH');
    if (status?.freshness !== 'FRESH') add(errors, `${path}.signal`, 'NON_FRESH_DATA_CANNOT_SIGNAL');
    if (status?.rights !== 'CONFIRMED') add(errors, `${path}.signal`, 'UNCONFIRMED_RIGHTS_CANNOT_SIGNAL');
    if (status?.availability !== 'AVAILABLE') add(errors, `${path}.signal`, 'NON_AVAILABLE_DATA_CANNOT_SIGNAL');
  }
  if (['STALE', 'UNKNOWN'].includes(status?.freshness)) {
    if (eligibility.signal !== false) add(errors, `${path}.signal`, 'STALE_DATA_CANNOT_SIGNAL');
    if (eligibility.performance !== false) add(errors, `${path}.performance`, 'UNVERIFIED_DATA_CANNOT_PERFORM');
  }
  if (status?.usability === 'CHART_ONLY' || status?.usability === 'DISPLAY_ONLY') {
    if (eligibility.signal !== false) add(errors, `${path}.signal`, 'NON_SIGNAL_MODE_CANNOT_SIGNAL');
    if (eligibility.performance !== false) add(errors, `${path}.performance`, 'NON_SIGNAL_MODE_CANNOT_PERFORM');
  }
  if (status?.usability === 'BLOCKED') {
    for (const key of ['chart', 'signal', 'performance']) {
      if (eligibility[key] !== false) add(errors, `${path}.${key}`, 'BLOCKED_DATA_CANNOT_BE_USED');
    }
  }
}

function checkRecord(record, index, envelopeMarket, audience, errors) {
  const path = `records[${index}]`;
  if (!isObject(record)) {
    add(errors, path, 'REQUIRED_OBJECT');
    return { full: false, redacted: false };
  }
  const projection = record.projection;
  if (!['FULL', 'REDACTED'].includes(projection)) add(errors, `${path}.projection`, 'INVALID_PROJECTION');

  if (!isObject(record.instrument)) add(errors, `${path}.instrument`, 'REQUIRED_OBJECT');
  else {
    if (record.instrument.market !== envelopeMarket) add(errors, `${path}.instrument.market`, 'CROSS_MARKET_RECORD_FORBIDDEN');
    if (typeof record.instrument.symbol !== 'string' || !record.instrument.symbol) add(errors, `${path}.instrument.symbol`, 'INVALID_SYMBOL');
    if (projection === 'FULL' && (typeof record.instrument.instrumentId !== 'string' || !record.instrument.instrumentId)) add(errors, `${path}.instrument.instrumentId`, 'INVALID_INSTRUMENT_ID');
  }

  checkDataState(record.status, `${path}.status`, errors);
  checkTimestampSet(record.timestamps, `${path}.timestamps`, errors);
  checkFreshness(record.freshness, `${path}.freshness`, errors);
  checkSession(record.session, `${path}.session`, errors);
  checkSource(record.source, `${path}.source`, record.status, record.timestamps, errors);
  checkEligibility(record.eligibility, `${path}.eligibility`, record.status, errors);

  if (record.status?.freshness !== record.freshness?.state) add(errors, `${path}.freshness.state`, 'FRESHNESS_STATE_MISMATCH');
  if (!Array.isArray(record.statusCodes)) add(errors, `${path}.statusCodes`, 'REQUIRED_ARRAY');
  else record.statusCodes.forEach((code, codeIndex) => checkEnum(code, STATUS_CODES, `${path}.statusCodes[${codeIndex}]`, errors));
  if (!isObject(record.data)) add(errors, `${path}.data`, 'REQUIRED_OBJECT');

  if (record.eligibility?.performance === true) {
    const evidence = record.data?.performanceEvidence;
    const completeEvidence = isObject(evidence)
      && evidence.closed === true
      && isIntegerAtLeastZero(evidence.sampleSize)
      && evidence.sampleSize > 0
      && typeof evidence.windowStart === 'string'
      && isIsoDateTime(evidence.windowStart)
      && typeof evidence.windowEnd === 'string'
      && isIsoDateTime(evidence.windowEnd)
      && typeof evidence.tradeSemantics === 'string'
      && evidence.tradeSemantics.length > 0
      && typeof evidence.methodologyId === 'string'
      && evidence.methodologyId.length > 0
      && typeof evidence.sourceId === 'string'
      && evidence.sourceId.length > 0;
    if (!completeEvidence) add(errors, `${path}.data.performanceEvidence`, 'VERIFIED_CLOSED_TRADE_EVIDENCE_REQUIRED');
  }

  const rightsAllowValues = record.status?.rights === 'CONFIRMED' && record.source?.rightsStatus === 'CONFIRMED';
  if (!rightsAllowValues && isObject(record.data) && Object.keys(record.data).length > 0) {
    add(errors, `${path}.data`, 'UNCONFIRMED_RIGHTS_VALUE_LEAK');
  }
  if (record.status?.usability === 'BLOCKED' && isObject(record.data) && Object.keys(record.data).length > 0) {
    add(errors, `${path}.data`, 'BLOCKED_VALUE_LEAK');
  }
  if (record.status?.availability === 'UNAVAILABLE' && isObject(record.data) && Object.keys(record.data).length > 0) {
    add(errors, `${path}.data`, 'UNAVAILABLE_VALUE_LEAK');
  }
  if (record.source?.fallback === true && record.eligibility?.signal === true) {
    add(errors, `${path}.eligibility.signal`, 'FALLBACK_CANNOT_SIGNAL');
  }

  if (projection === 'REDACTED') {
    if (record.eligibility?.chart !== false || record.eligibility?.signal !== false || record.eligibility?.performance !== false) {
      add(errors, `${path}.eligibility`, 'REDACTED_RECORD_NOT_USABLE');
    }
    const allowedDataKeys = new Set(['name', 'changePct']);
    if (isObject(record.data)) {
      for (const key of Object.keys(record.data)) {
        if (!allowedDataKeys.has(key)) add(errors, `${path}.data`, 'REDACTED_FIELD_FORBIDDEN');
      }
    }
  }
  if (audience === 'customer' && record.status?.rights !== 'CONFIRMED' && record.status?.usability !== 'BLOCKED') {
    add(errors, `${path}.status.usability`, 'RIGHTS_NOT_CONFIRMED_MUST_BLOCK');
  }

  return { full: projection === 'FULL', redacted: projection === 'REDACTED' };
}

/**
 * Checks semantic invariants only; the JSON Schema remains authoritative for
 * the complete object shape. Returns safe path/code diagnostics, never values.
 */
export function validateEnvelopeInvariants(envelope, { audience = 'customer' } = {}) {
  const errors = [];
  if (!isObject(envelope)) return { valid: false, errors: [{ path: '$', code: 'REQUIRED_OBJECT' }] };
  if (envelope.schemaVersion !== 'nugaom.market-data.v1') add(errors, 'schemaVersion', 'UNSUPPORTED_SCHEMA_VERSION');
  if (typeof envelope.requestId !== 'string' || !envelope.requestId) add(errors, 'requestId', 'REQUIRED_FIELD');
  if (envelope.snapshotId !== null && (typeof envelope.snapshotId !== 'string' || !envelope.snapshotId)) add(errors, 'snapshotId', 'INVALID_SNAPSHOT_ID');
  checkEnum(envelope.market, MARKET_IDS, 'market', errors);
  if (!isObject(envelope.selectedScope)) add(errors, 'selectedScope', 'REQUIRED_OBJECT');
  else {
    if (envelope.selectedScope.market !== envelope.market) add(errors, 'selectedScope.market', 'SELECTED_MARKET_MISMATCH');
    checkEnum(envelope.selectedScope.kind, ['MARKET_SCAN', 'SYMBOL_LOOKUP', 'CHART', 'REFERENCE'], 'selectedScope.kind', errors);
  }

  checkDataState(envelope.status, 'status', errors);
  checkTimestampSet(envelope.timestamps, 'timestamps', errors);
  checkFreshness(envelope.freshness, 'freshness', errors);
  checkSession(envelope.session, 'session', errors);
  if (envelope.status?.freshness !== envelope.freshness?.state) add(errors, 'freshness.state', 'FRESHNESS_STATE_MISMATCH');

  if (!Array.isArray(envelope.providers)) add(errors, 'providers', 'REQUIRED_ARRAY');
  else {
    for (const [index, provider] of envelope.providers.entries()) {
      const path = `providers[${index}]`;
      if (!isObject(provider)) { add(errors, path, 'REQUIRED_OBJECT'); continue; }
      if (typeof provider.id !== 'string' || !provider.id) add(errors, `${path}.id`, 'INVALID_PROVIDER_ID');
      checkEnum(provider.type, ['EXCHANGE', 'LICENSED_VENDOR', 'BROKER_API', 'REFERENCE', 'INTERNAL_INGEST', 'CACHE', 'UNKNOWN'], `${path}.type`, errors);
      checkEnum(provider.status, PROVIDER_STATES, `${path}.status`, errors);
      checkEnum(provider.rightsStatus, RIGHTS_STATES, `${path}.rightsStatus`, errors);
      checkEnum(provider.dataMode, DATA_MODES, `${path}.dataMode`, errors);
    }
  }

  const coverage = envelope.coverage;
  if (!isObject(coverage)) add(errors, 'coverage', 'REQUIRED_OBJECT');
  else {
    checkEnum(coverage.disclosureScope, ['PUBLIC_CATALOG', 'ENTITLED_PROJECTION', 'OWNER_INTERNAL'], 'coverage.disclosureScope', errors);
    if (audience === 'customer' && coverage.disclosureScope === 'OWNER_INTERNAL') add(errors, 'coverage.disclosureScope', 'OWNER_INTERNAL_SCOPE_NOT_PUBLIC');
    for (const key of ['catalogTotal', 'computedTotal', 'availableTotal', 'staleTotal', 'unavailableTotal', 'chartOnlyTotal']) {
      if (coverage[key] !== null && !isIntegerAtLeastZero(coverage[key])) add(errors, `coverage.${key}`, 'INVALID_COUNT');
    }
    for (const key of ['visibleTotal', 'visibleFullCards', 'visibleRedactedSamples']) {
      if (!isIntegerAtLeastZero(coverage[key])) add(errors, `coverage.${key}`, 'INVALID_COUNT');
    }
  }

  const access = envelope.entitlement;
  if (!isObject(access)) add(errors, 'entitlement', 'REQUIRED_OBJECT');
  else {
    const cap = ENTITLEMENT_CAPS[access.tier];
    if (!cap) add(errors, 'entitlement.tier', 'INVALID_TIER');
    else {
      if (access.maxFullCards !== cap.maxFullCards) add(errors, 'entitlement.maxFullCards', 'TIER_CAP_MISMATCH');
      if (access.redactedSampleLimit !== cap.redactedSampleLimit) add(errors, 'entitlement.redactedSampleLimit', 'TIER_PREVIEW_CAP_MISMATCH');
    }
    if (access.selectedMarket !== envelope.market) add(errors, 'entitlement.selectedMarket', 'SELECTED_MARKET_MISMATCH');
    if (access.resolvedServerSide !== true) add(errors, 'entitlement.resolvedServerSide', 'SERVER_ENTITLEMENT_REQUIRED');
    for (const key of ['maxFullCards', 'fullCardsReturned', 'redactedSampleLimit', 'redactedSamplesReturned']) {
      if (!isIntegerAtLeastZero(access[key])) add(errors, `entitlement.${key}`, 'INVALID_COUNT');
    }
    if (isIntegerAtLeastZero(access.fullCardsReturned) && isIntegerAtLeastZero(access.maxFullCards) && access.fullCardsReturned > access.maxFullCards) {
      add(errors, 'entitlement.fullCardsReturned', 'FULL_CARD_CAP_EXCEEDED');
    }
    if (isIntegerAtLeastZero(access.redactedSamplesReturned) && isIntegerAtLeastZero(access.redactedSampleLimit) && access.redactedSamplesReturned > access.redactedSampleLimit) {
      add(errors, 'entitlement.redactedSamplesReturned', 'REDACTED_SAMPLE_CAP_EXCEEDED');
    }
  }

  if (!Array.isArray(envelope.records)) add(errors, 'records', 'REQUIRED_ARRAY');
  else {
    if (envelope.records.length > 8) add(errors, 'records', 'MAX_RECORDS_EXCEEDED');
    const counts = envelope.records.map((record, index) => checkRecord(record, index, envelope.market, audience, errors));
    const full = counts.filter(count => count.full).length;
    const redacted = counts.filter(count => count.redacted).length;
    if (coverage?.visibleTotal !== envelope.records.length) add(errors, 'coverage.visibleTotal', 'VISIBLE_COUNT_MISMATCH');
    if (coverage?.visibleFullCards !== full) add(errors, 'coverage.visibleFullCards', 'FULL_CARD_COUNT_MISMATCH');
    if (coverage?.visibleRedactedSamples !== redacted) add(errors, 'coverage.visibleRedactedSamples', 'REDACTED_COUNT_MISMATCH');
    if (access?.fullCardsReturned !== full) add(errors, 'entitlement.fullCardsReturned', 'FULL_CARD_COUNT_MISMATCH');
    if (access?.redactedSamplesReturned !== redacted) add(errors, 'entitlement.redactedSamplesReturned', 'REDACTED_COUNT_MISMATCH');
    if (access?.tier === 'GUEST' && (full !== 0 || redacted > 1 || counts.some(count => !count.redacted))) {
      add(errors, 'records', 'GUEST_PROJECTION_INVALID');
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validates the sanitized HTTP error body, separate from data availability. */
export function validateApiErrorEnvelope(body) {
  const errors = [];
  if (!isObject(body)) return { valid: false, errors: [{ path: '$', code: 'REQUIRED_OBJECT' }] };
  if (body.schemaVersion !== 'nugaom.api-error.v1') add(errors, 'schemaVersion', 'UNSUPPORTED_SCHEMA_VERSION');
  if (typeof body.requestId !== 'string' || !body.requestId) add(errors, 'requestId', 'REQUIRED_FIELD');
  if (!isIsoDateTime(body.generatedAt)) add(errors, 'generatedAt', 'INVALID_TIMESTAMP');
  if (!isObject(body.error)) add(errors, 'error', 'REQUIRED_OBJECT');
  else {
    checkEnum(body.error.code, API_ERROR_CODES, 'error.code', errors);
    if (typeof body.error.messageKey !== 'string' || !body.error.messageKey) add(errors, 'error.messageKey', 'REQUIRED_FIELD');
    if (typeof body.error.retryable !== 'boolean') add(errors, 'error.retryable', 'INVALID_BOOLEAN');
    for (const key of Object.keys(body.error)) {
      if (!['code', 'messageKey', 'retryable'].includes(key)) add(errors, 'error', 'ERROR_DETAIL_FORBIDDEN');
    }
  }
  for (const key of Object.keys(body)) {
    if (!['schemaVersion', 'requestId', 'generatedAt', 'error'].includes(key)) add(errors, '$', 'ERROR_DETAIL_FORBIDDEN');
  }
  return { valid: errors.length === 0, errors };
}
