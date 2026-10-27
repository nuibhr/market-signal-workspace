import {legacyScanHandler} from '../../../market-data/contracts/v1/legacy-scan-server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=legacyScanHandler('rows','thai');
