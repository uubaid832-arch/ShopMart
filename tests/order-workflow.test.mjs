import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL(path,import.meta.url),'utf8')).toString('base64'));
const mobile=await load('../apps/mobile/src/admin/contactMessages.js');
const web=await load('../apps/web/src/features/admin/contactMessages.js');
const rules=await load('../apps/mobile/src/orders/orderRules.js');
for(const [name,api] of [['mobile',mobile],['web',web]]) {
 test(`${name}: account follow-up and voucher follow-up are distinct`,()=>{
  const request={mode:'refund',orderNumber:'SM-1',customerName:'Customer',productName:'Item',returnId:'return-1'};
  const account=api.customerMessage(request);assert.match(account,/IBAN\/account number/);assert.match(account,/Never send/);assert.match(account,/not yet issued/);
  const voucher=api.customerMessage({...request,refundChoice:'VOUCHER'});assert.match(voucher,/voucher amount, terms and code separately/);assert.doesNotMatch(voucher,/IBAN/);
 });
 test(`${name}: saved address is reused in new return drafts`,()=>{
  const warehouse='ShopMart Warehouse, Sample road, Lahore';
  for(const id of ['first','second'])assert.ok(api.customerMessage({mode:'return',returnId:id,warehouse}).includes(warehouse));
  assert.throws(()=>api.customerMessage({mode:'return',warehouse:''}));
 });
}
test('completed/cancelled orders never enable live tracking',()=>{
 for(const status of ['PENDING','CONFIRMED','DELIVERED','CANCELLED','RETURNED',undefined])assert.equal(rules.canTrackLive(status),false);
 assert.equal(rules.canTrackLive('DISPATCHED'),true);
});
