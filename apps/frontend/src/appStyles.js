export const css = `
*{ box-sizing:border-box; }
html,body,#root{ margin:0; min-height:100%; background:#15131a; }
body{ overflow-x:hidden; }
.al-root{
  --bg:#15131a; --phone:#191820; --ink:#f4f2f8; --soft:#aaa4b6; --line:#34313d;
  --accent:#9f7cff; --accent2:#ff8fc6; --like:#ff5a8a;
  min-height:100dvh; background:
    radial-gradient(circle at 30% -10%, #30224a 0%, transparent 50%),
    radial-gradient(circle at 80% 10%, #3b2032 0%, transparent 45%),
    var(--bg);
  display:flex; flex-direction:column; align-items:center;
  padding:0 16px;
  font-family:'Pretendard','Inter',-apple-system,'Apple SD Gothic Neo',sans-serif; color:var(--ink);
}
.al-phone{ width:100%; max-width:420px; min-height:100dvh; background:var(--phone);
  border:1px solid var(--line); border-radius:26px; overflow:hidden;
  box-shadow:0 30px 70px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05) inset; }

/* setup */
.al-setup{ padding:30px 22px 26px; display:flex; flex-direction:column; gap:16px; }
.al-setup-head{ text-align:center; margin-bottom:4px; }
.al-spark{ font-size:24px; color:var(--accent); }
.al-setup-head h1{ font-size:24px; font-weight:800; margin:8px 0 6px; letter-spacing:-.02em; }
.al-setup-head p{ font-size:13.5px; color:var(--soft); margin:0; line-height:1.6; }

.al-field{ display:flex; flex-direction:column; gap:7px; }
.al-field > span{ font-size:12.5px; font-weight:700; color:var(--ink); letter-spacing:.02em;
  display:flex; align-items:center; gap:7px; }
.al-hint{ font-size:11px; font-weight:400; color:var(--soft); font-style:normal; }
.al-row{ display:flex; gap:10px; }
.al-row .al-field{ flex:1; }
.al-field input, .al-field textarea{ width:100%; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:12px 13px; font-family:inherit; font-size:14px; color:var(--ink); resize:none; }
.al-field input::placeholder, .al-field textarea::placeholder{ color:#55555f; }
.al-field input:focus, .al-field textarea:focus{ outline:none; border-color:var(--accent); }
.al-field textarea{ min-height:64px; line-height:1.55; }

.al-tones{ display:flex; flex-wrap:wrap; gap:7px; }
.al-tone{ flex:1 1 calc(33% - 7px); min-width:96px; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:10px 11px; cursor:pointer; font-family:inherit; text-align:left;
  display:flex; flex-direction:column; gap:2px; transition:.16s; color:var(--ink); }
.al-tone i{ font-size:10.5px; color:var(--soft); font-style:normal; }
.al-tone.on{ border-color:var(--accent); background:linear-gradient(135deg, #221a38, #1a1a20);
  box-shadow:0 0 0 1px var(--accent) inset; }
.al-tone.on i{ color:#c8b3ff; }

.al-start{ margin-top:8px; padding:15px; border:none; border-radius:13px; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:800; letter-spacing:.02em;
  background:linear-gradient(135deg, var(--accent), var(--accent2)); color:#fff; transition:.18s; }
.al-start:hover:not(:disabled){ filter:brightness(1.08); }
.al-start:disabled{ background:#2a2a32; color:#5a5a64; cursor:not-allowed; }

.al-dump{ width:100%; min-height:200px; background:#1a1a20; border:1px solid var(--line);
  border-radius:13px; padding:15px; font-family:inherit; font-size:14.5px; line-height:1.7;
  color:var(--ink); resize:none; }
.al-dump::placeholder{ color:#55555f; line-height:1.7; }
.al-dump:focus{ outline:none; border-color:var(--accent); }
.al-dump-note{ font-size:12px; color:var(--soft); text-align:center; margin:2px 0 0; }

/* guide chips */
.al-guidechips{ display:flex; flex-wrap:wrap; gap:6px; }
.al-guidechip{ font-size:11.5px; color:var(--soft); background:#18181e; border:1px solid var(--line);
  padding:5px 10px; border-radius:20px; }

/* roleplay log (option) */
.al-rp{ background:#15141b; border:1px solid var(--line); border-radius:13px; padding:13px 14px; }
.al-rp-head{ display:flex; align-items:center; gap:8px; }
.al-rp-head > span:first-child{ font-size:13px; font-weight:700; color:var(--ink); }
.al-rp-opt{ font-size:10.5px; font-weight:700; color:var(--accent); background:#221a38;
  border:1px solid #2e2640; padding:2px 8px; border-radius:20px; letter-spacing:.04em; }
.al-rp-desc{ font-size:11.5px; color:var(--soft); margin:7px 0 9px; line-height:1.5; }
.al-rp-box{ width:100%; min-height:90px; background:#1a1a20; border:1px solid var(--line);
  border-radius:10px; padding:12px; font-family:inherit; font-size:13.5px; line-height:1.7;
  color:var(--ink); resize:none; }
.al-rp-box::placeholder{ color:#55555f; line-height:1.7; }
.al-rp-box:focus{ outline:none; border-color:var(--accent); }

/* example cards */
.al-examples{ display:flex; flex-direction:column; gap:8px; }
.al-examples-lbl{ font-size:11.5px; color:var(--soft); }
.al-example-cards{ display:flex; gap:8px; }
.al-example{ flex:1; text-align:left; background:#18141f; border:1px solid var(--line); border-radius:11px;
  padding:11px 12px; cursor:pointer; font-family:inherit; display:flex; flex-direction:column; gap:3px; transition:.15s; }
.al-example:hover{ border-color:var(--accent); background:#201a30; }
.al-example-name{ font-size:13.5px; font-weight:800; color:var(--ink); }
.al-example-desc{ font-size:11.5px; color:var(--soft); }

/* gallery */
.al-gallery{ margin-top:14px; padding-top:13px; border-top:1px solid var(--line); }
.al-gallery-head{ display:flex; justify-content:space-between; align-items:center; }
.al-gallery-head > span{ font-size:12.5px; font-weight:700; color:var(--ink); }
.al-upload{ font-size:12px; color:var(--accent); cursor:pointer; font-weight:600; }
.al-upload:hover{ text-decoration:underline; }
.al-gallery-empty{ font-size:11.5px; color:var(--soft); line-height:1.55; margin:8px 0 0; }
.al-gallery-strip{ display:flex; gap:7px; margin-top:9px; flex-wrap:wrap; }
.al-thumb{ position:relative; width:54px; height:54px; border-radius:9px; overflow:hidden; border:1px solid var(--line); }
.al-thumb img{ width:100%; height:100%; object-fit:cover; }
.al-thumb-x{ position:absolute; top:2px; right:2px; width:16px; height:16px; border-radius:50%;
  background:rgba(0,0,0,.6); color:#fff; border:none; font-size:12px; line-height:1; cursor:pointer; padding:0; }

/* post media */
.al-post-img{ margin-top:10px; border-radius:13px; overflow:hidden; border:1px solid var(--line); }
.al-post-img img{ width:100%; display:block; max-height:340px; object-fit:cover; }
.al-post-photo{ margin-top:10px; display:flex; align-items:center; gap:10px; padding:14px;
  border-radius:13px; border:1px dashed #3a3550; background:linear-gradient(135deg,#161320,#13131a); }
.al-photo-frame{ font-size:22px; color:var(--accent); opacity:.6; }
.al-photo-desc{ font-size:13px; color:#c4c2cc; font-style:italic; line-height:1.5; }
.al-post-moodcard{ margin-top:10px; padding:11px 14px; border-radius:11px; font-size:13px;
  color:#d8c2ff; background:linear-gradient(135deg,#1d1730,#181421); border:1px solid #2e2640; }
.al-confirm-title{ font-size:22px !important; }
.al-parse-error{ padding:12px 13px; border-radius:11px; background:#22141a; border:1px solid #66303c;
  color:#ffc3ce; font-size:12.5px; line-height:1.55; }
.al-parse-error span{ display:block; color:#ff8fa4; font-weight:800; margin-bottom:4px; }
.al-parse-error p{ margin:0; word-break:break-word; }
.al-retry{ width:100%; padding:12px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:700; background:#221a38; border:1px solid var(--accent); color:#c8b3ff; }
.al-retry:hover{ background:#2a2042; }
.al-confirm-actions{ display:flex; gap:10px; margin-top:8px; }
.al-reparse{ flex-shrink:0; padding:15px 16px; border-radius:13px; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:600; background:#1a1a20; border:1px solid var(--line); color:var(--soft); }
.al-reparse:hover{ border-color:var(--accent); color:var(--ink); }
.al-confirm-go{ flex:1; margin-top:0 !important; }

/* deep analysis card */
.al-analysis{ background:linear-gradient(135deg,#1a1530,#161420); border:1px solid #2e2640;
  border-radius:13px; padding:14px; display:flex; flex-direction:column; gap:9px; }
.al-analysis-head{ font-size:12.5px; font-weight:800; color:#c8b3ff; letter-spacing:.02em; margin-bottom:2px; }
.al-spark-sm{ color:var(--accent); }
.al-an-row{ display:flex; align-items:center; gap:10px; }
.al-an-lbl{ font-size:11.5px; color:#9a92b5; width:64px; flex-shrink:0; font-weight:600; }
.al-warmth-chips{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.al-warmth-chip{ padding:5px 12px; border-radius:13px; cursor:pointer; font-family:inherit; font-size:12px;
  font-weight:700; border:1px solid #2a2440; background:#16131f; color:#9aa0b0; }
.al-warmth-chip.on{ background:#2a2440; color:#fff; border-color:#7a5fa0; }
.al-warmth-hint{ font-size:10.5px; color:#7a7488; width:100%; margin-top:2px; }
.al-an-row input{ flex:1; background:#120f1c; border:1px solid #2a2440; border-radius:8px;
  padding:9px 11px; font-family:inherit; font-size:13px; color:var(--ink); }
.al-an-row input::placeholder{ color:#544d6b; }
.al-an-row input:focus{ outline:none; border-color:var(--accent); }

/* auto-post bar */
.al-autobar{ display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:11px 16px; border-bottom:1px solid var(--line);
  background:linear-gradient(135deg,#14101e,#121119); }
.al-autotoggle{ display:flex; align-items:center; gap:8px; background:none; border:none;
  font-family:inherit; font-size:12.5px; font-weight:600; color:var(--soft); cursor:pointer; padding:0; text-align:left; }
.al-autotoggle.on{ color:#c8b3ff; }
.al-autodot{ width:8px; height:8px; border-radius:50%; background:#4a4a52; flex-shrink:0; }
.al-autotoggle.on .al-autodot{ background:var(--accent2); box-shadow:0 0 0 0 var(--accent2);
  animation:pulse 2s infinite; }
@keyframes pulse{ 0%{box-shadow:0 0 0 0 rgba(236,72,153,.5);} 70%{box-shadow:0 0 0 7px rgba(236,72,153,0);} 100%{box-shadow:0 0 0 0 rgba(236,72,153,0);} }
.al-autometa{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
.al-nextin{ font-size:11.5px; color:var(--soft); font-variant-numeric:tabular-nums; }
.al-fast{ font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; cursor:pointer;
  font-family:inherit; background:#1f1a2e; border:1px solid #2e2640; color:#9a92b5; }
.al-fast.on{ background:var(--accent); color:#fff; border-color:var(--accent); }

.al-auto-badge{ font-style:normal; font-size:9.5px; font-weight:800; color:var(--accent2);
  background:#2a1322; border:1px solid #43203a; padding:1px 6px; border-radius:8px; margin-right:6px; }

/* profile */
.al-profile{ position:relative; padding-bottom:14px; border-bottom:1px solid var(--line); }
.al-back{ position:absolute; top:12px; left:12px; z-index:3; width:34px; height:34px; border-radius:50%;
  background:rgba(10,10,12,.6); backdrop-filter:blur(6px); border:none; color:#fff; font-size:22px;
  cursor:pointer; line-height:1; }
.al-banner{ position:relative; height:96px; overflow:hidden; background:linear-gradient(120deg, #2d1f4a, #3a1f33 60%, #1f2d3a); }
.al-banner img{ width:100%; height:100%; display:block; object-fit:cover; }
.al-cover-tools{ position:absolute; right:10px; bottom:9px; display:flex; align-items:center; gap:6px; }
.al-cover-tools label,.al-cover-tools button,.al-avatar-tools label,.al-avatar-tools button{ border:1px solid rgba(255,255,255,.22); border-radius:999px;
  padding:6px 9px; cursor:pointer; font-family:inherit; font-size:10.5px; font-weight:900; color:#fff;
  background:rgba(10,10,12,.58); backdrop-filter:blur(8px); white-space:nowrap; line-height:1; min-width:max-content; }
.al-cover-tools button,.al-avatar-tools button{ color:#ffb3c0; border-color:rgba(255,143,166,.32); }
.al-avatar-wrap{ position:relative; width:max-content; margin:-36px 0 0 18px; }
.al-avatar{ width:72px; height:72px; border-radius:50%; position:relative; overflow:hidden;
  background:linear-gradient(135deg, var(--accent), var(--accent2)); border:4px solid var(--phone);
  display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:800; color:#fff; }
.al-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.al-avatar-tools{ position:absolute; left:76px; bottom:5px; display:flex; align-items:center; gap:5px; width:max-content; }
.al-profile-info{ padding:8px 18px 0; }
.al-profile-info h2{ margin:0; font-size:20px; font-weight:800; letter-spacing:-.01em; }
.al-profile-top-main{ min-width:0; flex:1 1 auto; }
.al-name-line{ display:flex; align-items:center; gap:7px; min-width:0; flex-wrap:wrap; }
.al-world-chip{ flex-shrink:0; border:1px solid #3a3550; border-radius:999px; padding:3px 7px; cursor:pointer;
  background:#1c1730; color:#c8b3ff; font-family:inherit; font-size:10.5px; font-weight:900; line-height:1.1; }
.al-world-chip:hover,.al-world-chip.on{ border-color:var(--accent); color:#fff; background:#241d35; }
.al-world-view-modal{ width:min(390px,calc(100vw - 34px)); max-height:min(620px,82vh); overflow:auto; border-radius:18px;
  border:1px solid #3a3446; background:#17161e; color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.48); }
.al-world-view-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px; border-bottom:1px solid var(--line); }
.al-world-view-head h3{ margin:0 0 3px; font-size:18px; line-height:1.2; }
.al-world-view-head span{ color:var(--soft); font-size:12px; }
.al-world-view-head button{ flex-shrink:0; border:none; border-radius:10px; padding:7px 10px; cursor:pointer; font-family:inherit;
  color:#bdb5ca; background:#26212e; font-size:12px; font-weight:900; }
.al-world-view-modal p{ margin:0; padding:16px; color:#d8d3e2; font-size:13.5px; line-height:1.7; white-space:pre-wrap; }
.al-handle{ font-size:13.5px; color:var(--soft); }
.al-bio{ display:flex; gap:6px; margin:9px 0 0; flex-wrap:wrap; }
.al-bio-tag{ font-size:11.5px; padding:3px 9px; border-radius:20px; background:#1f1a2e;
  color:#c8b3ff; border:1px solid #2e2640; }
.al-bio-text{ font-size:13px; color:#bcbcc6; line-height:1.6; margin:10px 0 0; }
.al-share-status{ font-size:11.5px; color:#c8b3ff; line-height:1.5; margin:8px 0 0; word-break:break-all;
  opacity:.72; animation:shareFade 2.2s ease both; }
@keyframes shareFade{ 0%{opacity:0; transform:translateY(-3px);} 14%,72%{opacity:.72; transform:translateY(0);} 100%{opacity:0; transform:translateY(-2px);} }

/* composer */
.al-composer{ padding:14px 16px; border-bottom:1px solid var(--line); }
.al-wake{ width:100%; padding:14px; border-radius:13px; cursor:pointer; font-family:inherit;
  font-size:14.5px; font-weight:700; color:var(--ink); border:1px dashed #3a3550;
  background:linear-gradient(135deg, #1c1730, #18141f); transition:.18s; }
.al-wake:hover:not(:disabled){ border-color:var(--accent); color:#fff; }
.al-wake:disabled{ cursor:default; opacity:.85; }
.al-typing{ display:inline-flex; gap:5px; }
.al-typing i{ width:7px; height:7px; border-radius:50%; background:var(--accent);
  animation:bounce 1.2s infinite both; }
.al-typing i:nth-child(2){ animation-delay:.18s; } .al-typing i:nth-child(3){ animation-delay:.36s; }
@keyframes bounce{ 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }

.al-moods{ }
.al-moods-q{ font-size:13px; color:var(--soft); margin:2px 0 10px; }
.al-moods-grid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.al-mood{ padding:12px 10px; border-radius:11px; cursor:pointer; font-family:inherit; font-size:13px;
  background:#1a1a20; border:1px solid var(--line); color:var(--ink); transition:.15s; }
.al-mood:hover{ border-color:var(--accent); background:#201a30; color:#fff; }
.al-moods-cancel{ width:100%; margin-top:9px; padding:9px; background:none; border:none;
  color:var(--soft); font-family:inherit; font-size:12.5px; cursor:pointer; }

/* feed */
.al-feed{ min-height:120px; }
.al-empty{ text-align:center; padding:50px 24px; color:var(--soft); }
.al-empty span{ font-size:15px; }
.al-empty p{ font-size:13px; margin:8px 0 0; line-height:1.6; color:#6a6a74; }
.al-feed-tabs{ display:grid; grid-template-columns:1fr 1fr; border-top:1px solid var(--line); border-bottom:1px solid var(--line);
  background:#121119; }
.al-feed-tabs button{ min-width:0; padding:12px 8px; border:none; border-bottom:2px solid transparent; cursor:pointer;
  background:transparent; color:var(--soft); font-family:inherit; font-size:13px; font-weight:900; }
.al-feed-tabs button.on{ color:#fff; border-bottom-color:var(--accent); background:#171320; }
.al-feed-tabs b{ margin-left:5px; color:#c8b3ff; font-size:11px; }

.al-post{ display:flex; gap:11px; padding:15px 16px; border-bottom:1px solid var(--line);
  animation:fadein .4s ease; }
@keyframes fadein{ from{opacity:0; transform:translateY(-6px);} to{opacity:1; transform:none;} }
.al-post-av{ width:42px; height:42px; flex-shrink:0; border-radius:50%;
  background:linear-gradient(135deg, var(--accent), var(--accent2)); display:flex;
  align-items:center; justify-content:center; font-size:18px; font-weight:800; color:#fff; overflow:hidden; }
.al-post-av img{ width:100%; height:100%; object-fit:cover; display:block; }
.al-post-body{ flex:1; min-width:0; }
.al-post-head{ display:flex; align-items:center; gap:5px; font-size:13.5px; }
.al-post-name{ font-weight:800; }
.al-post-handle, .al-post-time{ color:var(--soft); font-size:12.5px; }
.al-post-text{ font-size:14.5px; line-height:1.65; margin:5px 0 0; white-space:pre-wrap; color:#e4e4ea; }
.al-edited{ margin-left:6px; color:#6f687c; font-size:10.5px; font-style:normal; font-weight:700; }
.al-editbox{ margin-top:8px; display:flex; flex-direction:column; gap:8px; }
.al-editbox textarea{ width:100%; min-height:86px; resize:vertical; background:#15131c; border:1px solid #3a3550;
  border-radius:11px; padding:11px 12px; color:var(--ink); font-family:inherit; font-size:14px; line-height:1.55; }
.al-editbox textarea:focus{ outline:none; border-color:var(--accent); }
.al-edit-actions{ display:flex; justify-content:flex-end; gap:7px; }
.al-edit-actions button, .al-comment-editbox button{ border:1px solid var(--line); background:#1a1a20; color:var(--soft);
  border-radius:8px; padding:6px 10px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; }
.al-edit-actions button.primary, .al-comment-editbox button:last-child{ border-color:var(--accent); background:#221a38; color:#d8cbff; }
.al-edit-actions button:disabled, .al-comment-editbox button:disabled{ opacity:.45; cursor:not-allowed; }
.al-quoted{ margin-top:10px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:#15131c; }
.al-quoted-head{ display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.al-quoted-av{ width:20px; height:20px; flex-shrink:0; border-radius:50%; font-size:10px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-quoted-name{ font-size:12.5px; font-weight:800; color:var(--ink); }
.al-quoted-handle{ font-size:11px; color:var(--soft); }
.al-quoted-text{ font-size:13px; line-height:1.5; margin:0; color:#bcbcc6; }
.al-post-actions{ display:flex; align-items:center; gap:10px; margin-top:11px; flex-wrap:wrap; }
.al-like{ background:none; border:none; color:var(--soft); font-family:inherit; font-size:13px;
  cursor:pointer; padding:0; transition:.15s; }
.al-like:hover{ color:var(--like); }
.al-like.on{ color:var(--like); }
.al-post-mood{ font-size:11px; color:#5a5a64; background:#18181e; padding:2px 9px; border-radius:20px; }
.al-mini-action{ background:none; border:none; color:#777180; font-family:inherit; font-size:11.5px; font-weight:700; cursor:pointer; padding:0; }
.al-mini-action:hover{ color:#c8b3ff; }
.al-mini-action.danger:hover{ color:#ff8fa4; }

.al-footer{ display:none; }

/* DM 컨트롤 */
.al-dmctrl{ padding:10px 14px 0; }
.al-speakas, .al-chatmode{ display:flex; align-items:center; gap:6px; }
.al-ctrl-lbl{ font-size:11px; color:var(--soft); flex-shrink:0; }
.al-speakas button, .al-chatmode button{ padding:5px 12px; border-radius:16px; cursor:pointer; font-family:inherit;
  font-size:11.5px; font-weight:600; background:#1a1a20; border:1px solid var(--line); color:var(--soft); }
.al-speakas button.on, .al-chatmode button.on{ background:var(--accent); color:#fff; border-color:var(--accent); }
.al-owner-persona{ width:100%; margin-top:8px; background:#1a1a20; border:1px solid var(--line);
  border-radius:9px; padding:8px 11px; font-family:inherit; font-size:12.5px; color:var(--ink); }
.al-owner-persona:focus{ outline:none; border-color:var(--accent); }
.al-chatmode{ margin-bottom:8px; }

/* 관계 시각화 */
.al-relbox{ background:linear-gradient(135deg,#1d1426,#161420); border:1px solid #2e2640; border-radius:13px; padding:14px; }
.al-relbox-head{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
.al-relbox-head > span:first-child{ font-size:13px; font-weight:800; color:var(--accent2); }
.al-relbox-hint{ font-size:10.5px; color:var(--soft); }
.al-relviz{ display:flex; flex-direction:column; gap:8px; margin-bottom:10px; }
.al-relviz-item{ display:flex; flex-direction:column; gap:5px; padding:10px 12px; background:#15111f; border:1px solid #2a2440; border-radius:11px; }
.al-relviz-line2{ display:flex; align-items:center; gap:8px; font-size:12.5px; }
.al-relviz-me{ font-weight:800; color:var(--ink); background:#221a38; padding:4px 10px; border-radius:14px; }
.al-relviz-arrow{ font-size:13px; color:var(--accent2); }
.al-relviz-peer{ font-weight:700; color:#c8b3ff; background:#1a1a20; border:1px solid #2e2640; padding:4px 10px; border-radius:14px; }
.al-relviz-rel{ font-size:12px; color:#b8b2c8; line-height:1.5; padding-left:2px; }
.al-relinput{ width:100%; background:#120f1c; border:1px solid #2a2440; border-radius:9px;
  padding:9px 11px; font-family:inherit; font-size:13px; color:var(--ink); }
.al-relinput:focus{ outline:none; border-color:var(--accent); }
/* 자동 기억 표시 */
.al-memlist{ margin-top:10px; padding:14px; background:#120f1c; border:1px solid #2a2440; border-radius:11px; }
.al-rellist{ margin-top:10px; padding:12px 13px; background:#120f1c; border:1px solid #2a2440; border-radius:11px; display:flex; flex-direction:column; gap:12px; }
.al-rel{ padding:11px 12px; background:#15111f; border:1px solid #241f38; border-radius:11px; }
.al-rel-top{ display:flex; align-items:center; gap:8px; margin-bottom:7px; }
.al-rel-av{ width:26px; height:26px; flex-shrink:0; border-radius:50%; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-rel-who{ font-size:13px; font-weight:800; color:var(--ink); }
.al-rel-desc{ font-size:12px; color:#b8b2c8; line-height:1.55; margin:0 0 8px; }
.al-rel-stage{ font-size:11px; color:var(--soft); margin-left:auto; }
.al-rel-delete{ flex-shrink:0; border:1px solid #563044; background:#251520; color:#ff9ab0; border-radius:8px;
  padding:4px 8px; font-family:inherit; font-size:10.5px; font-weight:800; cursor:pointer; }
.al-rel-delete:hover{ border-color:#854560; background:#321a2a; color:#ffd3dd; }
.al-rel-onesided{ font-size:10px; font-weight:700; color:#ff8aa0; background:#3a1f2a; padding:2px 7px; border-radius:8px; }
.al-rel-onesided-note{ display:block; font-size:10.5px; color:#d68a9a; margin-top:6px; }
.al-rel-bar{ height:5px; background:#1f1b2e; border-radius:3px; overflow:hidden; }
.al-rel-fill{ height:100%; background:linear-gradient(90deg,#9d6bff,#c8b3ff); border-radius:3px; }
.al-rel-fill.neg{ background:linear-gradient(90deg,#d65a7a,#ff8aa0); }
.al-rel-edit{ display:grid; grid-template-columns:auto minmax(0,1fr) 54px; align-items:center; gap:8px; margin-top:9px; }
.al-rel-edit span{ font-size:10.5px; color:#9a92b5; font-weight:900; white-space:nowrap; }
.al-rel-edit input[type="range"]{ width:100%; accent-color:var(--accent); }
.al-rel-edit input[type="number"]{ width:54px; min-width:0; border:1px solid #342e40; border-radius:8px; padding:5px 6px;
  background:#111018; color:#d9ccff; font-family:inherit; font-size:11px; font-weight:900; text-align:center; }
.al-mem-peers{ display:flex; flex-direction:column; gap:9px; }
.al-mem-peer-card{ display:flex; align-items:center; gap:10px; width:100%; padding:12px; border-radius:10px;
  cursor:pointer; font-family:inherit; text-align:left; background:#171321; border:1px solid #2a2440; color:var(--ink); }
.al-mem-peer-card:hover{ border-color:var(--accent); background:#1d1730; }
.al-mem-peer-av{ width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; color:#fff; font-size:13px; font-weight:800; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-mem-peer-info{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.al-mem-peer-info b{ font-size:13px; }
.al-mem-peer-info small{ font-size:11px; color:var(--soft); }
.al-mem-detail-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:9px; }
.al-mem-detail-head button{ background:none; border:none; color:var(--soft); cursor:pointer; font-family:inherit; font-size:12px; padding:0; }
.al-mem-detail-head span{ font-size:13px; font-weight:800; color:#c8b3ff; }
.al-mem-card{ margin-bottom:9px; padding:12px; border:1px solid #2f2942; border-radius:13px;
  background:linear-gradient(135deg,#171321,#12111a); }
.al-mem-card.pinned{ border-color:#5b4a78; background:linear-gradient(135deg,#1d1730,#14111d); }
.al-mem-card-top{ display:flex; align-items:center; gap:6px; margin-bottom:8px; }
.al-mem-kind,.al-mem-source,.al-mem-pin{ flex-shrink:0; border-radius:999px; padding:3px 7px; font-size:10.5px; font-weight:900; }
.al-mem-kind{ color:#ffd6e9; background:#2a1322; border:1px solid #4c233c; }
.al-mem-source{ color:#b8b2c8; background:#1a1822; border:1px solid #332e42; }
.al-mem-pin{ color:#ffd27a; background:#2a2112; border:1px solid #5a4520; }
.al-mem-card-actions{ margin-left:auto; display:flex; gap:5px; }
.al-mem-card-actions button{ border:1px solid #3a3550; border-radius:8px; padding:5px 7px; cursor:pointer;
  background:#1c1730; color:#c8b3ff; font-family:inherit; font-size:10.5px; font-weight:900; }
.al-mem-card-actions button.danger{ color:#ff9aaa; background:#241419; border-color:#502330; }
.al-mem-card-text{ margin:0; color:#e4dfeb; font-size:13px; line-height:1.65; white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; }
.al-mem-editbox{ display:flex; flex-direction:column; gap:8px; }
.al-mem-editbox textarea,.al-mem-editbox select{ width:100%; background:#171321; border:1px solid #3a3446; border-radius:10px;
  padding:10px 11px; color:var(--ink); font-family:inherit; font-size:12.5px; }
.al-mem-editbox textarea{ min-height:86px; line-height:1.6; resize:vertical; }
.al-mem-editbox textarea:focus,.al-mem-editbox select:focus{ outline:none; border-color:var(--accent); }
.al-mem-edit{ display:flex; gap:7px; align-items:stretch; margin-bottom:7px; }
.al-mem-edit textarea, .al-mem-add textarea, .al-mem-add input, .al-mem-add select{ width:100%; background:#171321; border:1px solid #2a2440;
  border-radius:9px; color:var(--ink); font-family:inherit; font-size:12px; line-height:1.45; padding:8px 9px; resize:vertical; }
.al-mem-add label{ font-size:11px; color:#9a92b5; font-weight:800; }
.al-mem-edit textarea{ min-height:58px; }
.al-mem-edit textarea:focus, .al-mem-add textarea:focus, .al-mem-add input:focus, .al-mem-add select:focus{ outline:none; border-color:var(--accent); }
.al-mem-edit button, .al-mem-add button{ flex-shrink:0; border-radius:9px; border:1px solid #3a2940; cursor:pointer;
  font-family:inherit; font-size:11px; font-weight:800; color:#ffb2c0; background:#24131b; padding:0 10px; }
.al-mem-add-toggle{ width:100%; margin-top:12px; min-height:40px; border:1px dashed #4a3c68; border-radius:12px; cursor:pointer;
  background:#171321; color:#c8b3ff; font-family:inherit; font-size:12.5px; font-weight:900; }
.al-mem-add-toggle:hover{ border-color:var(--accent); background:#1d1730; color:#fff; }
.al-mem-add{ display:flex; flex-direction:column; gap:8px; margin-top:12px; padding:12px; background:#171321;
  border:1px solid #2a2440; border-radius:11px; }
.al-mem-add.slide{ animation:memSlide .2s ease both; transform-origin:top; }
@keyframes memSlide{ from{ opacity:0; transform:translateY(-6px) scaleY(.96); } to{ opacity:1; transform:translateY(0) scaleY(1); } }
.al-mem-add.compact{ margin-top:12px; }
.al-mem-add-title{ font-size:12px; color:#c8b3ff; font-weight:800; margin-bottom:2px; }
.al-mem-add textarea{ min-height:70px; }
.al-mem-add button.al-mem-add-btn{ min-height:38px; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff);
  border-color:#9d6bff; font-size:12.5px; }
.al-mem-add button:disabled{ opacity:.45; cursor:default; }
/* DM 내 상대 기억 */
.al-peermem{ padding:0 14px 6px; }
.al-peermem-toggle{ width:100%; text-align:left; padding:8px 11px; border-radius:9px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:700; color:#9eddb0; background:#121a16; border:1px solid #1f3a2c; }
.al-peermem-toggle:hover{ border-color:#2f6a4c; }
.al-peermem-list{ margin-top:6px; padding:9px 11px; background:#101810; border:1px solid #1f3a2c; border-radius:9px; }
.al-peermem-item{ font-size:12px; color:#c4c0cf; line-height:1.6; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.05); }
.al-peermem-item:last-child{ border-bottom:none; }
.al-peermem-item.muted{ color:#8f889c; }
.al-peermem-item p{ margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
.al-peermem-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px; }
.al-peermem-top span{ color:#9eddb0; font-size:10.5px; font-weight:900; }
.al-peermem-top div{ display:flex; gap:5px; flex-shrink:0; }
.al-peermem-top button{ border:1px solid #2f6a4c; border-radius:7px; padding:4px 7px; cursor:pointer;
  background:#121a16; color:#9eddb0; font-family:inherit; font-size:10.5px; font-weight:900; }
.al-peermem-top button.danger{ color:#ff9aaa; background:#241419; border-color:#502330; }
.al-peermem-edit textarea{ width:100%; min-height:70px; background:#111710; border:1px solid #2f6a4c; border-radius:9px;
  padding:8px 9px; color:var(--ink); font-family:inherit; font-size:12px; line-height:1.55; resize:vertical; }
.al-peermem-edit textarea:focus{ outline:none; border-color:#9eddb0; }
.al-mem-note{ font-size:11px; color:var(--soft); margin:8px 0 0; }

/* DM 대화 목록 */
.al-convlist{ min-height:180px; }
.al-conv-empty{ text-align:center; padding:50px 24px; color:var(--soft); }
.al-conv-empty p{ font-size:14px; margin:0 0 6px; }
.al-conv-empty span{ font-size:12.5px; color:#6a6a74; }
.al-convitem{ width:100%; display:flex; align-items:center; gap:8px; padding:10px 12px 10px 16px;
  background:none; border-bottom:1px solid var(--line); transition:.15s; color:var(--ink); }
.al-convitem:hover{ background:#161420; }
.al-convmain{ min-width:0; flex:1; display:flex; align-items:center; gap:12px; padding:4px 0; cursor:pointer;
  font-family:inherit; background:none; border:none; text-align:left; color:var(--ink); }
.al-convitem-av{ width:44px; height:44px; flex-shrink:0; border-radius:50%; font-size:18px; font-weight:800;
  color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; }
.al-convitem-info{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.al-convitem-name{ font-size:15px; font-weight:700; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-convitem-last{ font-size:12.5px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-convitem-count{ font-size:11px; color:var(--soft); background:#1f1a2e; padding:2px 8px; border-radius:10px; flex-shrink:0; }
.al-conv-actions{ display:flex; flex-direction:column; gap:5px; flex-shrink:0; }
.al-conv-actions button{ min-width:42px; border:1px solid #3a3550; border-radius:8px; padding:5px 7px; cursor:pointer;
  background:#1c1730; color:#c8b3ff; font-family:inherit; font-size:10.5px; font-weight:900; }
.al-conv-actions button.danger{ color:#ff9aaa; background:#241419; border-color:#502330; }

.al-newchat{ padding:14px 16px; border-top:1px solid var(--line); }
.al-newchat-btn{ width:100%; padding:13px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:14px; font-weight:700; color:var(--accent); background:#16121f; border:1px dashed #3a3550; text-align:center; }
.al-newchat-btn:hover{ border-color:var(--accent); background:#1c1730; }
.al-newchat-lbl{ font-size:12px; color:var(--soft); margin:0 0 10px; }
.al-newchat-targets{ display:flex; flex-direction:column; gap:8px; }
.al-newchat-target{ display:flex; align-items:center; gap:10px; padding:11px 13px; cursor:pointer;
  font-family:inherit; color:var(--ink); background:#161420; border:1px solid var(--line); border-radius:11px; transition:.15s; }
.al-newchat-target:hover{ border-color:var(--accent); background:#1c1730; }
.al-nt-av{ width:32px; height:32px; flex-shrink:0; border-radius:50%; font-size:14px; font-weight:800;
  color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; }
.al-nt-name{ font-size:14px; font-weight:700; flex:1; text-align:left; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-nt-rel{ font-size:11px; color:var(--accent2); flex-shrink:0; }
.al-nt-none{ font-size:12.5px; color:var(--soft); line-height:1.5; }
.al-newchat-cancel{ width:100%; margin-top:9px; padding:9px; background:none; border:none;
  color:var(--soft); font-family:inherit; font-size:12.5px; cursor:pointer; }

/* 직접 지시 */
.al-directive{ display:flex; align-items:center; gap:9px; padding:10px 16px; border-bottom:1px solid var(--line); background:#100e18; }
.al-directive-lbl{ font-size:11.5px; color:var(--accent); font-weight:700; flex-shrink:0; }
.al-directive-input{ flex:1; background:#1a1a20; border:1px solid var(--line); border-radius:9px;
  padding:8px 11px; font-family:inherit; font-size:12.5px; color:var(--ink); }
.al-directive-input:focus{ outline:none; border-color:var(--accent); }
.al-directive-on{ font-size:10px; font-weight:800; color:#7bbf6a; background:#13201a;
  border:1px solid #294a30; padding:2px 7px; border-radius:8px; flex-shrink:0; }

/* 자동 대화 */
.al-autochat{ padding:10px 14px 0; }
.al-autochat-go{ width:100%; padding:11px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:700; color:#c8b3ff; background:#1c1730; border:1px solid #3a3550; }
.al-autochat-go:hover:not(:disabled){ border-color:var(--accent); }
.al-autochat-go:disabled{ opacity:.5; cursor:not-allowed; }
.al-autochat-stop{ width:100%; padding:11px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:700; color:#ff8b8b; background:#251416; border:1px solid #43203a;
  display:flex; align-items:center; justify-content:center; gap:8px; }
.al-autochat-live{ font-size:10px; color:var(--accent2); animation:pulse 1.5s infinite; }
/* 오너 끼어들기 */
.al-intervene{ margin-top:8px; }
/* 화자 선택 칩 */
.al-speaker-wrap{ padding:0 14px; }
.al-nc-speakers{ display:flex; flex-wrap:wrap; gap:6px; margin:4px 0 12px; }
.al-persona-entry{ width:100%; padding:13px; margin-top:9px; border-radius:12px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:700; color:#ffd27a; background:#1f1a10;
  border:1px solid #4a3c1c; text-align:center; }
.al-persona-entry:hover{ border-color:#ffd27a; }
.al-pe-hint{ font-size:11px; color:var(--soft); font-weight:400; }
.al-newchat-target.mine{ border-color:#5a4570; background:#1c1730; }
.al-nt-mine-tag{ margin-left:auto; font-size:11px; color:#c8b3ff; background:#2a2440; padding:2px 8px; border-radius:8px; }.al-speaker-sel{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:8px; }.al-spk-chip{ padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit; font-size:12px;
  font-weight:700; border:1px solid #3a3550; background:#16161c; color:#9aa0b0; }
.al-spk-chip:hover{ border-color:var(--accent); }
.al-spk-chip.on{ background:#2a2440; color:#fff; border-color:#5a4570; }
.al-spk-chip.persona.on{ background:#3a2a18; color:#ffd27a; border-color:#5a4520; }
.al-spk-chip.add{ border-style:dashed; color:#9eddb0; }
.al-persona-active{ margin-top:7px; font-size:11.5px; color:#ffd27a; }
/* 페르소나 편집 모달 */
.al-pd-input{ width:100%; margin-top:9px; background:#1a1a20; border:1px solid var(--line); border-radius:10px;
  padding:11px 13px; color:var(--ink); font-family:inherit; font-size:13px; box-sizing:border-box; }
.al-pd-input:focus{ outline:none; border-color:var(--accent); }
.al-pd-input.area{ min-height:64px; resize:vertical; }
.al-pd-btns{ display:flex; gap:8px; margin-top:16px; }
.al-pd-save,.al-pd-cancel,.al-pd-del{ flex:1; padding:12px; border-radius:11px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:800; border:none; }
.al-pd-save{ background:linear-gradient(135deg,var(--accent),#9d6bff); color:#fff; }
.al-pd-save:disabled{ opacity:.4; cursor:not-allowed; }
.al-pd-cancel{ background:#26222e; color:#b8b4c4; }
.al-pd-del{ background:#2a1418; color:#ff8b8b; flex:0 0 auto; padding:12px 16px; }
/* 홈 페르소나 관리 */
.al-persona-mgr{ margin-top:24px; padding-top:20px; border-top:1px solid var(--line); }
.al-pm-head{ font-size:15px; font-weight:800; color:#ffd27a; }
.al-pm-head span{ color:var(--soft); font-weight:600; }
.al-pm-desc{ font-size:12px; color:var(--soft); margin:5px 0 12px; line-height:1.5; }
.al-pm-list{ display:flex; flex-direction:column; gap:8px; }
.al-pm-row{ display:flex; align-items:stretch; gap:8px; }
.al-pm-card{ display:flex; gap:11px; align-items:center; background:#16141c; border:1px solid var(--line);
  border-radius:12px; padding:11px; cursor:pointer; text-align:left; flex:1; min-width:0; }
.al-pm-card:hover{ border-color:#5a4520; }
.al-pm-av{ width:38px; height:38px; flex-shrink:0; border-radius:50%; font-size:16px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#ffd27a,#e8a040); }
.al-pm-info{ display:flex; flex-direction:column; min-width:0; }
.al-pm-name{ font-size:14px; font-weight:800; color:var(--ink); }
.al-pm-sub{ font-size:11.5px; color:var(--soft); }
.al-pm-add{ padding:11px; border-radius:12px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;
  border:1px dashed #5a4520; background:#1a1610; color:#ffd27a; }
.al-pm-actions{ display:flex; flex-direction:column; gap:6px; flex-shrink:0; }
.al-pm-edit-mini{ flex:1; padding:0 12px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:900; color:#ffd27a; background:#241d10; border:1px solid #5a4520; }
.al-pm-del-mini{ flex:0 0 auto; padding:0 12px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:900; color:#ff9aa9; background:#25151b; border:1px solid #5c2736; }
.al-pm-del-mini:hover{ border-color:#ff7c95; color:#ffd5dc; }
.al-intervene-btn{ width:100%; padding:9px; border-radius:10px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:700; color:#9aa0b0; background:#16161c; border:1px dashed #3a3a48; }
.al-intervene-btn:hover{ color:#c8b3ff; border-color:var(--accent); }
.al-intervene-btn.on{ color:#ffd27a; background:#241d10; border-style:solid; border-color:#5a4520; }
.al-bubble-spk{ display:block; font-size:10px; font-weight:800; opacity:.7; margin-bottom:3px; }
/* 오너→내캐릭터 직접 대화 입구 */
.al-owner-entry{ width:100%; padding:12px; margin-bottom:10px; border-radius:12px; cursor:pointer;
  font-family:inherit; font-size:13px; color:#ffd27a; background:#1f1a10; border:1px solid #4a3c1c; text-align:center; }
.al-owner-entry:hover{ border-color:#ffd27a; }
.al-owner-entry b{ color:#fff; }
/* 호감도 게이지 */
.al-affinity{ margin:10px 14px 8px; padding:12px 13px; border:1px solid #4a3650; border-radius:14px;
  background:linear-gradient(135deg,#2b1c31,#181923); box-shadow:0 10px 28px -22px #000, inset 0 0 0 1px rgba(255,255,255,.03); }
.al-aff-toggle{ width:100%; display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:8px;
  border:none; background:transparent; color:var(--ink); padding:0; cursor:pointer; font-family:inherit; text-align:left; }
.al-aff-toggle span{ font-size:13px; font-weight:950; color:#ffd7ec; }
.al-aff-toggle b{ font-size:11.5px; color:#fff; background:#4a2c42; border:1px solid #6a3c5a; border-radius:999px; padding:3px 8px; }
.al-aff-toggle i{ font-style:normal; font-size:11px; color:#b7a8c4; }
.al-aff-content{ margin-top:11px; }
.al-aff-top{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; }
.al-aff-row{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; }
.al-aff-row.second{ margin-top:9px; }
.al-aff-lbl.rev{ color:#9ec4ff; }
.al-aff-fill.rev{ background:linear-gradient(90deg,#9ec4ff,#6ea8ff); }
.al-aff-fill.neg{ background:linear-gradient(90deg,#6a5560,#c0506a) !important; }
.al-aff-note{ font-size:10px; color:var(--soft); font-weight:400; }
.al-aff-lbl{ font-size:12px; font-weight:900; color:#ffacd2; }
.al-aff-stage{ font-size:11.5px; color:#fff; background:#4a2c42; border:1px solid #6a3c5a; border-radius:999px; padding:2px 8px; font-weight:900; }
.al-aff-bar{ position:relative; height:10px; background:#2b2430; border:1px solid #3f3448; border-radius:999px; overflow:hidden; }
.al-aff-fill{ height:100%; border-radius:6px; background:linear-gradient(90deg,#ff7eb3,#ff5a8c); transition:width .5s ease; }
.al-aff-mark{ position:absolute; top:-2px; width:2px; height:11px; background:#ffd27a; opacity:.8; transform:translateX(-1px); }
.al-affinity.owner .al-aff-lbl{ color:#a8c8ff; }
.al-affinity.owner .al-aff-fill{ background:linear-gradient(90deg,#9ec4ff,#6ea8ff); }
/* 진도질문 모달 */
.al-proposal{ text-align:center; max-width:340px; }
.al-prop-heart{ font-size:34px; color:#ff5a8c; animation:pulse 1.4s infinite; }
.al-prop-who{ font-size:14px; font-weight:800; color:#ff9ec4; margin-top:2px; }
.al-prop-line{ font-size:16px; line-height:1.55; color:#fff; margin:12px 4px; font-weight:500; }
.al-prop-sub{ font-size:12px; color:var(--soft); margin-bottom:16px; }
.al-prop-btns{ display:flex; gap:10px; }
.al-prop-yes,.al-prop-no{ flex:1; padding:13px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:14px; font-weight:800; border:none; }
.al-prop-yes{ background:linear-gradient(135deg,#ff7eb3,#ff5a8c); color:#fff; }
.al-prop-no{ background:#26222e; color:#b8b4c4; border:1px solid #3a3550; }
.al-prop-yes:hover{ filter:brightness(1.08); }
.al-prop-heart.broken{ filter:grayscale(0.3); opacity:0.85; }
.al-prop-no:hover{ border-color:var(--soft); }

/* 캐해 교정 */
.al-fixbtn{ background:none; border:none; color:#8a8a96; font-family:inherit; font-size:12px; cursor:pointer; padding:0; }
.al-fixbtn:hover{ color:#ffb454; }
.al-fixbtn-dm{ display:block; margin-top:8px; background:none; border:none; color:#6a6a74;
  font-family:inherit; font-size:11px; cursor:pointer; padding:0; }
.al-fixbtn-dm:hover{ color:#ffb454; }
.al-modal-bg{ position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center; padding:20px; z-index:50; }
.al-modal{ width:100%; max-width:400px; background:var(--phone); border:1px solid var(--line);
  border-radius:18px; padding:22px; box-shadow:0 30px 70px -20px #000; }
.al-modal-title{ font-size:18px; font-weight:800; margin:0 0 6px; }
.al-modal-sub{ font-size:13px; color:var(--soft); margin:0 0 14px; line-height:1.5; }
.al-modal-quote{ font-size:13px; color:#bcbcc6; background:#1a1a20; border-left:2px solid #ffb454;
  border-radius:0 8px 8px 0; padding:10px 12px; margin-bottom:14px; font-style:italic; }
.al-fixchips{ display:flex; flex-wrap:wrap; gap:7px; margin-bottom:11px; }
.al-fixchip{ font-size:12px; padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit;
  background:#241d14; border:1px solid #4a3a22; color:#ffb454; }
.al-fixchip:hover{ border-color:#ffb454; }
.al-fixinput{ width:100%; min-height:70px; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:11px; font-family:inherit; font-size:13.5px; line-height:1.6; color:var(--ink); resize:none; }
.al-fixinput:focus{ outline:none; border-color:var(--accent); }
.al-modal-actions{ display:flex; gap:7px; justify-content:flex-end; margin-top:13px; flex-wrap:wrap; }
.al-modal-cancel{ padding:9px 14px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px;
  background:none; border:1px solid var(--line); color:var(--soft); }
.al-modal-saveonly{ padding:9px 14px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600;
  background:#1f1a2e; border:1px solid var(--accent); color:#c8b3ff; }
.al-modal-saveonly:disabled,.al-modal-save:disabled{ opacity:.4; cursor:not-allowed; }
.al-modal-save{ padding:9px 16px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;
  background:#ffb454; color:#fff; border:none; }
.al-modal-danger{ padding:9px 16px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:800;
  background:#ff5d73; color:#fff; border:none; }
.al-fixcount{ font-size:11.5px; color:var(--soft); margin:12px 0 0; text-align:center; }

/* home — account list */
.al-home{ padding:30px 22px 26px; }
.al-accountbar{ display:flex; align-items:center; gap:8px; margin:-12px 0 18px; padding:9px 11px;
  border:1px solid #2a2440; border-radius:10px; background:#14101e; color:var(--soft); font-size:11.5px; }
.al-accountbar span{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#c8b3ff; font-weight:800; }
.al-accountbar b{ font-weight:700; color:#8d849e; }
.al-accountbar button{ border:none; background:#1f1a2e; color:#c8b3ff; border-radius:8px; padding:5px 8px;
  font-family:inherit; font-size:11px; cursor:pointer; }
.al-auth{ min-height:620px; padding:76px 24px 28px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.al-auth h1{ margin:12px 0 8px; font-size:25px; font-weight:900; }
.al-auth p{ margin:0 0 18px; color:var(--soft); font-size:13.5px; line-height:1.6; }
.al-auth-tabs{ width:100%; display:flex; gap:7px; margin-bottom:10px; padding:4px; border:1px solid #2a2440; border-radius:12px; background:#120f1c; }
.al-auth-tabs button{ flex:1; padding:9px; border:none; border-radius:9px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:800; color:var(--soft); background:transparent; }
.al-auth-tabs button.on{ color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-social-login{ width:100%; display:flex; flex-direction:column; gap:8px; margin:12px 0 6px; }
.al-social-login button{ width:100%; min-height:44px; border-radius:12px; border:1px solid #4a4654; cursor:pointer;
  background:#fee500; color:#191600; font-family:inherit; font-size:14px; font-weight:900; }
.al-social-login button:nth-child(2){ background:#f7f5fb; border-color:#e8e3f1; color:#17151d; }
.al-social-login button:nth-child(3){ background:#111; border-color:#333; color:#fff; }
.al-social-login button:disabled{ opacity:.45; cursor:default; }
.al-auth-divider{ width:100%; display:flex; align-items:center; gap:10px; margin:10px 0 2px; color:var(--soft); font-size:11.5px; }
.al-auth-divider:before,.al-auth-divider:after{ content:""; flex:1; height:1px; background:#363241; }
.al-auth-input{ width:100%; background:#1a1a20; border:1px solid var(--line); border-radius:12px;
  padding:13px 14px; color:var(--ink); font-family:inherit; font-size:14px; margin-top:8px; }
.al-auth-input:focus{ outline:none; border-color:var(--accent); }
.al-auth-btn{ width:100%; margin-top:10px; padding:13px; border:none; border-radius:12px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:800; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-auth-btn:disabled{ background:#2a2a32; color:#5a5a64; cursor:default; }
.al-auth-linkbtn{ width:100%; margin-top:9px; padding:11px; border-radius:12px; cursor:pointer; font-family:inherit;
  font-size:13px; font-weight:800; color:#d8cbff; background:#171222; border:1px solid #3a3550; }
.al-auth-alt{ width:100%; display:flex; gap:8px; margin-top:10px; }
.al-auth-alt button{ flex:1; min-height:34px; border:1px solid #3a3550; border-radius:11px; cursor:pointer;
  font-family:inherit; font-size:11.5px; font-weight:800; color:#d8cbff; background:#171222; }
.al-auth-alt button:hover:not(:disabled){ border-color:var(--accent); background:#211a34; color:#fff; }
.al-auth-alt button:disabled{ opacity:.45; cursor:default; }
.al-auth-msg{ margin-top:13px !important; color:#c8b3ff !important; }
.al-home-head{ text-align:center; margin-bottom:20px; }
.al-home-head h1{ font-size:24px; font-weight:800; margin:8px 0 6px; }
.al-home-head p{ font-size:13.5px; color:var(--soft); margin:0; }
.al-build{ margin-top:18px; text-align:center; font-size:10px; color:#5f566f; }
.al-acclist{ display:flex; flex-direction:column; gap:10px; }
.al-acccard{ display:flex; align-items:center; gap:8px; padding:8px; font-family:inherit;
  background:#161420; border:1px solid var(--line); border-radius:14px; text-align:left; transition:.16s; }
.al-acccard:hover{ border-color:var(--accent); background:#1c1730; }
.al-acccard-main{ flex:1; min-width:0; display:flex; align-items:center; gap:13px; padding:6px; cursor:pointer;
  font-family:inherit; background:none; border:none; color:var(--ink); text-align:left; }
.al-acccard-av{ width:48px; height:48px; flex-shrink:0; border-radius:50%; font-size:21px; font-weight:800;
  color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; }
.al-acccard-info{ flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.al-acccard-name{ font-size:16px; font-weight:800; }
.al-acccard-handle{ font-size:12.5px; color:var(--soft); }
.al-acccard-rel{ font-size:11.5px; color:var(--accent2); margin-top:2px; }
.al-acccard-count{ font-size:11.5px; color:var(--soft); flex-shrink:0; }
.al-acc-actions{ display:flex; flex-direction:column; gap:6px; flex-shrink:0; align-self:stretch; }
.al-accedit{ flex:1; min-width:52px; border:1px solid #4d3d72; border-radius:10px; cursor:pointer;
  background:#201932; color:#c8b3ff; font-family:inherit; font-size:12px; font-weight:900; }
.al-accedit:hover{ background:#2a2140; color:#fff; border-color:var(--accent); }
.al-accdel{ flex-shrink:0; align-self:stretch; min-width:52px; border:1px solid #5a2632; border-radius:10px; cursor:pointer;
  background:#251018; color:#ff9aaa; font-family:inherit; font-size:12px; font-weight:800; }
.al-acc-actions .al-accdel{ flex:1; align-self:auto; }
.al-accdel:hover{ background:#3a1522; color:#fff; border-color:#ff5d73; }
.al-accadd{ padding:15px; cursor:pointer; font-family:inherit; font-size:14px; font-weight:700;
  color:var(--accent); background:#16121f; border:1px dashed #3a3550; border-radius:14px; transition:.16s; }
.al-accadd:hover{ border-color:var(--accent); background:#1c1730; }
.al-dump-back{ background:none; border:none; color:var(--soft); font-family:inherit; font-size:13.5px;
  cursor:pointer; padding:14px 16px 0; }
.al-dump-back:hover{ color:var(--ink); }

/* compose row + write */
.al-compose-row{ display:flex; gap:8px; }
.al-compose-row .al-wake{ flex:1; }
.al-writeself{ flex-shrink:0; padding:14px 16px; border-radius:13px; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:700; background:#1a1a20; border:1px solid var(--line); color:#c8b3ff; }
.al-writeself:hover{ border-color:var(--accent); }
.al-writebox{ margin-top:10px; }
.al-write-lbl{ font-size:11.5px; color:var(--soft); margin:0 0 7px; }
.al-writebox textarea{ width:100%; min-height:80px; background:#1a1a20; border:1px solid var(--line);
  border-radius:11px; padding:12px; font-family:inherit; font-size:14px; line-height:1.6; color:var(--ink); resize:none; }
.al-writebox textarea:focus{ outline:none; border-color:var(--accent); }
.al-write-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
.al-write-cancel{ padding:8px 16px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px;
  background:none; border:1px solid var(--line); color:var(--soft); }
.al-write-post{ padding:8px 18px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;
  background:var(--accent); color:#fff; border:none; }
.al-write-post:disabled{ background:#2a2a32; color:#5a5a64; cursor:not-allowed; }

.al-user-badge{ font-style:normal; font-size:9.5px; font-weight:800; color:#7bbf6a;
  background:#13201a; border:1px solid #294a30; padding:1px 6px; border-radius:8px; margin-right:6px; }
.al-occhip{ font-size:12px; padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit;
  background:#1a2820; border:1px solid #2a4a35; color:#9eddb0; }
.al-occhip:hover{ border-color:#7bbf6a; color:#fff; }

/* profile DM button */
.al-profile-top{ display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:start; gap:10px; min-width:0; }
.al-dmbtn{ flex:0 0 auto; min-width:0; min-height:36px; padding:8px 13px; border-radius:20px; cursor:pointer; font-family:inherit;
  display:inline-flex; align-items:center; justify-content:center; gap:5px; font-size:12.5px; font-weight:800; background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff; border:none; transition:.16s; white-space:nowrap; line-height:1.1; }
.al-dmbtn span{ line-height:1; }
.al-dmbtn b{ font:inherit; }
.al-dmbtn:hover{ filter:brightness(1.1); }
.al-feed-actions{ display:flex; justify-content:flex-end; gap:7px; min-width:0; max-width:100%; }
.al-dmbtn.ghost{ background:#1c1730; color:#c8b3ff; border:1px solid #3a3550; }
.al-dmbtn.ghost:hover{ border-color:var(--accent); filter:none; }
/* 탐색 */
.al-disc-search{ padding:10px 14px; }
.al-disc-search input{ width:100%; background:#1a1a20; border:1px solid var(--line); border-radius:11px;
  padding:11px 14px; color:var(--ink); font-family:inherit; font-size:13px; }
.al-disc-search input:focus{ outline:none; border-color:var(--accent); }
.al-disc-status{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin:0 14px 10px; padding:8px 10px;
  border:1px solid #2e2940; border-radius:10px; color:#8f879b; font-size:11.5px; background:#15131c; }
.al-disc-status span{ flex:1 1 180px; min-width:0; line-height:1.45; }
.al-disc-status button{ border:1px solid #3a3550; border-radius:9px; background:#1c1730; color:#c8b3ff; cursor:pointer;
  font-family:inherit; font-size:11.5px; font-weight:800; padding:5px 9px; white-space:nowrap; }
.al-disc-status button:disabled{ opacity:.5; cursor:not-allowed; }
.al-disc-error{ margin:0 14px 10px; color:#ff9caf; font-size:12px; line-height:1.45; }
.al-disc-focus{ margin:0 14px 10px; padding:10px 12px; border-radius:12px; border:1px solid #5f4c82;
  background:#241d35; color:#e8ddff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.al-disc-focus button{ border:none; border-radius:9px; padding:7px 9px; cursor:pointer; font-family:inherit; font-size:11px; font-weight:900;
  color:#1b1526; background:#d8cbff; }
.al-following-panel{ margin:0 14px 12px; padding:12px; border:1px solid #3d344d; border-radius:14px;
  background:#171420; }
.al-following-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;
  font-size:13px; font-weight:900; color:#d9ccff; }
.al-following-head b{ color:#fff; background:#2a2440; border:1px solid #51436b; border-radius:999px; padding:2px 8px; }
.al-following-list{ display:flex; flex-direction:column; gap:8px; max-height:190px; overflow:auto; }
.al-following-card{ display:flex; align-items:center; gap:8px; padding:8px; border:1px solid #302b3a; border-radius:12px;
  background:#111018; }
.al-following-main{ flex:1; min-width:0; display:flex; align-items:center; gap:9px; background:none; border:none;
  color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; }
.al-following-av{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:900; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-following-info{ min-width:0; display:flex; flex-direction:column; gap:1px; }
.al-following-info b{ font-size:13px; }
.al-following-info small{ font-size:11px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-unfollow{ flex-shrink:0; padding:7px 9px; border-radius:9px; cursor:pointer; font-family:inherit; font-size:11.5px;
  font-weight:900; color:#ffb0bd; background:#25151b; border:1px solid #5c2736; }
.al-disc-list{ flex:1; overflow-y:auto; padding:0 14px 14px; display:flex; flex-direction:column; gap:10px; }
.al-disc-none{ text-align:center; color:var(--soft); font-size:13px; padding:30px 0; }
.al-disc-none p{ margin:0 0 10px; }
.al-disc-none button{ border:1px solid #3a3550; border-radius:10px; background:#1c1730; color:#c8b3ff; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:900; padding:8px 11px; }
.al-disc-none button:hover{ border-color:var(--accent); color:#fff; }
.al-disc-card{ display:grid; grid-template-columns:42px minmax(0,1fr); gap:9px 11px; align-items:flex-start;
  background:#16141c; border:1px solid var(--line); border-radius:14px; padding:13px; }
.al-disc-card.on{ border-color:#5a4570; background:#1a1626; }
.al-disc-av{ width:42px; height:42px; flex-shrink:0; border-radius:50%; font-size:18px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff;
  background:linear-gradient(135deg,var(--accent),#9d6bff); border:none; cursor:pointer; font-family:inherit; }
.al-disc-body{ flex:1; min-width:0; }
.al-disc-top{ display:flex; align-items:center; gap:5px 7px; flex-wrap:wrap; min-width:0; }
.al-disc-name{ min-width:0; max-width:100%; font-size:14px; font-weight:800; color:var(--ink); background:none; border:none; padding:0; cursor:pointer; font-family:inherit;
  overflow-wrap:anywhere; line-height:1.25; text-align:left; }
.al-disc-name:hover{ color:#d9ccff; text-decoration:underline; text-underline-offset:3px; }
.al-disc-owner{ font-size:11px; color:var(--soft); overflow-wrap:anywhere; }
.al-disc-persona{ font-size:12px; color:#c4c0cf; margin:4px 0 6px; line-height:1.45; overflow-wrap:anywhere; word-break:keep-all; }
.al-disc-tags{ display:flex; flex-wrap:wrap; gap:5px; }
.al-disc-tag{ max-width:100%; font-size:10.5px; color:#9eddb0; background:#15201a; border-radius:5px; padding:2px 6px;
  overflow-wrap:anywhere; }
.al-disc-actions{ grid-column:2; justify-self:start; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.al-disc-follow,.al-disc-dm{ min-height:32px; padding:8px 12px; border-radius:9px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:700; border:1px solid #3a3550; background:#1c1730; color:#c8b3ff; white-space:nowrap; }
.al-disc-follow:hover,.al-disc-dm:hover{ border-color:var(--accent); }
.al-disc-follow.on{ background:#2a2440; color:#fff; border-color:#5a4570; }
.al-disc-dm{ color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); border:none; }
.al-disc-foot{ padding:10px 14px; font-size:11.5px; color:var(--soft); text-align:center; border-top:1px solid var(--line); }
.al-public-profile{ position:relative; width:min(390px,calc(100vw - 34px)); overflow:hidden; border-radius:18px;
  border:1px solid #343040; background:#17161e; color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.48); }
.al-public-back{ position:absolute; z-index:2; top:12px; left:12px; width:34px; height:34px; border-radius:50%;
  border:none; cursor:pointer; color:#fff; background:#111018; font-size:24px; line-height:1; }
.al-public-banner{ height:96px; overflow:hidden; background:linear-gradient(120deg,#2b2142,#4a1f3a 55%,#263044); }
.al-public-banner img{ width:100%; height:100%; display:block; object-fit:cover; }
.al-public-avatar{ width:70px; height:70px; margin:-35px 0 0 18px; border:4px solid #17161e; border-radius:50%;
  overflow:hidden;
  display:flex; align-items:center; justify-content:center; color:#fff; font-size:30px; font-weight:950;
  background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-public-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.al-public-body{ padding:12px 16px 17px; }
.al-public-main h3{ margin:0; font-size:23px; line-height:1.1; }
.al-public-main span{ color:var(--soft); font-size:13px; }
.al-public-age{ display:inline-flex; margin:10px 0 6px; padding:4px 9px; border-radius:999px;
  color:#cdbbff; background:#211b34; border:1px solid #493b68; font-size:12px; font-weight:800; }
.al-public-tag{ display:inline-flex; max-width:100%; margin:5px 0 10px; padding:7px 10px; border-radius:999px;
  color:#cdbbff; background:#211b34; border:1px solid #493b68; font-size:12px; font-weight:800;
  line-height:1.35; overflow-wrap:anywhere; word-break:keep-all; }
.al-public-line{ margin:5px 0; color:#d8d3e2; font-size:13px; line-height:1.5; }
.al-public-desc{ margin:8px 0 12px; color:#e8e4ee; font-size:13px; line-height:1.6; }
.al-public-stats{ display:flex; gap:12px; color:var(--soft); font-size:12px; margin-bottom:13px; }
.al-public-stats b{ color:#fff; }
.al-public-actions{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.al-public-follow,.al-public-dm{ width:100%; min-height:42px; border:none; border-radius:14px; cursor:pointer; font-family:inherit;
  font-size:14px; font-weight:950; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-public-follow.on{ background:#26212e; color:#ffb0bd; border:1px solid #5c2736; }
.al-public-dm{ background:#1c1730; color:#c8b3ff; border:1px solid #3a3550; }
.al-follow-modal{ width:min(390px,calc(100vw - 34px)); max-height:min(620px,82vh); overflow:hidden; border-radius:18px;
  border:1px solid #343040; background:#17161e; color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.48); display:flex; flex-direction:column; }
.al-follow-modal-head{ display:flex; align-items:center; justify-content:space-between; padding:15px 16px; border-bottom:1px solid var(--line); }
.al-follow-modal-head h3{ margin:0; font-size:18px; }
.al-follow-modal-head button{ border:none; border-radius:10px; padding:7px 10px; cursor:pointer; font-family:inherit;
  color:#bdb5ca; background:#26212e; font-size:12px; font-weight:900; }
.al-follow-empty{ margin:0; padding:28px 16px; color:var(--soft); font-size:13px; text-align:center; }
.al-follow-modal-list{ overflow:auto; padding:10px; display:flex; flex-direction:column; gap:8px; }
.al-follow-modal-row{ border:1px solid #302b3a; border-radius:13px; background:#111018; overflow:hidden; }
.al-follow-modal-row:hover{ border-color:var(--accent); background:#1c1730; }
.al-follow-modal-item{ display:flex; align-items:center; gap:8px; width:100%; padding:10px; color:var(--ink); }
.al-follow-modal-main{ flex:1; min-width:0; display:flex; align-items:center; gap:10px; border:none; background:none; color:inherit;
  cursor:pointer; font-family:inherit; text-align:left; padding:0; }
.al-follow-modal-av{ width:38px; height:38px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:950; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-follow-modal-info{ min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }
.al-follow-modal-info b{ font-size:14px; }
.al-follow-modal-info small{ font-size:11.5px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.al-follow-modal-item i{ font-style:normal; flex-shrink:0; font-size:11px; color:#c8b3ff; background:#241d35; border:1px solid #4a3c68; border-radius:999px; padding:3px 8px; }
.al-mem-meta{ display:flex; gap:6px; align-items:center; margin-bottom:7px; }
.al-mem-meta button,.al-mem-meta select,.al-mem-meta span{ border:1px solid #3a3446; border-radius:999px; padding:4px 8px;
  background:#15131c; color:#bdb5ca; font-family:inherit; font-size:11px; font-weight:800; }
.al-mem-meta button{ cursor:pointer; }
.al-mem-meta button.on{ color:#ffd27a; border-color:#6a5220; background:#2a2112; }
.al-mem-meta select{ cursor:pointer; }
.al-world-modal{ width:min(390px,calc(100vw - 34px)); border-radius:18px; border:1px solid #3a3446;
  background:#17161e; color:var(--ink); padding:18px; box-shadow:0 30px 80px rgba(0,0,0,.48); }
.al-world-modal h3{ margin:0 0 7px; font-size:19px; }
.al-world-modal p{ margin:0 0 14px; color:var(--soft); font-size:13px; line-height:1.55; }
.al-world-options{ display:flex; flex-direction:column; gap:9px; }
.al-world-options button{ width:100%; padding:13px; border-radius:14px; border:1px solid #342e40; background:#111018;
  color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; display:flex; flex-direction:column; gap:3px; }
.al-world-options button:hover{ border-color:var(--accent); background:#1c1730; }
.al-world-options button.on{ border-color:var(--accent); background:#241d35; }
.al-world-options.compact{ margin-bottom:10px; }
.al-world-options b{ font-size:14px; }
.al-world-options span{ font-size:12px; color:var(--soft); }
.al-world-note{ width:100%; min-height:112px; resize:vertical; border:1px solid #3a3446; border-radius:13px;
  background:#111018; color:var(--ink); padding:12px; font-family:inherit; font-size:13px; line-height:1.5; }
.al-world-note:focus{ outline:none; border-color:var(--accent); }
.al-world-actions{ display:flex; gap:8px; margin-top:12px; }
.al-world-actions button{ flex:1; padding:12px; border-radius:12px; border:1px solid #3a3446; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:900; color:#c8c1d4; background:#26212e; }
.al-world-actions button.primary{ border:none; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-newchat-target.ext{ border-style:dashed; }
.al-nt-ext{ font-size:10px; color:#9eddb0; margin-left:auto; }
/* 팔로우 통계 */
.al-follow-stats{ display:flex; gap:8px; align-items:center; margin-top:9px; flex-wrap:wrap; min-width:0; }
.al-fstat{ background:none; border:none; padding:2px 0; font-family:inherit; font-size:12.5px; color:var(--soft); cursor:default;
  min-width:0; max-width:100%; overflow-wrap:anywhere; }
button.al-fstat{ cursor:pointer; }
.al-fstat.on{ color:#d9ccff; text-decoration:underline; text-underline-offset:4px; }
.al-fstat b{ color:var(--ink); font-weight:800; }
.al-fstat-new{ font-size:11px; color:#ff9ec4; background:#241621; border-radius:6px; padding:2px 8px; }
.al-profile-follow-panel{ margin-top:11px; padding:11px; border:1px solid #3a3550; border-radius:13px; background:#15131d; }
.al-profile-follow-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; color:#d9ccff; font-size:13px; font-weight:900; }
.al-profile-follow-head button{ border:none; background:#26212e; color:#bdb5ca; border-radius:8px; padding:5px 8px; cursor:pointer; font-family:inherit; font-size:11px; }
.al-profile-follow-list{ display:flex; flex-direction:column; gap:7px; }
.al-profile-follow-card{ display:flex; align-items:center; gap:7px; }
.al-profile-follow-card > button:first-child{ flex:1; min-width:0; display:flex; align-items:center; gap:8px; padding:8px; border:1px solid #2f2a3a;
  border-radius:10px; background:#111018; color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; }
.al-profile-follow-card span{ width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:900; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
.al-profile-follow-card b{ font-size:13px; }
.al-profile-follow-card small{ margin-left:auto; color:var(--soft); font-size:11px; }
.al-unfollow.small{ padding:8px 9px; font-size:11px; }
.al-disc-fcount{ font-size:10.5px; color:var(--soft); overflow-wrap:anywhere; }
.al-dm-settings-btn{ border:1px solid #3a3550; border-radius:999px; padding:7px 10px;
  background:#1c1730; color:#c8b3ff; cursor:pointer; font-family:inherit; font-size:11.5px; font-weight:900; }
.al-dm-settings-btn:hover{ border-color:var(--accent); color:#fff; }
.al-dm-settings-btn.on{ border-color:#2f6a4c; background:#121a16; color:#9eddb0; }
/* 외부 글 / 댓글 */
.al-post-av.ext{ background:linear-gradient(135deg,#6ea8ff,#9d6bff); }
.al-post-extbadge{ font-size:9.5px; color:#a8c8ff; background:#16203a; border-radius:5px; padding:1px 6px; }
.al-comments{ margin-top:10px; padding-top:9px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:8px; }
.al-comment{ display:flex; gap:8px; align-items:flex-start; }
.al-comment-av{ width:26px; height:26px; flex-shrink:0; border-radius:50%; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-comment-body{ flex:1; min-width:0; font-size:12.5px; line-height:1.5; }
.al-comment-name{ font-weight:800; color:var(--ink); margin-right:6px; }
.al-replyto{ color:#7f778c; font-size:11px; margin-right:6px; }
.al-comment-text{ color:#c4c0cf; }
.al-comment-tools{ display:inline-flex; gap:6px; margin-left:7px; vertical-align:baseline; }
.al-comment-tools button{ background:none; border:none; color:#6f687c; cursor:pointer; padding:0; font-family:inherit; font-size:10.5px; font-weight:800; }
.al-comment-tools button:hover{ color:#c8b3ff; }
.al-comment-tools button:last-child:hover{ color:#ff8fa4; }
.al-comment-editbox{ display:flex; align-items:center; gap:6px; margin-top:5px; flex-wrap:wrap; }
.al-comment-editbox input{ flex:1 1 160px; min-width:0; background:#1a1626; border:1px solid #2a2440; border-radius:8px;
  padding:7px 9px; color:var(--ink); font-family:inherit; font-size:12.5px; }
.al-comment-editbox input:focus{ outline:none; border-color:var(--accent); }
.al-comment-av.mine{ background:linear-gradient(135deg,#c8b3ff,#9d6bff); }
.al-cmt-mine{ font-size:9px; font-weight:700; color:#c8b3ff; background:#2a2440; padding:1px 5px; border-radius:6px; margin-left:5px; font-style:normal; }
.al-cmt-open{ margin-top:9px; padding:7px 12px; border-radius:9px; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:700; border:1px solid var(--line); background:#16131f; color:var(--soft); }
.al-cmt-open:hover{ border-color:var(--accent); color:#c8b3ff; }
.al-cmtbox{ margin-top:10px; padding:10px; border:1px solid #2a2440; border-radius:11px; background:#15131c; }
.al-cmtbox-who{ display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
.al-cmtbox-row{ display:flex; gap:6px; }
.al-cmtbox-input{ flex:1; background:#1a1626; border:1px solid #2a2440; border-radius:9px; padding:9px 11px;
  color:var(--ink); font-family:inherit; font-size:13px; }
.al-cmtbox-input:focus{ outline:none; border-color:var(--accent); }
.al-cmtbox-send{ flex:0 0 auto; width:38px; border:none; border-radius:9px; cursor:pointer;
  background:linear-gradient(135deg,var(--accent),#9d6bff); color:#fff; font-size:15px; font-weight:800; }
.al-cmtbox-cancel{ margin-top:7px; background:none; border:none; color:var(--soft); font-size:11px; cursor:pointer; font-family:inherit; }

/* DM screen */
.al-dmhead{ display:flex; align-items:center; gap:11px; padding:14px 16px; border-bottom:1px solid var(--line); }
.al-back-inline{ background:none; border:none; color:var(--ink); font-size:26px; cursor:pointer; line-height:1; padding:0; }
.al-dmhead-av{ width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2));
  display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:#fff; }
.al-dmhead-info{ display:flex; flex-direction:column; min-width:0; flex:1; }
.al-dmhead-name{ font-size:15px; font-weight:800; color:var(--ink); }
.al-dmhead-sub{ font-size:11.5px; color:var(--soft); }
.al-dm-head-actions{ display:flex; align-items:center; gap:6px; flex-shrink:0; }

.al-identity{ border-bottom:1px solid var(--line); }
.al-identity-cur{ width:100%; display:flex; align-items:center; gap:8px; padding:11px 16px;
  background:#14101e; border:none; cursor:pointer; font-family:inherit; color:var(--ink); }
.al-identity-lbl{ font-size:12px; color:var(--soft); }
.al-identity-val{ font-size:12.5px; font-weight:700; color:#c8b3ff; flex:1; text-align:left; }
.al-identity-caret{ color:var(--soft); font-size:14px; }
.al-identity-panel{ padding:12px 16px; background:#120f1c; display:flex; flex-direction:column; gap:8px; }
.al-identity-modes{ display:flex; gap:8px; }
.al-identity-modes button{ flex:1; padding:9px; border-radius:9px; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:600; background:#1a1a20; border:1px solid var(--line); color:var(--soft); }
.al-identity-modes button.on{ background:var(--accent); color:#fff; border-color:var(--accent); }
.al-identity-input{ width:100%; background:#1a1a20; border:1px solid var(--line); border-radius:9px;
  padding:9px 11px; font-family:inherit; font-size:13px; color:var(--ink); resize:none; }
.al-identity-input:focus{ outline:none; border-color:var(--accent); }
.al-identity-done{ align-self:flex-end; padding:7px 16px; border-radius:8px; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:700; background:var(--accent); color:#fff; border:none; }
.al-relhint{ margin:0; font-size:12px; color:var(--accent2); font-weight:600; }
.al-relpick{ display:flex; flex-direction:column; gap:6px; }
.al-relpick-lbl{ font-size:11px; color:var(--soft); }
.al-relchips{ display:flex; flex-wrap:wrap; gap:6px; }
.al-relchip{ font-size:12px; padding:6px 11px; border-radius:16px; cursor:pointer; font-family:inherit;
  background:#1f1a2e; border:1px solid #2e2640; color:#c8b3ff; }
.al-relchip:hover{ border-color:var(--accent2); color:#fff; }
.al-persona-guide{ font-size:11.5px; color:var(--soft); margin:0; line-height:1.5; }
.al-persona-area{ min-height:96px; line-height:1.6; resize:none; }

.al-dmscroll{ min-height:280px; max-height:440px; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px;
  background:linear-gradient(180deg,#202029,#191820); }
.al-dm-empty{ text-align:center; padding:60px 20px; color:var(--soft); }
.al-dm-empty p{ font-size:14px; margin:0 0 6px; }
.al-dm-empty span{ font-size:12px; color:#5a5a64; }
.al-bubble-row{ display:flex; gap:8px; align-items:flex-end; }
.al-bubble-row.me{ justify-content:flex-end; }
.al-bubble-av{ width:28px; height:28px; flex-shrink:0; border-radius:50%;
  background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center;
  justify-content:center; font-size:13px; font-weight:800; color:#fff; }
.al-bubble{ max-width:76%; padding:10px 13px; border-radius:18px; font-size:14.5px; line-height:1.55; white-space:pre-wrap;
  box-shadow:0 8px 18px -16px #000; }
.al-bubble.char{ background:#f1eff6; color:#17151d; border-bottom-left-radius:5px; }
.al-bubble.me{ background:#0a84ff; color:#fff; border-bottom-right-radius:5px; font-weight:600; }
.al-bubble.typing{ padding:13px 15px; }
.al-bubble-label{ display:block; font-size:10.5px; font-weight:800; opacity:.7; margin-bottom:3px; }
.al-bubble-text{ display:block; }
.al-bubble-img{ display:block; width:min(230px, 62vw); max-width:100%; max-height:280px; object-fit:cover; border-radius:14px; background:#0f0e15; }
.al-bubble-img + .al-bubble-text{ margin-top:7px; }
.al-bubble.me .al-bubble-img{ border:1px solid rgba(255,255,255,.25); }
.al-bubble.char .al-bubble-img{ border:1px solid rgba(0,0,0,.08); }

.al-dm-preview{ display:flex; align-items:center; gap:10px; padding:10px 14px 0; border-top:1px solid var(--line); background:#1f1e26; }
.al-dm-preview img{ width:74px; height:74px; object-fit:cover; border-radius:14px; border:1px solid #45424f; box-shadow:0 10px 24px -18px #000; }
.al-dm-preview button{ width:32px; height:32px; border-radius:50%; border:1px solid #45424f; background:#2a2932; color:#ddd7ea; font-size:18px; font-weight:800; cursor:pointer; }
.al-dm-preview button:hover{ border-color:var(--accent); color:#fff; }
.al-dminput{ display:flex; gap:8px; padding:12px 14px; border-top:1px solid var(--line); background:#1f1e26; }
.al-dminput input{ flex:1; background:#2a2932; border:1px solid #45424f; border-radius:22px;
  padding:11px 16px; font-family:inherit; font-size:14px; color:var(--ink); }
.al-dminput input:focus{ outline:none; border-color:var(--accent); }
.al-dminput button{ width:42px; height:42px; flex-shrink:0; border-radius:50%; border:none; cursor:pointer;
  background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; font-size:18px; font-weight:800; }
.al-dminput button:disabled{ background:#2a2a32; color:#5a5a64; cursor:not-allowed; }
.al-dm-image-btn{ width:42px; height:42px; flex-shrink:0; border-radius:50%; border:1px solid #45424f; cursor:pointer;
  display:flex; align-items:center; justify-content:center; background:#2a2932; color:#d9c8ff; font-size:24px; font-weight:500; line-height:1; }
.al-dm-image-btn:hover{ border-color:var(--accent); color:#fff; }
.al-dm-image-btn input{ display:none; }

@media (max-width:430px){
  .al-root{ padding:0; align-items:stretch; }
  .al-phone{ max-width:none; min-height:100dvh; border-radius:0; border-left:none; border-right:none; }
  .al-profile-info{ padding-left:12px; padding-right:12px; }
  .al-profile-top{ grid-template-columns:1fr; gap:9px; }
  .al-feed-actions{ justify-content:flex-start; }
  .al-dmbtn{ min-height:36px; padding:8px 12px; font-size:12px; }
  .al-profile-info h2{ font-size:19px; overflow-wrap:anywhere; }
  .al-handle{ display:block; overflow-wrap:anywhere; font-size:12.5px; }
  .al-banner{ height:86px; }
  .al-avatar-wrap{ margin-top:-33px; margin-left:12px; }
  .al-avatar{ width:66px; height:66px; }
  .al-avatar-tools{ left:70px; bottom:4px; }
  .al-cover-tools label,.al-cover-tools button,.al-avatar-tools label,.al-avatar-tools button{ padding:5px 7px; font-size:10px; }
  .al-composer, .al-post{ padding-left:12px; padding-right:12px; }
  .al-autobar{ align-items:flex-start; flex-direction:column; }
  .al-autometa{ width:100%; justify-content:space-between; }
  .al-gallery-head{ align-items:flex-start; flex-direction:column; gap:6px; }
}

@media (max-width:320px){
  .al-feed-actions{ gap:6px; }
  .al-dmbtn{ padding-left:10px; padding-right:10px; font-size:11.5px; }
}
@media (prefers-reduced-motion:reduce){ .al-post,.al-typing i{ animation:none; } }
`;
