import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNewsRss,createPublicNewsFeed,PUBLIC_NEWS_FEEDS} from './rss-news.mjs';
const xml=`<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title><item><title><![CDATA[Breaking: stocks &amp; bonds move]]></title><link>https://www.cnbc.com/story</link><pubDate>Thu, 15 Oct 2026 15:00:00 GMT</pubDate><description>Private body is never returned</description></item></channel></rss>`;
test('RSS returns publisher headline/link/time only, decodes text and retains an explicit breaking prefix',()=>{
  const a=parseNewsRss(xml,PUBLIC_NEWS_FEEDS[1])[0];assert.equal(a.title,'Breaking: stocks & bonds move');assert.equal(a.breaking,true);assert.equal(a.publishedAt,'2026-10-15T15:00:00.000Z');assert.equal(a.impactScore,null);assert.equal(a.source,'CNBC');assert.equal(a.brief,'');assert.ok(!JSON.stringify(a).includes('Private body'));
  assert.equal(parseNewsRss(xml.replace('https://www.cnbc.com/story','https://evil.example/story'),PUBLIC_NEWS_FEEDS[1]).length,0);
});
test('invalid XML, oversized responses and entity declarations are refused; undated stories stay ineligible',()=>{
  for(const bad of ['<html>not RSS</html>','<rss>',`<!DOCTYPE rss [<!ENTITY x "secret">]>${xml}`,'x'.repeat(256001)])assert.throws(()=>parseNewsRss(bad,PUBLIC_NEWS_FEEDS[1]));
  assert.equal(parseNewsRss(xml.replace(/<pubDate>.*?<\/pubDate>/,''),PUBLIC_NEWS_FEEDS[1]).length,0);
});
test('public RSS cache coalesces visitors, refreshes once per minute and surfaces publisher failures without fallback headlines',async()=>{
  let clock=100000,calls=0,fail=false;
  const read=createPublicNewsFeed({now:()=>clock,fetcher:async(url,options)=>{calls++;assert.equal(options.headers.Authorization,undefined);if(fail)return new Response('no',{status:503});return new Response(xml.replaceAll('www.cnbc.com',url.includes('infoquest')?'www.infoquest.co.th':'www.cnbc.com'));}});
  const [a,b]=await Promise.all([read(),read()]);assert.equal(a.status,'available');assert.equal(b.markets.length,2);assert.equal(calls,2);await read();assert.equal(calls,2);
  clock+=60001;fail=true;const broken=await read();assert.equal(calls,4);assert.equal(broken.status,'unavailable');assert.ok(broken.markets.every(m=>m.articles.length===0));
});
