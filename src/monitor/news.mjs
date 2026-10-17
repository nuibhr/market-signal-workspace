// News is context, never an entry/exit or a statistical trade outcome.
export function newsEvents(feed,now=Date.now()) {
  const events=(feed.markets||[]).filter(m=>m.status==='available').flatMap(m=>(m.articles||[]).flatMap(a=>{
    const age=now-Date.parse(a.publishedAt);
    const breaking=a.breaking===true||(a.newsTypes||[]).some(t=>['breaking','breaking_news'].includes(t.toLowerCase()));
    const publicHeadline=(a.newsTypes||[]).includes('rss_headline');
    if(!Number.isFinite(age)||age<0||age>=1800000||!breaking&&!(a.impactScore>=4)&&!publicHeadline)return [];
    let url;try{url=new URL(a.url);if(url.protocol!=='https:')return [];}catch{return [];}
    // Provider job IDs can change on repeated scans; the source URL is stable.
    url.hash='';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_'))url.searchParams.delete(key);
    return [{id:`news:${m.id}:${url}`,type:'NEWS',ledger:'news',market:m.id,symbol:(a.entities||[]).join(' · ')||m.label,title:a.title,url:a.url,source:a.source,breaking,publicHeadline,impactScore:a.impactScore,createdAt:a.publishedAt,priceAt:a.publishedAt,price:null}];
  }));
  return [...new Map(events.map(e=>[e.id,e])).values()];
}
