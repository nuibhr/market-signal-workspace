import { defineCloudflareConfig } from '@opennextjs/cloudflare';
const config=defineCloudflareConfig({incrementalCache:'dummy',tagCache:'dummy',queue:'dummy'});
config.buildCommand='NUGAOM_CLOUD_BUILD=true node node_modules/next/dist/bin/next build --webpack';
export default config;
