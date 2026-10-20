import {XMLParser,XMLValidator} from 'fast-xml-parser';
const LIMIT=256000,TTL=60000;
export const PUBLIC_NEWS_FEEDS=[
  {id:'thai',label:'ข่าวไทย / เศรษฐกิจ',source:'InfoQuest',url:'https://www.infoquest.co.th/feed',host:'www.infoquest.co.th'},
  {id:'us',label:'ข่าว US / ตลาดโลก',source:'CNBC',url:'https://www.cnbc.com/id/100003114/device/rss/rss.html',host:'www.cnbc.com'},
];
const decode=text=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(all,key)=>{
  if(key[0]!=='#')return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[key.toLowerCase()]||all;
  const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
});
export function parseNewsRss(xml,feed) {
  if(typeof xml!=='string'||xml.length>LIMIT||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('INVALID_NEWS_RSS');
  const data=new XMLParser({ignoreAttributes:true,processEntities:false,parseTagValue:false}).parse(xml);
  if(!data.rss?.channel)throw Error('INVALID_NEWS_RSS');
  const raw=data.rss.channel.item,items=Array.isArray(raw)?raw:raw?[raw]:[];
  const articles=items.slice(0,40).flatMap(item=>{
    if(typeof item.title!=='string'||typeof item.link!=='string')return [];
    const title=decode(item.title).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,300);
    let url;try{url=new URL(decode(item.link));if(url.protocol!=='https:'||url.hostname!==feed.host||url.username||url.password)return [];}catch{return [];}
    // RSS pubDate carries its timezone; undated stories never trigger speech.
    const date=typeof item.pubDate==='string'?Date.parse(item.pubDate):NaN;
    if(!title||!Number.isFinite(date))return [];
    return [{id:url.toString(),title,url:url.toString(),publishedAt:new Date(date).toISOString(),source:feed.source,
      breaking:/^(breaking(?: news)?\s*:|ข่าวด่วน|ด่วน\s*[:!])/i.test(title),impactScore:null,newsTypes:['rss_headline'],entities:[],brief:''}];
  });
  return [...new Map(articles.map(a=>[a.id,a])).values()];
}
async function boundedText(response) {
  if(Number(response.headers.get('content-length'))>LIMIT)throw Error('NEWS_RSS_TOO_LARGE');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>LIMIT)throw Error('NEWS_RSS_TOO_LARGE');chunks.push(value);}}
  finally{await reader.cancel();}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  return new TextDecoder().decode(bytes);
}
export function createPublicNewsFeed({fetcher=fetch,now=Date.now}={}) {
  const cache=new Map(),pending=new Map();
  const load=async feed=>{
    if(cache.get(feed.id)?.until>now())return cache.get(feed.id).data;
    if(pending.has(feed.id))return pending.get(feed.id);
    const job=(async()=>{
      let data;
      try{
        const response=await fetcher(feed.url,{headers:{Accept:'application/rss+xml, application/xml'},cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});
        if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
        data={id:feed.id,label:feed.label,status:'available',receivedAt:new Date(now()).toISOString(),articles:parseNewsRss(await boundedText(response),feed)};
      }catch{data={id:feed.id,label:feed.label,status:'unavailable',code:'RSS_SOURCE_UNAVAILABLE',articles:[]};}
      cache.set(feed.id,{until:now()+TTL,data});return data;
    })().finally(()=>pending.delete(feed.id));pending.set(feed.id,job);return job;
  };
  return async()=>{
    const markets=await Promise.all(PUBLIC_NEWS_FEEDS.map(load)),ready=markets.filter(m=>m.status==='available').length;
    return {status:ready===markets.length?'available':ready?'partial':'unavailable',source:'Public RSS · InfoQuest / CNBC',scope:'public-market-headlines',pollingSeconds:60,
      newsPolicy:'fresh-public-headlines',markets};
  };
}
export const publicNewsFeed=createPublicNewsFeed();
