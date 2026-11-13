# stash-overrides 维护约定

## 仓库结构

一个覆写一个目录，覆写文件与它自带的脚本放在同一个目录下：

```
stash-overrides/
├── README.md                仅枚举覆写列表与订阅地址，不写技术细节
├── CLAUDE.md                本文件：维护约定与技术细节
└── spotify/
    ├── Spotify.stoverride
    └── spotify-strip304-v2.js
```

新增覆写：建 `<类别>/` 目录，`.stoverride` + 自写脚本都放进去，README 表格加一行。
第三方脚本用远程 URL，不复制进仓库。

## 发布方式

`.stoverride` 首行写自身 raw 地址：

```yaml
#SUBSCRIBED https://raw.githubusercontent.com/MaxMaoSu/stash-overrides/main/<目录>/<文件名>.stoverride
```

客户端会把它当订阅源自动更新。**改文件名或路径必须同步改这一行**，
否则客户端仍指向旧地址。改完 push，客户端重载后生效。

## 脚本缓存

Stash 按 URL 路径缓存脚本，`interval` 未到期不会重新下载。
改脚本内容时改文件名（如 `xxx-v2.js`）能强制刷新；给 URL 加 `?v=2` **无效**，
会被规范化掉。

## Stash 覆写的实际能力边界（4.3.5 实测）

| 键 | 可用 | 说明 |
|---|---|---|
| `rules` | ✅ | 数组默认 prepend，覆写规则优先 |
| `http.mitm` | ✅ | 中缀通配可用，`*spclient.a.com` 能匹配 `guc3-spclient.a.com` |
| `http.script` | ✅ | 支持 `require-body` / `binary-mode` / `max-size` / `timeout` |
| `script-providers` | ✅ | **只认 https `url:`**，`path:` 与 http 均不生效 |
| `url-rewrite` | ❌ | reject / reject-200 / 302 全部无效，静默忽略 |
| `header-rewrite` | ❌ | request-add 未注入 |
| `body-rewrite` | ❌ | 同组，推断同样无效 |
| `mock` | ❌ | 指定 status-code 不生效 |

覆写里要改请求头、伪造响应、拦截请求，**一律写脚本**。

## 排查顺序

1. **配置是否解析成功**：引用不存在的 provider 会让整份配置失效
   （App 弹「配置文件无效」），之后所有规则静默不生效。
2. **MITM 是否生效**：`openssl s_client -proxy 127.0.0.1:7890 -connect <host>:443`
   看 issuer 是否为 `Stash Generated CA`。
3. **规则/rewrite 是否命中**：先取直连基准——很多端点在没有干预时就是 `200` 空响应，
   拿它当"生效"的证据会得出完全相反的结论。只有直连返回非 200 的端点才能区分。
4. **脚本是否执行**：`~/Library/Application Support/Stash/Core/script-logs/<脚本名>.log`
   记录脚本自己的 `console.log`；`Core/logs/*.log` 记录引擎级错误（超时、pipeline 失败）。
5. **效果**：找免费状态下恒定存在的 UI 标志消失，而不是"等一会儿没广告"。

## Spotify 专项

- **QUIC 必须拦且不能收窄**：`AND,((DOMAIN-SUFFIX,spotify.com),(PROTOCOL,QUIC)),REJECT-DROP`。
  写成 `DOMAIN-SUFFIX,spclient.spotify.com` 会因标签边界（`-` 不是 `.`）
  匹配不到 `guc3-spclient.spotify.com`，规则静默失效。
- **接口**：9.1.98 起不走 `bootstrap`/`customize`，账号属性在
  `nebula/v1/configuration/attributes`。桌面版同样请求这个接口，因此同一份覆写两端通用。
- **proto 脚本 timeout 给 30 秒**：406KB 内嵌 protobuf schema，默认 10 秒跑不完，
  只在引擎日志报 `script execution timed out`。
- **`remote-config-resolver` 不要交给 proto**：桌面版该接口返回 JSON，
  protobuf 解码抛 `invalid wire type`，异常会重置 WebKit 引擎，
  连带让同期 nebula 的脚本跑不掉。
- **304 无 body**：服务器命中 ETag 返回 304 时脚本拿不到数据，用 request 脚本
  删 `If-None-Match` / `If-Modified-Since`。只在真删到头时才返回 headers。
- **已知未解**：桌面版后续 nebula 请求在 proto 日志里不留记录（curl 触发正常），
  UI 表现为 premium 但无法从日志确认每次改写。
- **效果判据**：底部导航的 Premium 入口消失，或窗口标题显示 `Spotify Premium`。
  音质仍无法设为「超高」，这是规则方案的固有限制。

## 第三方脚本

- Reukix/ukix 的 `Spotify-{proto,home,search,scroll}.js`
- app2smile/rules 的 `spotify-json.js`

一律锁定 commit SHA，避免上游改动导致行为漂移。升级时改 SHA、重载，
确认 `script-logs` 尾部时间戳更新且无 `passthrough` / `timed out`。
