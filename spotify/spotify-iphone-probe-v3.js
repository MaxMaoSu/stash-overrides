// 临时诊断：把 iPhone 上 spclient 响应的 URL 与内容特征回传到本机 Mac。
// iPhone 的 script-logs 读不到，控制器也只给 host，不提供路径，只能这样取证。
// 定位到播放器广告接口后，连同 provider 一起删除。
//
// 只读，不修改响应；上报失败也照常放行（$httpClient 回调里再 $done）。

(() => {
  const SINK = "http://10.0.0.2:8765/log";

  function toBytes(body) {
    if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (typeof body === "string") return new TextEncoder().encode(body);
    return null;
  }

  let line = "";
  try {
    const bytes = toBytes($response.body);
    const headers = $response.headers || {};
    const ct = headers["content-type"] || headers["Content-Type"] || "";
    let head = "";
    if (bytes) {
      const end = Math.min(bytes.length, 160);
      for (let i = 0; i < end; i++) {
        const c = bytes[i];
        head += c >= 32 && c < 127 ? String.fromCharCode(c) : ".";
      }
    }
    // 首页是 87KB+ protobuf，本机解析需要完整数据：直接回传原始 body。
    if (bytes && $request.url.indexOf("casita/") >= 0) {
      $httpClient.post({
        url: SINK,
        headers: { "x-kind": "home", "x-url": encodeURIComponent($request.url) },
        body: bytes,
      }, () => $done({}));
      return;
    }

    line = [
      "status=" + $response.status,
      "ct=" + ct,
      "len=" + (bytes ? bytes.length : -1),
      "url=" + $request.url,
      "head=" + head,
    ].join(" ") + tags;
  } catch (e) {
    line = "probe error " + (e && e.message ? e.message : String(e)) + " url=" + $request.url;
  }

  $httpClient.post({ url: SINK, headers: { "content-type": "text/plain" }, body: line }, () => $done({}));
})();
