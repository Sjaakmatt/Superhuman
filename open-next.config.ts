import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Standaard OpenNext-config. Er is (nog) geen incremental cache nodig: elk
// scherm gaat over vandaag en is daarom bewust dynamisch.
export default defineCloudflareConfig();
