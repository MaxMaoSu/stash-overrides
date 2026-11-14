// 过滤 Casita 首页响应里的品牌推广 section（identifier 以 `|brand-ad` 结尾）。
//
// 自写脚本，替代 Reukix/ukix 的 Spotify-home.js。原脚本只认 Uint8Array，
// 实测本机 Stash 交出的 body 不是字节时直接抛异常 → 日志只有
// "unrecognized response, passed through"，从未真正过滤。
//
// 诊断优先：每次执行都写一行摘要到 script-logs/spotify-home.log，
// 记录 status / content-type / body 类型 / 长度 / 解析结果，
// 解析失败时记录具体原因。日志就是排障依据，不要删。

(() => {
  const TAG = "spotify-home v1";

  // ---- body 归一化 -------------------------------------------------------
  function toBytes(body) {
    if (body === undefined || body === null) throw new Error("empty body");
    if (ArrayBuffer.isView(body)) {
      return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    }
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (Array.isArray(body)) return new Uint8Array(body);
    if (typeof body === "string") {
      const trimmed = body.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return new TextEncoder().encode(body);
      }
      // 部分版本把二进制体以 base64 交出
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    throw new Error("unsupported body type: " + typeof body);
  }

  function bodyKind(body) {
    if (body === undefined || body === null) return "empty";
    if (ArrayBuffer.isView(body)) return "view:" + (body.constructor && body.constructor.name);
    if (body instanceof ArrayBuffer) return "arraybuffer";
    if (Array.isArray(body)) return "array";
    if (typeof body === "string") return "string";
    return typeof body;
  }

  function hexHead(bytes, n) {
    let out = "";
    const end = Math.min(n, bytes.length);
    for (let i = 0; i < end; i++) out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }

  function looksJson(bytes) {
    for (let i = 0; i < bytes.length && i < 16; i++) {
      const c = bytes[i];
      if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) continue;
      return c === 0x7b || c === 0x5b; // { [
    }
    return false;
  }

  // ---- protobuf ----------------------------------------------------------
  function readVarint(bytes, offset, end) {
    let value = 0;
    for (let i = 0; i < 10 && offset < end; i++) {
      const byte = bytes[offset++];
      value += (byte & 0x7f) * 2 ** (i * 7);
      if (byte < 0x80) return { value, offset };
    }
    throw new Error("invalid varint at " + offset);
  }

  function fields(bytes) {
    const result = [];
    let offset = 0;
    while (offset < bytes.length) {
      const start = offset;
      const tag = readVarint(bytes, offset, bytes.length);
      const number = Math.floor(tag.value / 8);
      const wire = tag.value % 8;
      if (!number) throw new Error("field number 0 at " + start);
      offset = tag.offset;
      let dataStart = offset;
      if (wire === 0) {
        let terminated = false;
        while (offset < bytes.length) {
          if (bytes[offset++] < 0x80) {
            terminated = true;
            break;
          }
        }
        if (!terminated) throw new Error("invalid scalar at " + start);
      } else if (wire === 1) {
        offset += 8;
      } else if (wire === 5) {
        offset += 4;
      } else if (wire === 2) {
        const length = readVarint(bytes, offset, bytes.length);
        // dataStart 必须跳过长度 varint，否则下层把长度字节当 tag 解析
        dataStart = length.offset;
        offset = dataStart + length.value;
      } else {
        throw new Error("unsupported wire type " + wire + " at " + start);
      }
      if (offset > bytes.length) throw new Error("truncated field at " + start);
      result.push({ number, wire, start, tagEnd: tag.offset, dataStart, end: offset });
    }
    return result;
  }

  function concat(parts) {
    let size = 0;
    for (const p of parts) size += p.length;
    const out = new Uint8Array(size);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  function encodeLength(value) {
    const bytes = [];
    do {
      const next = value % 128;
      value = Math.floor(value / 128);
      bytes.push(next | (value ? 0x80 : 0));
    } while (value);
    return new Uint8Array(bytes);
  }

  function latin1(bytes) {
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return text;
  }

  // 收集 section 内的 `spotify:...|xxx` 标识。
  // 真实 Casita 的嵌套层级未经抓包确认，这里递归下探最多 3 层：
  // 直接是字符串就收下，能当 protobuf 解析就继续往下找。
  function collectIds(buf, depth, out) {
    if (depth > 3 || out.length > 60) return;
    if (buf.length > 0 && buf.length <= 512) {
      const text = latin1(buf);
      if (text.startsWith("spotify:") && text.includes("|")) {
        out.push(text);
        return;
      }
    }
    let sub;
    try {
      sub = fields(buf);
    } catch (_) {
      return;
    }
    for (const f of sub) {
      if (f.wire !== 2) continue;
      collectIds(buf.subarray(f.dataStart, f.end), depth + 1, out);
    }
  }

  function sectionIds(section) {
    const ids = [];
    collectIds(section, 0, ids);
    return ids;
  }

  function isBrandAd(ids) {
    for (const id of ids) {
      if (id.startsWith("spotify:section:") && id.endsWith("|brand-ad")) return true;
    }
    return false;
  }

  function filterProto(bytes) {
    const seen = [];
    let removed = 0;
    const parts = fields(bytes).map((field) => {
      const original = bytes.subarray(field.start, field.end);
      if (field.number !== 1 || field.wire !== 2) return original;
      const sections = bytes.subarray(field.dataStart, field.end);
      let changed = false;
      const kept = [];
      for (const section of fields(sections)) {
        if (section.number === 1 && section.wire === 2) {
          const ids = sectionIds(sections.subarray(section.dataStart, section.end));
          if (seen.length < 24) seen.push(ids.filter((x) => x.includes("|")).slice(0, 3).join(","));
          if (isBrandAd(ids)) {
            removed++;
            changed = true;
            continue;
          }
        }
        kept.push(sections.subarray(section.start, section.end));
      }
      if (!changed) return original;
      const payload = concat(kept);
      return concat([
        bytes.subarray(field.start, field.tagEnd),
        encodeLength(payload.length),
        payload,
      ]);
    });
    // 即便没删，也把看到的 section 标识写进日志，方便判断结构是否变化
    return { body: removed ? concat(parts) : null, removed, seen };
  }

  // ---- JSON --------------------------------------------------------------
  function jsonKeyStrings(node, out, depth) {
    if (depth > 24 || out.length > 200) return;
    if (typeof node === "string") {
      if (node.startsWith("spotify:") && node.includes("|")) out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) jsonKeyStrings(item, out, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) jsonKeyStrings(node[key], out, depth + 1);
    }
  }

  function pruneJson(node) {
    let removed = 0;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const item = node[i];
        if (item && typeof item === "object" && typeof item.uri === "string" &&
            item.uri.startsWith("spotify:section:") && item.uri.endsWith("|brand-ad")) {
          node.splice(i, 1);
          removed++;
          continue;
        }
        removed += pruneJson(item);
      }
      return removed;
    }
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) removed += pruneJson(node[key]);
    }
    return removed;
  }

  // ---- main --------------------------------------------------------------
  let result = null;
  let note = "";
  try {
    const body = $response.body;
    const status = $response.status;
    const headers = $response.headers || {};
    const ct = headers["content-type"] || headers["Content-Type"] || "";
    const kind = bodyKind(body);

    if (status !== undefined && Number(status) !== 200) {
      note = "status " + status + ", passthrough";
    } else {
      const bytes = toBytes(body);
      if (looksJson(bytes)) {
        const text = new TextDecoder().decode(bytes);
        const data = JSON.parse(text);
        const ids = [];
        jsonKeyStrings(data, ids, 0);
        const removed = pruneJson(data);
        result = removed ? { body: JSON.stringify(data) } : null;
        note = "json len=" + bytes.length + " removed=" + removed +
          " ids=" + Array.from(new Set(ids.map((x) => x.split("|").pop()))).slice(0, 6).join("/");
      } else {
        const proto = filterProto(bytes);
        if (proto.removed) result = { body: proto.body };
        note = "proto len=" + bytes.length + " removed=" + proto.removed +
          " head=" + hexHead(bytes, 6) +
          " seen=" + proto.seen.filter(Boolean).slice(0, 6).join(";");
      }
    }
  } catch (e) {
    note = "error " + (e && e.message ? e.message : String(e));
  }

  console.log(TAG + " " + note);
  $done(result ? { body: result.body } : {});
})();
