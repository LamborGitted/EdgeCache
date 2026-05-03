export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const pathParts = url.pathname.split('/').filter(Boolean);

    const encodedKey = pathParts[0] || '';
    const MAX_ENCODED_LENGTH = 128;

    if (url.pathname === '/' || !encodedKey || encodedKey.length > MAX_ENCODED_LENGTH) {
      return new Response(inputHtml(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    const KV_KEY = decodeURIComponent(encodedKey);

    if (pathParts.length === 1) {
      return new Response(pageHtml(encodedKey, KV_KEY, origin), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    if (pathParts[1] === "upload" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file");
        const ttl = parseInt(form.get('ttl')) || 1800;
        const buf = await file.arrayBuffer();
        const expiration = Math.floor(Date.now()/1000) + ttl;
        
        await env.FILE_KV.put(KV_KEY, buf, {
          metadata: { 
            name: file.name, 
            size: file.size,
            ttl: ttl,
            expiration: expiration
          },
          expirationTtl: ttl
        });
        return new Response("ok");
      } catch (err) {
        return resMsg("上传失败, 文件可能超过25MB", 400);
      }
    }

    if (pathParts[1] === "download") {
      const { value, metadata } = await env.FILE_KV.getWithMetadata(KV_KEY, "arrayBuffer");
      if (!value) return resMsg("未找到文件", 404);
      return new Response(value, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
        }
      });
    }

    if (pathParts[1] === "delete") {
      await env.FILE_KV.delete(KV_KEY);
      return new Response("ok");
    }

    if (pathParts[1] === "info") {
      const { metadata } = await env.FILE_KV.getWithMetadata(KV_KEY);
      return new Response(JSON.stringify({
        exist: !!metadata,
        name: metadata?.name || "",
        size: metadata?.size || 0,
        ttl: metadata?.ttl || 0,
        expiration: metadata?.expiration || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return resMsg("404", 404);
  }
};

function resMsg(text, status = 200) {
  return new Response(text, { status });
}

function inputHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EdgeCache</title>
<script>(function(){var t=localStorage.getItem('ec_theme');if(t)document.documentElement.setAttribute('data-theme',t);else if(window.matchMedia('(prefers-color-scheme:light)').matches)document.documentElement.setAttribute('data-theme','light');})()</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#06060b;--surface:#111118;--surface-2:#191922;
  --border:#2a2a3a;--border-hover:#3a3a50;
  --text:#eaeaf2;--text-2:#9898b4;--text-3:#5c5c72;
  --accent:#c8a044;--accent-hover:#dab050;
  --accent-glow:rgba(200,160,68,0.12);--accent-glow-strong:rgba(200,160,68,0.25);
  --red:#d84050;--red-dim:rgba(216,64,80,0.1);
  --green:#40b880;--green-dim:rgba(64,184,128,0.12);
  --grid-color:rgba(42,42,58,0.18);--glow-color:rgba(200,160,68,0.045);
  --radius:10px;
  --font:'Sora',system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;
}
[data-theme="light"]{
  --bg:#f4f4f8;--surface:#ffffff;--surface-2:#eaeaef;
  --border:#d0d0dc;--border-hover:#b8b8c8;
  --text:#1a1a28;--text-2:#5a5a70;--text-3:#8a8a9e;
  --accent:#9a7020;--accent-hover:#b08428;
  --accent-glow:rgba(154,112,32,0.1);--accent-glow-strong:rgba(154,112,32,0.2);
  --red:#c03040;--red-dim:rgba(192,48,64,0.08);
  --green:#2a9060;--green-dim:rgba(42,144,96,0.1);
  --grid-color:rgba(0,0,0,0.045);--glow-color:rgba(180,140,40,0.06);
}
::selection{background:var(--accent-glow-strong);color:var(--text)}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

body{
  min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;
  background:var(--bg);color:var(--text);font-family:var(--font);
  padding:20px;gap:20px;position:relative;overflow-x:hidden;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%,var(--glow-color) 0%,transparent 100%),
    repeating-linear-gradient(0deg,transparent,transparent 47px,var(--grid-color) 47px,var(--grid-color) 48px),
    repeating-linear-gradient(90deg,transparent,transparent 47px,var(--grid-color) 47px,var(--grid-color) 48px);
}
body>*{position:relative;z-index:1}

.theme-toggle{
  position:fixed;top:16px;right:16px;z-index:100;
  width:36px;height:36px;border-radius:8px;border:1px solid var(--border);
  background:var(--surface);color:var(--text-3);cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:all .2s;padding:0;
}
.theme-toggle:hover{border-color:var(--accent);color:var(--accent)}
.theme-toggle .ico-moon{display:none}
.theme-toggle .ico-sun{display:block}
[data-theme="light"] .theme-toggle .ico-moon{display:block}
[data-theme="light"] .theme-toggle .ico-sun{display:none}

.brand{
  display:flex;align-items:center;justify-content:center;gap:10px;
  padding:4px 0 0;animation:slideUp .5s ease-out both;
}
.brand svg.hex{color:var(--accent);opacity:.85}
.brand-name{
  font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--text-2);
}

.card{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:28px 24px;width:100%;max-width:400px;
  display:flex;flex-direction:column;gap:18px;
  animation:slideUp .5s ease-out .08s both;position:relative;overflow:hidden;
}
.card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent 5%,var(--accent) 50%,transparent 95%);opacity:.5;
}

.title{font-size:19px;font-weight:600;text-align:center;color:var(--text);letter-spacing:-.01em}
.tip{color:var(--text-3);font-size:13px;text-align:center;line-height:1.5}

input[type="text"]{
  width:100%;padding:14px 16px;background:var(--surface-2);
  border:1px solid var(--border);border-radius:8px;
  color:var(--text);font-family:var(--font);font-size:15px;
  outline:none;transition:border-color .2s,box-shadow .2s;
}
input[type="text"]:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
input[type="text"]::placeholder{color:var(--text-3)}

.btn{
  display:block;width:100%;padding:14px;border:none;border-radius:8px;
  font-family:var(--font);font-size:15px;font-weight:600;cursor:pointer;
  text-align:center;transition:all .2s;letter-spacing:.02em;
  background:var(--accent);color:#0a0a0f;
}
.btn:hover{background:var(--accent-hover);transform:translateY(-1px);box-shadow:0 4px 24px var(--accent-glow)}
.btn:active{transform:translateY(0)}

.history-card{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px 24px;width:100%;max-width:400px;
  animation:slideUp .5s ease-out .16s both;
}
.history-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.history-title{
  font-size:11px;font-weight:600;color:var(--text-3);
  letter-spacing:.12em;text-transform:uppercase;
}
.history-clear{
  font-size:12px;color:var(--text-3);background:none;border:none;cursor:pointer;
  padding:4px 10px;border-radius:6px;font-family:var(--font);transition:.2s;
}
.history-clear:hover{color:var(--red);background:var(--red-dim)}
.history-empty{color:var(--text-3);font-size:13px;text-align:center;padding:8px 0}
.history-item{
  display:flex;align-items:center;gap:12px;padding:10px 12px;
  border-radius:8px;background:var(--surface-2);
  margin-bottom:6px;cursor:pointer;transition:all .2s;
  border:1px solid transparent;
}
.history-item:last-child{margin-bottom:0}
.history-item:hover{border-color:var(--border);transform:translateX(4px)}
.history-info{flex:1;min-width:0}
.history-name{font-size:13px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.history-meta{font-size:11px;color:var(--text-3);margin-top:3px}
.history-del{
  font-size:15px;color:var(--text-3);background:none;border:none;cursor:pointer;
  padding:4px 8px;border-radius:6px;flex-shrink:0;transition:.2s;font-family:var(--font);line-height:1;
}
.history-del:hover{color:var(--red);background:var(--red-dim)}

@keyframes slideUp{
  from{opacity:0;transform:translateY(18px)}
  to{opacity:1;transform:translateY(0)}
}
@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
}
</style>
</head>
<body>

<button class="theme-toggle" onclick="toggleTheme()" aria-label="切换主题">
  <svg class="ico-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  <svg class="ico-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
</button>

<div class="brand">
  <svg class="hex" width="18" height="20" viewBox="0 0 20 22" fill="none"><path d="M10 0L20 5.5V16.5L10 22L0 16.5V5.5L10 0Z" stroke="currentColor" stroke-width="1.3"/></svg>
  <span class="brand-name">EdgeCache</span>
</div>

<div class="card">
  <h2 class="title">进入专属文件空间</h2>
  <p class="tip">输入自定义标识, 用于鉴权</p>
  <input type="text" id="key" placeholder="例: test1、测试1" autocomplete="off">
  <button class="btn" onclick="go()">下一步</button>
</div>

<div class="history-card" id="historyCard" style="display:none;">
  <div class="history-header">
    <span class="history-title">历史记录</span>
    <button class="history-clear" onclick="clearHistory()">清空</button>
  </div>
  <div id="historyList"></div>
</div>

<script>
function toggleTheme(){
  var h=document.documentElement;
  var c=h.getAttribute('data-theme')||'dark';
  var n=c==='dark'?'light':'dark';
  h.setAttribute('data-theme',n);
  localStorage.setItem('ec_theme',n);
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem('edgecache_history') || '[]'); }
  catch { return []; }
}
function saveHistory(list) {
  localStorage.setItem('edgecache_history', JSON.stringify(list));
}
function fmtSize(b) {
  if(b<1024) return b+'B';
  if(b<1048576) return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}
function fmtDate(ts) {
  return new Date(ts).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function renderHistory() {
  const list = getHistory();
  const card = document.getElementById('historyCard');
  const container = document.getElementById('historyList');
  if (!list.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  container.innerHTML = list.map((item, i) =>
    '<div class="history-item" onclick="enterHistory('+i+')">' +
      '<div class="history-info">' +
        '<div class="history-name">' + escHtml(item.rawKey) + '/' + escHtml(item.fileName) + '</div>' +
        '<div class="history-meta">' + fmtSize(item.fileSize) + ' · ' + fmtDate(item.uploadTime) + '</div>' +
      '</div>' +
      '<button class="history-del" onclick="event.stopPropagation();delHistory('+i+')">×</button>' +
    '</div>'
  ).join('');
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function enterHistory(i) {
  const list = getHistory();
  if (list[i]) window.location.href = '/' + list[i].encodedKey + '/';
}
function delHistory(i) {
  const list = getHistory();
  list.splice(i, 1);
  saveHistory(list);
  renderHistory();
}
function clearHistory() {
  if (!confirm('确定清空所有历史记录？')) return;
  localStorage.removeItem('edgecache_history');
  renderHistory();
}
function go(){
  const key = document.getElementById('key').value.trim();
  if(!key) {alert('请输入标识');return;}
  const encoded = encodeURIComponent(key);
  if(encoded.length > 128){
    alert('编码后最多允许128个字符!');
    return;
  }
  window.location.href = '/' + encoded + '/';
}
renderHistory();
</script>
</body>
</html>
`;
}

function pageHtml(encodedKey, rawKey, origin) {
  function wrapText(str, maxLength) {
    const regex = new RegExp(`(.{1,${maxLength}})`, 'g');
    return str.match(regex)?.join('\n') || str;
  }
  const wrappedKey = wrapText(rawKey, 32);
  
  const shareUrl = `${origin}/${encodedKey}/`;
  const basePath = `/${encodedKey}`;

  let tipContent;
  if (wrappedKey.includes('\n')) {
    tipContent = `空间标识:\n${wrappedKey}\n单文件最大25MB`;
  } else {
    tipContent = `空间标识: ${wrappedKey}\n单文件最大25MB`;
  }

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EdgeCache</title>
<script>(function(){var t=localStorage.getItem('ec_theme');if(t)document.documentElement.setAttribute('data-theme',t);else if(window.matchMedia('(prefers-color-scheme:light)').matches)document.documentElement.setAttribute('data-theme','light');})()</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#06060b;--surface:#111118;--surface-2:#191922;
  --border:#2a2a3a;--border-hover:#3a3a50;
  --text:#eaeaf2;--text-2:#9898b4;--text-3:#5c5c72;
  --accent:#c8a044;--accent-hover:#dab050;
  --accent-glow:rgba(200,160,68,0.12);--accent-glow-strong:rgba(200,160,68,0.25);
  --red:#d84050;--red-dim:rgba(216,64,80,0.1);
  --green:#40b880;--green-dim:rgba(64,184,128,0.12);
  --grid-color:rgba(42,42,58,0.18);--glow-color:rgba(200,160,68,0.045);
  --radius:10px;
  --font:'Sora',system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;
}
[data-theme="light"]{
  --bg:#f4f4f8;--surface:#ffffff;--surface-2:#eaeaef;
  --border:#d0d0dc;--border-hover:#b8b8c8;
  --text:#1a1a28;--text-2:#5a5a70;--text-3:#8a8a9e;
  --accent:#9a7020;--accent-hover:#b08428;
  --accent-glow:rgba(154,112,32,0.1);--accent-glow-strong:rgba(154,112,32,0.2);
  --red:#c03040;--red-dim:rgba(192,48,64,0.08);
  --green:#2a9060;--green-dim:rgba(42,144,96,0.1);
  --grid-color:rgba(0,0,0,0.045);--glow-color:rgba(180,140,40,0.06);
}
::selection{background:var(--accent-glow-strong);color:var(--text)}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

body{
  min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;
  background:var(--bg);color:var(--text);font-family:var(--font);
  padding:20px;gap:20px;position:relative;overflow-x:hidden;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%,var(--glow-color) 0%,transparent 100%),
    repeating-linear-gradient(0deg,transparent,transparent 47px,var(--grid-color) 47px,var(--grid-color) 48px),
    repeating-linear-gradient(90deg,transparent,transparent 47px,var(--grid-color) 47px,var(--grid-color) 48px);
}
body>*{position:relative;z-index:1}

.theme-toggle{
  position:fixed;top:16px;right:16px;z-index:100;
  width:36px;height:36px;border-radius:8px;border:1px solid var(--border);
  background:var(--surface);color:var(--text-3);cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:all .2s;padding:0;
}
.theme-toggle:hover{border-color:var(--accent);color:var(--accent)}
.theme-toggle .ico-moon{display:none}
.theme-toggle .ico-sun{display:block}
[data-theme="light"] .theme-toggle .ico-moon{display:block}
[data-theme="light"] .theme-toggle .ico-sun{display:none}

.brand{
  display:flex;align-items:center;justify-content:center;gap:10px;
  padding:4px 0 0;animation:slideUp .5s ease-out both;
}
.brand svg.hex{color:var(--accent);opacity:.85}
.brand-name{
  font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--text-2);
}

.card{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:28px 24px;width:100%;max-width:400px;
  display:flex;flex-direction:column;gap:18px;
  animation:slideUp .5s ease-out .08s both;position:relative;overflow:hidden;
}
.card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent 5%,var(--accent) 50%,transparent 95%);opacity:.5;
}

.title{font-size:19px;font-weight:600;text-align:center;color:var(--text);letter-spacing:-.01em}

.tip{
  color:var(--text-2);font-size:13px;text-align:center;white-space:pre-wrap;line-height:1.6;
  padding:12px 14px;background:var(--accent-glow);border-radius:8px;
  border-left:2px solid var(--accent);
}

.upload-zone{
  border:2px dashed var(--border);border-radius:var(--radius);
  padding:22px 16px;text-align:center;cursor:pointer;
  color:var(--text-2);font-size:14px;font-family:var(--font);
  transition:all .25s;display:block;
}
.upload-zone:hover{
  border-color:var(--accent);color:var(--accent);background:var(--accent-glow);
}

.file-info{
  background:var(--surface-2);border:1px solid var(--border);border-radius:8px;
  padding:18px;text-align:center;font-size:14px;line-height:1.8;
  word-break:break-all;white-space:pre-wrap;min-height:80px;
  display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;
  color:var(--text-2);
}
.expiry-info{color:var(--red);font-size:13px;line-height:1.6}

.btn-group{display:flex;flex-direction:column;gap:8px;margin-top:auto}

.btn{
  display:block;width:100%;padding:14px;border-radius:8px;
  font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer;
  text-align:center;transition:all .2s;letter-spacing:.02em;
}
.btn-primary{background:var(--accent);border:none;color:#0a0a0f}
.btn-primary:hover{background:var(--accent-hover);transform:translateY(-1px);box-shadow:0 4px 24px var(--accent-glow)}
.btn-success{background:var(--green);border:none;color:#0a0a0f}
.btn-success:hover{transform:translateY(-1px);box-shadow:0 4px 24px var(--green-dim)}
.btn-danger{background:transparent;border:1px solid var(--red);color:var(--red)}
.btn-danger:hover{background:var(--red-dim);transform:translateY(-1px)}
.btn-secondary{background:transparent;border:1px solid var(--border);color:var(--text-2)}
.btn-secondary:hover{border-color:var(--border-hover);color:var(--text)}
.btn:active{transform:translateY(0)!important}

.slider-container{width:100%;padding:6px 0}
.slider-label{text-align:center;font-size:13px;color:var(--text-2);margin-bottom:10px}
.slider-label span{color:var(--accent);font-weight:600}

input[type="range"]{
  width:100%;height:4px;border-radius:2px;outline:none;-webkit-appearance:none;
  background:var(--border);
}
input[type="range"]::-webkit-slider-thumb{
  -webkit-appearance:none;width:18px;height:18px;border-radius:50%;
  background:var(--accent);cursor:pointer;border:3px solid var(--surface);
  box-shadow:0 0 10px var(--accent-glow);
}
input[type="range"]::-moz-range-thumb{
  width:18px;height:18px;border-radius:50%;
  background:var(--accent);cursor:pointer;border:3px solid var(--surface);
}

#status{color:var(--red);font-size:13px;text-align:center;min-height:20px}
#uploadArea,#fileArea{display:none}
input[type="file"]{position:absolute;opacity:0;width:0;height:0}

@keyframes slideUp{
  from{opacity:0;transform:translateY(18px)}
  to{opacity:1;transform:translateY(0)}
}
@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
}
</style>
</head>
<body>

<button class="theme-toggle" onclick="toggleTheme()" aria-label="切换主题">
  <svg class="ico-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  <svg class="ico-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
</button>

<div class="brand">
  <svg class="hex" width="18" height="20" viewBox="0 0 20 22" fill="none"><path d="M10 0L20 5.5V16.5L10 22L0 16.5V5.5L10 0Z" stroke="currentColor" stroke-width="1.3"/></svg>
  <span class="brand-name">EdgeCache</span>
</div>

<div id="uploadArea" class="card">
  <h2 class="title">上传文件</h2>
  <p class="tip">${tipContent}</p>
  
  <div class="slider-container">
    <div class="slider-label">文件有效期：<span id="ttlText">30分钟</span></div>
    <input type="range" id="ttlSlider" min="0" max="5" value="1" step="1">
  </div>

  <label class="upload-zone" for="file">↑ 选择文件上传</label>
  <input type="file" id="file">
  <button class="btn btn-secondary" onclick="backToInput()">返回首页</button>
  <div id="status"></div>
</div>

<div id="fileArea" class="card">
  <h2 class="title">当前文件</h2>
  <div class="file-info">
    <div id="fileBasicInfo"></div>
    <div id="fileExpiryInfo" class="expiry-info"></div>
  </div>
  <div class="btn-group">
    <button class="btn btn-primary" onclick="download()">下载文件</button>
    <button class="btn btn-success" onclick="share()">分享链接</button>
    <button class="btn btn-danger" onclick="delFile()">删除文件</button>
  </div>
</div>

<script>
function toggleTheme(){
  var h=document.documentElement;
  var c=h.getAttribute('data-theme')||'dark';
  var n=c==='dark'?'light':'dark';
  h.setAttribute('data-theme',n);
  localStorage.setItem('ec_theme',n);
}
const basePath = "${basePath}";
const shareUrl = "${shareUrl}";

const ttlOptions = [
  { text: '5分钟', value: 300 },
  { text: '30分钟', value: 1800 },
  { text: '1小时', value: 3600 },
  { text: '6小时', value: 21600 },
  { text: '12小时', value: 43200 },
  { text: '1天', value: 86400 }
];

const slider = document.getElementById('ttlSlider');
const ttlText = document.getElementById('ttlText');
let currentTtl = ttlOptions[0].value;
let expiryInterval;

slider.addEventListener('input', () => {
  const index = parseInt(slider.value);
  ttlText.innerText = ttlOptions[index].text;
  currentTtl = ttlOptions[index].value;
});

function backToInput(){
  window.location.href = '/';
}

function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}

function fmtTime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400)/3600);
  const m = Math.floor((seconds % 3600)/60);
  const s = seconds % 60;
  
  let parts = [];
  if (d > 0) parts.push(d + '天');
  if (h > 0) parts.push(h + '小时');
  if (m > 0) parts.push(m + '分钟');
  if (s > 0 || parts.length === 0) parts.push(s + '秒');
  
  return parts.join(' ');
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function updateExpiryDisplay(expiration) {
  const now = Math.floor(Date.now()/1000);
  const remaining = expiration - now;
  
  if (remaining <= 0) {
    document.getElementById('fileExpiryInfo').innerText = '文件已过期';
    clearInterval(expiryInterval);
    return;
  }
  
  const ttlText = fmtTime(remaining);
  const expiryDate = formatDate(expiration);
  document.getElementById('fileExpiryInfo').innerText = 
    \`剩余有效期：\${ttlText}\\n过期时间：\${expiryDate}\`;
}

async function loadInfo(){
  const res=await fetch(basePath+'/info');
  const d=await res.json();
  
  const uploadArea = document.getElementById('uploadArea');
  const fileArea = document.getElementById('fileArea');
  const status = document.getElementById('status');

  if(!d.exist){
    uploadArea.style.display = 'flex';
    fileArea.style.display = 'none';
    status.innerText = '';
    clearInterval(expiryInterval);
    return;
  }
  
  uploadArea.style.display = 'none';
  fileArea.style.display = 'flex';
  document.getElementById('fileBasicInfo').innerText = d.name+'\\n大小: '+fmtSize(d.size);
  
  if (d.expiration) {
    updateExpiryDisplay(d.expiration);
    if (expiryInterval) clearInterval(expiryInterval);
    expiryInterval = setInterval(() => {
      updateExpiryDisplay(d.expiration);
    }, 1000);
  } else {
    document.getElementById('fileExpiryInfo').innerText = '无过期时间设置';
  }
}

function saveToHistory(fileName, fileSize) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('edgecache_history') || '[]'); }
  catch {}
  list.unshift({
    encodedKey: "${encodedKey}",
    rawKey: "${rawKey}",
    fileName: fileName,
    fileSize: fileSize,
    shareUrl: shareUrl,
    uploadTime: Date.now()
  });
  if (list.length > 20) list = list.slice(0, 20);
  localStorage.setItem('edgecache_history', JSON.stringify(list));
}

let lastUploadedName = '';
let lastUploadedSize = 0;

document.getElementById('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  lastUploadedName = f.name;
  lastUploadedSize = f.size;
  const fd = new FormData();
  fd.append('file', f);
  fd.append('ttl', currentTtl);
  
  const res = await fetch(basePath+'/upload', { method:'POST', body:fd });
  const text = await res.text();
  if(!res.ok){
    document.getElementById('status').innerText = text;
  }else{
    document.getElementById('status').innerText = '';
    saveToHistory(lastUploadedName, lastUploadedSize);
    loadInfo();
  }
});

function download(){window.location.href=basePath+'/download'}
async function delFile(){
  await fetch(basePath+'/delete');
  clearInterval(expiryInterval);
  loadInfo();
}

async function share(){
  try {
    await navigator.clipboard.writeText(shareUrl);
    alert('链接复制成功!');
  } catch (e) {
    alert('复制失败, 请手动复制: '+shareUrl);
  }
}

window.onload=loadInfo;
window.onbeforeunload = () => {
  clearInterval(expiryInterval);
};
</script>
</body>
</html>
`;
}
