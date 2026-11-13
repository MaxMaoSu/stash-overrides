// 临时诊断：把手机端 spclient 请求上报到 webhook.site，用于定位广告接口。排查完删除。
console.log(`trace ${$request.url}`);
$httpClient.post(
  { url: "https://webhook.site/REDACTED", body: $request.url, timeout: 3 },
  (error) => { if (error) console.log(`trace error ${error}`); }
);
$done({});
