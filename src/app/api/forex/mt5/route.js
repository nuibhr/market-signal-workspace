import {cookies} from 'next/headers';
import {currentMember} from '../../../../membership/server.mjs';
import {isConfigured} from '../../../../membership/store.mjs';
import {createForexHandlers} from '../../../../forex-mt5/handlers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const {GET,POST}=createForexHandlers({currentMember,cookieStore:cookies,isLoginConfigured:isConfigured});
