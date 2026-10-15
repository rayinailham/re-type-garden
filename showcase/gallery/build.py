"""Galeri bukti offline: slider sebelum/sesudah frame oracle (kode asli) vs rebuild.
Satu sumber angka: REPORT_FACTS.json, dibangun dari log/hasil run — tidak ada angka diketik tangan.
  python3 -I showcase/gallery/build.py      (butuh: PARITY_SAVE=1 npm run test:parity > showcase/out/parity.log)
"""
import json, re, shutil, html
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
G = Path(__file__).resolve().parent
OUT = ROOT / "showcase/out"
PAR = ROOT / "tests/parity/out"

# --- fakta dari artefak run ---
plog = (OUT / "parity.log").read_text()
frames = [dict(name=m[1], pct=float(m[2]), px=int(m[3]), ok=m[0].startswith("PASS"))
          for m in re.findall(r"^((?:PASS|FAIL)\s+([a-z]+-[a-z]+-\d+)\s+([\d.]+)%\s+\((\d+) px\))", plog, re.M)]
for f in frames:
    f["ok"] = plog.count(f"PASS  {f['name']} ") == 1
unit = re.search(r"Tests\s+(\d+) passed \((\d+)\)", (OUT / "unit.log").read_text())
leak = re.search(r"bersih: (\d+) temuan", (OUT / "leak.log").read_text())
bites = len(re.findall(r"^PASS\s+uji gigit", (OUT / "leak.log").read_text(), re.M))
qa = json.loads((ROOT / "tests/e2e/out/qa/results.json").read_text())
facts = {
    "parity_frames": len(frames), "parity_pass": sum(f["ok"] for f in frames),
    "parity_worst_pct": max(f["pct"] for f in frames), "parity_threshold_pct": 1,
    "unit_passed": int(unit[1]), "unit_total": int(unit[2]),
    "leak_findings": int(leak[1]), "leak_bite_tests": bites,
    "qa_total": len(qa), "qa_clean": sum(1 for r in qa if not r["issues"]),
    "qa_engines": sorted({r["engine"] for r in qa}),
    "sources": ["showcase/out/parity.log", "showcase/out/unit.log", "showcase/out/leak.log", "tests/e2e/out/qa/results.json"],
}
assert facts["parity_frames"] == 49, facts
(G / "REPORT_FACTS.json").write_text(json.dumps(facts, indent=2) + "\n")

# --- gambar ---
for d in ("full", "thumbs"):
    shutil.rmtree(G / d, ignore_errors=True); (G / d).mkdir()
for f in frames:
    for side in ("orig", "rebuild"):
        src = PAR / f"{f['name']}-{side}.png"
        shutil.copy(src, G / "full" / src.name)
    im = Image.open(PAR / f"{f['name']}-rebuild.png").convert("RGB"); im.thumbnail((320, 320))
    im.save(G / "thumbs" / f"{f['name']}.jpg", quality=86)

# --- html (inline, tanpa CDN/fetch) ---
def card(f):
    s, p, m = f["name"].split("-")
    return (f'<button class="cell" data-set="{s}" data-preset="{p}" data-name="{f["name"]}">'
            f'<img loading="lazy" src="thumbs/{f["name"]}.jpg" alt="rebuild frame {f["name"]}">'
            f'<span>{p} · {s} · {m}%</span><b class="{"ok" if f["ok"] else "bad"}">{f["pct"]:.4f}%</b></button>')
presets = sorted({f["name"].split("-")[1] for f in frames})
sets = {"base": '"in bloom" · seed 7 · Rose noir', "alt": '"type garden wind" · seed 4242 · Paper', "boil": '"in bloom" · boil on'}
opt = lambda xs: "".join(f'<option value="{x}">{x}</option>' for x in xs)
F = facts
page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RE: Type Garden — parity gallery</title>
<style>
:root{{--bg:#0c0809;--fg:#f6efe8;--mute:#b9aca4;--rose:#ff1400;--line:#3a2a2c}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-monospace,Menlo,monospace}}
main{{max-width:1180px;margin:0 auto;padding:32px 16px 64px}}h1{{font:700 44px/1.1 Georgia,serif;margin:0 0 6px}}h1 em{{color:var(--rose);font-style:normal}}
.lede{{color:var(--mute);max-width:760px}}.facts{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:24px 0}}
.fact{{border-top:1px solid var(--line);padding-top:10px}}.fact b{{display:block;font:700 34px Georgia,serif}}.fact small{{color:var(--mute)}}
.bar{{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:20px 0}}select{{background:#1a1213;color:var(--fg);border:1px solid var(--line);padding:6px 8px;font:inherit}}
#count{{color:var(--mute)}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}}
.cell{{background:#000;border:1px solid var(--line);color:var(--fg);padding:0;text-align:left;cursor:pointer;font:inherit}}.cell:focus-visible,.cell[aria-pressed=true]{{outline:2px solid var(--rose)}}
.cell img{{width:100%;display:block;aspect-ratio:1}}.cell span{{display:block;padding:6px 8px 0;font-size:12px;color:var(--mute)}}.cell b{{display:block;padding:0 8px 8px;font-size:13px}}.ok{{color:#7fd18b}}.bad{{color:var(--rose)}}
.ba{{position:relative;width:min(100%,720px);aspect-ratio:1;margin:12px 0;user-select:none;border:1px solid var(--line);touch-action:none}}
.ba img{{position:absolute;inset:0;width:100%;height:100%}}.ba .top{{clip-path:inset(0 0 0 var(--x,50%))}}
.ba .knob{{position:absolute;top:0;bottom:0;left:var(--x,50%);width:2px;background:var(--rose)}}.ba .lab{{position:absolute;top:8px;padding:2px 8px;background:#000c;font-size:12px}}
.ba input{{position:absolute;inset:auto 0 -34px;width:100%}}#detail{{margin:28px 0 48px}}footer{{color:var(--mute);border-top:1px solid var(--line);padding-top:16px;margin-top:40px}}
video{{width:min(100%,540px);display:block;margin-top:12px}}
</style></head><body><main>
<h1><em>RE:</em> Type Garden — parity gallery</h1>
<p class="lede">Poster frames rendered by the original code (run unchanged as an oracle) vs the rebuild, same text · seed · preset · palette · time.
Drag the slider: left = original, right = rebuild. Diff = YIQ pixel diff, threshold {F["parity_threshold_pct"]}%.</p>
<div class="facts">
<div class="fact"><b>{F["parity_pass"]}/{F["parity_frames"]}</b><small>poster frames pass · worst {F["parity_worst_pct"]:.4f}%</small></div>
<div class="fact"><b>{F["unit_passed"]}/{F["unit_total"]}</b><small>unit tests passing</small></div>
<div class="fact"><b>{F["qa_clean"]}/{F["qa_total"]}</b><small>QA sweep clean · {" · ".join(F["qa_engines"])}</small></div>
<div class="fact"><b>{F["leak_findings"]}</b><small>leaked commercial assets · {F["leak_bite_tests"]} bite tests caught</small></div>
</div>
<section id="detail" aria-live="polite"><h2 id="dt">base-grow-50</h2>
<div class="ba" id="ba"><img id="ia" alt="original frame"><img id="ib" class="top" alt="rebuild frame"><span class="lab" style="left:8px">original</span><span class="lab" style="right:8px">rebuild</span><div class="knob"></div>
<input id="sl" type="range" min="0" max="100" value="50" aria-label="before/after slider"></div></section>
<div class="bar"><label>preset <select id="fp"><option value="">all</option>{opt(presets)}</select></label>
<label>set <select id="fs"><option value="">all</option>{opt(sets)}</select></label><span id="count"></span></div>
<p class="lede">{" · ".join(f"<b>{k}</b> = {html.escape(v)}" for k, v in sets.items())}</p>
<div class="grid" id="grid">{"".join(card(f) for f in frames)}</div>
<h2>Showcase video</h2><video src="showcase-re-type-garden.mp4" controls muted playsinline preload="metadata"></video>
<footer>Original design &amp; code: <b>Type Garden by Akshat Agarwal</b> (x.com/art_akshat). Reverse-engineered rebuild by Rayina Ilham — non-commercial portfolio showcase.
Type mode uses Playfair Display (SIL OFL); the commercial GT Ultra is not redistributed. Numbers: REPORT_FACTS.json ← {", ".join(F["sources"])}.</footer>
</main><script>
const $=s=>document.querySelector(s),cells=[...document.querySelectorAll('.cell')];
function show(n){{$('#dt').textContent=n;$('#ia').src='full/'+n+'-orig.png';$('#ib').src='full/'+n+'-rebuild.png';cells.forEach(c=>c.setAttribute('aria-pressed',c.dataset.name===n))}}
$('#sl').oninput=e=>$('#ba').style.setProperty('--x',e.target.value+'%');
cells.forEach(c=>c.onclick=()=>{{show(c.dataset.name);$('#detail').scrollIntoView({{behavior:'smooth'}})}});
function filt(){{const p=$('#fp').value,s=$('#fs').value;let n=0;cells.forEach(c=>{{const v=(!p||c.dataset.preset===p)&&(!s||c.dataset.set===s);c.hidden=!v;n+=v}});$('#count').textContent=(p||'all')+' · '+(s||'all')+' → '+n+'/'+cells.length+' frames'}}
$('#fp').onchange=$('#fs').onchange=filt;filt();show('base-grow-50');
</script></body></html>"""
(G / "index.html").write_text(page)
shutil.copy(OUT / "showcase-re-type-garden.mp4", G)
print(json.dumps(facts))
