// 临时诊断脚本：把手机端所有 spclient 请求上报到局域网日志服务，
// 用于定位 Sponsored 卡片由哪个接口下发。排查完删除本脚本与对应挂载。
$httpClient.post({ url: "http://10.0.0.2:8765/trace", body: $request.url }, () => {});
$done({});
