export async function readApiJson(response){
 const text=await response.text();let data;
 try{data=JSON.parse(text);}catch{
  throw Error(response.status===503?'เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองโหลดใหม่อีกครั้ง':'อ่านข้อมูลจากเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
 }
 return data;
}
