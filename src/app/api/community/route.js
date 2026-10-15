import { currentMember, sameOrigin } from '../../../membership/server.mjs';
import { createCommunityHandlers } from '../../../community/handlers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const {GET,POST}=createCommunityHandlers({currentMember,sameOrigin});
