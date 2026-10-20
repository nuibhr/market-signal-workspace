import {currentMember} from '../../../membership/server.mjs';
import {createDaytradeHandlers} from '../../../daytrade/handlers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const {GET}=createDaytradeHandlers({currentMember});
