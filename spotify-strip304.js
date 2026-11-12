// Spotify 在 ETag 命中时返回 304，而 304 没有响应体，
// spotify-proto 拿不到 protobuf 只能 passthrough，账号属性永远改不掉。
// 在请求阶段去掉条件请求头，强制服务器返回 200 完整响应。
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
$done({ headers });
