// Sponsored 卡片下发接口（sponsoredplaylist/v1/sponsored）返回 protobuf。
// 空 body 等价于空 message，客户端渲染不出卡片；返回 {} 反而会让 protobuf 解码失败。
console.log(`block-sponsored ${$request.url}`);
$done({
  response: {
    status: 200,
    headers: { "cache-control": "no-cache", "content-length": "0" },
    body: "",
  },
});
