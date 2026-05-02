const KV_KEY = "single_file_store";
const MAX_SIZE = 26214400; // 25MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 主页：生成内嵌UI网页
    if (url.pathname === "/") {
      return new Response(pageHtml(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    // 上传接口
    if (url.pathname === "/upload" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      if (!file) return resMsg("未选择文件", 400);

      if (file.size > MAX_SIZE) {
        return resMsg("文件超过25MB限制", 400);
      }

      const buf = await file.arrayBuffer();
      await env.FILE_KV.put(KV_KEY, buf, {
        metadata: {
          name: file.name,
          size: file.size
        }
      });
      return resMsg("上传成功, 已覆盖旧文件");
    }

    // 下载接口
    if (url.pathname === "/download") {
      const { value, metadata } = await env.FILE_KV.getWithMetadata(KV_KEY, "arrayBuffer");
      if (!value) return resMsg("无文件", 404);

      return new Response(value, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
        }
      });
    }

    // 删除接口
    if (url.pathname === "/delete") {
      await env.FILE_KV.delete(KV_KEY);
      return resMsg("文件已删除");
    }

    // 获取文件信息
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

// 内嵌网页UI（纯JS拼接, 无外部HTML文件）
function pageHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>单文件临时存储</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui}
body{max-width:450px;margin:60px auto;padding:0 20px}
.box{border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px}
.tip{color:#ef4444;font-size:14px;margin:8px 0}
.info{background:#f9fafb;padding:12px;border-radius:8px;margin:12px 0}
button{padding:9px 18px;border:none;border-radius:8px;cursor:pointer;margin:6px 4px}
.btn-blue{background:#3b82f6;color:#fff}
.btn-red{background:#ef4444;color:#fff}
#status{margin-top:12px;color:#16a34a}
</style>
</head>
<body>
<div class="box">
  <h3>单文件临时存储</h3>
  <p class="tip">文件最大25MB, 仅保存1个</p>
  <input type="file" id="file">
  <div>
    <button class="btn-blue" onclick="upload()">立即上传</button>
  </div>
  <div id="status"></div>
</div>

<div class="box">
  <h3>当前文件信息</h3>
  <div class="info" id="fileInfo">加载中...</div>
  <button class="btn-blue" onclick="download()">下载文件</button>
  <button class="btn-red" onclick="delFile()">删除文件</button>
</div>

<script>
function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}
async function loadInfo(){
  const res=await fetch('/info');
  const d=await res.json();
  const el=document.getElementById('fileInfo');
  if(!d.exist){
    el.innerText='暂无存储文件';
    return;
  }
  el.innerText='文件名：'+d.name+'\\n大小：'+fmtSize(d.size);
}
async function upload(){
  const f=document.getElementById('file').files[0];
  if(!f)return status('请先选择文件','red');
  status('上传中...','#3b82f6');
  const fd=new FormData();
  fd.append('file',f);
  const res=await fetch('/upload',{method:'POST',body:fd});
  const t=await res.text();
  status(t,res.ok?'green':'red');
  loadInfo();
}
function download(){window.location.href='/download'}
async function delFile(){
  if(!confirm('确定删除当前文件？'))return;
  await fetch('/delete');
  status('已删除','green');
  loadInfo();
}
function status(txt,c){
  const el=document.getElementById('status');
  el.innerText=txt;el.style.color=c;
}
window.onload=loadInfo;
</script>
</body>
</html>
  `;
}