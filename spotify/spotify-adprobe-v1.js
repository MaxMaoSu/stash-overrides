// 临时诊断脚本：记录首页推广卡片相关接口的响应特征，不修改响应。
// 定位到真正的接口后再写过滤逻辑；用完删除本条 script 与 provider。
//
// 只写日志，永远 $done({})，不会影响播放或界面数据。

(() => {
  const TAG = "adprobe v1";
  let note = "";
  try {
    const body = $response.body;
    const headers = $response.headers || {};
    const ct = headers["content-type"] || headers["Content-Type"] || "";
    let kind = typeof body;
    if (ArrayBuffer.isView(body)) kind = "view:" + (body.constructor && body.constructor.name);
    else if (body instanceof ArrayBuffer) kind = "arraybuffer";
    else if (Array.isArray(body)) kind = "array";

    let len = 0;
    let head = "";
    if (typeof body === "string") {
      len = body.length;
      head = body.slice(0, 300);
    } else if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) {
      const bytes = ArrayBuffer.isView(body)
        ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
        : new Uint8Array(body);
      len = bytes.length;
      let text = "";
      const end = Math.min(bytes.length, 300);
      for (let i = 0; i < end; i++) {
        const c = bytes[i];
        text += c >= 32 && c < 127 ? String.fromCharCode(c) : ".";
      }
      head = text;
    }

    note = "status=" + $response.status + " ct=" + ct + " kind=" + kind +
      " len=" + len + " url=" + $request.url + " head=" + head;
  } catch (e) {
    note = "probe error " + (e && e.message ? e.message : String(e));
  }
  console.log(TAG + " " + note);
  $done({});
})();
