import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveSignalPage,referenceAlertHistorical,referenceVoiceEligible} from './client.mjs';
import {createNotificationInbox} from '../auto-pick/notification-inbox.mjs';
const scope='swing:fixture:thai';
const event=(id,type='ENTRY')=>({id,type,createdAt:new Date().toISOString(),symbol:'PTT'});
const page=(cursor,events=[])=>({notificationScope:scope,nextCursor:cursor,events});
const setup=()=>{const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};return createNotificationInbox({scope,storage,owner:'fixture-tab'});};
test('reload catches up from the saved cursor before advancing to a new high water mark',async()=>{
 const inbox=setup();await inbox.receive({events:[event('old')],nextCursor:'5'});
 let requested;
 await receiveSignalPage({page:page(20),inbox,expectedScope:scope,fetchAfter:async after=>{requested=after;return page(20,[event('missed-while-closed')]);}});
 assert.equal(requested,'5');assert.equal((await inbox.snapshot()).pending,2);assert.equal((await inbox.snapshot()).cursor,'20');
});
test('another tab advancing the cursor cannot be overwritten by a slower page response',async()=>{
 const inbox=setup();await inbox.receive({events:[],nextCursor:'5'});
 await inbox.receive({events:[event('newer-tab')],nextCursor:'30'},'5');
 await receiveSignalPage({page:page(20,[event('slower-response')]),requestCursor:'5',inbox,expectedScope:scope,fetchAfter:async()=>{throw Error('not needed');}});
 assert.equal((await inbox.snapshot()).cursor,'30');assert.equal((await inbox.snapshot()).pending,1);
});
test('account scope mismatch is refused; an old US intraday price does not trigger fresh voice delivery',async()=>{
 await assert.rejects(receiveSignalPage({page:{...page(10),notificationScope:'another-member'},inbox:setup(),expectedScope:scope}),/ACCOUNT_OR_EVENT_SCOPE_CHANGED/);
 const now=Date.now();assert.equal(referenceAlertHistorical({market:'us',priceAt:new Date(now-31*60000).toISOString()},now),true);
 assert.equal(referenceAlertHistorical({market:'us',priceAt:new Date(now-16*60000).toISOString()},now),false);
 assert.equal(referenceVoiceEligible({deliveryVoice:'attempted',priceAt:new Date(now-16*60000).toISOString()},now),false);
 assert.equal(referenceVoiceEligible({deliveryVoice:'pending',priceAt:new Date(now-16*60000).toISOString()},now),true);
});
