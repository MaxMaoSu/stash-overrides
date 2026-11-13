# stash-overrides 维护约定

## 仓库结构

一个覆写一个目录，覆写文件与它自带的脚本放在同一个目录下：

```
stash-overrides/
├── README.md                仅枚举覆写列表与订阅地址，不写技术细节
├── CLAUDE.md                本文件：维护约定与技术细节
└── spotify/
    ├── Spotify.stoverride
    ├── spotify.png          覆写图标
    └── spotify-strip304-v2.js
```

新增覆写：建 `<类别>/` 目录，`.stoverride` + 图标 + 自写脚本都放进去，README 表格加一行。
**每个覆写必须有图标**：`.stoverride` 用 `icon: '<raw URL>'` 指向同目录 PNG
（512×512、透明底，优先产品官方 logo），不是 `#!icon`。
图标必须清晰、居中：SVG 转 PNG 要 `-density 2400` + `-trim` + `-extent`，
直接 `-resize` 会糊且偏心，完整命令见 skill `stash-override-authoring`。
换图片内容必须换文件名，Stash 按 URL 缓存图标。
第三方脚本用远程 URL，不复制进仓库。

## 发布方式

`.stoverride` 首行写自身 raw 地址：

```yaml
#SUBSCRIBED https://raw.githubusercontent.com/MaxMaoSu/stash-overrides/main/<目录>/<文件名>.stoverride
```

客户端会把它当订阅源自动更新。**改文件名或路径必须同步改这一行**，
否则客户端仍指向旧地址。改完 push，客户端重载后生效（⌘R）。

Stash 的「更新」按钮有时拉不到新内容（本地文件 mtime 不变），且可能在文件里
重复追加 `#SUBSCRIBED` 行。此时直接改 iCloud 目录下的同名文件、只保留一行
`#SUBSCRIBED`，再 ⌘R 重载。

## 跨端同步

Mac 与 iPhone 共用 iCloud 目录
`~/Library/Mobile Documents/iCloud~ws~stash~icloud/Documents/override/`。
在 Mac 上更新覆写文件后，iCloud 会自动同步到手机，**手机端不需要任何手动操作**
（不用重新订阅、不用重装），只会弹一次「配置已更新」提示。
新建的覆写首次仍需在 App 里启用，之后内容更新即自动生效。

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

## 小红书专项

移植自 QingRex/LoonKissSurge 的「小红书去广告」Surge 模块，去掉了 Stash 覆写不生效的段落。

- **Surge `[Map Local]` → request 脚本**：`xiaohongshu-mock-v1.js` 在请求阶段直接
  `$done({ response: { status: 200, body } })`。watermark 配置接口必须回 1×1 GIF
  原始字节（`Content-Type: image/gif`），其余 4 组回 `{}`。返回 Uint8Array 要算准
  `Content-Length`，否则客户端按长度截断。
- **Surge `[Body Rewrite]` jq → response 脚本**：`xiaohongshu-search-v1.js` 处理搜索页
  banner_list / hot_list / hint / trending。trending 一次请求里同时改 `queries` 和
  `hint_word`，Surge 模块拆成了两条规则。
- **主脚本**：RedPaper_remove_ads.js，镜像在 `Repcz/Tool`，锁 commit SHA。
  匹配 12 组端点，覆盖信息流广告、开屏、详情页小部件、图片/视频/实况照片水印。
  MITM 要放开 `ci` / `so` 两个非常用子域，否则 mock 与搜索脚本不触发。
- **QUIC 必须拦**：`AND,((PROTOCOL,QUIC),(DOMAIN-SUFFIX,xiaohongshu.com)),REJECT-DROP`。
- **效果判据**：搜索页无「猜你想搜」和 banner；开屏不出现广告图；保存图片无水印。
- **图标**：simpleicons 的 `xiaohongshu`（红色 #FF2442 字标）。

## 第三方脚本

- Reukix/ukix 的 `Spotify-{proto,home,search,scroll}.js`
- app2smile/rules 的 `spotify-json.js`

一律锁定 commit SHA，避免上游改动导致行为漂移。升级时改 SHA、重载，
确认 `script-logs` 尾部时间戳更新且无 `passthrough` / `timed out`。

## 项目技能

`.claude/skills/stash-override-authoring`（写/改覆写）、`.claude/skills/stash-override-debug`（规则或脚本静默失效时排查）。只在本仓库会话加载。
