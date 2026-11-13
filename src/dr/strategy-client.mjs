import {readApiJson} from '../security/api-response.mjs';
export async function requestStrategyFeed({refresh=false,market='dr',fetcher=globalThis.fetch,signal}={}) {
  const response=await fetcher('/api/dr-strategy/feed'+(market==='thai'?'?market=thai':''),{method:refresh?'POST':'GET',cache:'no-store',signal});
  const data=await readApiJson(response);
  if(response.status===403&&data?.code==='MEMBERSHIP_REQUIRED')throw Error('กรุณาเข้าสู่ระบบและเปิดสิทธิ์สมาชิกเพื่อสแกนหุ้น / DR');
  if(!response.ok||!['available','partial'].includes(data?.status))throw Error('ยังสแกนไม่ได้ กรุณาลองใหม่เมื่อแหล่งข้อมูลพร้อม');
  if(!Array.isArray(data.scoredDRs)||!Array.isArray(data.scoredThaiStocks))throw Error('ผลสแกนไม่สมบูรณ์ กรุณาลองใหม่');
  return data;
}
