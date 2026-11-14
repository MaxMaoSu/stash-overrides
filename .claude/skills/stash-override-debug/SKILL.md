---
name: stash-override-debug
description: Use when a Stash .stoverride rule, rewrite, or MITM script silently does nothing — script never runs, rule never matches, request never gets decrypted, or an override that used to work stopped applying after an app update.
---

# Stash 覆写排障

写新覆写请用 skill `stash-override-authoring`；本文只处理"已经写好但不生效"。

Overrides fail **silently**. A broken config, an unmatched hostname, and a script
timeout all look identical from the outside: the app behaves as if the override
were never installed. Never conclude "the rule doesn't work" before walking the
five layers below — each has its own cheap check.

**禁止靠猜**：不知道是哪个接口/哪条规则时，先建观测手段拿到真实 URL（临时上报
脚本见 `stash-override-authoring`「排障」、手机端「工具 → 检视 HTTP 请求」、
`Core/script-logs`、`Core/logs`），再改。凭经验猜着改会让用户反复重载重测，
而且每猜一次都要重来一遍。

## 五层排查，从外到内

Work outside-in. Every layer must be proven independently; do not jump to the
script before the decryption is confirmed.

### 1. 配置是否解析成功

A script entry naming a provider that isn't registered makes **the whole config
invalid**, and Stash then applies nothing at all — no MITM, no rules, no scripts.
It surfaces only as a modal 「配置文件无效」 in the Stash app.

- 改完覆写后必须确认没有这个弹窗。
- `script-providers` **只认 `url:`（必须 https）**；`path:` / `http://` 会注册失败。
- Provider 未下载成功时脚本同样不报错，静默跳过。

### 2. 流量是否被 MITM

```bash
echo | openssl s_client -proxy 127.0.0.1:7890 -connect <host>:443 -servername <host> 2>/dev/null \
  | openssl x509 -noout -issuer
```

`O=Stash Generated CA …` = 解密成功；真实 CA（Let's Encrypt 等）= 没进 MITM。

常见原因：

- **MITM 通配符写法**：Stash 支持中缀通配，`*spclient.spotify.com` 能匹配
  `guc3-spclient.spotify.com`（已实测）。写 `*.example.com` 虽然也能覆盖，
  但会把同域所有子域一起解密——只解密真正需要改写的子域，别图省事。
- **HTTP/3 绕过**：客户端用 QUIC 直连时完全不经 MITM，请求列表里都看不到。
  加 `AND,((DOMAIN-SUFFIX,<注册域>),(PROTOCOL,QUIC)),REJECT-DROP` 强制回落 TCP。
  **必须写注册域**（如 `spotify.com`），不能收窄成 `spclient.spotify.com`——
  regional 主机是 `guc3-spclient.spotify.com`，`DOMAIN-SUFFIX` 要求标签边界
  （`-` 不算 `.`），收窄后规则静默失效，正是最危险的那类失败。

### 3. 规则 / rewrite 是否命中

```bash
curl -s -o /dev/null --max-time 12 -w "%{http_code} %{size_download}\n" https://<url>   # 直连基准
curl -s -o /dev/null -x http://127.0.0.1:7890 -w "%{http_code} %{size_download}\n" https://<url>
```

**先取直连基准再对比**。很多端点在**没有任何干预时就是 `200` 空响应**，
拿它当"rewrite 生效"的证据会得出完全相反的结论。只有直连返回非 200
（如 401）的端点才能区分：走代理变成 `200 0` 才算命中。

`REJECT-DROP` 的域名直连不走代理也是 `000`，同样要用直连基准排除。

**Stash 4.3.5 的覆写只认 `http.mitm` / `http.script` / `script-providers` / `rules`
这一组**。官方文档里的 `url-rewrite`、`header-rewrite`、`body-rewrite`、`mock`
实测在 `.stoverride` 里全部不生效（同一份文件里 mitm 和 script 正常，重载也确实
生效，排除了加载问题），且不报警。要改请求、去请求头、伪造响应，一律写脚本。

### 4. 脚本是否执行 / 是否超时

两个日志位置，**必须都看**：

| 位置 | 内容 |
|---|---|
| `~/Library/Application Support/Stash/Core/script-logs/<脚本名>.log` | 脚本自己的 `console.log`，**只有脚本真的跑起来才会生成** |
| `~/Library/Application Support/Stash/Core/logs/*.log` | 引擎级错误：`script execution timed out`、`script_pipeline` 失败、配置解析失败 |

高频坑：

- **超时**：内嵌 protobuf schema 的大脚本（400KB+）默认 10 秒跑不完，报
  `reset WebKit script engine after execution failure`。把 `timeout` 提到 30。
- **304 无 body**：条件请求命中时服务器回 304，脚本拿到空响应只能 passthrough，
  `console.log` 会留下 `response status 304, passthrough`。Stash **没有
  `header-rewrite` 键**，只能用 `type: request` 的脚本改 `$request.headers`，
  删掉 `If-None-Match` / `If-Modified-Since` 强制 200。
- 脚本日志目录为空 ≠ 引擎没跑：先看 `logs/` 里的超时/失败记录。
- **移除脚本/规则后 toggle 覆写开关可能不会停掉已加载的脚本 VM**：实测
  `spotify-block-ads.log` 在配置已无该脚本后仍持续增长，退出 Stash 再重开
  （不是只关窗口）后 10 秒零增长。判断是否停掉看该日志的 mtime 和行数增量。

### 5. 效果是否真的改了

不要靠"用一会儿看看"。找界面上一个**免费/未解锁状态下恒定存在**的标志
（锁形图标、Premium 入口、广告位），它消失或变化才是服务端数据被改写的证据。
单纯"没出现广告"不算——广告周期可能还没到。

### 手机端：用 CLI 连远程控制器

iPhone 端日志不在本机，但 Stash 的控制器接口可以直连。手机
「设置 → 外部访问」打开「启用外部控制」，API 密钥存入
`~/.claude/secrets/stash-iphone-controller`（600），不要写进仓库。

```bash
# 本机已装封装脚本，自动读取密钥、按 mDNS 主机名连接
stash-iphone status
stash-iphone conn ls --limit 200
stash-iphone conn ls --json | jq '.connections[] | {host: .metadata.host, rule, rulePayload}'
```

- 控制器地址用 mDNS 发现：先 `timeout 4 dns-sd -B _stash-control._tcp local`
  拿实例名（形如 `Stash-<hash>`），再
  `timeout 4 dns-sd -L <实例名> _stash-control._tcp local` 拿 `host:port`。
  两条命令默认都会持续输出，必须加 `timeout`。局域网里通常不止一台，
  看 `-L` 输出的 `name=` 确认是 `maosutekiiphone.local`，别连到 Mac 自己。
- 认证头是 `Authorization: Bearer <API 密钥>`；`stash-cli --url` 指向非本机时
  必须另给密钥（`--secret-stdin` 最安全）。
- `provider ls` 能看到脚本缓存时间，但**缓存存在不等于仍挂载**；看到已删脚本
  还在列表里，更可能是手机仍跑旧覆写。判断是否生效以手机 App
  「覆写 → Spotify → 内容」和实际连接为准。
- iOS 的 `/configs` 只返回极简配置，不要拿它判断覆写是否加载。
- 也可以直接用 Mac 的 **Stash Dashboard → 远程控制器 → 已保存的设备 → 连接**，
  看手机的活跃连接；CLI 更适合过滤和脚本化，两者读的是同一套控制器。

#### 手机端取真实响应

控制器只给 host / 命中规则 / 字节数，**不给 URL 路径，也没有脚本日志接口**
（`/script-logs`、`/logs/scripts` 均 405）。要让手机上的脚本把证据送出来：

1. 本机起一个 HTTP 接收端，监听局域网地址（如 `10.0.0.2:8765`），
   把 body 原样写文件。**必须解析 `Transfer-Encoding: chunked`**，
   Stash 的 `$httpClient` 走 chunked，只读 `Content-Length` 会全部收成空 body。
2. 覆写里加一条只读 response 脚本，把 `$request.url` 和响应体
   `$httpClient.post(...)` 到这个地址；`$done` 必须写在回调里
   （先 `$done` 会销毁 VM，请求发不出去）。
3. 手机同步 iCloud 后打开 Stash App 重载覆写；抓完删脚本与 provider。

判断手机是否真的加载了新脚本：控制器只能给 URL 与更新时间。
`provider update` 对手机返回 404 且不刷新缓存——**改脚本内容要换文件名**
（`xxx-v2.js`），否则端上一直跑旧版本。

拿到原始 body 后在本机解析（protobuf 直接按字节扫 `spotify:...|kind` 之类标识），
比在手机上看日志快，也不受日志等级限制。

## 覆写写法要点

```yaml
http:
  mitm:
    - '*.service.com'          # 只写真正需要解密的子域，别用 *.example.com
  script:
    - match: '^https://…'
      name: my-script
      type: response
      require-body: true
      binary-mode: true
      timeout: 30              # 大脚本必须给足
script-providers:
  my-script:
    url: https://raw.githubusercontent.com/.../my-script.js   # 必须 https
```

- `rules:` 支持逻辑规则与 `PROTOCOL,QUIC`。`url-rewrite` / `header-rewrite` /
  `body-rewrite` / `mock` 在覆写里实测不生效，要改请求就用脚本。
- 版本化维护：把 `.stoverride` 和自写脚本放进 public 仓库，首行写
  `#SUBSCRIBED <raw-url>`，客户端即按订阅源自动更新。

## 交付前自检

- [ ] 重载后无「配置文件无效」弹窗
- [ ] 目标域名证书 issuer 是 Stash CA
- [ ] rewrite 返回 `200 0`、Q 规则域名连不上
- [ ] `script-logs/` 有当次执行记录
- [ ] `logs/` 无 `timed out` / `script_pipeline` 失败

## 真实案例

完整拆解见 `references/spotify-case.md`（Spotify 9.1.98，五层问题同时存在）。
规则仓库：<https://github.com/MaxMaoSu/stash-overrides>。
