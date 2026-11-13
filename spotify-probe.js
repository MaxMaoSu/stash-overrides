// 诊断用：打印 remote-config 响应的 JSON 结构，不做改写。
// 桌面版返回 application/json（iOS 版是裸 protobuf），
// Stash 已经把 body 解析成对象，可以直接读写。
const r = $response || {};
const b = r.body;
let keys = "-";
let preview = "-";
if (b && typeof b === "object") {
  keys = Object.keys(b).join(",");
  preview = JSON.stringify(b).slice(0, 300);
} else if (typeof b === "string") {
  preview = b.slice(0, 300);
}
console.log(`PROBE status=${r.status} len=${r.body ? JSON.stringify(b).length : 0}`);
console.log(`KEYS ${keys}`);
console.log(`PREVIEW ${preview}`);
$done({});
