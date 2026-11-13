// Spotify 在 ETag 命中时返回 304，而 304 没有响应体，
// spotify-proto 拿不到 protobuf 只能 passthrough，账号属性永远改不掉。
// 在请求阶段去掉条件请求头，强制服务器返回 200 完整响应。
//
// 注意：只有真的删到了头才返回 headers。无条件 $done({ headers })
// 会让 Stash 重建请求，桌面版上会导致同一 URL 的 response 脚本整条链不执行
// （日志里表现为 strip304 有记录、spotify-proto 完全没有）。
const headers = Object.assign({}, $request.headers || {});
let stripped = false;
for (const key of Object.keys(headers)) {
  const lower = key.toLowerCase();
  if (lower === "if-none-match" || lower === "if-modified-since") {
    delete headers[key];
    stripped = true;
  }
}
console.log(`strip304 ${stripped ? "stripped" : "clean"} ${$request.url}`);
if (stripped) {
  $done({ headers });
} else {
  $done({});
}
