import {currentMember} from '../../../membership/server.mjs';
import {isAdmin} from '../../../membership/store.mjs';
import {ownerGuard} from './http.mjs';
export const requireDataOwner=ownerGuard({currentMember,isOwner:isAdmin});
// Owner status alone does not grant access to another owner's broker account.
// Bind the object using server configuration before constructing a broker client.
export async function requireOwnedBrokerAccount(body,market,env=process.env){
 const member=await currentMember();
 if(!member||!isAdmin(member))return false;
 let bindings;try{bindings=JSON.parse(env.CANONICAL_OWNER_PORTFOLIOS_JSON||'{}');}catch{return false;}
 return Array.isArray(bindings[member.id])&&bindings[member.id].some(b=>b.market===market&&b.brokerId===body?.brokerId&&b.accountNo===body?.accountNo);
}
