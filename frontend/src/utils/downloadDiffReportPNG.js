export function downloadDiffReportPNG({
  summary,
  filename = "rgb-diff-report.png",
  title = "RGB Comparison Report",
  canvasSize = { width: 1400, height: 900 },
}) {
  if (!summary) throw new Error("summary is required");

  const { width: W, height: H } = canvasSize;
  const pad = 28;
  const line = 28;

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(title, pad, pad + 4);

  ctx.font = "400 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "#334155";
  const ts = new Date().toLocaleString();
  const method = summary.method || "pixel_diff";
  ctx.fillText(`Generated: ${ts}  •  Method: ${method}`, pad, pad + line + 6);

  drawDivider(ctx, pad, pad + line + 14, W - pad * 2);

  const m = summary.metrics || {};
  const settings = summary.settings || {};
  const imgSize = summary.imageSize || {};
  const leftX = pad;
  let y = pad + line + 30;

  drawSectionTitle(ctx, "Global Metrics", leftX, y); y += 8;
  ctx.font = "400 16px system-ui, -apple-system"; y += line;
  drawKV(ctx, "Image size", `${imgSize.width ?? "?"} × ${imgSize.height ?? "?"}`, leftX, y); y += line;
  drawKV(ctx, "Changed pixels", fmtNum(m.changedPx), leftX, y); y += line;
  drawKV(ctx, "Changed %", pct(m.changedPct), leftX, y); y += line;
  drawKV(ctx, "Mean diff (0–255)", n2(m.meanDiff), leftX, y); y += line;
  drawKV(ctx, "Max diff", n0(m.maxDiff), leftX, y); y += line;
  if (m.ssim != null) { drawKV(ctx, "SSIM (0–1, higher=same)", n3(m.ssim), leftX, y); y += line; }
  if (m.avgBrightnessDelta != null) { drawKV(ctx, "Avg brightness Δ", n2(m.avgBrightnessDelta), leftX, y); y += line; }

  y += 10;
  drawSectionTitle(ctx, "Settings", leftX, y); y += line;
  drawKV(ctx, "Threshold", settings.threshold ?? "—", leftX, y); y += line;
  drawKV(ctx, "Blur radius", settings.blurRadius ?? "—", leftX, y); y += line;
  drawKV(ctx, "Min region px", settings.minRegionPx ?? "—", leftX, y); y += line;

  if (Array.isArray(summary.notes) && summary.notes.length) {
    y += 10;
    drawSectionTitle(ctx, "Notes", leftX, y); y += line;
    ctx.fillStyle = "#1f2937"; ctx.font = "400 16px system-ui, -apple-system";
    summary.notes.slice(0, 4).forEach(note => { ctx.fillText("• " + String(note), leftX, y); y += line; });
  }

  const tableX = W * 0.46;
  const tableW = W - tableX - pad;
  const tableTop = pad + line + 30;
  drawSectionTitle(ctx, "Changed Regions", tableX, tableTop);
  drawTable(ctx, {
    x: tableX, y: tableTop + line,
    w: tableW, rowH: 28,
    headers: ["#", "x", "y", "w", "h", "area%", "meanΔ"],
    rows: (summary.regions || []).map(r => ([
      r.id ?? "",
      r.bbox?.x ?? "",
      r.bbox?.y ?? "",
      r.bbox?.w ?? "",
      r.bbox?.h ?? "",
      n2((r.areaPx / ((summary.imageSize?.width||1)*(summary.imageSize?.height||1))) * 100),
      n1(r.meanDiff),
    ])).slice(0, 18)
  });

  ctx.font = "400 14px system-ui, -apple-system";
  ctx.fillStyle = "#64748b";
  ctx.fillText(
    "Tip: high changed% + low SSIM = large scene change. Lighting changes show high brightnessΔ with many small regions.",
    pad, H - pad + 2
  );

  const url = c.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL?.(url);
}

function drawDivider(ctx, x, y, w){ ctx.fillStyle="#e5e7eb"; ctx.fillRect(x,y,w,1); }
function drawSectionTitle(ctx, t, x, y){ ctx.font="600 18px system-ui, -apple-system"; ctx.fillStyle="#0f172a"; ctx.fillText(t,x,y); }
function drawKV(ctx,k,v,x,y){ ctx.fillStyle="#475569"; ctx.fillText(k+":", x, y); ctx.fillStyle="#0f172a"; ctx.fillText(String(v), x+180, y); }
function drawTable(ctx, { x, y, w, rowH, headers, rows }) {
  const colWidths = [36, 64, 64, 64, 64, 80, 80];
  let cx = x, cy = y;
  ctx.font = "600 16px system-ui, -apple-system"; ctx.fillStyle = "#0f172a";
  headers.forEach((h,i)=>{ ctx.fillText(h, cx+8, cy); cx += colWidths[i]; });
  cy += 10;
  ctx.fillStyle = "#e5e7eb"; ctx.fillRect(x, cy, w, 1); cy += 18;

  ctx.font = "400 15px system-ui, -apple-system";
  rows.forEach((r, ri) => {
    cx = x;
    const zebra = ri % 2 === 0 ? "#f8fafc" : "#ffffff";
    ctx.fillStyle = zebra; ctx.fillRect(x, cy - 20, w, rowH);
    r.forEach((cell,i) => { ctx.fillStyle = "#1f2937"; ctx.fillText(String(cell), cx+8, cy); cx += colWidths[i]; });
    cy += rowH;
  });
}
function fmtNum(n){ return (n==null)? "—" : n.toLocaleString(); }
function pct(n){ return (n==null)? "—" : `${Number(n).toFixed(2)}%`; }
function n0(n){ return (n==null)? "—" : Number(n).toFixed(0); }
function n1(n){ return (n==null)? "—" : Number(n).toFixed(1); }
function n2(n){ return (n==null)? "—" : Number(n).toFixed(2); }
function n3(n){ return (n==null)? "—" : Number(n).toFixed(3); }
