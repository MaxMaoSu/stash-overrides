// 小红书：搜索页推广位清理，替代 Surge 模块里的 [Body Rewrite] jq 规则。
// Stash 覆写的 body-rewrite 在本仓库未验证生效，统一改走 response 脚本。

const url = $request.url;

let obj = null;
if ($response.body) {
  try {
    obj = JSON.parse($response.body);
  } catch (e) {
    obj = null;
  }
}

if (!obj) {
  $done({});
} else {
  if (/\/v1\/search\/banner_list$/.test(url)) {
    // 搜索页顶部 banner
    if (obj.data !== undefined) obj.data = {};
  } else if (/\/v1\/search\/hot_list$/.test(url)) {
    // 搜索页热搜榜
    if (obj.data && obj.data.items !== undefined) obj.data.items = [];
  } else if (/\/v4\/search\/hint/.test(url)) {
    // 搜索联想词
    if (obj.data && obj.data.hint_words !== undefined) obj.data.hint_words = [];
  } else if (/\/v4\/search\/trending/.test(url)) {
    // 搜索页趋势：热搜词条与聚合词
    if (obj.data) {
      if (obj.data.queries !== undefined) obj.data.queries = [];
      if (obj.data.hint_word !== undefined) obj.data.hint_word = {};
    }
  }
  $done({ body: JSON.stringify(obj) });
}
