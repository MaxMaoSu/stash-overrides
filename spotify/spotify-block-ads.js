// Spotify 广告投递拦截。
// gabo-receiver-service：音频广告下发（播放页的 Sponsored 卡片不在这里，
// 它走 sponsoredplaylist，见 spotify-block-sponsored.js）。
// pam-view-service：Premium 全屏推广页（Premium Ads Marketplace）。
// pendragon：Pendo 引导/推广弹窗。
// ad-* / ads/：新的广告链路（ad-logic、ad-slot 等），按前缀兜底。
// 统一返回空对象 200，客户端拿不到广告数据就不渲染；直接 REJECT 会让客户端重试。
// body 必须是合法 JSON 空对象：这些接口客户端都按 JSON 解码，
// 0 字节 body 会抛 SyntaxError 并走异常分支，比拿到 {} 更糟。
const body = "{}";
const headers = {
  "cache-control": "no-cache",
  "content-length": String(body.length),
  "content-type": "application/json",
};
console.log(`block-ads ${$request.url}`);
$done({ response: { status: 200, headers, body } });
