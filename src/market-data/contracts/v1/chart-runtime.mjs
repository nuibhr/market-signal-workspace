import {currentMember} from '../../../membership/server.mjs';
import {membershipFor} from '../../../membership/rights.mjs';
import {ALL_ASSETS} from '../../../markets/catalog.mjs';
import {candleClosedAt} from '../../delayed-candles.mjs';
import {rightsEvidence,scanAssets} from './runtime.mjs';
import {createChartHandler} from './chart-handlers.mjs';
export const chartHandler=(read,market=null)=>createChartHandler({read,currentMember,membershipFor,assets:ALL_ASSETS,scanAssets,evidence:rightsEvidence,closedAt:candleClosedAt,market});
