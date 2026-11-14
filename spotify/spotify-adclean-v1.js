// 广告投递接口统一清理（response 阶段，结构化处理，不伪造错误响应）。
//
// 处理的接口与结构：
//   GET /ads/v3/ads?slots=hpto      → {"pod":{"hpto":[{id,clickthrough,...}]}}
//   GET /ad-logic/prefetch          → {"pod":{"stream":[...]}}   (实测)
//   GET /pendragon/.../FetchMessageList → 消息数组               (按 messages 兜底，未抓包确认)
// 共同点：广告素材都放在 `pod` 下的 slot 数组里。清空数组、保留结构，
// 客户端拿到的是「这一屏没有广告」，不是错误响应，因此不会触发重试或异常分支。
//
// 不处理的接口（有意为之）：
//   ads/vN/config、ad-logic/vN/config —— 客户端广告配置，清了可能导致播放链路异常
//   gabo-receiver-service/*/events    —— 曝光上报，拦它去不掉广告，只会丢埋点
//   capping-api                       —— 频次控制，同上
//
// 任何解析失败都原样放行，并把原因写进 script-logs/spotify-adclean.log。

(() => {
  const TAG = "adclean v1";

  function toText(body) {
    if (typeof body === "string") return body;
    if (ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    }
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
    if (Array.isArray(body)) return new TextDecoder().decode(new Uint8Array(body));
    throw new Error("unsupported body type: " + typeof body);
  }

  // 清空对象里所有「数组值」的字段，返回清掉的条数；非数组字段保持不动。
  function clearArrays(obj, label, detail) {
    let removed = 0;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (!Array.isArray(value)) continue;
      if (value.length) {
        detail.push(label + "." + key + ":" + value.length);
        removed += value.length;
      }
      obj[key] = [];
    }
    return removed;
  }

  const url = $request.url || "";
  const status = $response.status;
  let out = null;
  let note = "";

  try {
    if (status !== undefined && Number(status) !== 200) {
      note = "status " + status + ", passthrough";
    } else {
      const data = JSON.parse(toText($response.body));
      const detail = [];
      let removed = 0;

      if (data && typeof data === "object" && data.pod && typeof data.pod === "object") {
        removed += clearArrays(data.pod, "pod", detail);
      }
      // 少数接口直接以数组返回广告列表
      if (Array.isArray(data)) {
        if (data.length) detail.push("root:" + data.length);
        removed += data.length;
        data.length = 0;
      }
      // pendragon 之类把消息放在 messages 里
      if (data && typeof data === "object" && Array.isArray(data.messages)) {
        if (data.messages.length) detail.push("messages:" + data.messages.length);
        removed += data.messages.length;
        data.messages = [];
      }

      note = (removed ? "removed=" + removed + " " : "clean ") + detail.join(",");
      if (removed) out = { body: JSON.stringify(data) };
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  console.log(TAG + " " + note + " url=" + url);
  $done(out ? { body: out.body } : {});
})();
