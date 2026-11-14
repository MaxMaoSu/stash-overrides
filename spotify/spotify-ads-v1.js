// 清空屏幕广告位：`ads/v3/ads` 返回的 pod 里放的就是推广素材。
//
// 抓到的真实响应：
//   GET https://guc3-spclient.spotify.com/ads/v3/ads?slots=hpto
//   200 {"pod":{"hpto":[{"id":"...","clickthrough":"https://www.coach.com/...", ...}]}}
// `hpto` = Home Page TakeOver，就是首页顶部那张全宽品牌推广卡片。
//
// 只清空 pod 下每个 slot 的数组，保留 JSON 结构，客户端拿到的是「没有广告」而不是错误。
// 解析失败一律放行，并把原因写进 script-logs/spotify-ads.log。

(() => {
  const TAG = "spotify-ads v1";

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
    if (Array.isArray(body)) return new TextDecoder().decode(new Uint8Array(body));
    throw new Error("unsupported body type: " + typeof body);
  }

  let out = null;
  let note = "";
  try {
    const status = $response.status;
    if (status !== undefined && Number(status) !== 200) {
      note = "status " + status + ", passthrough";
    } else {
      const data = JSON.parse(toText($response.body));
      const pod = data && data.pod;
      if (!pod || typeof pod !== "object") {
        note = "no pod, passthrough";
      } else {
        const slots = [];
        let removed = 0;
        for (const key of Object.keys(pod)) {
          if (!Array.isArray(pod[key])) continue;
          slots.push(key + ":" + pod[key].length);
          removed += pod[key].length;
          pod[key] = [];
        }
        note = "slots=" + slots.join(",") + " removed=" + removed;
        if (removed) out = { body: JSON.stringify(data) };
      }
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  console.log(TAG + " " + note);
  $done(out ? { body: out.body } : {});
})();
