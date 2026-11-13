import {storage} from '../../src/storage/database.mjs';
const required=['APP_ORIGIN','LINE_CHANNEL_ID','LINE_CHANNEL_SECRET','SESSION_SECRET','PORTFOLIO_HASH_SECRET','WEB_BRIDGE_URL','WEB_BRIDGE_SECRET','VPS_ORIGIN_SECRET'];
if(required.some(k=>!process.env[k])||process.env.STORAGE_PROVIDER!=='d1-http'||process.env.SHARED_MARKET_DATA_MODE!=='daily')throw Error('VPS_WEB_CONFIGURATION_REQUIRED');
if(!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY||''))throw Error('EXISTING_TEST_MODE_REQUIRED');
await storage.first('SELECT 1');
const coverage=await storage.all('SELECT market,COUNT(*) AS symbols FROM signal_desk_observations GROUP BY market');
console.log(JSON.stringify({storage:'available',lineConfigured:true,stripeMode:'test',dataMode:'daily-snapshot',coverage}));
