export async function compareTwoShots(fileA, fileB, opts = {}) {
  const options = {
    threshold: 25,    
    blurRadius: 3,     
    minRegionPx: 600,  
    maxRegions: 50,
    overlayAlpha: 0.35,
    ...opts,
  };

  const imgA = await fileToBitmap(fileA);
  const imgB = await fileToBitmap(fileB);

  const W = imgA.width, H = imgA.height;

  const cA = makeCanvas(W, H), cB = makeCanvas(W, H);
  const gA = cA.getContext("2d"), gB = cB.getContext("2d");
  gA.drawImage(imgA, 0, 0, W, H);
  gB.drawImage(imgB, 0, 0, W, H);

  const dA = gA.getImageData(0, 0, W, H);
  const dB = gB.getImageData(0, 0, W, H);

  const grayA = toGray(dA);
  const grayB = toGray(dB);

  const ga = options.blurRadius > 0 ? boxBlur(grayA, W, H, options.blurRadius) : grayA;
  const gb = options.blurRadius > 0 ? boxBlur(grayB, W, H, options.blurRadius) : grayB;

  const { diff, meanA, meanB, meanAbsDiff, maxAbsDiff } = absDiff(ga, gb, W, H);

  const mask = thresholdMask(diff, W, H, options.threshold);

  const cleaned = open3x3(mask, W, H);

  const regions = findRegions(cleaned, diff, W, H, options.minRegionPx)
                    .slice(0, options.maxRegions);

  const changedPx = regions.reduce((s, r) => s + r.areaPx, 0);
  const changedPct = (changedPx / (W * H)) * 100;
  const avgBrightnessDelta = Math.abs(meanA - meanB);

  const ssim = simpleSSIM(ga, gb, W, H);

  const summary = {
    imageSize: { width: W, height: H },
    method: "pixel_diff",
    settings: {
      threshold: options.threshold,
      blurRadius: options.blurRadius,
      minRegionPx: options.minRegionPx
    },
    metrics: {
      changedPx: Math.round(changedPx),
      changedPct: +changedPct.toFixed(2),
      meanDiff: +meanAbsDiff.toFixed(2),
      maxDiff: maxAbsDiff,
      ssim: +ssim.toFixed(3),
      avgBrightnessDelta: +avgBrightnessDelta.toFixed(2)
    },
    regions: regions.map((r, i) => ({
      id: i + 1,
      bbox: r.bbox,
      areaPx: r.areaPx,
      areaPct: +((r.areaPx / (W * H)) * 100).toFixed(2),
      meanDiff: +r.meanDiff.toFixed(1),
      maxDiff: r.maxDiff
    })),
    notes: []
  };

  const overlayCanvas = drawOverlay(imgA, cleaned, regions, W, H, options.overlayAlpha);

  return { summary, overlayCanvas };
}

async function fileToBitmap(file) {
  if (window.createImageBitmap) return await createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const c = makeCanvas(img.naturalWidth, img.naturalHeight);
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

function toGray(imgData) {
  const { data, width, height } = imgData;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    out[j] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }
  return out;
}

function boxBlur(src, w, h, r) {
  const tmp = new Uint16Array(w * h);
  const out = new Uint8ClampedArray(w * h);
  const dia = r * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0, row = y * w;
    for (let x = -r; x <= r; x++) sum += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum;
      const x0 = x - r, x1 = x + r + 1;
      sum += src[row + clamp(x1, 0, w - 1)] - src[row + clamp(x0, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      const idx = y * w + x;
      out[idx] = (sum / (dia * dia)) | 0;
      const y0 = y - r, y1 = y + r + 1;
      sum += tmp[clamp(y1, 0, h - 1) * w + x] - tmp[clamp(y0, 0, h - 1) * w + x];
    }
  }
  return out;
}

function absDiff(a, b, w, h) {
  const N = w * h;
  const out = new Uint8ClampedArray(N);
  let sumA = 0, sumB = 0, sumD = 0, maxD = 0;
  for (let i = 0; i < N; i++) {
    const d = Math.abs(a[i] - b[i]);
    out[i] = d;
    if (d > maxD) maxD = d;
    sumA += a[i]; sumB += b[i]; sumD += d;
  }
  return {
    diff: out,
    meanA: sumA / N,
    meanB: sumB / N,
    meanAbsDiff: sumD / N,
    maxAbsDiff: maxD
  };
}

function thresholdMask(diff, w, h, T) {
  const N = w * h;
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = diff[i] >= T ? 1 : 0;
  return mask;
}

function open3x3(mask, w, h) {
  return dilate3x3(erode3x3(mask, w, h), w, h);
}
function erode3x3(src, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let all = 1;
      for (let yy = -1; yy <= 1 && all; yy++)
        for (let xx = -1; xx <= 1; xx++)
          if (!src[(y + yy) * w + (x + xx)]) { all = 0; break; }
      out[y * w + x] = all;
    }
  }
  return out;
}
function dilate3x3(src, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let any = 0;
      for (let yy = -1; yy <= 1 && !any; yy++)
        for (let xx = -1; xx <= 1; xx++)
          if (src[(y + yy) * w + (x + xx)]) { any = 1; break; }
      out[y * w + x] = any;
    }
  }
  return out;
}

function findRegions(mask, diff, w, h, minArea) {
  const visited = new Uint8Array(w * h);
  const regions = [];
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!mask[idx] || visited[idx]) continue;

      let head = 0, tail = 0;
      qx[tail] = x; qy[tail] = y; tail++;
      visited[idx] = 1;

      let minX = x, minY = y, maxX = x, maxY = y;
      let area = 0, sumDiff = 0, maxD = 0;

      while (head < tail) {
        const cx = qx[head], cy = qy[head]; head++;
        const cidx = cy * w + cx;
        area++;
        const d = diff[cidx]; sumDiff += d; if (d > maxD) maxD = d;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;

        const nbs = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let k = 0; k < 4; k++) {
          const nx = cx + nbs[k][0], ny = cy + nbs[k][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nidx = ny * w + nx;
          if (mask[nidx] && !visited[nidx]) {
            visited[nidx] = 1;
            qx[tail] = nx; qy[tail] = ny; tail++;
          }
        }
      }

      if (area >= (minArea || 0)) {
        regions.push({
          bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
          areaPx: area,
          meanDiff: sumDiff / area,
          maxDiff: maxD
        });
      }
    }
  }
  regions.sort((a, b) => b.areaPx - a.areaPx);
  return regions;
}

function drawOverlay(imgA, mask, regions, W, H, alpha) {
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  g.drawImage(imgA, 0, 0, W, H);

  const id = g.getImageData(0, 0, W, H);
  const px = id.data;
  for (let i = 0, j = 0; j < mask.length; i += 4, j++) {
    if (mask[j]) {
      px[i]   = Math.min(255, px[i]   * (1 - alpha) + 255 * alpha);
      px[i+1] = Math.max(0,   px[i+1] * (1 - alpha));       
      px[i+2] = Math.max(0,   px[i+2] * (1 - alpha));       
    }
  }
  g.putImageData(id, 0, 0);

  g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,0.9)";
  g.font = "600 12px system-ui, -apple-system";
  g.fillStyle = "rgba(0,0,0,0.6)";
  regions.forEach((r, i) => {
    g.strokeRect(r.bbox.x + 0.5, r.bbox.y + 0.5, r.bbox.w, r.bbox.h);
    const label = `#${i+1}`;
    g.fillRect(r.bbox.x, r.bbox.y - 16, 22, 16);
    g.fillStyle = "#fff";
    g.fillText(label, r.bbox.x + 4, r.bbox.y - 4);
    g.fillStyle = "rgba(0,0,0,0.6)";
  });

  return c;
}

function simpleSSIM(a, b, w, h) {
  const N = w * h;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < N; i++) { sumA += a[i]; sumB += b[i]; }
  const muA = sumA / N, muB = sumB / N;

  let va = 0, vb = 0, vab = 0;
  for (let i = 0; i < N; i++) {
    const da = a[i] - muA, db = b[i] - muB;
    va += da * da; vb += db * db; vab += da * db;
  }
  va /= N - 1; vb /= N - 1; vab /= N - 1;

  const L = 255, C1 = (0.01 * L) ** 2, C2 = (0.03 * L) ** 2;
  return ((2 * muA * muB + C1) * (2 * vab + C2)) /
         ((muA * muA + muB * muB + C1) * (va + vb + C2));
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
