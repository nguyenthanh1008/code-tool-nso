import fs from 'node:fs';
import path from 'node:path';
// Idempotent runtime repair for the Ads Manager Pro Free PWA.
// The bundled v7.5.1 app.js references featureAlertConfig but never declares it.
// Until the bundled archive is replaced, repair the extracted file at Node startup.
const root=process.cwd();
const file=path.join(root,'app.js');
if(fs.existsSync(file)){
 let src=fs.readFileSync(file,'utf8');
 const needle="const FEATURE_ALERT_KEY='adsProFeatureAlertV1';\n";
 if(src.includes(needle) && !src.includes('let featureAlertConfig=')){
  const patch=[
   "const FEATURE_ALERT_KEY='adsProFeatureAlertV1';",
   "let featureAlertConfig={enabled:false,spend:42000,period:'today'};",
   "try {",
   " const saved=JSON.parse(localStorage.getItem(FEATURE_ALERT_KEY)||'null');",
   " if(saved && typeof saved.enabled==='boolean' && Number.isInteger(saved.spend) && saved.spend>=1000 && saved.spend<=100000000 && ['today','yesterday','last_7d','last_30d'].includes(saved.period))featureAlertConfig=saved;",
   "} catch {}",
   ""
  ].join('\n');
  src=src.replace(needle,patch);
  // Prevent an endless loading message while checking the server.
  src=src.replace(" featureAutoOffLoading=true;\n try{\n  const state=await request('/api/auto-pause');",
    " featureAutoOffLoading=true;\n $('featureAutoOffMessage').textContent='Đang kết nối bộ tự động trên máy chủ…';\n try{\n  const state=await request('/api/auto-pause');");
  src=src.replace(" const toggle=$('featureAutoOffToggle');\n toggle.setAttribute('aria-checked'",
    " const toggle=$('featureAutoOffToggle');\n toggle.disabled=!featureServerReady;\n toggle.setAttribute('aria-checked'");
  fs.writeFileSync(file,src,'utf8');
  console.log('Ads Manager Pro v7.5.2: fixed Features page initialization');
 }
}
