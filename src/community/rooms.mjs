// Template rows only. These are the sole allowed nonempty table on a fresh D1 destination.
export const COMMUNITY_ROOM_SEEDS = [
  {id:'lounge',name:'ห้องนักออม',description:'พูดคุยและแลกเปลี่ยนประสบการณ์',locked:0},
  {id:'thai',name:'หุ้นไทย',description:'แลกเปลี่ยนมุมมองหุ้นไทย',locked:0},
  {id:'dr',name:'DR',description:'สินทรัพย์ต่างประเทศในกระดานไทย',locked:0},
  {id:'us',name:'US และ ETF',description:'หุ้นสหรัฐฯ และ ETF',locked:0},
  {id:'tfex',name:'TFEX',description:'กราฟ สัญญา และการจัดการความเสี่ยง',locked:0},
  {id:'forex',name:'Forex',description:'คู่เงินและบริบทเศรษฐกิจ',locked:0},
];
export function pristineCommunityRooms(rows) {
  return rows.length===COMMUNITY_ROOM_SEEDS.length && COMMUNITY_ROOM_SEEDS.every(seed=>rows.some(row=>Object.keys(seed).every(key=>row[key]===seed[key])));
}
