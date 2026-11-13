---
name: stash-override-authoring
description: Use when writing or editing a Stash .stoverride file — adding routing rules, MITM hosts, or JavaScript to unlock an app feature, strip ads, or rewrite traffic.
---

# 编写 Stash 覆写

写之前先明确要动哪一层：**路由**（走哪个出口）、**解密**（能不能看到明文）、
**改写**（怎么改造请求或响应）。三层缺一不可，任何一层没配好，最终表现都是
"覆写没生效"，且没有任何报错。

## 文件骨架

```yaml
#SUBSCRIBED https://raw.githubusercontent.com/<user>/<repo>/main/<file>.stoverride
#!name = 显示名称
#!desc = 一句话说明
name: 显示名称
desc: 描述
icon: 'https://raw.githubusercontent.com/<user>/<repo>/main/<目录>/icon.png'

rules:
  - AND,((DOMAIN-SUFFIX,example.com),(PROTOCOL,QUIC)),REJECT-DROP

http:
  mitm:
    - 'spclient.wg.example.com'
    - '*spclient.example.com'
  script:
    - match: '^https://…/api/path(?:\?.*)?$'
      name: my-script
      type: response
      require-body: true
      binary-mode: true
      timeout: 30
script-providers:
  my-script:
    url: https://raw.githubusercontent.com/…/my-script.js
    interval: 86400
```

首行 `#SUBSCRIBED <自身 raw 地址>` 让客户端把它当订阅源，改动 push 后自动更新。

## 图标

**每个覆写都要有图标**，用 `icon:` 键（不是 `#!icon`），值是 raw URL：

```yaml
icon: 'https://raw.githubusercontent.com/<user>/<repo>/main/<目录>/icon.png'
```

- 图标文件与该覆写的 `.stoverride` 放同一目录，优先用产品官方 logo。
- 512×512 PNG、透明底；从 SVG 转：`magick -background none logo.svg -resize 512x512 icon.png`。
- 官方 logo 可取 simpleicons（`https://cdn.simpleicons.org/<slug>`，返回 SVG），
  **不要**用 Wikimedia 的 thumb 地址，会返回 HTML 错误页。

## 覆写里真正可用的键

| 键 | 作用 | 备注 |
|---|---|---|
| `rules` | 路由规则 | 数组默认 **prepend**，覆写规则先匹配 |
| `http.mitm` | 需要 TLS 解密的域名 | 不解密就看不到、也改不了 |
| `http.script` | 脚本挂载 | 配 `match` / `type` / `timeout` |
| `script-providers` | 脚本体来源 | **只认 `url:` 且必须 https** |

**`url-rewrite` / `header-rewrite` / `body-rewrite` / `mock` 在覆写里一律不生效**
（官方文档有、实测无效、静默忽略）。要改请求头、伪造状态码、拦截请求，
全部写脚本。官方那套 rewrite 语法只能放进主配置。

其他可用但少用的：`dns.*`、`proxy-groups`、`log-level`、`ipv6`。

## 三个必须先处理的坑

1. **QUIC 绕过 MITM**。客户端走 HTTP/3 时完全不经解密，请求列表里连记录都没有。
   ```yaml
   - AND,((DOMAIN-SUFFIX,<注册域>),(PROTOCOL,QUIC)),REJECT-DROP
   ```
   必须写注册域（`example.com`）。收窄成 `spclient.example.com` 会因标签边界
   匹配不到 `guc3-spclient.example.com`，规则静默失效。

2. **MITM 通配符按标签写**。`*spclient.example.com` 能匹配 `guc3-spclient.example.com`
   （中缀通配可用，已实测）。但 `*.example.com` 会把同域所有子域一起解密，
   增加开销还可能影响别的功能——只列真正需要改写的域名。

3. **大脚本必须给足 timeout**。内嵌 protobuf/schema 的脚本动辄 400KB，
   WebKit 引擎默认 10 秒跑不完，报 `script execution timed out`，且只写在
   `Core/logs/*.log` 里。给 30 秒。

## 配方

### 删请求头（最常见：绕开 304）

服务器命中 ETag 返回 304 时不带 body，response 脚本拿不到数据。
在 request 阶段把条件请求头删掉：

```yaml
- match: '^https://…/api/path(?:\?.*)?$'
  name: strip-conditional
  type: request
  timeout: 5
```

```js
const headers = Object.assign({}, $request.headers || {});
for (const k of Object.keys(headers)) {
  const l = k.toLowerCase();
  if (l === "if-none-match" || l === "if-modified-since") delete headers[k];
}
$done({ headers });
```

### 改响应内容

`type: response` + `require-body: true`；二进制（protobuf 等）再加
`binary-mode: true`。脚本里读 `$response.body`，改完 `$done({ body })`。

### 自己伪造响应（替代 mock）

```js
$done({ response: { status: 200, body: "" } });   // 等价于 reject-200
```

挂在 `type: request` 上，match 到就直接返回，不再发往服务器。

### 拒绝某个域名

放 `rules`：`- DOMAIN,telemetry.example.com,REJECT`。
`REJECT` 返回空响应，`REJECT-DROP` 直接断连——断连会让客户端反复重试，
非必要不用。

## 脚本管理

- 自写脚本放自己仓库，用 raw URL 引用；第三方脚本**锁 commit SHA**，避免上游改动
  导致行为漂移：`https://raw.githubusercontent.com/<user>/<repo>/<sha>/js/x.js`。
- 改脚本后要等 `interval` 到期或手动重载，不是立即生效。
- 多个脚本匹配同一 URL 时，request 脚本先于 response 脚本执行，可以用来做前置清理。

## 发布

个人规则放 public 仓库，一个覆写一个目录（`.stoverride` 与自写脚本放一起），
README 只列订阅地址，技术细节写进仓库的 CLAUDE.md。改完 push 即生效（首行有
`#SUBSCRIBED` 时）。

Mac 与 iPhone 共用 iCloud 覆写目录，**Mac 上改完会自动同步到手机，手机不需要手动更新**
（只弹一次「配置已更新」）；新建的覆写首次仍需在 App 里启用一次。

## 排障

写完一定要验证。完整的分层排查流程见 skill `stash-override-debug`——
核心是四件事各验一次：证书 issuer 是不是 Stash CA、目标规则有没有命中、
脚本日志有没有当次记录、引擎日志有没有超时。
