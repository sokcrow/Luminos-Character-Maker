import {chromium} from 'playwright';

const base=process.env.LUMINOUS_TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('console',message=>console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror',error=>console.error('[browser:pageerror]',error));
  await page.goto(`${base}/tests/vtt_rama4_test_lab_performance.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>{
    const node=document.getElementById('rama4-test-lab-result');
    return node&&['pass','fail'].includes(node.dataset.status);
  },null,{timeout:30000});
  const result=await page.locator('#rama4-test-lab-result').textContent();
  console.log(result);
  const parsed=JSON.parse(result);
  if(parsed.status!=='PASS')throw new Error(`TEST_LAB_BROWSER_FAILED: ${parsed.message||result}`);
  if(parsed.renderer?.webgl2!==true)throw new Error('TEST_LAB_BROWSER_NO_WEBGL2');
  if(parsed.movement?.previewFrames!==240)throw new Error(`TEST_LAB_BROWSER_PREVIEW_COUNT: ${parsed.movement?.previewFrames}`);
  if(parsed.perception?.previewVisionRecomputes!==0)throw new Error(`TEST_LAB_BROWSER_PREVIEW_FOV: ${parsed.perception?.previewVisionRecomputes}`);
  if(parsed.perception?.endpointVisionRecomputes!==1)throw new Error(`TEST_LAB_BROWSER_ENDPOINT_FOV: ${parsed.perception?.endpointVisionRecomputes}`);
  console.log('vtt Test Lab Chromium WebGL2: ok');
}finally{
  await browser.close();
}
