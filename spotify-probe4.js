// 诊断用：列出 remote-config 里所有广告/产品相关的属性名与当前值。
const r = $response || {};
let b = r.body, text = "";
try {
  if (typeof b === "string") text = b;
  else if (b && typeof b === "object") {
    const bytes = b instanceof Uint8Array ? b : new Uint8Array(Object.values(b));
    text = new TextDecoder("utf-8").decode(bytes);
  }
} catch (e) { text = ""; }

let p = null;
try { p = JSON.parse(text); } catch (e) {}

const vals = (p && p.configuration && p.configuration.assignedValues) || [];
const RE = /(^|[^a-z])(ad|ads|advert|premium|catalogue|product|esperanto|upgrade|messag|hpto|billboard|sponsor)/i;
const hits = vals.filter(v => RE.test((v.propertyId && v.propertyId.name) || ""));

function valOf(v) {
  if (v.boolValue) return "bool=" + v.boolValue.value;
  if (v.intValue) return "int=" + v.intValue.value;
  if (v.stringValue) return "str=" + v.stringValue.value;
  if (v.enumValue) return "enum=" + v.enumValue.value;
  return "?";
}

console.log(`TOTAL ${vals.length} HITS ${hits.length}`);
console.log("NAMES " + hits.map(v => (v.propertyId.name + ":" + valOf(v))).join(" | ").slice(0, 1500));
$done({});
