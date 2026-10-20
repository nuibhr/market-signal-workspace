import {receiverConfiguration} from '../forex-mt5/runtime-policy.mjs';
export function daytradeRuntime(market,env=process.env) {
 const config=receiverConfiguration(env),native=['thai','dr','tfex'].includes(market);
 return {...config,enabled:native?!config.disabledReason:config.enabled};
}
