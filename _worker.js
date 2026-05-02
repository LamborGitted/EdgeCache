const KV_KEY = "single_file_store";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(pageHtml(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file");
        const buf = await file.arrayBuffer();

        await env.FILE_KV.put(KV_KEY, buf, {
          metadata: { name: file.name, size: file.size }
        });

        return new Response("ok");
      } catch (err) {
        return resMsg("上传失败, 可能文件过大", 400);
      }
    }

    if (url.pathname === "/download") {
      const { value, metadata } = await env.FILE_KV.getWithMetadata(KV_KEY, "arrayBuffer");
      if (!value) return resMsg("未上传文件", 404);
      return new Response(value, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
        }
      });
    }

    if (url.pathname === "/delete") {
      await env.FILE_KV.delete(KV_KEY);
      return new Response("ok");
    }

    if (url.pathname === "/info") {
      const { metadata } = await env.FILE_KV.getWithMetadata(KV_KEY);
      return new Response(JSON.stringify({
        exist: !!metadata,
        name: metadata?.name || "",
        size: metadata?.size || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return resMsg("404");
  }
};

function resMsg(text, status = 200) {
  return new Response(text, { status });
}

function pageHtml() {
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
  /* 保留你要求的渐变背景 */
  background: linear-gradient(135deg, rgb(255, 100, 180) 0%, rgb(200, 150, 255) 50%, rgb(0, 255, 255) 100%);
  padding: 20px;
}

/* 核心卡片：响应式，无固定宽高 */
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

/* 标题样式 */
.card-title {
  font-size: 24px;
  color: #111;
  text-align: center;
  font-weight: 600;
}

/* 提示文字 */
.tip {
  color: #dc2626;
  font-size: 14px;
  text-align: center;
}

/* 文件信息盒子：支持长文本换行 */
.file-info {
  background: rgba(255, 255, 255, 0.7);
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 按钮容器：弹性布局，自动间距 */
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto; /* 自动推到下方，永远留间距 */
}

/* 按钮样式 */
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

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

/* 上传按钮 */
.upload-btn {
  background: #3b82f6;
  color: #fff;
  padding: 16px;
  border-radius: 14px;
  cursor: pointer;
  text-align: center;
  font-size: 16px;
}

/* 状态提示 */
#status {
  color: #dc2626;
  font-size: 14px;
  text-align: center;
  min-height: 20px;
}

/* 隐藏元素 */
#uploadArea, #fileArea {
  display: none;
}

/* 隐藏原生文件选择框 */
input[type="file"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* hover 动效 */
.btn:hover, .upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
</style>
</head>
<body>

<!-- 上传区域 -->
<div id="uploadArea" class="card">
  <h2 class="card-title">上传文件</h2>
  <p class="tip">仅保存1个 · KV 单文件限制 25MB</p>
  <label class="upload-btn" for="file">选择文件上传</label>
  <input type="file" id="file">
  <div id="status"></div>
</div>

<!-- 文件展示区域 -->
<div id="fileArea" class="card">
  <h2 class="card-title">当前文件</h2>
  <div class="file-info" id="fileInfo"></div>
  <div class="btn-group">
    <button class="btn btn-primary" onclick="download()">下载文件</button>
    <button class="btn btn-danger" onclick="delFile()">删除文件</button>
  </div>
</div>

<script>
// 文件大小格式化
function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}

// 加载文件信息
async function loadInfo(){
  const res=await fetch('/info');
  const d=await res.json();
  
  const uploadArea = document.getElementById('uploadArea');
  const fileArea = document.getElementById('fileArea');
  const status = document.getElementById('status');

  if(!d.exist){
    uploadArea.style.display = 'flex';
    fileArea.style.display = 'none';
    status.innerText = '';
    return;
  }

  uploadArea.style.display = 'none';
  fileArea.style.display = 'flex';
  document.getElementById('fileInfo').innerText = d.name+'\\n大小：'+fmtSize(d.size);
}

// 上传文件
document.getElementById('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;

  const fd = new FormData();
  fd.append('file', f);
  
  const res = await fetch('/upload', { method:'POST', body:fd });
  const text = await res.text();

  if(!res.ok){
    document.getElementById('status').innerText = text;
  }else{
    document.getElementById('status').innerText = '';
    loadInfo();
  }
});

// 下载文件
function download(){window.location.href='/download'}

// 删除文件
async function delFile(){
  await fetch('/delete');
  loadInfo();
}

window.onload=loadInfo;
</script>
</body>
</html>
`;
}