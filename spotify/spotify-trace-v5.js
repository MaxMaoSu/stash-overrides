// 临时诊断：response 阶段上报 spclient 请求，排查完删除。
// $done 必须等上报回调返回，否则 Stash 在 $done 后销毁 VM，请求发不出去。
let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  $done({});
}
setTimeout(finish, 2000);
$httpClient.post(
  { url: "https://webhook.site/REDACTED", body: $request.url, timeout: 3 },
  (error) => {
    console.log(`trace ${error ? "error " + error : "ok"} ${$request.url}`);
    finish();
  }
);
