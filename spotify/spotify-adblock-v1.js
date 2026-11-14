// 广告链路兜底拦截（request 阶段直接返回空响应）。
//
// 只用于拿不到可结构化清理的数据、或本来就不该让客户端拿到数据的端点。
// 能按 JSON 结构清理的走 spotify-adclean（response 阶段清空数组），两者 match 不重叠。
//
// 响应体按客户端的解码方式区分，写错会直接抛解码异常：
//   protobuf 端点：sponsoredplaylist、ad-logic/vN/config → 0 字节空 body
//   JSON 端点：gabo-receiver-service、pam-view-service、ads/vN/config → {}
//
// 直接 REJECT 会让客户端不断重试，所以统一回 200。
//
// 注意命中范围：
//   gabo 会连带拦掉 /v3/events、/public/v3/events 等曝光上报（丢埋点，不影响播放）；
//   ads/vN/config 是 JSON 广告位配置，返回 {} 后播放是否完全正常只在旧版验证过。

const url = $request.url || "";

// protobuf 端点：客户端按二进制解码，空 body 等价于空 message；
// 给 "{}" 反而会在解码时抛异常。
const isProto = /(?:sponsoredplaylist|ad-logic\/v[0-9]+\/config)/.test(url);

const headers = isProto
  ? { "cache-control": "no-cache", "content-length": "0" }
  : {
      "cache-control": "no-cache",
      "content-length": "2",
      "content-type": "application/json",
    };

console.log(`adblock ${isProto ? "empty" : "json"} ${url}`);
$done({ response: { status: 200, headers, body: isProto ? "" : "{}" } });
