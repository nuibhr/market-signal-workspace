import {createOptionsHandler} from '../../../../market-data/contracts/v1/options-handlers.mjs';
import {rightsEvidence} from '../../../../market-data/contracts/v1/runtime.mjs';
import {currentMember} from '../../../../membership/server.mjs';
import {membershipFor} from '../../../../membership/rights.mjs';
import {buildTfexContracts} from '../../../../markets/tfex-contracts.mjs';
import {createTfexClient} from '../../../../market-data/settrade.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=createOptionsHandler({currentMember,membershipFor,contracts:buildTfexContracts,evidence:rightsEvidence,rateLimit,
 getQuote:symbol=>{const client=createTfexClient();return client.configuration.configured?client.getQuote(symbol):null;}});
