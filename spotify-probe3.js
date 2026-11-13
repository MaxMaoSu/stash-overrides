// 诊断用：body 是 UTF-8 字节对象（{0:123,1:34,...}），先解码成文本再看 JSON 结构。
const r = $response || {};
let b = r.body;
let text = "";
try {
  if (typeof b === "string") {
    text = b;
  } else if (b && typeof b === "object") {
    const bytes = b instanceof Uint8Array ? b : new Uint8Array(Object.values(b));
    text = new TextDecoder("utf-8").decode(bytes);
  }
} catch (e) {
  text = "";
}
let parsed = null;
try { parsed = JSON.parse(text); } catch (e) {}
console.log(`PROBE chars=${text.length} json=${parsed ? "ok" : "fail"}`);
console.log(`TOP ${parsed ? Object.keys(parsed).join(",") : "-"}`);
console.log(`HEAD ${text.slice(0, 700)}`);
$done({});
