import {cookies} from 'next/headers';
import {currentMember} from '../../../../membership/server.mjs';
import {isConfigured,isAdmin} from '../../../../membership/store.mjs';
import {storage} from '../../../../storage/database.mjs';
import {createOwnerForexHandlers} from '../../../../forex-mt5/owner-handlers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const {GET,POST}=createOwnerForexHandlers({currentMember,isOwner:isAdmin,
 loadOwner:id=>storage.first('SELECT id,line_id FROM members WHERE id=?',id),cookieStore:cookies,isLoginConfigured:isConfigured});
