// 广告链路兜底拦截（request 阶段直接返回空 JSON 200）。
//
// 用于那些拿不到可靠结构、或者本来就不该让客户端拿到数据的端点：
//   gabo-receiver-service  —— 音频广告投递与曝光上报
//   pam-view-service       —— Premium 全屏推广页（Ads Marketplace）
//   capping-api            —— 广告频次控制
//   sponsoredplaylist      —— 播放页 Sponsored 卡片（protobuf，无法结构化清理）
//   ad-logic/vN/config     —— 广告逻辑配置
//   ads/vN/config          —— 广告位配置
//
// 只有确定能结构化处理的接口才用 spotify-adclean（response 阶段清空数组）：
// ads/vN/ads、ad-logic/prefetch、pendragon。两者 match 不重叠。
//
// 必须返回合法 JSON 空对象而不是空 body：这些接口客户端按 JSON 解码，
// 0 字节会抛 SyntaxError 走进异常分支。直接 REJECT 会让客户端不断重试。

const body = "{}";
const headers = {
  "cache-control": "no-cache",
  "content-length": String(body.length),
  "content-type": "application/json",
};
console.log(`adblock ${$request.url}`);
$done({ response: { status: 200, headers, body } });
