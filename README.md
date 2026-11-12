# stash-overrides

个人 Stash 覆写规则合集，通过 raw URL 订阅，改完 push 即生效。

## Spotify 解锁

适配 Spotify 9.1.98 的服务端接口（nebula / remote-config-resolver）。

订阅地址：

```
https://raw.githubusercontent.com/MaxMaoSu/stash-overrides/main/Spotify.stoverride
```

要点：

- 必须拦截 QUIC，否则 Spotify 用 HTTP/3 直连，完全绕过 MITM
- MITM 主机写 `*.spotify.com`，`*spclient.spotify.com` 这种标签内通配在 Stash 上不匹配
- `spotify-strip304` 去掉 `If-None-Match`，否则服务器返回 304 无 body，脚本无从改写
- `spotify-proto` 是 406KB 的内嵌 protobuf 脚本，`timeout` 必须给到 30 秒，默认 10 秒会超时
- 音质仍无法设为「超高」，这是规则方案的固有限制

脚本来自 [Reukix/ukix](https://github.com/Reukix/ukix)（proto/home/search/scroll）和 [app2smile/rules](https://github.com/app2smile/rules)（json）。
