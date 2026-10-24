import {currentMember,sameOrigin} from '../../../../membership/server.mjs';
import {isAdmin} from '../../../../membership/store.mjs';
import {rateLimit} from '../../../../security/request-guard.mjs';
import {createTelegramHandlers} from '../../../../notifications/handlers.mjs';
import {telegramHistory} from '../../../../notifications/history.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const {GET,POST}=createTelegramHandlers({currentMember,isAdmin,sameOrigin,rateLimit,history:telegramHistory});
