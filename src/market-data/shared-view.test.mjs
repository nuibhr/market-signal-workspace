import test from 'node:test';import assert from 'node:assert/strict';
import {sharedMarketRows} from './shared-view.mjs';
test('shared view keeps exact contract identity, source time, permissions and honest missing prices',()=>{
 const assets=[{id:'thai',symbol:'PTT',instrumentId:'SET100:PTT'},{id:'thai',symbol:'AOT',instrumentId:'SET100:AOT'}];
 const rows=[{symbol:'PTT',instrument_id:'SET100:PTT',price:35,previous_price:34,source:'Settrade Open API',price_ms:1792700000000,snapshot_at:'2026-10-24T00:00:00Z'}];
 const env={NODE_ENV:'production',SETTRADE_DISPLAY_RIGHTS_CONFIRMED:'true'};
 const view=sharedMarketRows(assets,rows,env);assert.equal(view[0].price,35);assert.equal(view[0].priceAt,new Date(rows[0].price_ms).toISOString());assert.equal(view[1].price,null);
 assert.equal(sharedMarketRows(assets,rows,{NODE_ENV:'production'})[0].price,null);
 assert.equal(sharedMarketRows(assets,[{...rows[0],symbol:'AOT'}],env)[0].price,null);
 assert.equal(sharedMarketRows(assets,[{...rows[0],instrument_id:'SET100:AOT'}],env)[0].price,null);
});
