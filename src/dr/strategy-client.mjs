export async function requestStrategyFeed({refresh=false,fetcher=globalThis.fetch,signal}={}) {
  const response=await fetcher('/api/dr-strategy/feed',{method:refresh?'POST':'GET',cache:'no-store',signal});
  const data=await response.json();
  if(!response.ok||!['available','partial'].includes(data?.status))throw Error('ยังสแกนไม่ได้ กรุณาลองใหม่เมื่อแหล่งข้อมูลพร้อม');
  if(!Array.isArray(data.scoredDRs)||!Array.isArray(data.scoredThaiStocks))throw Error('ผลสแกนไม่สมบูรณ์ กรุณาลองใหม่');
  return data;
}
