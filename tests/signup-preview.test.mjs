import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../apps/mobile/src/auth/registrationRules.js',import.meta.url),'utf8');
const {isRegistrationChallenge,canPreviewStore}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('unverified account responses cannot masquerade as email challenge',()=>{assert.equal(isRegistrationChallenge(null),false);assert.equal(isRegistrationChallenge({id:'user'}),false);assert.equal(isRegistrationChallenge({challengeId:'id',expiresAt:'bad',resendAt:'bad'}),false);assert.equal(isRegistrationChallenge({challengeId:'id',expiresAt:new Date().toISOString(),resendAt:new Date().toISOString()}),true);});
test('store preview is restricted to the same signed-in admin',()=>{assert.equal(canPreviewStore('ADMIN','a','a'),true);assert.equal(canPreviewStore('RIDER','a','a'),false);assert.equal(canPreviewStore('CUSTOMER','a','a'),false);assert.equal(canPreviewStore('ADMIN','b','a'),false);assert.equal(canPreviewStore(undefined,undefined,null),false);});
