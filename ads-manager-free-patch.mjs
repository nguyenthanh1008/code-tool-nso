import fs from 'node:fs';
function replace(file, from, to) {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes(from)) throw new Error('Expected original source missing in ' + file + ': ' + from.slice(0,80));
  fs.writeFileSync(file,s.replace(from,to));
}
replace('server.js',
"// Server-side monitoring is disabled until encrypted durable storage AND an always-on\n// host are explicitly configured. Render Free is NOT a reliable background worker.",
"// Render Free: best effort only. A scheduled external /health ping keeps the server awake.\n// Encrypted local state is ephemeral: restart/redeploy resets enabled rules to OFF.");
replace('server.js',
"const AUTO_RULE_ALLOWED=process.env.AUTO_PAUSE_SERVER_ENABLED==='true';",
"const AUTO_RULE_ALLOWED=process.env.AUTO_PAUSE_SERVER_ENABLED==='true';\nconst AUTO_RULE_FREE_MODE=process.env.AUTO_PAUSE_FREE_MODE==='true';");
replace('server.js',
"const AUTO_RULE_READY=AUTO_RULE_ALLOWED && Boolean(AUTO_RULE_FILE&&AUTO_RULE_KEY) &&\n  (!process.env.RENDER_SERVICE_ID || (RENDER_DISK_PATH && path.resolve(AUTO_RULE_FILE).startsWith(path.resolve(RENDER_DISK_PATH)+path.sep)));\nconst autoPauseStore=AUTO_RULE_READY?new AutoPauseStore(AUTO_RULE_FILE,AUTO_RULE_KEY):null;",
"const AUTO_RULE_CAPABLE=AUTO_RULE_ALLOWED && Boolean(AUTO_RULE_FILE && /^[0-9a-fA-F]{64}$/.test(AUTO_RULE_KEY)) &&\n  (AUTO_RULE_FREE_MODE || !process.env.RENDER_SERVICE_ID || (RENDER_DISK_PATH && path.resolve(AUTO_RULE_FILE).startsWith(path.resolve(RENDER_DISK_PATH)+path.sep)));\nlet autoPauseStore=null;\nif(AUTO_RULE_CAPABLE){try{autoPauseStore=new AutoPauseStore(AUTO_RULE_FILE,AUTO_RULE_KEY)}catch(e){console.error('Could not read rule store:',e.message)}}\nconst AUTO_RULE_READY=Boolean(autoPauseStore);");
replace('server.js',
"setupHint:AUTO_RULE_READY?'': 'Máy chủ chưa có lưu trữ mã hóa bền vững và chế độ chạy liên tục; không thể bật tự động 24/7 an toàn.'",
"mode:AUTO_RULE_FREE_MODE?'free':'durable',\n      reliabilityNotice:AUTO_RULE_FREE_MODE?'Chế độ miễn phí: quy tắc có thể ngừng khi máy chủ ngủ, bị khởi động lại hoặc triển khai phiên bản mới. Cần bật lại nếu trạng thái bị đặt lại.':'',\n      setupHint:AUTO_RULE_READY?'':'Máy chủ chưa được cấu hình để lưu quy tắc mã hóa.'");
replace('server.js',
"Chưa cấu hình máy chủ chạy liên tục với ổ lưu trữ mã hóa. Không thể bật tự động 24/7.",
"Chưa cấu hình kho lưu quy tắc mã hóa.");
replace('server.js',
"Máy chủ chưa có ổ lưu trữ bền vững.",
"Máy chủ chưa có kho lưu quy tắc.");
replace('server.js',
"// Server checks every two minutes independently of mobile tabs; requires paid always-on storage.",
"// Server checks every two minutes independently of mobile tabs; Free mode is best-effort.");
replace('app.js',
"$('featureAutoOffBadge').textContent=featureAutoOffConfig.enabled?'Máy chủ đang bật':'Đang tắt';",
"$('featureAutoOffBadge').textContent=featureAutoOffConfig.enabled?(state?.mode==='free'?'Bật (Free)':'Máy chủ đang bật'):'Đang tắt';");
replace('app.js',
"?'Đã bật chạy nền trên máy chủ. Kiểm tra mỗi 2 phút, kể cả khi bạn đóng điện thoại.':'Đang tắt, máy chủ không tắt camp.'",
"?(state?.mode==='free'?'Đã bật trên Render Free: cố gắng kiểm tra mỗi 2 phút, kể cả khi đóng điện thoại. Có thể gián đoạn khi Render ngủ hoặc khởi động lại.':'Đã bật chạy nền trên máy chủ. Kiểm tra mỗi 2 phút, kể cả khi bạn đóng điện thoại.'):'Đang tắt, máy chủ không tắt camp.'");
replace('app.js',
"(state?.lastError?' Lỗi: '+state.lastError:'')",
"(state?.lastError?' Lỗi: '+state.lastError:'')+(state?.reliabilityNotice?' Lưu ý: '+state.reliabilityNotice:'')");
replace('app.js',
"'Chưa thể bật 24/7: '+featureServerError+' Mở Render Dashboard để cấu hình always-on và ổ lưu trữ.'",
"'Chưa thể bật giám sát nền: '+featureServerError+'.'");
replace('app.js',
"kiểm tra 2 phút/lần ngay cả khi đóng app?",
"kiểm tra khoảng 2 phút/lần khi máy chủ còn hoạt động?");
replace('index.html','Ads Manager Pro v7.4','Ads Manager Pro v7.5');
replace('index.html','v7.4 · Chế độ máy chủ 24/7','v7.5 · Máy chủ Free');
replace('index.html','Bộ kiểm tra chạy trên máy chủ mỗi 2 phút khi bạn đã bật, ngay cả lúc đóng ứng dụng. Tắt chỉ khi Meta ghi nhận rõ 0 lượt mua.',
'Máy chủ Free cố gắng kiểm tra 2 phút/lần kể cả khi đóng app; có thể gián đoạn nếu máy chủ ngủ hoặc khởi động lại.');
replace('index.html','Bật tự tắt camp trên máy chủ 24/7','Bật tự tắt camp trên máy chủ (Free)');
replace('index.html','/app.js?v=7.4.0','/app.js?v=7.5.0');
replace('index.html','/app.css?v=7.4.0','/app.css?v=7.5.0');
replace('sw.js','ads-manager-pro-static-v7-4-0','ads-manager-pro-static-v7-5-0');
replace('package.json','"version": "7.4.0"','"version": "7.5.0"');
console.log('v7.5 Free background mode patched');
