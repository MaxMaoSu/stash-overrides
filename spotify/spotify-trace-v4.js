// 临时诊断：response 阶段上报 spclient 请求，排查完删除。
console.log(`trace ${$request.url}`);
$httpClient.post(
  { url: "https://webhook.site/REDACTED", body: $request.url, timeout: 3 },
  (error) => { if (error) console.log(`trace error ${error}`); }
);
$done({});
