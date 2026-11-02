/* 生成 PWA 图标：墨绿呢面 + 宣纸牌面 + 朱砂红桃（纯 Node，无依赖） */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ---------- 最小 PNG 编码器 ---------- */
const CRCT = [];
for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRCT[n] = c >>> 0; }
function crc32(buf){ let c = ~0; for (const b of buf) c = CRCT[(c ^ b) & 0xFF] ^ (c >>> 8); return (~c) >>> 0; }
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, cr]);
}
function encodePNG(w, h, pix){
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = w * 4 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++){ raw[y * stride] = 0; Buffer.from(pix.buffer, pix.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1); }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 参数化绘制（单位坐标 0~1，可配置尺寸渲染） ---------- */
const mix = (a, b, t) => a + (b - a) * t;
const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const F1 = hex('#07281d'), F3 = hex('#12472f'), GOLD = hex('#d9a94e'), CREAM = hex('#fdf7e8'), RED = hex('#c1402a');

function insideRoundRect(u, v, cx, cy, hw, hh, r){
  const dx = Math.abs(u - cx), dy = Math.abs(v - cy);
  if (dx > hw || dy > hh) return false;
  if (dx > hw - r || dy > hh - r){
    return dx > hw - r && dy > hh - r ? (dx - (hw - r)) ** 2 + (dy - (hh - r)) ** 2 <= r * r : true;
  }
  return true;
}
function heartInside(u, v){
  const xs = (u - 0.500) / 0.125, ys = (0.505 - v) / 0.105;   // y 轴向上
  return ((xs * xs + ys * ys - 1) ** 3 - xs * xs * ys ** 3) <= 0;
}
function drawPixel(u, v){
  const d = Math.min(1, Math.hypot(u - 0.5, v - 0.46) / 0.72);   // 呢面径向渐变
  let r = mix(F3[0], F1[0], d), g = mix(F3[1], F1[1], d), b = mix(F3[2], F1[2], d);
  if (insideRoundRect(u, v, 0.50, 0.52, 0.19, 0.26, 0.055)){     // 牌面投影
    r = Math.round(r * 0.55); g = Math.round(g * 0.55); b = Math.round(b * 0.55);
  }
  if (insideRoundRect(u, v, 0.50, 0.50, 0.19, 0.26, 0.055)){     // 宣纸牌面
    r = CREAM[0]; g = CREAM[1]; b = CREAM[2];
    if (!insideRoundRect(u, v, 0.50, 0.50, 0.185, 0.255, 0.053)){ // 鎏金细边
      r = mix(r, GOLD[0], 0.55); g = mix(g, GOLD[1], 0.55); b = mix(b, GOLD[2], 0.55);
    }
    if (heartInside(u, v)){ r = RED[0]; g = RED[1]; b = RED[2]; } // 朱砂红桃
  }
  return [r, g, b];
}
function renderIcon(size){
  const pix = new Uint8Array(size * size * 4), S = 3;   // 3x3 超采样抗锯齿
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++){
      const [pr, pg, pb] = drawPixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
      r += pr; g += pg; b += pb;
    }
    const i = (y * size + x) * 4;
    pix[i] = Math.round(r / (S * S)); pix[i+1] = Math.round(g / (S * S)); pix[i+2] = Math.round(b / (S * S)); pix[i+3] = 255;
  }
  return encodePNG(size, size, pix);
}

/* ---------- 输出 ---------- */
fs.mkdirSync(path.join(__dirname, 'icons'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'icons', 'icon-192.png'), renderIcon(192));
fs.writeFileSync(path.join(__dirname, 'icons', 'icon-512.png'), renderIcon(512));

/* 打印红桃在单位坐标里的包围盒，确认未越出牌面 */
let minX = 1, maxX = 0, minY = 1, maxY = 0;
for (let v = 0; v < 1; v += 0.002) for (let u = 0; u < 1; u += 0.002)
  if (heartInside(u, v)){ minX = Math.min(minX, u); maxX = Math.max(maxX, u); minY = Math.min(minY, v); maxY = Math.max(maxY, v); }
console.log(`红桃包围盒 u:[${minX.toFixed(3)}, ${maxX.toFixed(3)}] v:[${minY.toFixed(3)}, ${maxY.toFixed(3)}]（牌面 u:[0.31,0.69] v:[0.24,0.76]）`);
console.log('icons/icon-192.png, icons/icon-512.png 已生成');
