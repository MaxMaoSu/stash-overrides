// 小红书：伪造响应，替代 Surge 模块里的 [Map Local]。
// Stash 覆写里的 mock / url-rewrite 实测不生效，只能在 request 脚本里直接返回 response。

const url = $request.url;

// 1×1 透明 GIF（43 字节），模块里用 data-type=tiny-gif 替换水印配置图
const TINY_GIF = [
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
];

if (/^https:\/\/ci\.xiaohongshu\.com\/system_config\/watermark/.test(url)) {
  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Length": String(TINY_GIF.length)
      },
      body: new Uint8Array(TINY_GIF)
    }
  });
} else {
  // 惊喜盒子、活动横幅、广告资源位等：返回空对象即可
  const body = "{}";
  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(body.length)
      },
      body
    }
  });
}
