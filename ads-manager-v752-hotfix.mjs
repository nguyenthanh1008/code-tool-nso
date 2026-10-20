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


// v7.5.3: clarify Meta-recorded zero purchase and explain each monitoring cycle.
// This runs before server.js imports the automation module.
function patch753(filename,patcher){
 if(!fs.existsSync(filename))return;
 const original=fs.readFileSync(filename,'utf8');
 const updated=patcher(original);
 if(updated!==original)fs.writeFileSync(filename,updated,'utf8');
}
patch753(path.join(root,'auto-pause.js'),s=>{
 const old="    if(!observed.length || observed.some(x=>!Number.isFinite(Number(x.value)) || Number(x.value)!==0))return [];";
 if(s.includes(old)){
  s=s.replace(old,
    "    // Meta may omit a zero-count purchase action. The opted-in rule checks purchases RECORDED by Meta, not Pancake sales.\n"+
    "    const purchaseActions=(Array.isArray(row.actions)?row.actions:[]).filter(a=>/(^|[._])purchases?($|[._])/i.test(String(a?.action_type||'')));\n"+
    "    if(purchaseActions.some(x=>!Number.isFinite(Number(x.value)) || Number(x.value)>0 || Number(x.value)<0))return [];");
 }
 if(!s.includes("lastStats:record?.lastStats")){
  s=s.replace("    lastCheckedAt:record?.lastCheckedAt??null,","    lastCheckedAt:record?.lastCheckedAt??null,\n    lastStats:record?.lastStats??null,");
 }
 return s;
});
patch753(path.join(root,'server.js'),s=>{
 if(s.includes("AUTO_PAUSE_RUN_STATS"))return s;
 s=s.replace(" rule.lastCheckedAt=new Date().toISOString();",
  " const stats={accountsChecked:0,campaignsScanned:0,overLimit:0,candidates:0,paused:0,errors:0};\n rule.lastCheckedAt=new Date().toISOString();");
 s=s.replace("   const account=allowed.get(accountId);\n   if(!account||account.currency!=='VND')continue;",
  "   const account=allowed.get(accountId);\n   if(!account||account.currency!=='VND'){stats.errors++;appendAutoPauseAction(rule,{ok:false,accountId,message:'TKQC thiếu quyền hoặc không dùng VND.'});continue;}\n   stats.accountsChecked++;");
 s=s.replace("   if(camp.truncated||ins.truncated){",
  "   stats.campaignsScanned+=camp.items.length;\n   stats.overLimit+=ins.items.filter(row=>Number.isFinite(Number(row.spend))&&Number(row.spend)>=rule.spend).length;\n   if(camp.truncated||ins.truncated){stats.errors++;");
 s=s.replace("   const candidates=chooseAutoPauseCandidates(account,camp.items,ins.items,rule.spend,false);",
  "   const candidates=chooseAutoPauseCandidates(account,camp.items,ins.items,rule.spend,false);\n   stats.candidates+=candidates.length;");
 s=s.replace("     appendAutoPauseAction(rule,{ok:true,accountId,campaignId:item.campaignId,name:item.name,spend:item.spend,message:'Meta xác nhận tắt camp.'});",
  "     stats.paused++;appendAutoPauseAction(rule,{ok:true,accountId,campaignId:item.campaignId,name:item.name,spend:item.spend,message:'Meta xác nhận tắt camp.'});");
 s=s.replace("    }catch(e){\n     appendAutoPauseAction(rule,{ok:false,accountId,campaignId:item.campaignId",
  "    }catch(e){\n     stats.errors++;appendAutoPauseAction(rule,{ok:false,accountId,campaignId:item.campaignId");
 s=s.replace(" }catch(e){\n  rule.lastError=String(e.message||'Không đọc được dữ liệu Meta').slice(0,230);",
  " }catch(e){\n  stats.errors++;rule.lastError=String(e.message||'Không đọc được dữ liệu Meta').slice(0,230);");
 s=s.replace(" }finally{if(autoPauseStore.get(userId)===rule)autoPauseStore.put(userId,rule)}",
  " }finally{rule.lastStats=stats;console.info('AUTO_PAUSE_RUN_STATS',JSON.stringify({checkedAt:rule.lastCheckedAt,...stats,hasError:!!rule.lastError}));if(autoPauseStore.get(userId)===rule)autoPauseStore.put(userId,rule)}");
 return s;
});
patch753(path.join(root,'app.js'),s=>{
 if(s.includes("Lượt quét: "))return s;
 s=s.replace("Meta phải ghi rõ 0 lượt mua. Chiến dịch sẽ bị tắt THẬT khi đủ điều kiện.",
  "Chỉ dựa trên lượt mua META GHI NHẬN. Nếu Meta không trả dòng mua, hệ thống coi là 0 lượt mua ghi nhận, ngay cả khi Pancake có thể có đơn thật. Camp sẽ bị TẮT THẬT khi đủ điều kiện.");
 s=s.replace("(state?.lastError?' Lỗi: '+state.lastError:'')",
  "(state?.lastError?' Lỗi: '+state.lastError:'')+(state?.lastStats?' Lượt quét: '+state.lastStats.accountsChecked+' TKQC / '+state.lastStats.campaignsScanned+' camp; vượt ngưỡng '+state.lastStats.overLimit+', đủ điều kiện '+state.lastStats.candidates+', tắt thành công '+state.lastStats.paused+', lỗi '+state.lastStats.errors+'.':'')");
 s=s.replace(" $('featureAutoOffMessage').textContent='Máy chủ đã nhận yêu cầu kiểm tra. Nhấn vào Tính năng lại để xem kết quả.';",
  " $('featureAutoOffMessage').textContent='Máy chủ đã nhận lệnh kiểm tra, đang lấy kết quả…';\n  setTimeout(()=>loadServerAutoPause().catch(()=>{}),5000);\n  setTimeout(()=>loadServerAutoPause().catch(()=>{}),18000);");
 return s;
});
patch753(path.join(root,'index.html'),s=>{
 s=s.replaceAll("Chỉ tắt khi Meta xác nhận 0 lượt mua.","Chỉ dựa trên lượt mua do Meta ghi nhận, chưa đối chiếu đơn qua Pancake.");
 s=s.replaceAll("Tắt chỉ khi Meta ghi nhận rõ 0 lượt mua.","Tắt khi Meta không ghi nhận lượt mua; có thể vẫn có đơn trên Pancake.");
 s=s.replaceAll("Chỉ tắt camp đang bật, tiền tệ VND, Meta ghi nhận chính xác 0 lượt mua. Không sử dụng dữ liệu bị thiếu như 0 đơn.",
  "Chỉ xét camp đang bật, dùng VND và không có lượt mua Meta ghi nhận. Chưa kết nối đơn Pancake, nên có rủi ro tắt nhầm camp có đơn thật.");
 s=s.replace("v7.5.2 · Công tắc máy chủ","v7.5.3 · Theo dõi kết quả tự động");
 return s;
});
console.info('Ads Manager Pro v7.5.3: fixed Meta purchase omission and enabled safe run diagnostics');


const autopause=path.join(root,'auto-pause.js');
const backend=path.join(root,'server.js');
const frontend=path.join(root,'app.js');
const html=path.join(root,'index.html');
const patch=patch753;
// v7.5.4: server-driven adaptive monitoring, best effort on Render Free.
patch(autopause,s=>{
 if(s.includes('AUTO_PAUSE_NEAR_LIMIT_MS'))return s;
 s=s.replace('export const AUTO_PAUSE_INTERVAL_MS = 120_000;',
  'export const AUTO_PAUSE_INTERVAL_MS = 120_000;\nexport const AUTO_PAUSE_NEAR_LIMIT_MS = 30_000;\nexport const AUTO_PAUSE_WAKE_TICK_MS = 15_000;\nexport const AUTO_PAUSE_NEAR_LIMIT_RATIO = 0.80;');
 s=s.replace("    period:'today',timezone:TZ,intervalSeconds:120,",
  "    period:'today',timezone:TZ,intervalSeconds:120,nearIntervalSeconds:30,\n    nearLimit:!!record?.nearLimit,\n    nextCheckAt:record?.enabled && record?.lastCheckedAt ? new Date(Date.parse(record.lastCheckedAt) + (record.nearLimit?AUTO_PAUSE_NEAR_LIMIT_MS:AUTO_PAUSE_INTERVAL_MS)).toISOString() : null,");
 return s;
});
patch(backend,s=>{
 if(s.includes('AUTO_PAUSE_NEAR_LIMIT_RATIO'))return s;
 s=s.replace('import {AUTO_PAUSE_INTERVAL_MS, AutoPauseStore',
  'import {AUTO_PAUSE_INTERVAL_MS, AUTO_PAUSE_NEAR_LIMIT_MS, AUTO_PAUSE_WAKE_TICK_MS, AUTO_PAUSE_NEAR_LIMIT_RATIO, AutoPauseStore');
 s=s.replace(' const stats={accountsChecked:0,campaignsScanned:0,overLimit:0,candidates:0,paused:0,errors:0};',
  ' const stats={accountsChecked:0,campaignsScanned:0,nearLimit:0,overLimit:0,candidates:0,paused:0,errors:0};\n rule.nearLimit=false;');
 s=s.replace('   stats.campaignsScanned+=camp.items.length;\n   stats.overLimit',
  '   stats.campaignsScanned+=camp.items.length;\n   if(!camp.truncated && !ins.truncated){\n    const near=chooseAutoPauseCandidates(account,camp.items,ins.items,Math.ceil(rule.spend*AUTO_PAUSE_NEAR_LIMIT_RATIO),false);\n    stats.nearLimit+=near.length;\n    if(near.length)rule.nearLimit=true;\n   }\n   stats.overLimit');
 s=s.replace(' }finally{rule.lastStats=stats;console.info',
  ' }finally{if(stats.errors)rule.nearLimit=false;rule.lastStats=stats;console.info');
 s=s.replace('   if(!forceUser && rule.lastCheckedAt && Date.now()-Date.parse(rule.lastCheckedAt)<AUTO_PAUSE_INTERVAL_MS-5000)continue;',
  '   const interval=rule.nearLimit?AUTO_PAUSE_NEAR_LIMIT_MS:AUTO_PAUSE_INTERVAL_MS;\n   if(!forceUser && rule.lastCheckedAt && Date.now()-Date.parse(rule.lastCheckedAt)<interval-2000)continue;');
 s=s.replace('        lastError:null,recentActions:old.recentActions||[],lastCheckedAt:null});',
  '        lastError:null,recentActions:old.recentActions||[],lastCheckedAt:null,nearLimit:false});');
 s=s.replace("  setInterval(()=>autoPauseTick().catch(e=>console.error('Auto pause failed:',e.message)),AUTO_PAUSE_INTERVAL_MS).unref();",
  "  setInterval(()=>autoPauseTick().catch(e=>console.error('Auto pause failed:',e.message)),AUTO_PAUSE_WAKE_TICK_MS).unref();");
 return s;
});
patch(frontend,s=>{
 if(s.includes('v7.5.4: refresh live rule status'))return s;
 s=s.replace('async function loadServerAutoPause(){','async function loadServerAutoPause(preserveDraft=false){');
 s=s.replace('  renderServerAutoPause(state);\n }catch(e){featureServerReady=false;featureServerError=e.message;renderServerAutoPause();}',
  '  renderServerAutoPause(state,preserveDraft);\n }catch(e){featureServerReady=false;featureServerError=e.message;renderServerAutoPause(undefined,preserveDraft);}');
 s=s.replace('function renderServerAutoPause(state){','function renderServerAutoPause(state,preserveDraft=false){');
 s=s.replace(" $('featureAutoOffSpend').value=featureAutoOffConfig.spend;",
  " if(!preserveDraft){\n $('featureAutoOffSpend').value=featureAutoOffConfig.spend;");
 s=s.replace(" document.querySelectorAll('[data-autooff-day]').forEach(box=>box.checked=featureAutoOffConfig.days.includes(Number(box.dataset.autooffDay)));",
  " document.querySelectorAll('[data-autooff-day]').forEach(box=>box.checked=featureAutoOffConfig.days.includes(Number(box.dataset.autooffDay)));\n }");
 s=s.replace(" (state?.lastCheckedAt?' Lần kiểm tra cuối: '+new Date(state.lastCheckedAt).toLocaleString('vi-VN')+'.':'')+",
  " (state?.lastCheckedAt?' Lần kiểm tra cuối: '+new Date(state.lastCheckedAt).toLocaleString('vi-VN')+'.':' Chưa có lượt kiểm tra nào được máy chủ xác nhận.')+\n       (state?.nextCheckAt?' Lượt tiếp theo dự kiến: '+new Date(state.nextCheckAt).toLocaleTimeString('vi-VN')+'.':'')+\n       (state?.nearLimit?' Có camp gần 80% ngưỡng: kiểm tra nhanh khoảng 30 giây/lần.':'')+");
 s=s.replace("(state?.lastStats?' Lượt quét: '+state.lastStats.accountsChecked+' TKQC / '+state.lastStats.campaignsScanned+' camp; vượt ngưỡng '+state.lastStats.overLimit+",
  "(state?.lastStats?' Lượt quét: '+state.lastStats.accountsChecked+' TKQC / '+state.lastStats.campaignsScanned+' camp; gần ngưỡng '+(state.lastStats.nearLimit||0)+', vượt ngưỡng '+state.lastStats.overLimit+");
 s=s.replace(' renderServerAccounts();renderAutoOffLog(featureAutoOffLog);',
  ' if(!preserveDraft)renderServerAccounts();renderAutoOffLog(featureAutoOffLog);');
 s=s.replace('// The 24/7 auto-pause loop lives on the server, not inside the Android tab.',
  "// v7.5.4: refresh live rule status, without overwriting unsaved form edits.\nsetInterval(()=>{if(selectedPage==='features' && !$('dashboard').hidden && !document.hidden)loadServerAutoPause(true).catch(()=>{})},15000);\n// The monitor lives on the server, not inside the Android tab. Render Free is best-effort.");
 s=s.replace('kiểm tra khoảng 2 phút/lần khi máy chủ còn hoạt động?',
  'kiểm tra khoảng 2 phút/lần, hoặc 30 giây khi gần ngưỡng, lúc máy chủ còn hoạt động?');
 return s;
});
patch(html,s=>{
 s=s.replace('Bộ kiểm tra chạy trên máy chủ mỗi 2 phút khi bạn đã bật',
  'Máy chủ kiểm tra khoảng 2 phút/lần hoặc 30 giây khi camp gần 80% ngưỡng, sau khi bạn bật');
 s=s.replaceAll('v7.5.3 · Hiển thị kết quả kiểm tra','v7.5.4 · Giám sát gần ngưỡng');
 return s;
});
console.info('Ads Manager Pro v7.5.4: adaptive server monitor (2min/30s) and status refresh installed');
