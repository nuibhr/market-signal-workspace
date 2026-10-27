import {legacyLedgerHandler} from '../../../../market-data/contracts/v1/legacy-ledger-server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=legacyLedgerHandler('results');
