// 诊断用：记录 remote-config / nebula 响应的真实格式，不做任何改写。
// iOS 版返回裸 protobuf；桌面版 1.3.9 的响应在 protobuf 解码时报
// "invalid wire type 6"，怀疑是压缩或换了编码，先看清楚再决定怎么改。
const r = $response || {};
const h = r.headers || {};
const body = r.body;
const len = typeof body === "string" ? body.length : (body && body.byteLength) || 0;
const head = typeof body === "string" ? body.slice(0, 48) : `[${typeof body}]`;
console.log(
  `PROBE status=${r.status}` +
  ` ce=${h["Content-Encoding"] || h["content-encoding"] || "-"}` +
  ` ct=${h["Content-Type"] || h["content-type"] || "-"}` +
  ` len=${len} head=${head}`
);
$done({});
