# 案例：Spotify 9.1.98 解锁

规则本体：<https://github.com/MaxMaoSu/stash-overrides>

## 症状链

用户反馈"脚本没效果"，逐层拆开是四个独立问题同时存在：

1. **接口迁移** — app2smile 的老规则匹配 `bootstrap/v1/bootstrap` 和
   `user-customization-service/v1/customize`，9.1.98 起不再请求这两个接口，
   账号属性改走 `nebula/v1/configuration/attributes` 和
   `remote-config-resolver/v3/configuration`。脚本零触发。
2. **QUIC 绕过** — Spotify 全程 HTTP/3，请求列表里看不到任何 spclient 请求。
3. **脚本超时** — `Spotify-proto.js` 406KB（内嵌 protobuf schema），WebKit
   默认 10 秒跑不完，`logs/` 里报 `script execution timed out`。
4. **304 无 body** — `script-logs/spotify-proto.log` 显示
   `response status 304, passthrough`，需要删 `If-None-Match`。

排查中途曾误判为"MITM 通配符不匹配"，实测 `*spclient.spotify.com` 是能匹配
`guc3-spclient.spotify.com` 的，误导来自当时配置已经解析失败（自己写坏的
诊断 provider），所有规则同时静默失效。

## 关键配置

```yaml
rules:
  - AND,((DOMAIN-SUFFIX,spotify.com),(PROTOCOL,QUIC)),REJECT-DROP
  - DOMAIN,aet.spotify.com,REJECT-DROP
http:
  mitm:
    - 'spclient.wg.spotify.com'
    - '*spclient.spotify.com'   # 中缀通配可用，能匹配 guc3-spclient.spotify.com
  script:
    # 删条件请求头，必须先于 response 脚本
    - match: '^https://…/(nebula|remote-config-resolver|bootstrap|user-customization-service)/…'
      name: spotify-strip304
      type: request
      timeout: 5
    - match: '^https://…'
      name: spotify-proto
      type: response
      require-body: true
      binary-mode: true
      timeout: 30
```

## 效果判据

底部导航「主页 / 搜索 / 音乐库 / **Premium** / 创建」里的 Premium 按钮消失 ——
免费账号该按钮恒定存在，消失说明 `nebula` 返回的账号属性已被改成 premium。

残留限制：音质仍不能设为「超高」，规则方案只改账号属性，改不了音源权限。

## 附带教训

- 自己写诊断脚本时用了不存在的 provider（`path:` 不支持），导致整份配置
  解析失败，之后所有规则静默失效，白白浪费一轮排查。
- Sideloadly 把 iOS 包塞进 Apple Silicon Mac 是 Patreon 付费功能，装上后
  Spotify 反复 SIGSEGV（pointer authentication failure），不适合当验证载体。
