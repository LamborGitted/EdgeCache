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
<style>
* {margin:0;padding:0;box-sizing:border-box;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;}
body {
  min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;
  background: linear-gradient(135deg, rgb(255, 100, 180) 0%, rgb(200, 150, 255) 50%, rgb(0, 255, 255) 100%);
  padding:20px;gap:16px;
}
.card {
  background:rgba(255,255,255,0.55);backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,0.6);border-radius:20px;
  padding:32px;width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.1);
  display:flex;flex-direction:column;gap:20px;
}
.title {font-size:24px;color:#111;text-align:center;font-weight:600;}
.tip {color:#666;font-size:14px;text-align:center;}
input {
  padding:16px;border-radius:14px;border:1px solid #ddd;
  font-size:16px;outline:none;transition:0.2s;
}
input:focus {border-color:#3b82f6;}
.btn {
  padding:16px;border:none;border-radius:14px;background:#3b82f6;
  color:#fff;font-size:16px;font-weight:500;cursor:pointer;
  transition:0.2s;
}
.btn:hover {transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.1);}
.history-card {
  background:rgba(255,255,255,0.45);backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,0.5);border-radius:20px;
  padding:24px;width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.08);
}
.history-header {
  display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;
}
.history-title {font-size:16px;color:#333;font-weight:600;}
.history-clear {
  font-size:13px;color:#999;cursor:pointer;background:none;border:none;
  padding:4px 8px;border-radius:8px;transition:0.2s;
}
.history-clear:hover {color:#ef4444;background:rgba(239,68,68,0.1);}
.history-empty {color:#999;font-size:14px;text-align:center;padding:8px 0;}
.history-item {
  display:flex;align-items:center;gap:12px;
  padding:12px;border-radius:12px;background:rgba(255,255,255,0.6);
  margin-bottom:8px;cursor:pointer;transition:0.2s;
}
.history-item:last-child {margin-bottom:0;}
.history-item:hover {background:rgba(255,255,255,0.85);transform:translateY(-1px);}
.history-info {flex:1;min-width:0;}
.history-name {
  font-size:14px;color:#111;font-weight:500;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.history-meta {font-size:12px;color:#888;margin-top:2px;}
.history-del {
  font-size:18px;color:#ccc;cursor:pointer;background:none;border:none;
  padding:4px 8px;border-radius:8px;flex-shrink:0;transition:0.2s;
}
.history-del:hover {color:#ef4444;background:rgba(239,68,68,0.1);}
</style>
</head>
<body>
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
        '<div class="history-name">' + escHtml(item.fileName) + '</div>' +
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
  // 工具函数：每32个字符插入换行符
  function wrapText(str, maxLength) {
    const regex = new RegExp(`(.{1,${maxLength}})`, 'g');
    return str.match(regex)?.join('\n') || str;
  }
  // 处理标识, 每32字符换行
  const wrappedKey = wrapText(rawKey, 32);
  
  const shareUrl = `${origin}/${encodedKey}/`;
  const basePath = `/${encodedKey}`;

  // ====================== 核心修改：判断换行, 控制空间标识显示 ======================
  let tipContent;
  if (wrappedKey.includes('\n')) {
    // 标识有换行 → 空间标识独立一行
    tipContent = `空间标识:\n${wrappedKey}\n单文件最大25MB`;
  } else {
    // 标识无换行 → 空间标识与标识同行
    tipContent = `空间标识: ${wrappedKey}\n单文件最大25MB`;
  }
  // ==============================================================================

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EdgeCache</title>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgb(255, 100, 180) 0%, rgb(200, 150, 255) 50%, rgb(0, 255, 255) 100%);
  padding: 20px;
}
.card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  padding: 32px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card-title {
  font-size: 24px;
  color: #111;
  text-align: center;
  font-weight: 600;
}
.tip {
  color: #dc2626;
  font-size: 14px;
  text-align: center;
  white-space: pre-wrap;
  line-height: 1.6;
}
.file-info {
  background: rgba(255, 255, 255, 0.7);
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  font-size: 15px;
  line-height: 1.8;
  word-break: break-all;
  white-space: pre-wrap;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
}
.expiry-info {
  color: #ef4444;
  font-size: 14px;
  line-height: 1.6;
}
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}
.btn {
  padding: 16px;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: 0.2s;
}
.btn-primary {background: #3b82f6;color: #fff;}
.btn-success {background: #10b981;color: #fff;}
.btn-danger {background: #ef4444;color: #fff;}
.btn-secondary {background: #6b7280;color: #fff;}
.upload-btn {
  background: #3b82f6;
  color: #fff;
  padding: 16px;
  border-radius: 14px;
  cursor: pointer;
  text-align: center;
  font-size: 16px;
}
#status {
  color: #dc2626;
  font-size: 14px;
  text-align: center;
  min-height: 20px;
}
#uploadArea, #fileArea {display: none;}
input[type="file"] {position: absolute;opacity: 0;width: 0;height: 0;}
.btn:hover, .upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.slider-container {
  width: 100%;
  padding: 10px 0;
}
.slider-label {
  text-align: center;
  font-size: 15px;
  color: #333;
  margin-bottom: 8px;
}
input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  background: #ddd;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}
</style>
</head>
<body>
<div id="uploadArea" class="card">
  <h2 class="card-title">上传文件</h2>
  <p class="tip">${tipContent}</p>
  
  <div class="slider-container">
    <div class="slider-label">文件有效期：<span id="ttlText">30分钟</span></div>
    <input type="range" id="ttlSlider" min="0" max="5" value="1" step="1">
  </div>

  <label class="upload-btn" for="file">选择文件上传</label>
  <input type="file" id="file">
  <button class="btn btn-secondary" onclick="backToInput()">返回首页</button>
  <div id="status"></div>
</div>

<div id="fileArea" class="card">
  <h2 class="card-title">当前文件</h2>
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
const basePath = "${basePath}";
const shareUrl = "${shareUrl}";

// 新增1分钟测试选项, 共6个档位
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

// 分两行显示：有效期剩余 + 过期时间
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
  // LLM经常乱改下面第二行
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