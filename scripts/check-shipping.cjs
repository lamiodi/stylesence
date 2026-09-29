// Run from the repository root: node scripts/check-shipping.cjs
// Isolated checkout regression tests. No database, payment gateway or email calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {module,exports:module.exports,require: id => {
    if(id in mocks)return mocks[id];throw Error('Unexpected dependency: '+id);
  },console:{log(){},error(){}},URL,Date,Math,Response});
  return module.exports;
}
assert.equal(fs.readFileSync(path.join(root,'backend/lib/shipping.ts'),'utf8'),fs.readFileSync(path.join(root,'frontend/src/lib/shipping.ts'),'utf8'));
const shipping = load('backend/lib/shipping.ts');
const geo = load('frontend/src/lib/geo.ts');
const cases=[['Nigeria','Lagos',5000,'local'],['Nigeria','Ogun',8000,'nationwide'],['Nigeria','Oyo',8000,'nationwide'],['Nigeria','FCT — Abuja',12500,'nationwide'],['Nigeria','Rivers',12500,'nationwide'],['Ghana','Greater Accra',35000,'international'],['Kenya','Nairobi',50000,'international'],['United Kingdom','England',55000,'international'],['Germany','Berlin',65000,'international'],['Canada','Ontario',75000,'international'],['Japan','Tokyo',85000,'international']];
for(const [country,state,price,method] of cases){const zone=shipping.deliveryZone(country,state);assert.equal(zone.price,price);assert.equal(zone.method,method);assert.equal(shipping.shippingError(country,state,method),null);}
for(const country of geo.COUNTRY_NAMES){
  for(const state of geo.provincesFor(country)??['Region'])assert.ok(shipping.deliveryZone(country,state),country+' '+state);
}
assert.ok(shipping.shippingError('Nigeria','Kano','local'));
assert.ok(shipping.shippingError('Nigeria','Lagos','international'));
assert.ok(shipping.shippingError('United Kingdom','England','nationwide'));
assert.equal(shipping.deliveryZone('Nigeria','Made up'),null);
// Unmapped destinations order at the rest-of-the-world rate — nobody is stranded.
assert.equal(shipping.deliveryZone('Vanuatu','Region').price,85000);
assert.equal(shipping.deliveryZone('Vanuatu','Region').method,'international');
async function checkoutTest(country,state,method,expected){
  let saved,stockWrites=0,cartClears=0;
  const input={country,state,shippingMethod:method,email:'test@example.com',fullName:'Test Buyer',address:'12 Test Road',city:'City',paymentMethod:'confirmed',productionTier:'standard'};
  const item={qty:2,variantId:'v1',variant:{stock:5,size:'M',color:'Black',product:{price:50000,name:'Dress',slug:'dress',images:[]}}};
  const tx={productVariant:{updateMany:async()=>{stockWrites++;return{count:1}}},order:{findUnique:async()=>null,create:async({data})=>{saved=data;return{orderNumber:data.orderNumber,id:'o1'}}},orderItem:{createMany:async()=>{}},cartItem:{deleteMany:async()=>{cartClears++}}};
  const route=load('backend/app/api/checkout/route.ts',{
    '@/lib/db':{db:{cartItem:{findMany:async()=>[item]},$transaction:async fn=>fn(tx)}},
    '@/lib/api-helpers':{fail:(status,error)=>({status,error}),ok:(body,opts)=>({status:opts?.status??200,...body}),readValidated:async()=>({ok:true,data:input})},
    '@/lib/cart':{getCartFromCookie:async()=>({cartId:'c1'})},'@/lib/validators':{checkoutInput:{}},
    '@/lib/promo':{},'@/lib/types':{PRODUCTION_TIERS:{standard:{fee:0}}},'@/lib/shipping':shipping,
    '@/lib/payments':{},'@/lib/email':{}
  });
  const result=await route.POST({});
  if(expected===null){assert.equal(result.status,400);assert.equal(stockWrites,0);assert.equal(cartClears,0);}
  else {assert.equal(result.status,201);assert.equal(saved.shipping,expected);assert.equal(saved.total,100000+expected);assert.equal(result.order.total,saved.total);assert.equal(saved.status,'PENDING_PAYMENT');assert.equal(stockWrites,1);assert.equal(cartClears,1);}
}
async function verifyTest(status,reference,expectedStatus,expectedVerified){
  let gatewayCalls=0;
  const route=load('backend/app/api/checkout/verify/route.ts',{
    '@/lib/db':{db:{order:{findUnique:async()=>({id:'o1',status,paymentReference:'correct',paymentMethod:'paystack'})}}},
    '@/lib/api-helpers':{fail:(status,error)=>({status,error}),ok:body=>({statusCode:200,...body})},
    '@/lib/payments':{verifyPaystack:async()=>{gatewayCalls++;return{paid:true,amountNaira:105000}}},
    '@/lib/order-settle':{settleGatewayPayment:async()=> 'already-settled'}
  });
  const result=await route.GET({url:'https://example.com/api/checkout/verify?order=SS-test&reference='+reference});
  assert.equal(result.statusCode??result.status,expectedStatus);
  if(expectedVerified!==undefined)assert.equal(result.verified,expectedVerified);
  assert.equal(gatewayCalls,0);
}
(async()=>{
  for(const [country,state,price,method] of cases)await checkoutTest(country,state,method,price);
  await checkoutTest('Nigeria','Kano','local',null);
  await checkoutTest('Nigeria','Lagos','international',null);
  await checkoutTest('United Kingdom','England','nationwide',null);
  await checkoutTest('Nigeria','Bogus','nationwide',null);
  await checkoutTest('Vanuatu','Region','international',85000);
  await verifyTest('PENDING_PAYMENT','other-order',400);
  await verifyTest('CANCELLED','correct',200,false);
  await verifyTest('PAID','correct',200,true);
  console.log('PASS: all supported destinations, frontend/backend parity, order totals, invalid delivery rejection, payment reference binding, cancelled/paid verification.');
})().catch(err=>{console.error(err);process.exitCode=1});
