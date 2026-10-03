import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && Date.parse(value) <= Date.now() + 60_000 ? value : null;

// Reads local diagnostic evidence only. This never starts MQTT or creates an auth request.
// Keep it behind the existing admin check; don't expose credentials or request bodies.
export async function webullSdkHealth() {
  const region = process.env.WEBULL_REGION_ID || 'us';
  const environment = process.env.WEBULL_ENVIRONMENT || 'sandbox';
  const configured = Boolean(process.env.WEBULL_APP_KEY?.trim() && process.env.WEBULL_APP_SECRET?.trim());
  const scope = createHash('sha256').update(JSON.stringify([
    process.env.WEBULL_APP_KEY || '', process.env.WEBULL_APP_SECRET || '', region, environment,
  ])).digest('hex');
  const base = { region, environment, configured, signalEligible: false };
  if (!configured) return { ...base, status: 'not-configured' };
  if (!['us', 'th'].includes(region) || !['prod', 'sandbox'].includes(environment)) return { ...base, status: 'invalid-config' };
  async function evidence(mode, targetEnvironment = environment, name = mode) {
    try {
      const path = resolve(`data/webull/reports/${name}.json`);
      if ((await stat(path)).size > 64_000) return null;
      const data = JSON.parse(await readFile(path, 'utf8'));
      const targetScope = targetEnvironment === environment ? scope : createHash('sha256').update(JSON.stringify([
        process.env.WEBULL_APP_KEY || '', process.env.WEBULL_APP_SECRET || '', region, targetEnvironment,
      ])).digest('hex');
      if (data.credentialScope !== targetScope || data.mode !== mode || !timestamp(data.checkedAt) || !Array.isArray(data.records)) return null;
      const config = data.records.find(row => row.stage === 'config' && row.region === region && row.environment === targetEnvironment);
      if (!config) return null;
      return data;
    } catch { return null; }
  }
  const [http, mqtt, prod] = await Promise.all([evidence('probe'), evidence('stream'), evidence('probe', 'prod', `probe-${region}-prod`)]);
  const prodConfig = prod?.records.find(row => row.stage === 'config');
  const production = { checkedAt: prod?.checkedAt ?? null,
    status: !prod ? 'not-checked' : prod.success ? 'data-verified' : prodConfig?.httpStatus === 401 ? 'unauthorized'
      : prodConfig?.twoFactorRequired ? 'approval-required' : 'unavailable',
    httpStatus: prodConfig?.httpStatus ?? null };
  const snapshot = http?.records.find(row => row.stage === 'snapshot' && row.status === 'available' && row.environment === environment);
  const bars = http?.records.find(row => row.stage === 'bars' && row.status === 'available' && row.environment === environment);
  const stream = mqtt?.records.find(row => row.stage === 'stream-summary' && row.environment === environment && row.region === region);
  const httpOk = http?.success === true && positive(snapshot?.price) && positive(bars?.closedValidBars);
  const streamOk = mqtt?.success === true && stream?.status === 'available' && positive(stream.pricedMessages);
  const status = httpOk && streamOk ? 'verified' : httpOk || streamOk ? 'partial' : http || mqtt ? 'failed' : 'not-checked';
  return { ...base, status, production,
    snapshot: positive(snapshot?.price) ? { symbol: snapshot.symbol, price: snapshot.price,
      observedAt: timestamp(snapshot.observedAt), checkedAt: http.checkedAt, responseMs: snapshot.responseMs } : null,
    bars: positive(bars?.closedValidBars) ? { symbol: bars.symbol, count: bars.closedValidBars,
      timeframe: bars.timeframe, latestTime: timestamp(bars.latestTime), checkedAt: http.checkedAt } : null,
    stream: stream ? { status: streamOk ? 'verified' : 'unconfirmed', symbol: stream.symbol,
      pricedMessages: positive(stream.pricedMessages) ? stream.pricedMessages : 0,
      topics: Array.isArray(stream.topics) ? stream.topics.filter(topic => ['quote', 'snapshot', 'tick'].includes(topic)) : [],
      checkedAt: mqtt.checkedAt } : null,
  };
}
