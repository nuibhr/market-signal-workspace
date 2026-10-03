import { US_SCAN_SYMBOLS, US_UNIVERSE_METADATA } from './us-liquid-500.mjs';
export { US_SCAN_SYMBOLS, US_UNIVERSE_METADATA };
// A changed catalog gets a new scan/progress slot; existing signal history stays intact.
export const US_UNIVERSE_VERSION = `us-liquid-${US_SCAN_SYMBOLS.length}:${US_UNIVERSE_METADATA.asOf}`;
export const usScanSlot = day => `${day}:${US_UNIVERSE_VERSION}`;
