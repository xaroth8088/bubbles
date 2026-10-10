import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('offline navigation returns a fresh document when the host redirects index.html',async()=>{
  const handlers={},cached=new Response('<html>Bubble Grove</html>',{headers:{'content-type':'text/html','content-encoding':'gzip','content-length':'100'}});
  Object.defineProperty(cached,'redirected',{value:true});
  const context={URL,Headers,Response,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/bubbles/'},addEventListener:(name,handler)=>handlers[name]=handler},
    caches:{match:async url=>{assert.equal(String(url),'https://example.test/bubbles/index.html');return cached;}},fetch:async()=>{throw new TypeError('Offline');}};
  runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
  let promise;handlers.fetch({request:{method:'GET',url:'https://example.test/bubbles/',mode:'navigate'},respondWith:value=>promise=value});
  const result=await promise;
  assert.equal(result.status,200);assert.equal(result.redirected,false);assert.equal(result.headers.get('content-type'),'text/html');
  assert.equal(result.headers.get('content-encoding'),null);assert.equal(result.headers.get('content-length'),null);
  assert.equal(await result.text(),'<html>Bubble Grove</html>');
});
