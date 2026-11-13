# stash-overrides

个人 Stash 覆写规则合集，通过 raw URL 订阅，改完 push 即生效。

## Spotify 解锁

适配 Spotify 9.1.98 的服务端接口（nebula / remote-config-resolver）。

订阅地址：

```
https://raw.githubusercontent.com/MaxMaoSu/stash-overrides/main/Spotify.stoverride
```

### 为什么原版规则失效

app2smile 的 `spotify.module` / `spotify.stoverride`（2025.06.27）在 9.1.98 上完全不生效，
四个原因叠加，任何一个都能让脚本不执行：

| 原因 | 现象 | 修法 |
|---|---|---|
| 接口迁移 | 脚本只匹配 `bootstrap/v1/bootstrap` 和 `user-customization-service/v1/customize`，9.1.98 改走 `nebula/v1/configuration/attributes` 和 `remote-config-resolver/v3/configuration`，零触发 | match 补齐新路径 |
| QUIC 绕过 | Spotify 用 HTTP/3 直连，绕过 MITM，请求列表里连记录都没有 | `PROTOCOL,QUIC` 规则 reject |
| 脚本超时 | `Spotify-proto.js` 406KB（内嵌 protobuf schema），WebKit 默认 10 秒跑不完，只在 `Core/logs` 报 `script execution timed out` | `timeout: 30` |
| 304 无 body | 服务器命中 ETag 返回 304，脚本拿到空响应只能 passthrough | request 脚本删 `If-None-Match` |

### 设计要点

- **MITM 只覆盖 spclient**：`spclient.wg.spotify.com` + `*spclient.spotify.com`。
  Stash 支持中缀通配，`*spclient.spotify.com` 能匹配 `guc3-spclient.spotify.com`。
  不要写成 `*.spotify.com`，那会把 api / login5 / apresolve 等无关域名一起解密。
- **QUIC 只拦 spclient**：音频 CDN 和其它 Spotify 服务继续走 HTTP/3，不受影响。
- **timeout 分级**：只有 406KB 的 `spotify-proto` 需要 30 秒，其余 5–10 秒。
- **脚本锁 commit**：Reukix 的四个脚本固定在 `406b5f6`，避免上游改动导致行为漂移。
  升级时改 SHA，重载后确认 `script-logs/` 没有 `passthrough` / `timed out`。
- **rewrite 系键在覆写里不可用**：官方文档的 `url-rewrite` / `header-rewrite` /
  `body-rewrite` / `mock` 实测在 `.stoverride` 里**全部不生效**（4.3.5 / macOS）。
  对照条件：同一文件里的 `http.mitm`、`http.script` 正常，重载也确实生效。
  所以文档里那些优雅写法（比如 `header-rewrite request-del If-None-Match`）只能在
  主配置里用，覆写里改请求只能走脚本。
- **验证 rewrite 要选对端点**：`pendragon` 和 `pam-view-service` 直连就返回
  `200` 空响应，拿它们当"rewrite 生效"的证据会得出完全错误的结论。
  只有 `gabo-receiver-service`（直连 401）能区分。

### 效果判据

底部导航「主页 / 搜索 / 音乐库 / **Premium** / 创建」里的 Premium 按钮消失——
免费账号该按钮恒定存在，消失说明 `nebula` 返回的账号属性已被改成 premium。

残留限制：音质仍不能设为「超高」。规则方案只能改账号属性，改不了音源权限。

脚本来自 [Reukix/ukix](https://github.com/Reukix/ukix)（proto/home/search/scroll）
和 [app2smile/rules](https://github.com/app2smile/rules)（json）。
