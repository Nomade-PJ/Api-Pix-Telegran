// api/painel.js — Nexus Panel v4 — Mobile-first
// Desktop sidebar + Mobile bottom nav + More drawer + Urgent strip
// Infinite scroll usuários, mobile row cards, quick actions
module.exports = function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Nexus Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#060608;--s1:#0c0c10;--s2:#111116;--s3:#18181f;--s4:#1f1f28;
  --line:#ffffff08;--line2:#ffffff12;--line3:#ffffff1e;
  --vio:#7c3aed;--viol:#8b5cf6;--violl:#a78bfa;--viod:#6d28d9;
  --glow:#7c3aed22;--glow2:#7c3aed44;
  --fg:#f8f8fc;--fg2:#a8a8c0;--fg3:#606080;
  --danger:#ef4444;--ok:#10b981;--warn:#f59e0b;--info:#6366f1;
  --grad:linear-gradient(135deg,#7c3aed,#db2777);
  --sb:220px;--tb:52px;--mnav:60px;
  --r:8px;--rl:12px;--rxl:16px;
}
html,body{height:100%;font-family:'Geist',sans-serif;background:var(--bg);color:var(--fg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;font-size:14px}
body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");pointer-events:none;z-index:9000}

/* ── LAYOUT ── */
.wrap{display:flex;min-height:100vh}

/* ── SIDEBAR ── */
.sb{width:var(--sb);background:var(--s1);border-right:1px solid var(--line);position:fixed;top:0;left:0;height:100vh;display:flex;flex-direction:column;z-index:300;transition:transform .25s cubic-bezier(.16,1,.3,1)}
.sb-top{padding:0 14px;height:var(--tb);display:flex;align-items:center;border-bottom:1px solid var(--line);flex-shrink:0}
.brand{display:flex;align-items:center;gap:8px}
.brand-mark{width:26px;height:26px;background:var(--grad);border-radius:7px;display:flex;align-items:center;justify-content:center}
.brand-mark svg{width:14px;height:14px;fill:none;stroke:#fff;stroke-width:2.5}
.brand-txt{font-size:13.5px;font-weight:600;letter-spacing:-.3px}
.brand-txt em{font-style:normal;color:var(--fg3)}
.nav{flex:1;padding:8px;overflow-y:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.ns{font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em;padding:14px 8px 4px}
.ns:first-child{padding-top:6px}
.ni{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;cursor:pointer;color:var(--fg3);font-size:13px;position:relative;user-select:none;transition:all .1s}
.ni:hover{background:var(--s3);color:var(--fg2)}
.ni.on{background:var(--s3);color:var(--fg);font-weight:500}
.ni.on::before{content:'';position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:2px;height:14px;background:var(--viol);border-radius:0 2px 2px 0}
.nico{width:16px;font-style:normal;opacity:.5;flex-shrink:0;font-size:12px;text-align:center}
.ni.on .nico,.ni:hover .nico{opacity:1}
.nbadge{margin-left:auto;font-size:10px;font-family:'Geist Mono',monospace;background:var(--s4);color:var(--fg2);padding:1px 5px;border-radius:3px;line-height:1.8}
.nbadge.r{background:#ef444418;color:#f87171}
.nbadge.v{background:#7c3aed18;color:var(--violl)}
.sb-foot{padding:8px;border-top:1px solid var(--line);flex-shrink:0}
.upill{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;background:var(--s2);border:1px solid var(--line)}
.uav{width:28px;height:28px;background:var(--grad);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
.uname{font-size:12px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.urole{font-size:10px;color:var(--fg3)}
.btnlo{background:none;border:none;color:var(--fg3);cursor:pointer;padding:4px;border-radius:4px;font-size:14px}
.btnlo:hover{color:var(--danger)}

/* ── TOPBAR ── */
.tb{height:var(--tb);background:var(--s1);border-bottom:1px solid var(--line);padding:0 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200}
.crumb{display:flex;align-items:center;gap:6px;font-size:13px}
.crumb-r{color:var(--fg3)}.crumb-s{color:var(--line3);font-size:10px}.crumb-c{font-weight:500}
.tb-r{display:flex;align-items:center;gap:8px}
.sdot{display:flex;align-items:center;gap:5px;font-size:10.5px;font-family:'Geist Mono',monospace;color:var(--fg3);background:var(--s2);border:1px solid var(--line2);padding:3px 9px;border-radius:20px}
.pulse{width:5px;height:5px;border-radius:50%;background:var(--ok);animation:pu 2s ease-in-out infinite}
@keyframes pu{0%,100%{box-shadow:0 0 0 0 #10b98155}50%{box-shadow:0 0 0 3px transparent}}
.btnhb{display:none;background:none;border:none;color:var(--fg2);cursor:pointer;padding:6px;font-size:20px;line-height:1;border-radius:6px}
.btnhb:active{background:var(--s3)}

/* ── MAIN ── */
.main{margin-left:var(--sb);flex:1;display:flex;flex-direction:column;min-height:100vh}
.content{padding:18px 20px;flex:1;overflow-y:auto;height:calc(100vh - var(--tb))}

/* ── BOTTOM NAV MOBILE ── */
.mnav{display:none;position:fixed;bottom:0;left:0;right:0;height:var(--mnav);background:var(--s1);border-top:1px solid var(--line2);z-index:300;padding:0 4px 4px;align-items:center;justify-content:space-around;safe-area-inset-bottom:env(safe-area-inset-bottom)}
.mni{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:10px;cursor:pointer;color:var(--fg3);font-size:10px;font-weight:500;transition:all .15s;min-width:50px;position:relative;-webkit-tap-highlight-color:transparent}
.mni.on{color:var(--violl)}
.mni.on .mni-ico{background:var(--glow);border-color:var(--viol)}
.mni-ico{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .15s;border:1px solid transparent}
.mbadge{position:absolute;top:4px;right:6px;background:var(--danger);color:#fff;font-size:9px;font-family:'Geist Mono',monospace;padding:1px 4px;border-radius:10px;min-width:14px;text-align:center;line-height:1.6;pointer-events:none}
.mbadge.v{background:var(--vio)}

/* ── MORE DRAWER ── */
.drawer-ov{position:fixed;inset:0;z-index:350;display:none}
.drawer-ov.on{display:block}
.drawer{position:fixed;bottom:calc(var(--mnav) + 8px);left:8px;right:8px;background:var(--s2);border:1px solid var(--line3);border-radius:var(--rxl);padding:10px;z-index:400;display:none;animation:drup .2s cubic-bezier(.16,1,.3,1);max-height:72vh;overflow-y:auto}
.drawer.on{display:block}
@keyframes drup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.dgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ditem{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 6px;border-radius:10px;background:var(--s3);border:1px solid var(--line2);cursor:pointer;font-size:11px;color:var(--fg2);text-align:center;transition:all .1s;position:relative}
.ditem:active{background:var(--s4);transform:scale(.97)}
.ditem.on{background:var(--glow);border-color:var(--viod);color:var(--violl)}
.dico{font-size:20px;line-height:1}
.dbadge{position:absolute;top:5px;right:7px;background:var(--danger);color:#fff;font-size:9px;font-family:'Geist Mono',monospace;padding:1px 4px;border-radius:8px;line-height:1.6}

/* ── URGENT STRIP (mobile dashboard) ── */
.ustrip{display:none;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.ustrip::-webkit-scrollbar{display:none}
.uc{background:var(--s2);border:1px solid var(--line2);border-radius:var(--rl);padding:12px 14px;min-width:150px;flex-shrink:0;cursor:pointer;transition:all .1s;position:relative;overflow:hidden}
.uc:active{transform:scale(.98)}
.uc-lbl{font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
.uc-val{font-size:26px;font-weight:700;font-family:'Geist Mono',monospace;letter-spacing:-1.5px;line-height:1}
.uc-sub{font-size:11px;color:var(--fg3);margin-top:2px}
.uc-bar{position:absolute;top:0;left:0;right:0;height:2px}
.uc.r .uc-val{color:var(--danger)}.uc.r .uc-bar{background:var(--danger)}
.uc.w .uc-val{color:var(--warn)}.uc.w .uc-bar{background:var(--warn)}
.uc.v .uc-val{color:var(--violl)}.uc.v .uc-bar{background:var(--grad)}
.uc.g .uc-val{color:var(--ok)}.uc.g .uc-bar{background:var(--ok)}

/* ── QUICK ACTIONS (mobile) ── */
.qact{display:none;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.qact::-webkit-scrollbar{display:none}
.qab{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:20px;border:1px solid var(--line2);background:var(--s2);color:var(--fg2);font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;font-family:'Geist',sans-serif;transition:all .1s;flex-shrink:0}
.qab:active{transform:scale(.97)}
.qab.p{background:var(--vio);border-color:var(--vio);color:#fff}

/* ── KPIs ── */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.kpi{background:var(--s1);border:1px solid var(--line2);border-radius:var(--rl);padding:14px;position:relative;overflow:hidden;transition:border-color .15s}
.kpi:hover{border-color:var(--line3)}
.kpi-lbl{font-size:10px;color:var(--fg3);font-weight:500;text-transform:uppercase;letter-spacing:.07em;margin-bottom:9px;display:flex;align-items:center;justify-content:space-between}
.kpi-v{font-size:20px;font-weight:600;font-family:'Geist Mono',monospace;letter-spacing:-1px;line-height:1}
.kpi-v.v{color:var(--violl)}.kpi-v.g{color:var(--ok)}.kpi-v.w{color:var(--warn)}.kpi-v.r{color:var(--danger)}
.kpi-s{font-size:10.5px;color:var(--fg3);margin-top:5px}
.kpi-a{position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--grad);opacity:0;transition:opacity .15s}
.kpi:hover .kpi-a{opacity:.4}
/* Mobile KPI scroll */
.kpis-m{display:none;overflow-x:auto;gap:10px;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none}
.kpis-m::-webkit-scrollbar{display:none}
.kpis-m .kpi{min-width:140px;flex-shrink:0}

/* ── CARD ── */
.card{background:var(--s1);border:1px solid var(--line2);border-radius:var(--rl);overflow:hidden;margin-bottom:12px}
.card-h{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line)}
.card-t{font-size:13px;font-weight:500}
.card-m{font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3)}

/* ── TABLES ── */
table{width:100%;border-collapse:collapse}
thead th{padding:7px 12px;text-align:left;font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--line);background:var(--s2);white-space:nowrap}
tbody tr{border-bottom:1px solid var(--line);transition:background .08s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:var(--s2)}
td{padding:9px 12px;font-size:13px;color:var(--fg2);vertical-align:middle}
td b{color:var(--fg);font-weight:500}
.mono{font-family:'Geist Mono',monospace;font-size:11.5px}
.trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px}
.tbl-w{overflow-x:auto;-webkit-overflow-scrolling:touch}

/* ── MOBILE ROW CARDS ── */
.mrows{flex-direction:column;gap:8px;padding:4px 0}
.mrow{background:var(--s2);border:1px solid var(--line2);border-radius:var(--rl);padding:12px 14px;cursor:pointer;transition:all .1s}
.mrow:active{transform:scale(.99)}
.mr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
.mr-id{font-family:'Geist Mono',monospace;font-size:11px;color:var(--fg3)}
.mr-val{font-family:'Geist Mono',monospace;font-size:15px;font-weight:600}
.mr-mid{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.mr-bot{display:flex;justify-content:space-between;align-items:center}
.mr-date{font-size:10px;color:var(--fg3);font-family:'Geist Mono',monospace}
.mr-acts{display:flex;gap:5px;flex-wrap:wrap}

/* ── TAGS ── */
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;font-size:10.5px;font-family:'Geist Mono',monospace;font-weight:500;white-space:nowrap;border:1px solid transparent}
.tag::before{content:'';width:4px;height:4px;border-radius:50%;flex-shrink:0}
.t-pending{background:#f59e0b0d;color:#fbbf24;border-color:#f59e0b20}.t-pending::before{background:#fbbf24}
.t-proof_sent,.t-approved,.t-validated{background:#6366f10d;color:#818cf8;border-color:#6366f120}
.t-proof_sent::before,.t-approved::before,.t-validated::before{background:#818cf8}
.t-delivered{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-delivered::before{background:#34d399}
.t-rejected,.t-cancelled{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-rejected::before,.t-cancelled::before{background:#f87171}
.t-delivery_failed{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-delivery_failed::before{background:#f87171}
.t-reversed{background:#f9731608;color:#fb923c;border-color:#f9731618}.t-reversed::before{background:#fb923c}
.t-expired{background:#ffffff06;color:var(--fg3);border-color:var(--line)}.t-expired::before{background:var(--fg3)}
.t-active,.t-resolved,.t-sent{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-active::before,.t-resolved::before,.t-sent::before{background:#34d399}
.t-inactive,.t-closed{background:#ffffff06;color:var(--fg3);border-color:var(--line)}.t-inactive::before,.t-closed::before{background:var(--fg3)}
.t-blocked{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-blocked::before{background:#f87171}
.t-open{background:#6366f10d;color:#818cf8;border-color:#6366f120}.t-open::before{background:#818cf8}
.t-in_progress{background:#f59e0b0d;color:#fbbf24;border-color:#f59e0b20}.t-in_progress::before{background:#fbbf24}
.t-sending,.t-draft,.t-pending_broadcast{background:#7c3aed0d;color:#a78bfa;border-color:#7c3aed20}.t-sending::before,.t-draft::before,.t-pending_broadcast::before{background:#a78bfa}
.t-admin{background:#7c3aed0d;color:#a78bfa;border-color:#7c3aed20}.t-admin::before{background:#a78bfa}
.t-creator{background:#db27770d;color:#f472b6;border-color:#db277720}.t-creator::before{background:#f472b6}
.t-urgent{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-urgent::before{background:#f87171}
.t-high{background:#f59e0b0d;color:#fbbf24;border-color:#f59e0b20}.t-high::before{background:#fbbf24}
.t-normal{background:#ffffff06;color:var(--fg3);border-color:var(--line)}.t-normal::before{background:var(--fg3)}
.t-low{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-low::before{background:#34d399}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;font-family:'Geist',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .1s;border:1px solid transparent;white-space:nowrap;line-height:1.4}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.bp{background:var(--vio);color:#fff;border-color:var(--vio)}.bp:hover{background:var(--viol);box-shadow:0 0 16px var(--glow2)}
.bd{background:var(--s3);color:var(--fg2);border-color:var(--line2)}.bd:hover{background:var(--s4);color:var(--fg)}
.br{background:#ef44440d;color:#f87171;border-color:#ef444420}.br:hover{background:#ef444420}
.bg_{background:#10b9810d;color:#34d399;border-color:#10b98120}.bg_:hover{background:#10b98120}
.bw{background:#f59e0b0d;color:#fbbf24;border-color:#f59e0b20}.bw:hover{background:#f59e0b20}
.bgh{background:transparent;color:var(--fg3);border-color:transparent}.bgh:hover{background:var(--s3)}
.bxs{padding:3px 8px;font-size:11px;border-radius:5px}
.bsm{padding:5px 10px;font-size:12px;border-radius:6px}
.bfl{width:100%;justify-content:center;padding:12px;font-size:14px;border-radius:10px}

/* ── INPUTS ── */
.fi{background:var(--s2);border:1px solid var(--line2);border-radius:6px;padding:6px 11px;color:var(--fg);font-family:'Geist',sans-serif;font-size:13px;outline:none;transition:border-color .1s;height:32px}
.fi:focus{border-color:var(--vio)}.fi::placeholder{color:var(--fg3)}.fi option{background:var(--s2)}
.fi-sm{height:28px;font-size:12px;padding:4px 9px}
.fi-lg{height:42px;font-size:14px;padding:8px 14px;border-radius:9px}
.filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.frow{margin-bottom:12px}
.frow label{display:block;font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
.frow .fi{width:100%;height:36px}
.frow textarea.fi{height:auto;min-height:80px;resize:vertical;padding:8px 11px}

/* ── PAGER ── */
.pager{display:flex;align-items:center;gap:4px;margin-top:12px;justify-content:center}
.pg{background:var(--s2);border:1px solid var(--line2);color:var(--fg3);padding:4px 9px;border-radius:5px;cursor:pointer;font-family:'Geist Mono',monospace;font-size:11px;transition:all .1s}
.pg:hover{border-color:var(--line3);color:var(--fg2)}.pg.on{background:var(--vio);color:#fff;border-color:var(--vio)}.pg:disabled{opacity:.3;cursor:default}
.pg-inf{font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3);padding:0 6px}

/* ── MODAIS ── */
.ov{position:fixed;inset:0;background:#00000080;z-index:600;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}
.ov.on{display:flex}
.modal{background:var(--s2);border:1px solid var(--line3);border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 -24px 60px #00000099;animation:mup .22s cubic-bezier(.16,1,.3,1)}
@keyframes mup{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
.modal.center{border-radius:14px;max-width:500px;align-self:center;animation:msc .18s cubic-bezier(.16,1,.3,1)}
@keyframes msc{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.modal.xl{max-width:640px}
.mdrag{width:36px;height:4px;background:var(--line3);border-radius:2px;margin:0 auto 16px}
.mtitle{font-size:15px;font-weight:600;margin-bottom:16px}
.mfoot{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}

/* ── LOADER / EMPTY ── */
.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;gap:10px}
.spin{width:22px;height:22px;border:2px solid var(--line3);border-top-color:var(--viol);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.ltxt{font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:6px;color:var(--fg3)}
.ei{font-size:28px;opacity:.2}.et{font-size:13px}

/* ── TOASTS ── */
.toasts{position:fixed;bottom:calc(var(--mnav) + 10px);right:14px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:var(--s3);border:1px solid var(--line3);border-radius:9px;padding:9px 14px;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px #00000060;animation:tin .2s cubic-bezier(.16,1,.3,1);min-width:180px;max-width:280px}
@keyframes tin{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.tline{width:2px;border-radius:2px;align-self:stretch;flex-shrink:0}
.toast.ok .tline{background:var(--ok)}.toast.err .tline{background:var(--danger)}.toast.warn .tline{background:var(--warn)}

/* ── SEÇÕES ── */
.sec{display:none}.sec.on{display:block;animation:son .18s ease}
@keyframes son{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}

/* ── DASHBOARD GRID ── */
.dg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.dli{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--line)}
.dli:last-child{border-bottom:none}

/* ── BROADCAST ── */
.bc{background:var(--s2);border:1px solid var(--line2);border-radius:var(--rl);padding:14px;margin-bottom:10px;display:flex;gap:12px}
.bc-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:5px}

/* ── TRUST BAR ── */
.tbar{height:5px;background:var(--s4);border-radius:3px;overflow:hidden;margin-top:2px}
.tfill{height:100%;border-radius:3px}

/* ── MSG THREAD ── */
.thread{max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px}
.msg{padding:9px 12px;border-radius:8px;max-width:85%;font-size:12.5px;line-height:1.5}
.msg.usr{background:var(--s3);border:1px solid var(--line);align-self:flex-start}
.msg.adm{background:#7c3aed15;border:1px solid #7c3aed22;align-self:flex-end}
.msg-m{font-size:10px;color:var(--fg3);margin-top:3px;font-family:'Geist Mono',monospace}

/* ── CHART BARS ── */
.bars{display:flex;align-items:flex-end;gap:2px;height:56px}
.bar{flex:1;border-radius:3px 3px 0 0;min-height:2px;opacity:.8}
.bar:hover{opacity:1}

/* ── SETTINGS ── */
.sblock{background:var(--s1);border:1px solid var(--line2);border-radius:var(--rl);padding:16px;margin-bottom:12px}
.sblock h3{font-size:13px;font-weight:500;margin-bottom:3px}
.sblock p{font-size:12px;color:var(--fg3);margin-bottom:12px}

/* ── MEDIA GRID ── */
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:5px;max-height:240px;overflow-y:auto}
.mthumb{aspect-ratio:1;border-radius:5px;background:var(--s3);border:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--fg3);text-align:center;padding:2px;word-break:break-all}
.mthumb img{width:100%;height:100%;object-fit:cover}

/* ── USER DETAIL ── */
.udh{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:14px}
.udav{width:42px;height:42px;background:var(--grad);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}

/* ── RESPONSIVE ── */
@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){
  .sb{transform:translateX(-100%);z-index:400}
  .sb.on{transform:none;box-shadow:0 0 40px #00000090}
  .sb-ov{position:fixed;inset:0;background:#00000060;z-index:380;display:none}
  .sb-ov.on{display:block}
  .main{margin-left:0}
  .tb{padding:0 12px;height:48px}
  .content{padding:12px;height:calc(100vh - 48px - var(--mnav))}
  .btnhb{display:flex}
  .crumb-r,.crumb-s{display:none}
  .sdot{display:none}
  .mnav{display:flex}
  .toasts{bottom:calc(var(--mnav) + 8px);right:10px}
  /* KPIs: hide grid, show scroll */
  .kpis{display:none}
  .kpis-m{display:flex}
  /* urgent strip */
  .ustrip{display:flex}
  /* quick actions */
  .qact{display:flex}
  /* dashboard grid 1 col */
  .dg{grid-template-columns:1fr}
  /* hide table cols */
  .hm{display:none!important}
  /* show mobile rows */
  .sm{display:flex!important}
  /* modal bottom */
  .modal.center{border-radius:16px 16px 0 0;align-self:flex-end;max-width:100%}
  .mfoot{flex-direction:column-reverse;gap:8px}
  .mfoot .btn{justify-content:center;padding:12px;border-radius:10px}
  table{font-size:12px}
  thead th{padding:6px 10px;font-size:9px}
  td{padding:8px 10px}
}
@media(max-width:480px){
  .kpis-m .kpi{min-width:130px}
  .tb{height:46px}
  .content{height:calc(100vh - 46px - var(--mnav))}
}
</style>
</head>
<body>
<div class="wrap">

<!-- SIDEBAR -->
<aside class="sb" id="sb">
  <div class="sb-top">
    <div class="brand">
      <div class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
      <span class="brand-txt">Nexus <em>Panel</em></span>
    </div>
  </div>
  <nav class="nav">
    <div class="ns">Visão geral</div>
    <div class="ni on" onclick="go('dashboard',this)"><i class="nico">◈</i>Dashboard</div>
    <div class="ni" onclick="go('stats',this)"><i class="nico">◉</i>Analytics</div>
    <div class="ns">Financeiro</div>
    <div class="ni" onclick="go('transactions',this)"><i class="nico">▦</i>Transações<span class="nbadge r" id="cnt-pend">–</span></div>
    <div class="ni" onclick="go('failures',this)"><i class="nico">◬</i>Falhas<span class="nbadge r" id="cnt-fail">–</span></div>
    <div class="ns">Catálogo</div>
    <div class="ni" onclick="go('products',this)"><i class="nico">▣</i>Produtos</div>
    <div class="ni" onclick="go('mediapacks',this)"><i class="nico">▤</i>Media Packs</div>
    <div class="ni" onclick="go('groups',this)"><i class="nico">◎</i>Grupos VIP</div>
    <div class="ni" onclick="go('coupons',this)"><i class="nico">◈</i>Cupons</div>
    <div class="ns">Usuários</div>
    <div class="ni" onclick="go('users',this)"><i class="nico">◯</i>Usuários</div>
    <div class="ni" onclick="go('trusted',this)"><i class="nico">★</i>Confiáveis<span class="nbadge v" id="cnt-trust">–</span></div>
    <div class="ni" onclick="go('tickets',this)"><i class="nico">▧</i>Tickets<span class="nbadge v" id="cnt-tick">–</span></div>
    <div class="ns">Marketing</div>
    <div class="ni" onclick="go('broadcast',this)"><i class="nico">◎</i>Broadcast</div>
    <div class="ni" onclick="go('autoresponses',this)"><i class="nico">◈</i>Auto Respostas</div>
    <div class="ns">Sistema</div>
    <div class="ni" onclick="go('deliver',this)"><i class="nico">↓</i>Entrega Manual</div>
    <div class="ni" onclick="go('settings',this)"><i class="nico">◎</i>Configurações</div>
    <div class="ni" onclick="go('ddds',this)"><i class="nico">◬</i>DDDs</div>
  </nav>
  <div class="sb-foot">
    <div class="upill">
      <div class="uav" id="uAv">A</div>
      <div><div class="uname" id="uName">Admin</div><div class="urole">administrator</div></div>
      <button class="btnlo" onclick="logout()" title="Sair">⏻</button>
    </div>
  </div>
</aside>
<div class="sb-ov" id="sbOv" onclick="closeSB()"></div>

<!-- MAIN -->
<div class="main" id="main">
  <div class="tb">
    <div style="display:flex;align-items:center;gap:10px">
      <button class="btnhb" onclick="toggleSB()">☰</button>
      <div class="crumb"><span class="crumb-r">nexus</span><span class="crumb-s">/</span><span class="crumb-c" id="pgTit">dashboard</span></div>
    </div>
    <div class="tb-r">
      <button class="btn bd bxs" onclick="reloadCur()" style="gap:3px">↺ <span class="hm">Atualizar</span></button>
      <div class="sdot"><div class="pulse"></div>online</div>
    </div>
  </div>

  <div class="content" id="cnt">

    <!-- ═══ DASHBOARD ═══ -->
    <div id="s-dashboard" class="sec on">
      <!-- Mobile urgent strip -->
      <div class="ustrip" id="ustrip">
        <div class="uc w" onclick="go('transactions',document.querySelector('.ni[onclick*=transactions]'))">
          <div class="uc-bar"></div>
          <div class="uc-lbl">Pendentes</div>
          <div class="uc-val" id="m-pend">–</div>
          <div class="uc-sub">toque para ver</div>
        </div>
        <div class="uc r" onclick="go('failures',document.querySelector('.ni[onclick*=failures]'))">
          <div class="uc-bar"></div>
          <div class="uc-lbl">Falhas</div>
          <div class="uc-val" id="m-fail">–</div>
          <div class="uc-sub">toque para ver</div>
        </div>
        <div class="uc v" onclick="go('tickets',document.querySelector('.ni[onclick*=tickets]'))">
          <div class="uc-bar"></div>
          <div class="uc-lbl">Tickets</div>
          <div class="uc-val" id="m-tick">–</div>
          <div class="uc-sub">abertos</div>
        </div>
        <div class="uc g">
          <div class="uc-bar"></div>
          <div class="uc-lbl">Hoje</div>
          <div class="uc-val" id="m-hoje">–</div>
          <div class="uc-sub">receita</div>
        </div>
      </div>
      <!-- Mobile quick actions -->
      <div class="qact">
        <button class="qab p" onclick="go('transactions',document.querySelector('.ni[onclick*=transactions]'))">▦ Pedidos <span id="qa-pend" style="background:#ffffff30;padding:0 5px;border-radius:8px;font-size:10px">–</span></button>
        <button class="qab" onclick="go('failures',document.querySelector('.ni[onclick*=failures]'))">◬ Falhas</button>
        <button class="qab" onclick="go('tickets',document.querySelector('.ni[onclick*=tickets]'))">▧ Tickets</button>
        <button class="qab" onclick="go('users',document.querySelector('.ni[onclick*=users]'))">◯ Usuários</button>
      </div>
      <!-- Desktop KPIs -->
      <div class="kpis" id="kpis"><div style="grid-column:1/-1" class="loader"><div class="spin"></div></div></div>
      <!-- Mobile KPI scroll -->
      <div class="kpis-m" id="kpisM"></div>
      <!-- Cards grid -->
      <div class="dg">
        <div class="card"><div class="card-h"><span class="card-t">Últimas transações</span><span class="card-m" id="dTxM"></span></div><div id="dTx"></div></div>
        <div class="card"><div class="card-h"><span class="card-t">Novos usuários</span></div><div id="dUsers"></div></div>
      </div>
    </div>

    <!-- ═══ ANALYTICS ═══ -->
    <div id="s-stats" class="sec">
      <div style="margin-bottom:14px">
        <button class="btn bw bxs" onclick="recalcValues()">↻ Recalcular valores</button>
      </div>
      <div class="dg">
        <div class="card"><div class="card-h"><span class="card-t">Receita 14 dias</span></div><div style="padding:14px 16px"><div class="bars" id="chartRev"></div><div style="font-size:10px;font-family:'Geist Mono',monospace;color:var(--fg3);margin-top:8px" id="chartRevL"></div></div></div>
        <div class="card"><div class="card-h"><span class="card-t">Por status</span></div><div id="chartSt"></div></div>
        <div class="card"><div class="card-h"><span class="card-t">Usuários 14 dias</span></div><div style="padding:14px 16px"><div class="bars" id="chartUsr"></div><div style="font-size:10px;font-family:'Geist Mono',monospace;color:var(--fg3);margin-top:8px" id="chartUsrL"></div></div></div>
        <div class="card"><div class="card-h"><span class="card-t">Top produtos</span></div><div id="chartProd"></div></div>
      </div>
    </div>

    <!-- ═══ TRANSAÇÕES ═══ -->
    <div id="s-transactions" class="sec">
      <div class="filters">
        <input class="fi fi-sm" style="flex:1;min-width:120px" id="txQ" placeholder="TXID ou Telegram ID..." oninput="dbounce('loadTx',500)">
        <select class="fi fi-sm" id="txSt" onchange="loadTx()">
          <option value="all">Todos status</option>
          <option value="pending">⏳ Pendente</option>
          <option value="proof_sent">📸 Comprovante</option>
          <option value="validated">✓ Validado</option>
          <option value="approved">✓ Aprovado</option>
          <option value="delivered">✅ Entregue</option>
          <option value="delivery_failed">❌ Falha</option>
          <option value="rejected">🚫 Rejeitado</option>
          <option value="reversed">↩ Revertido</option>
          <option value="expired">⌛ Expirado</option>
          <option value="cancelled">✗ Cancelado</option>
        </select>
      </div>
      <div class="card tbl-w hm" id="txTable"><div class="loader"><div class="spin"></div></div></div>
      <div class="mrows sm" id="txCards" style="display:none"></div>
      <div class="pager" id="txPager"></div>
    </div>

    <!-- ═══ FALHAS ═══ -->
    <div id="s-failures" class="sec">
      <div class="card tbl-w hm" id="failTable"><div class="loader"><div class="spin"></div></div></div>
      <div class="mrows sm" id="failCards" style="display:none"></div>
    </div>

    <!-- ═══ PRODUTOS ═══ -->
    <div id="s-products" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:500">Produtos</span>
        <button class="btn bp bxs" onclick="openM('mProd')">+ Novo</button>
      </div>
      <div class="card" id="prodTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ MEDIA PACKS ═══ -->
    <div id="s-mediapacks" class="sec">
      <div style="font-size:13px;font-weight:500;margin-bottom:12px">Media Packs</div>
      <div class="card" id="mpTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ GRUPOS ═══ -->
    <div id="s-groups" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:500">Grupos VIP</span>
        <button class="btn bp bxs" onclick="openM('mGroup')">+ Novo</button>
      </div>
      <div class="card" id="groupTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ CUPONS ═══ -->
    <div id="s-coupons" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:500">Cupons</span>
        <button class="btn bp bxs" onclick="openM('mCoupon')">+ Novo</button>
      </div>
      <div class="card" id="couponTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ USUÁRIOS ═══ -->
    <div id="s-users" class="sec">
      <div class="filters">
        <input class="fi fi-sm" style="flex:1;min-width:120px" id="userQ" placeholder="Nome, @username ou ID..." oninput="dbounce('resetUserScroll',500)">
        <select class="fi fi-sm" id="userBl" onchange="resetUserScroll()">
          <option value="">Todos</option><option value="false">Ativos</option><option value="true">Bloqueados</option>
        </select>
        <span class="card-m" id="userLbl" style="align-self:center"></span>
      </div>
      <div class="card">
        <table><thead><tr><th>Nome</th><th class="hm">Username</th><th class="hm">Telegram ID</th><th class="hm">Telefone</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody id="usersBody"></tbody></table>
        <div id="usersLdr" style="display:none" class="loader" style="padding:20px"><div class="spin"></div><span class="ltxt">carregando</span></div>
        <div id="usersEnd" style="display:none;text-align:center;padding:12px;font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3)">— fim da lista —</div>
      </div>
    </div>

    <!-- ═══ CONFIÁVEIS ═══ -->
    <div id="s-trusted" class="sec">
      <div class="card" id="trustedTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ TICKETS ═══ -->
    <div id="s-tickets" class="sec">
      <div class="filters">
        <select class="fi fi-sm" id="tickSt" onchange="loadTickets()">
          <option value="all">Todos</option><option value="open">Abertos</option>
          <option value="in_progress">Em andamento</option><option value="resolved">Resolvidos</option><option value="closed">Fechados</option>
        </select>
        <select class="fi fi-sm" id="tickPri" onchange="loadTickets()">
          <option value="">Prioridade</option>
          <option value="urgent">🔴 Urgente</option><option value="high">🟡 Alta</option>
          <option value="normal">⚪ Normal</option><option value="low">🟢 Baixa</option>
        </select>
      </div>
      <div class="card tbl-w hm" id="tickTable"><div class="loader"><div class="spin"></div></div></div>
      <div class="mrows sm" id="tickCards" style="display:none"></div>
      <div class="pager" id="tickPager"></div>
    </div>

    <!-- ═══ BROADCAST ═══ -->
    <div id="s-broadcast" class="sec">
      <div id="bcList"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ AUTO RESPOSTAS ═══ -->
    <div id="s-autoresponses" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:500">Respostas automáticas</span>
        <button class="btn bp bxs" onclick="openM('mAR')">+ Nova</button>
      </div>
      <div class="card" id="arTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- ═══ ENTREGA MANUAL ═══ -->
    <div id="s-deliver" class="sec">
      <div style="max-width:480px">
        <div class="sblock">
          <h3>Entrega manual</h3>
          <p>Entregue qualquer produto a qualquer usuário, independente de transação.</p>
          <div class="frow"><label>Telegram ID do usuário *</label><input class="fi" id="delUserId" placeholder="Ex: 6224210204" type="number"></div>
          <div class="frow"><label>Tipo *</label>
            <select class="fi" id="delType" onchange="updateDelProduct()">
              <option value="product">Produto</option><option value="mediapack">Media Pack</option><option value="group">Grupo VIP</option>
            </select>
          </div>
          <div class="frow"><label>Item *</label><select class="fi" id="delProduct"><option>Carregando...</option></select></div>
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
            <button class="btn bd bsm" onclick="lookupDelUser()">🔍 Verificar</button>
            <button class="btn bp bsm" onclick="doManualDeliver()">↓ Entregar</button>
          </div>
          <div id="delUserInfo" style="margin-top:12px;padding:10px;background:var(--s2);border:1px solid var(--line);border-radius:8px;font-size:12px;display:none"></div>
        </div>
      </div>
    </div>

    <!-- ═══ CONFIGURAÇÕES ═══ -->
    <div id="s-settings" class="sec">
      <div style="font-size:13px;font-weight:500;margin-bottom:16px">Configurações</div>
      <div style="max-width:500px">
        <div class="sblock">
          <h3>Chave PIX</h3><p>Chave usada para receber pagamentos</p>
          <div class="frow"><label>Chave PIX</label><input class="fi" id="pixKey" placeholder="Carregando..."></div>
          <button class="btn bp bxs" onclick="saveSetting('pix_key',document.getElementById('pixKey').value,'PIX salvo.')">Salvar</button>
        </div>
        <div class="sblock">
          <h3>Suporte Telegram</h3><p>Link do canal ou usuário de suporte</p>
          <div class="frow"><label>Link</label><input class="fi" id="supportLink" placeholder="https://t.me/..."></div>
          <button class="btn bp bxs" onclick="saveSetting('support_contact',document.getElementById('supportLink').value,'Salvo.')">Salvar</button>
        </div>
        <div class="sblock">
          <h3>IDs de Criador</h3><p>Telegram IDs com acesso a /criador</p>
          <div class="frow"><label>Criador principal</label><input class="fi" id="creatorId" placeholder="Carregando..."></div>
          <div class="frow"><label>Criador secundário</label><input class="fi" id="creator2Id" placeholder="Carregando..."></div>
          <button class="btn bp bxs" onclick="saveCreatorIds()">Salvar IDs</button>
        </div>
        <div class="sblock" id="shopBlock">
          <h3>&#128722; Status da Loja</h3>
          <p>Controla se os bot&#245;es de compra est&#227;o ativos. Quando <b>fechada</b>, nenhum usu&#225;rio consegue iniciar uma compra.</p>
          <div style=\"display:flex;align-items:center;gap:14px;margin-top:6px\">
            <div id=\"shopBadge\" style=\"display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid transparent;transition:all .2s\">
              <span id=\"shopDot\" style=\"width:9px;height:9px;border-radius:50%;display:inline-block;flex-shrink:0\"></span>
              <span id=\"shopStatusTxt\">Carregando...</span>
            </div>
            <button id=\"shopToggleBtn\" class=\"btn bsm\" onclick=\"toggleShop()\" style=\"min-width:120px\">...</button>
          </div>
          <div id=\"shopHint\" style=\"font-size:11px;color:var(--fg3);margin-top:8px;font-family:'Geist Mono',monospace\"></div>
        </div>
        <div class="sblock">
          <h3>Broadcast + Cupom</h3><p>Habilita CastCupom no bot</p>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
            <input type="checkbox" id="bcCoupEnabled" onchange="saveSetting('broadcast_coupon_enabled',this.checked?'true':'false','Salvo.')">Habilitado
          </label>
        </div>
        <div class="sblock" id="shopBlock">
          <h3>Status da Loja</h3>
          <p>Ativa ou desativa o menu de compras do bot. Quando desativado, nenhum usuário consegue iniciar uma compra.</p>
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div id="shopStatusBadge" style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;background:var(--s2);border:1px solid var(--line2)">
              <div id="shopDot" style="width:10px;height:10px;border-radius:50%;flex-shrink:0"></div>
              <span id="shopStatusTxt">Carregando...</span>
            </div>
            <button id="shopToggleBtn" class="btn bxs" onclick="toggleShop()" style="min-width:120px">Carregando...</button>
          </div>
          <div style="margin-top:10px;font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace" id="shopHint"></div>
        </div>
        <div class="sblock" style="border-color:#ef444420">
          <h3 style="color:var(--danger)">Zona de risco</h3><p>Operações críticas — use com cuidado</p>
          <button class="btn br bsm" onclick="recalcValues()">↻ Recalcular total de vendas</button>
        </div>
      </div>
    </div>

    <!-- ═══ DDDs ═══ -->
    <div id="s-ddds" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:500">DDDs bloqueados</span>
        <button class="btn br bxs" onclick="openM('mDDD')">+ Bloquear DDD</button>
      </div>
      <div class="card" id="dddTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

  </div><!-- /content -->
</div><!-- /main -->

<!-- BOTTOM NAV MOBILE -->
<nav class="mnav" id="mnav">
  <div class="mni on" id="mn-d" onclick="goMN('dashboard','mn-d')">
    <div class="mni-ico">◈</div><span>Home</span>
  </div>
  <div class="mni" id="mn-t" onclick="goMN('transactions','mn-t')">
    <div class="mni-ico">▦</div><span>Pedidos</span>
    <span class="mbadge" id="mb-pend" style="display:none">0</span>
  </div>
  <div class="mni" id="mn-u" onclick="goMN('users','mn-u')">
    <div class="mni-ico">◯</div><span>Usuários</span>
  </div>
  <div class="mni" id="mn-tk" onclick="goMN('tickets','mn-tk')">
    <div class="mni-ico">▧</div><span>Tickets</span>
    <span class="mbadge v" id="mb-tick" style="display:none">0</span>
  </div>
  <div class="mni" id="mn-more" onclick="toggleDrawer()">
    <div class="mni-ico">⋯</div><span>Mais</span>
  </div>
</nav>

<!-- MORE DRAWER -->
<div class="drawer-ov" id="drOv" onclick="closeDrawer()"></div>
<div class="drawer" id="drawer">
  <div style="font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;padding:0 2px 8px;font-weight:500">Todas as seções</div>
  <div class="dgrid">
    <div class="ditem" onclick="goDrawer('stats')"><div class="dico">◉</div>Analytics</div>
    <div class="ditem" onclick="goDrawer('failures')"><div class="dico">◬</div>Falhas<span class="dbadge" id="db-fail" style="display:none">0</span></div>
    <div class="ditem" onclick="goDrawer('broadcast')"><div class="dico">◎</div>Broadcast</div>
    <div class="ditem" onclick="goDrawer('products')"><div class="dico">▣</div>Produtos</div>
    <div class="ditem" onclick="goDrawer('mediapacks')"><div class="dico">▤</div>Media Packs</div>
    <div class="ditem" onclick="goDrawer('groups')"><div class="dico">◎</div>Grupos VIP</div>
    <div class="ditem" onclick="goDrawer('coupons')"><div class="dico">◈</div>Cupons</div>
    <div class="ditem" onclick="goDrawer('trusted')"><div class="dico">★</div>Confiáveis</div>
    <div class="ditem" onclick="goDrawer('autoresponses')"><div class="dico">◈</div>Auto Resp.</div>
    <div class="ditem" onclick="goDrawer('deliver')"><div class="dico">↓</div>Entrega</div>
    <div class="ditem" onclick="goDrawer('settings')"><div class="dico">◎</div>Config.</div>
    <div class="ditem" onclick="goDrawer('ddds')"><div class="dico">◬</div>DDDs</div>
  </div>
</div>


<!-- MODAIS -->
<div class="ov" id="mProd"><div class="modal"><div class="mdrag"></div>
  <div class="mtitle">Novo produto</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="frow" style="grid-column:1/-1"><label>ID único *</label><input class="fi" id="p_id" placeholder="ex: pack_vip_01"></div>
    <div class="frow" style="grid-column:1/-1"><label>Nome *</label><input class="fi" id="p_name" placeholder="Nome do produto"></div>
    <div class="frow"><label>Preço R$ *</label><input class="fi" type="number" id="p_price" placeholder="29.90" step="0.01"></div>
    <div class="frow"><label>Tipo entrega</label><select class="fi" id="p_type"><option value="link">Link</option><option value="media_pack">Media Pack</option><option value="group">Grupo</option></select></div>
    <div class="frow" style="grid-column:1/-1"><label>URL de entrega</label><input class="fi" id="p_url" placeholder="https://..."></div>
    <div class="frow" style="grid-column:1/-1"><label>Descrição</label><textarea class="fi" id="p_desc" placeholder="Opcional..."></textarea></div>
  </div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mProd')">Cancelar</button><button class="btn bp" onclick="saveProd()">Criar produto</button></div>
</div></div>

<div class="ov" id="mGroup"><div class="modal"><div class="mdrag"></div>
  <div class="mtitle">Novo grupo VIP</div>
  <div class="frow"><label>ID Telegram *</label><input class="fi" id="g_id" placeholder="-1001234567890"></div>
  <div class="frow"><label>Nome</label><input class="fi" id="g_name" placeholder="VIP Gold"></div>
  <div class="frow"><label>Link de convite</label><input class="fi" id="g_link" placeholder="https://t.me/+..."></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="frow"><label>Preço R$</label><input class="fi" type="number" id="g_price" placeholder="49.90"></div>
    <div class="frow"><label>Dias de acesso</label><input class="fi" type="number" id="g_days" placeholder="30"></div>
  </div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mGroup')">Cancelar</button><button class="btn bp" onclick="saveGroup()">Criar grupo</button></div>
</div></div>

<div class="ov" id="mCoupon"><div class="modal"><div class="mdrag"></div>
  <div class="mtitle">Novo cupom</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="frow" style="grid-column:1/-1"><label>Código *</label><input class="fi" id="c_code" placeholder="PROMO20" style="text-transform:uppercase"></div>
    <div class="frow"><label>Desconto % *</label><input class="fi" type="number" id="c_disc" placeholder="20" min="1" max="100"></div>
    <div class="frow"><label>Máx. usos</label><input class="fi" type="number" id="c_uses" placeholder="ilimitado"></div>
    <div class="frow" style="grid-column:1/-1"><label>Produto (vazio = todos)</label><select class="fi" id="c_prod"><option value="">Todos os produtos</option></select></div>
    <div class="frow" style="grid-column:1/-1"><label>Expira em</label><input class="fi" type="datetime-local" id="c_exp"></div>
  </div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mCoupon')">Cancelar</button><button class="btn bp" onclick="saveCoupon()">Criar cupom</button></div>
</div></div>

<div class="ov" id="mAR"><div class="modal"><div class="mdrag"></div>
  <div class="mtitle">Nova resposta automática</div>
  <div class="frow"><label>Palavra-chave *</label><input class="fi" id="ar_kw" placeholder="ex: preço, quanto custa"></div>
  <div class="frow"><label>Resposta *</label><textarea class="fi" id="ar_resp" placeholder="Texto que o bot vai enviar..."></textarea></div>
  <div class="frow"><label>Prioridade</label><input class="fi" type="number" id="ar_pri" value="0"></div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mAR')">Cancelar</button><button class="btn bp" onclick="saveAR()">Criar</button></div>
</div></div>

<div class="ov" id="mDDD"><div class="modal"><div class="mdrag"></div>
  <div class="mtitle">Bloquear DDD</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="frow"><label>DDD *</label><input class="fi" id="ddd_c" placeholder="11" maxlength="2" type="number"></div>
    <div class="frow"><label>Estado</label><input class="fi" id="ddd_s" placeholder="SP" maxlength="2"></div>
    <div class="frow" style="grid-column:1/-1"><label>Motivo</label><input class="fi" id="ddd_r" placeholder="Ex: Alta taxa de fraude"></div>
  </div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mDDD')">Cancelar</button><button class="btn br" onclick="addDDD()">Bloquear DDD</button></div>
</div></div>

<div class="ov" id="mTicket"><div class="modal xl"><div class="mdrag"></div>
  <div class="mtitle" id="mTickTit">Ticket #</div>
  <div id="mTickInfo" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line);font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3)"></div>
  <div class="thread" id="mTickMsgs"></div>
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
    <div class="frow"><label>Responder como admin</label><textarea class="fi" id="tickReply" placeholder="Digite sua resposta..."></textarea></div>
    <button class="btn bp bsm" onclick="replyTicket()">Enviar resposta</button>
  </div>
  <div class="mfoot">
    <button class="btn bgh" onclick="closeM('mTicket')">Fechar</button>
    <button class="btn bw bxs" id="btnPT" style="display:none" onclick="">▶ Iniciar</button>
    <button class="btn bd bxs" id="btnCT">✕ Fechar ticket</button>
    <button class="btn bg_ bxs" id="btnRT">✓ Resolver</button>
  </div>
</div></div>

<div class="ov" id="mUser"><div class="modal xl"><div class="mdrag"></div>
  <div class="udh">
    <div class="udav">👤</div>
    <div style="flex:1;min-width:0">
      <div id="udName" style="font-size:15px;font-weight:600"></div>
      <div id="udMeta" style="font-size:12px;color:var(--fg3);margin-top:2px"></div>
      <div id="udTags" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px"></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:12px">
    <div><div style="font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Cadastro</div><div class="mono" id="udCreated"></div></div>
    <div><div style="font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Telefone</div><div id="udPhone"></div></div>
  </div>
  <div style="font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Últimas transações</div>
  <div id="udTx"></div>
  <div class="mfoot" id="udActs" style="flex-direction:column"><button class="btn bgh" onclick="closeM('mUser')">Fechar</button></div>
</div></div>

<div class="ov" id="mReverse"><div class="modal"><div class="mdrag"></div>
  <div class="mtitle">↩ Reverter transação</div>
  <div style="font-size:11px;color:var(--fg3);margin-bottom:12px;font-family:'Geist Mono',monospace">TXID: <span id="revLbl"></span></div>
  <div class="frow"><label>Motivo</label><textarea class="fi" id="revReason" placeholder="Motivo da reversão..."></textarea></div>
  <input type="hidden" id="revTxid">
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mReverse')">Cancelar</button><button class="btn br" onclick="doReverse()">Reverter</button></div>
</div></div>

<div class="ov" id="mMP"><div class="modal xl"><div class="mdrag"></div>
  <div class="mtitle" id="mMPTit">Media Pack</div>
  <div id="mMPInfo" style="font-size:12px;color:var(--fg3);margin-bottom:10px"></div>
  <div style="font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Itens <span id="mMPCnt"></span></div>
  <div class="mgrid" id="mMPItems"></div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mMP')">Fechar</button></div>
</div></div>

<div class="ov" id="mBC"><div class="modal xl"><div class="mdrag"></div>
  <div class="mtitle" id="mBCTit">Campanha</div>
  <div id="mBCBody"></div>
  <div class="mfoot"><button class="btn bgh" onclick="closeM('mBC')">Fechar</button><button class="btn br bxs" id="btnCBC" style="display:none">✕ Cancelar campanha</button></div>
</div></div>

<div class="toasts" id="toasts"></div>
<script>
const API='/api/panel/data';
let TOKEN=localStorage.getItem('panel_token')||'';
let pg={tx:1,tick:1};
let dbt={};
let cur='dashboard';
let uState={loading:false,done:false,offset:0,limit:30,q:'',bl:''};
let delData={product:[],mediapack:[],group:[]};

// ── AUTH ──────────────────────────────────────────────
async function checkAuth(){
  if(!TOKEN){location.href='/login';return;}
  try{
    const r=await fetch('/api/panel/auth',{headers:{Authorization:'Bearer '+TOKEN}});
    if(!r.ok){localStorage.clear();location.href='/login';return;}
    const u=JSON.parse(localStorage.getItem('panel_user')||'{}');
    document.getElementById('uName').textContent=u.name||'Admin';
    document.getElementById('uAv').textContent=(u.name||'A')[0].toUpperCase();
  }catch(e){localStorage.clear();location.href='/login';}
}
function logout(){localStorage.clear();location.href='/login';}

async function api(action,opts={}){
  const{method='GET',body,params={}}=opts;
  const qs=new URLSearchParams({action,...params}).toString();
  try{
    const r=await fetch(API+'?'+qs,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:body?JSON.stringify(body):undefined});
    if(r.status===401){localStorage.clear();location.href='/login';}
    return r.json();
  }catch(e){return{error:e.message};}
}
function dbounce(fn,ms){clearTimeout(dbt[fn]);dbt[fn]=setTimeout(()=>window[fn]&&window[fn](),ms);}

// ── MOBILE HELPERS ────────────────────────────────────
const isMob=()=>window.innerWidth<=768;
function toggleSB(){
  const s=document.getElementById('sb'),o=document.getElementById('sbOv');
  const open=s.classList.toggle('on');
  o.classList.toggle('on',open);
}
function closeSB(){document.getElementById('sb').classList.remove('on');document.getElementById('sbOv').classList.remove('on');}
function toggleDrawer(){
  document.getElementById('drawer').classList.toggle('on');
  document.getElementById('drOv').classList.toggle('on');
}
function closeDrawer(){document.getElementById('drawer').classList.remove('on');document.getElementById('drOv').classList.remove('on');}
function goDrawer(sec){closeDrawer();go(sec,null);setMN('more');}
function setMN(sec){
  document.querySelectorAll('.mni').forEach(e=>e.classList.remove('on'));
  const map={dashboard:'mn-d',transactions:'mn-t',users:'mn-u',tickets:'mn-tk'};
  const id=map[sec]||'mn-more';
  document.getElementById(id)?.classList.add('on');
  // highlight drawer items
  document.querySelectorAll('.ditem').forEach(i=>{
    const fn=i.getAttribute('onclick')||'';
    i.classList.toggle('on',fn.includes("'"+sec+"'"));
  });
}
function goMN(sec,mnId){
  go(sec,document.querySelector('.ni[onclick*="\\''+sec+'\\'"]'));
  document.querySelectorAll('.mni').forEach(e=>e.classList.remove('on'));
  document.getElementById(mnId)?.classList.add('on');
}

// ── NAV ───────────────────────────────────────────────
const meta={dashboard:'dashboard',stats:'analytics',transactions:'transações',failures:'falhas',products:'produtos',mediapacks:'media packs',groups:'grupos VIP',coupons:'cupons',users:'usuários',trusted:'confiáveis',tickets:'tickets',broadcast:'broadcast',autoresponses:'auto respostas',deliver:'entrega manual',settings:'configurações',ddds:'DDDs bloqueados'};
const loads={dashboard:loadDash,stats:loadStats,transactions:loadTx,failures:loadFail,products:loadProd,mediapacks:loadMP,groups:loadGroups,coupons:loadCoupons,users:initUsers,trusted:loadTrusted,tickets:loadTickets,broadcast:loadBC,autoresponses:loadAR,deliver:loadDeliver,settings:loadSettings,ddds:loadDDDs};

function go(sec,el){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('s-'+sec)?.classList.add('on');
  if(el)el.classList.add('on');
  document.getElementById('pgTit').textContent=meta[sec]||sec;
  cur=sec;
  if(isMob())closeSB();
  if(loads[sec])loads[sec]();
}
function reloadCur(){if(loads[cur])loads[cur]();}

// ── HELPERS ───────────────────────────────────────────
function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtK(v){const n=parseFloat(v||0);return n>=1000?'R$'+(n/1000).toFixed(1)+'k':'R$'+fmt(n);}
function fmtD(d){if(!d)return'—';const dt=new Date(d);return dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function fmtDs(d){if(!d)return'—';return new Date(d).toLocaleDateString('pt-BR');}
function fmtR(v){return'R$ '+fmt(v);}
function tag(st){
  if(!st)return'';
  const L={pending:'pending',proof_sent:'comprov.',validated:'validado',approved:'aprovado',delivered:'entregue',delivery_failed:'falha',rejected:'rejeitado',reversed:'revertido',expired:'expirado',cancelled:'cancelado',active:'ativo',inactive:'inativo',blocked:'bloqueado',open:'aberto',in_progress:'andamento',resolved:'resolvido',closed:'fechado',sending:'enviando',draft:'rascunho',pending_broadcast:'agendado',sent:'enviado',admin:'admin',creator:'creator',urgent:'urgente',high:'alta',normal:'normal',low:'baixa'};
  return'<span class="tag t-'+st+'">'+(L[st]||st)+'</span>';
}
function dli(l,r){return'<div class="dli">'+l+r+'</div>';}
function toast(msg,type='ok'){
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML='<div class="tline"></div><span>'+msg+'</span>';
  document.getElementById('toasts').appendChild(t);
  setTimeout(()=>t.remove(),3500);
}
function openM(id){document.getElementById(id)?.classList.add('on');}
function closeM(id){document.getElementById(id)?.classList.remove('on');}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('on');}));
function pager(id,curP,total,fn){
  if(!total||total<=1){document.getElementById(id).innerHTML='';return;}
  let h='<button class="pg" onclick="'+fn+'('+Math.max(1,curP-1)+')" '+(curP<=1?'disabled':'')+'>←</button>';
  for(let i=Math.max(1,curP-2);i<=Math.min(total,curP+2);i++)h+='<button class="pg '+(i===curP?'on':'')+'" onclick="'+fn+'('+i+')">'+i+'</button>';
  h+='<button class="pg" onclick="'+fn+'('+Math.min(total,curP+1)+')" '+(curP>=total?'disabled':'')+'>→</button><span class="pg-inf">'+curP+'/'+total+'</span>';
  document.getElementById(id).innerHTML=h;
}

// ── DASHBOARD ─────────────────────────────────────────
async function loadDash(){
  const d=await api('dashboard');if(d.error)return;
  const pend=d.pendentes||0,fail=d.failures||0,tick=d.tickets||0;
  // Sidebar badges
  document.getElementById('cnt-pend').textContent=pend;
  document.getElementById('cnt-fail').textContent=fail;
  document.getElementById('cnt-tick').textContent=tick;
  document.getElementById('cnt-trust').textContent=d.trustedPending||0;
  document.getElementById('dTxM').textContent=(d.transactions||0).toLocaleString()+' total';
  // Mobile urgent
  document.getElementById('m-pend').textContent=pend;
  document.getElementById('m-fail').textContent=fail;
  document.getElementById('m-tick').textContent=tick;
  document.getElementById('m-hoje').textContent=fmtK(d.vendasHoje);
  // Quick actions badge
  document.getElementById('qa-pend').textContent=pend||'–';
  // Bottom nav badges
  const mbP=document.getElementById('mb-pend');mbP.textContent=pend;mbP.style.display=pend>0?'block':'none';
  const mbT=document.getElementById('mb-tick');mbT.textContent=tick;mbT.style.display=tick>0?'block':'none';
  const dbF=document.getElementById('db-fail');if(dbF){dbF.textContent=fail;dbF.style.display=fail>0?'block':'none';}
  // KPI data
  const kd=[
    {l:'Receita total',v:'R$ '+fmt(d.totalSales),s:'acumulado',c:'v'},
    {l:'Hoje',v:'R$ '+fmt(d.vendasHoje),s:new Date().toLocaleDateString('pt-BR'),c:'g'},
    {l:'Semana',v:'R$ '+fmt(d.vendasSemana),s:'últimos 7 dias',c:''},
    {l:'Pendentes',v:pend,s:'aguardando revisão',c:pend>0?'w':''},
    {l:'Usuários',v:(d.users||0).toLocaleString(),s:'cadastrados',c:''},
    {l:'Falhas',v:fail,s:'entrega',c:fail>0?'r':''},
    {l:'Tickets',v:tick,s:'suporte aberto',c:tick>0?'w':''},
    {l:'Confiáveis',v:d.trustedPending||0,s:'score < 80',c:(d.trustedPending||0)>0?'v':''}
  ];
  const kh=kd.map(k=>'<div class="kpi"><div class="kpi-lbl">'+k.l+'</div><div class="kpi-v '+k.c+'">'+k.v+'</div><div class="kpi-s">'+k.s+'</div><div class="kpi-a"></div></div>').join('');
  document.getElementById('kpis').innerHTML=kh;
  document.getElementById('kpisM').innerHTML=kh;
  // Recent tx
  document.getElementById('dTx').innerHTML=(d.recentTx||[]).map(t=>dli(
    '<div><div class="mono" style="color:var(--fg);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">'+(t.txid||'').substring(0,22)+'…</div><div style="font-size:10px;color:var(--fg3);margin-top:1px">'+fmtD(t.created_at)+'</div></div>',
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><span class="mono" style="font-weight:600">'+fmtR(t.amount)+'</span>'+tag(t.status)+'</div>'
  )).join('')||'<div class="empty" style="padding:24px"><div class="et">sem transações</div></div>';
  // Recent users
  document.getElementById('dUsers').innerHTML=(d.recentUsers||[]).map(u=>dli(
    '<div><div style="font-weight:500">'+(u.first_name||'N/A')+(u.last_name?' '+u.last_name:'')+'</div><div class="mono" style="font-size:10px;color:var(--fg3);margin-top:1px">@'+(u.username||'—')+' · '+u.telegram_id+'</div></div>',
    '<div style="font-size:10px;font-family:\\'Geist Mono\\',monospace;color:var(--fg3)">'+fmtDs(u.created_at)+'</div>'
  )).join('')||'<div class="empty" style="padding:24px"><div class="et">sem usuários</div></div>';
}

// ── ANALYTICS ─────────────────────────────────────────
async function loadStats(){
  const d=await api('stats');if(d.error)return;
  const days=Object.keys(d.byDay||{}).sort().slice(-14);
  const maxR=Math.max(...days.map(k=>parseFloat(d.byDay[k])||0),1);
  document.getElementById('chartRev').innerHTML=days.map(k=>{const v=parseFloat(d.byDay[k])||0;const h=Math.max(3,Math.round((v/maxR)*52));return'<div class="bar" style="height:'+h+'px;background:linear-gradient(to top,#7c3aed,#db2777)" title="'+k+': R$'+fmt(v)+'"></div>';}).join('');
  document.getElementById('chartRevL').textContent='14 dias · R$ '+fmt(days.reduce((a,k)=>a+(parseFloat(d.byDay[k])||0),0))+' total';
  document.getElementById('chartSt').innerHTML=Object.entries(d.byStatus||{}).map(([st,cnt])=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line)">'+tag(st)+'<span class="mono" style="color:var(--fg)">'+cnt+'</span></div>').join('')||'<div class="empty" style="padding:20px"><div class="et">sem dados</div></div>';
  const ud=Object.keys(d.byDayUsers||{}).sort().slice(-14);
  const maxU=Math.max(...ud.map(k=>d.byDayUsers[k]||0),1);
  document.getElementById('chartUsr').innerHTML=ud.map(k=>{const v=d.byDayUsers[k]||0;const h=Math.max(3,Math.round((v/maxU)*52));return'<div class="bar" style="height:'+h+'px;background:linear-gradient(to top,#6366f1,#7c3aed)" title="'+k+': '+v+'"></div>';}).join('');
  document.getElementById('chartUsrL').textContent='14 dias · '+ud.reduce((a,k)=>a+(d.byDayUsers[k]||0),0)+' novos';
  document.getElementById('chartProd').innerHTML=(d.topProducts||[]).map(p=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line)"><span style="font-size:12px">'+(p.product_id||'N/A')+'</span><span class="mono" style="color:var(--fg3)">'+p.count+'×</span></div>').join('')||'<div class="empty" style="padding:20px"><div class="et">sem dados</div></div>';
}
async function recalcValues(){toast('Recalculando...','warn');const d=await api('recalculateValues',{method:'POST'});if(d.ok)toast('Recalculado — R$ '+fmt(d.total));else toast(d.error||'Erro','err');}

// ── TRANSAÇÕES ────────────────────────────────────────
async function loadTx(p){
  if(p!==undefined)pg.tx=p;
  const q=document.getElementById('txQ').value.trim();
  const st=document.getElementById('txSt').value;
  const ld='<div class="loader"><div class="spin"></div><span class="ltxt">carregando</span></div>';
  document.getElementById('txTable').innerHTML=ld;
  document.getElementById('txCards').innerHTML=ld;
  const d=await api('transactions',{params:{page:pg.tx,limit:20,status:st,search:q}});
  if(!d.data){document.getElementById('txTable').innerHTML='<div class="empty"><div class="et">erro ao carregar</div></div>';return;}
  // Desktop table
  const rows=d.data.map(t=>{
    const hp=t.proof_file_id||t.proof_file_url;
    const canA=['proof_sent','expired','pending'].includes(t.status);
    const canD=['approved','delivery_failed','validated'].includes(t.status);
    const canR=['delivered','validated'].includes(t.status);
    const tg=t.username?'https://t.me/'+t.username:'tg://user?id='+t.telegram_id;
    return'<tr><td><span class="mono trunc" style="display:block;font-size:10px;max-width:110px">'+(t.txid||'').substring(0,16)+'…</span></td>'
    +'<td class="hm"><a href="'+tg+'" target="_blank" class="mono" style="color:var(--violl)">'+t.telegram_id+'</a></td>'
    +'<td><b>'+fmtR(t.amount)+'</b>'+(t.coupon_id?'<span style="font-size:9px;margin-left:2px;opacity:.5">🏷</span>':'')+'</td>'
    +'<td>'+tag(t.status)+(hp?' <span style="font-size:9px;opacity:.6">📸</span>':'')+'</td>'
    +'<td class="hm" style="font-size:10px;color:var(--fg3)">'+fmtD(t.created_at)+'</td>'
    +'<td><div style="display:flex;gap:3px">'
    +(canA?'<button class="btn bg_ bxs" onclick="approveTx(\\''+t.txid+'\\')">✓</button><button class="btn br bxs" onclick="rejectTx(\\''+t.txid+'\\')">✗</button>':'')
    +(canD?'<button class="btn bd bxs" onclick="deliverTx(\\''+t.txid+'\\')">↓</button>':'')
    +(canR?'<button class="btn bw bxs" onclick="openRev(\\''+t.txid+'\\')">↩</button>':'')
    +'</div></td></tr>';
  }).join('');
  document.getElementById('txTable').innerHTML='<table><thead><tr><th>TXID</th><th class="hm">Telegram</th><th>Valor</th><th>Status</th><th class="hm">Data</th><th>Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--fg3)">nenhuma transação</td></tr>')+'</tbody></table>';
  // Mobile cards
  document.getElementById('txCards').innerHTML=d.data.map(t=>{
    const hp=t.proof_file_id||t.proof_file_url;
    const canA=['proof_sent','expired','pending'].includes(t.status);
    const canD=['approved','delivery_failed','validated'].includes(t.status);
    const canR=['delivered','validated'].includes(t.status);
    return'<div class="mrow"><div class="mr-top"><div><div class="mr-id">'+(t.txid||'').substring(0,18)+'…</div></div><div class="mr-val">'+fmtR(t.amount)+'</div></div>'
    +'<div class="mr-mid">'+tag(t.status)+(hp?'<span class="tag t-proof_sent">📸 comprovante</span>':'')+(t.coupon_id?'<span class="tag">🏷 cupom</span>':'')+'</div>'
    +'<div class="mr-bot"><div class="mr-date">'+fmtD(t.created_at)+'</div><div class="mr-acts">'
    +(canA?'<button class="btn bg_ bxs" onclick="approveTx(\\''+t.txid+'\\')">✓ Aprovar</button><button class="btn br bxs" onclick="rejectTx(\\''+t.txid+'\\')">✗</button>':'')
    +(canD?'<button class="btn bd bxs" onclick="deliverTx(\\''+t.txid+'\\')">↓ Entregar</button>':'')
    +(canR?'<button class="btn bw bxs" onclick="openRev(\\''+t.txid+'\\')">↩</button>':'')
    +'</div></div></div>';
  }).join('')||'<div class="empty"><div class="et">nenhuma transação</div></div>';
  pager('txPager',d.page,d.pages,'loadTx');
}
async function approveTx(txid){await api('approveTransaction',{method:'POST',body:{txid}});toast('✓ Aprovada!');loadTx();loadDash();}
async function rejectTx(txid){if(!confirm('Rejeitar?'))return;await api('rejectTransaction',{method:'POST',body:{txid}});toast('Rejeitada.','warn');loadTx();}
async function deliverTx(txid){await api('deliverByTxid',{method:'POST',body:{txid}});toast('↓ Entregue.');loadTx();}
function openRev(txid){document.getElementById('revTxid').value=txid;document.getElementById('revLbl').textContent=txid.substring(0,24)+'…';document.getElementById('revReason').value='';openM('mReverse');}
async function doReverse(){const txid=document.getElementById('revTxid').value,r=document.getElementById('revReason').value;await api('reverseTransaction',{method:'POST',body:{txid,reason:r}});closeM('mReverse');toast('↩ Revertida.','warn');loadTx();}
function setTxPg(p){loadTx(p);}

// ── FALHAS ────────────────────────────────────────────
async function loadFail(){
  const d=await api('deliveryFailures');
  const empty='<div class="empty"><div class="ei">✓</div><div class="et">nenhuma falha</div></div>';
  if(!d.data?.length){document.getElementById('failTable').innerHTML=empty;document.getElementById('failCards').innerHTML='';return;}
  document.getElementById('failTable').innerHTML='<table><thead><tr><th>TXID</th><th class="hm">Telegram</th><th>Valor</th><th class="hm">Erro</th><th>Tent.</th><th>Ação</th></tr></thead><tbody>'
    +d.data.map(f=>'<tr><td class="mono" style="font-size:10px">'+(f.txid||'').substring(0,16)+'…</td>'
    +'<td class="hm"><a href="tg://user?id='+f.telegram_id+'" class="mono" style="color:var(--violl)">'+f.telegram_id+'</a></td>'
    +'<td><b>'+fmtR(f.amount)+'</b></td>'
    +'<td class="hm mono" style="font-size:10px;color:var(--fg3)">'+(f.delivery_error_type||'unknown')+'</td>'
    +'<td class="mono">'+(f.delivery_attempts||0)+'×</td>'
    +'<td><div style="display:flex;gap:4px"><button class="btn bd bxs" onclick="retryDel(\\''+f.txid+'\\')">↻</button><button class="btn bg_ bxs" onclick="forceDel(\\''+f.txid+'\\')">✓</button></div></td></tr>'
    ).join('')+'</tbody></table>';
  document.getElementById('failCards').innerHTML=d.data.map(f=>'<div class="mrow"><div class="mr-top"><div><div class="mr-id">'+(f.txid||'').substring(0,18)+'…</div><div style="font-size:10px;color:var(--fg3);margin-top:2px">'+(f.delivery_error_type||'unknown')+' · '+(f.delivery_attempts||0)+'× tent.</div></div><div class="mr-val">'+fmtR(f.amount)+'</div></div><div class="mr-bot"><div class="mr-date">'+fmtD(f.last_delivery_attempt_at)+'</div><div class="mr-acts"><button class="btn bd bxs" onclick="retryDel(\\''+f.txid+'\\')">↻ Tentar</button><button class="btn bg_ bxs" onclick="forceDel(\\''+f.txid+'\\')">✓ Forçar</button></div></div></div>').join('');
}
async function retryDel(txid){await api('retryDelivery',{method:'POST',body:{txid}});toast('↻ Tentando novamente.');loadFail();}
async function forceDel(txid){await api('forceDelivered',{method:'POST',body:{txid}});toast('✓ Marcado entregue.');loadFail();loadDash();}

// ── PRODUTOS ──────────────────────────────────────────
async function loadProd(){
  const d=await api('products',{params:{includeInactive:true}});
  if(!d.data?.length){document.getElementById('prodTable').innerHTML='<div class="empty"><div class="ei">▣</div><div class="et">nenhum produto</div></div>';return;}
  document.getElementById('prodTable').innerHTML='<table><thead><tr><th>Nome</th><th class="hm">ID</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead><tbody>'
    +d.data.map(p=>'<tr><td><b>'+p.name+'</b></td><td class="hm mono">'+p.product_id+'</td><td class="mono">'+fmtR(p.price)+'</td><td>'+tag(p.is_active?'active':'inactive')+'</td><td><div style="display:flex;gap:4px"><button class="btn bd bxs" onclick="toggleProd(\\''+p.product_id+'\\','+(!p.is_active)+')">'+(p.is_active?'Pausar':'Ativar')+'</button><button class="btn br bxs" onclick="delProd(\\''+p.product_id+'\\')">✕</button></div></td></tr>').join('')+'</tbody></table>';
}
async function saveProd(){const b={product_id:document.getElementById('p_id').value,name:document.getElementById('p_name').value,description:document.getElementById('p_desc').value,price:document.getElementById('p_price').value,delivery_type:document.getElementById('p_type').value,delivery_url:document.getElementById('p_url').value};const d=await api('createProduct',{method:'POST',body:b});if(d.ok){closeM('mProd');toast('Produto criado.');loadProd();}else toast(d.error||'Erro','err');}
async function toggleProd(id,a){await api('toggleProduct',{method:'POST',body:{product_id:id,is_active:a}});toast(a?'Ativado.':'Pausado.','warn');loadProd();}
async function delProd(id){if(!confirm('Remover produto "'+id+'"?'))return;await api('deleteProduct',{method:'DELETE',params:{product_id:id}});toast('Removido.','warn');loadProd();}

// ── MEDIA PACKS ───────────────────────────────────────
async function loadMP(){
  const d=await api('mediaPacks');
  if(!d.data?.length){document.getElementById('mpTable').innerHTML='<div class="empty"><div class="ei">▤</div><div class="et">nenhum media pack</div></div>';return;}
  document.getElementById('mpTable').innerHTML='<table><thead><tr><th>Nome</th><th class="hm">Pack ID</th><th>Preço</th><th class="hm">Entrega</th><th>Status</th><th>Ação</th></tr></thead><tbody>'
    +d.data.map(p=>'<tr><td><b>'+p.name+'</b></td><td class="hm mono">'+p.pack_id+'</td><td class="mono">'+fmtR(p.price)+'</td><td class="hm mono">'+(p.items_per_delivery||3)+'/entrega</td><td>'+tag(p.is_active?'active':'inactive')+'</td><td><button class="btn bd bxs" onclick="viewMP(\\''+p.pack_id+'\\',\\''+p.name.replace(/'/g,"\\\\'")+'\\')">Ver itens</button></td></tr>').join('')+'</tbody></table>';
}
async function viewMP(packId,name){
  document.getElementById('mMPTit').textContent=name;
  document.getElementById('mMPItems').innerHTML='<div class="loader"><div class="spin"></div></div>';
  document.getElementById('mMPInfo').textContent='';
  document.getElementById('mMPCnt').textContent='';
  openM('mMP');
  const d=await api('mediaItems',{params:{pack_id:packId}});
  if(!d.data?.length){document.getElementById('mMPItems').innerHTML='<div class="empty"><div class="et">sem itens</div></div>';return;}
  document.getElementById('mMPCnt').textContent='('+d.data.length+')';
  document.getElementById('mMPItems').innerHTML=d.data.map(item=>{
    if(item.file_url&&(item.file_type||'').startsWith('image'))
      return'<div class="mthumb"><img src="'+item.file_url+'" loading="lazy" alt="'+item.file_name+'"></div>';
    const ico={'video':'🎬','audio':'🎵','document':'📄'}[item.file_type]||'📁';
    return'<div class="mthumb">'+ico+'<br><span>'+((item.file_name||'').substring(0,10)||item.file_type||'—')+'</span></div>';
  }).join('');
}

// ── GRUPOS ────────────────────────────────────────────
async function loadGroups(){
  const d=await api('groups',{params:{includeInactive:true}});
  if(!d.data?.length){document.getElementById('groupTable').innerHTML='<div class="empty"><div class="ei">◎</div><div class="et">nenhum grupo</div></div>';return;}
  document.getElementById('groupTable').innerHTML='<table><thead><tr><th>Nome</th><th class="hm">ID Telegram</th><th>Preço</th><th class="hm">Dias</th><th>Status</th><th>Ações</th></tr></thead><tbody>'
    +d.data.map(g=>'<tr><td><b>'+(g.name||'Sem nome')+'</b></td><td class="hm mono" style="font-size:10px">'+g.group_id+'</td><td class="mono">'+fmtR(g.price)+'</td><td class="hm mono">'+(g.access_days||'∞')+'d</td><td>'+tag(g.is_active?'active':'inactive')+'</td><td><div style="display:flex;gap:4px"><button class="btn bd bxs" onclick="toggleGrp(\\''+g.group_id+'\\','+(!g.is_active)+')">'+(g.is_active?'Pausar':'Ativar')+'</button><button class="btn br bxs" onclick="delGrp(\\''+g.group_id+'\\')">✕</button></div></td></tr>').join('')+'</tbody></table>';
}
async function saveGroup(){const b={group_id:document.getElementById('g_id').value,name:document.getElementById('g_name').value,invite_link:document.getElementById('g_link').value,price:document.getElementById('g_price').value,access_days:document.getElementById('g_days').value};const d=await api('createGroup',{method:'POST',body:b});if(d.ok){closeM('mGroup');toast('Grupo criado.');loadGroups();}else toast(d.error||'Erro','err');}
async function toggleGrp(id,a){await api('toggleGroup',{method:'POST',body:{group_id:id,is_active:a}});toast(a?'Ativado.':'Pausado.','warn');loadGroups();}
async function delGrp(id){if(!confirm('Remover grupo?'))return;await api('deleteGroup',{method:'DELETE',params:{group_id:id}});toast('Removido.','warn');loadGroups();}

// ── CUPONS ────────────────────────────────────────────
async function loadCoupons(){
  const d=await api('coupons',{params:{includeInactive:true}});
  if(!d.data?.length){document.getElementById('couponTable').innerHTML='<div class="empty"><div class="ei">◈</div><div class="et">nenhum cupom</div></div>';return;}
  document.getElementById('couponTable').innerHTML='<table><thead><tr><th>Código</th><th>Desconto</th><th class="hm">Usos</th><th class="hm">Expira</th><th>Status</th><th>Ações</th></tr></thead><tbody>'
    +d.data.map(c=>'<tr><td><b class="mono">'+c.code+'</b></td><td class="mono">'+c.discount_percent+'%</td><td class="hm mono">'+(c.usage_count||0)+(c.max_uses?'/'+c.max_uses:'')+'</td><td class="hm" style="font-size:10px;color:var(--fg3)">'+(c.expires_at?fmtDs(c.expires_at):'sem data')+'</td><td>'+tag(c.is_active?'active':'inactive')+'</td><td><div style="display:flex;gap:4px"><button class="btn bd bxs" onclick="toggleCoup(\\''+c.id+'\\','+(!c.is_active)+')">'+(c.is_active?'Pausar':'Ativar')+'</button><button class="btn br bxs" onclick="delCoup(\\''+c.id+'\\')">✕</button></div></td></tr>').join('')+'</tbody></table>';
}
async function saveCoupon(){
  const pr=await api('products');
  const b={code:document.getElementById('c_code').value.toUpperCase(),discount_percent:document.getElementById('c_disc').value,max_uses:document.getElementById('c_uses').value||null,product_id:document.getElementById('c_prod').value||null,expires_at:document.getElementById('c_exp').value||null};
  const d=await api('createCoupon',{method:'POST',body:b});if(d.ok){closeM('mCoupon');toast('Cupom criado.');loadCoupons();}else toast(d.error||'Erro','err');
}
async function toggleCoup(id,a){await api('toggleCoupon',{method:'POST',body:{id,is_active:a}});toast(a?'Ativado.':'Pausado.','warn');loadCoupons();}
async function delCoup(id){if(!confirm('Remover cupom?'))return;await api('deleteCoupon',{method:'DELETE',params:{id}});toast('Removido.','warn');loadCoupons();}

// ── USUÁRIOS (infinite scroll) ────────────────────────
function initUsers(){
  uState={loading:false,done:false,offset:0,limit:30,q:document.getElementById('userQ').value,bl:document.getElementById('userBl').value};
  document.getElementById('usersBody').innerHTML='';
  document.getElementById('usersEnd').style.display='none';
  loadMoreUsers();
}
function resetUserScroll(){
  uState.offset=0;uState.done=false;uState.q=document.getElementById('userQ').value;uState.bl=document.getElementById('userBl').value;
  document.getElementById('usersBody').innerHTML='';
  document.getElementById('usersEnd').style.display='none';
  loadMoreUsers();
}
async function loadMoreUsers(){
  if(uState.loading||uState.done)return;
  uState.loading=true;
  document.getElementById('usersLdr').style.display='flex';
  const d=await api('usersScroll',{params:{offset:uState.offset,limit:uState.limit,search:uState.q,blocked:uState.bl}});
  document.getElementById('usersLdr').style.display='none';
  uState.loading=false;
  if(!d.data?.length){uState.done=true;document.getElementById('usersEnd').style.display='block';document.getElementById('userLbl').textContent=(uState.offset===0?'0 usuários':'');return;}
  uState.offset+=d.data.length;
  if(uState.offset>=d.total){uState.done=true;document.getElementById('usersEnd').style.display='block';}
  document.getElementById('userLbl').textContent=d.total.toLocaleString()+' total';
  const rows=d.data.map(u=>{
    const nm=(u.first_name||'N/A')+(u.last_name?' '+u.last_name:'');
    const tg=u.username?'https://t.me/'+u.username:'tg://user?id='+u.telegram_id;
    const ph=u.phone_number?'<a href="tel:'+u.phone_number+'" class="mono" style="color:var(--fg3);font-size:11px">'+u.phone_number+'</a>':'<span style="color:var(--fg3)">—</span>';
    return'<tr><td><a onclick="viewUser(\\''+u.telegram_id+'\\')" style="cursor:pointer;font-weight:500">'+nm+'</a></td>'
      +'<td class="hm"><a href="'+tg+'" target="_blank" class="mono" style="color:var(--violl);font-size:11px">@'+(u.username||'—')+'</a></td>'
      +'<td class="hm mono" style="font-size:11px">'+u.telegram_id+'</td>'
      +'<td class="hm">'+ph+'</td>'
      +'<td>'+(u.is_blocked?tag('blocked'):tag('active'))+(u.is_admin?' '+tag('admin'):'')+(u.is_creator?' '+tag('creator'):'')+'</td>'
      +'<td><div style="display:flex;gap:4px">'
      +(u.is_blocked?'<button class="btn bd bxs" onclick="unblockUser(\\''+u.telegram_id+'\\')">Desbloquear</button>':'<button class="btn br bxs" onclick="blockUser(\\''+u.telegram_id+'\\')">Bloquear</button>')
      +'</div></td></tr>';
  }).join('');
  document.getElementById('usersBody').insertAdjacentHTML('beforeend',rows);
}
async function viewUser(tid){
  openM('mUser');
  document.getElementById('udName').textContent='Carregando…';
  document.getElementById('udTags').innerHTML='';
  document.getElementById('udTx').innerHTML='<div class="loader" style="padding:20px"><div class="spin"></div></div>';
  const d=await api('userDetail',{params:{telegram_id:tid}});
  if(!d.user){closeM('mUser');toast('Usuário não encontrado','err');return;}
  const u=d.user;
  const nm=(u.first_name||'N/A')+(u.last_name?' '+u.last_name:'');
  document.getElementById('udName').textContent=nm;
  const tg=u.username?'https://t.me/'+u.username:'tg://user?id='+u.telegram_id;
  document.getElementById('udMeta').innerHTML='<a href="'+tg+'" target="_blank" class="mono" style="color:var(--violl);font-size:12px">@'+(u.username||'—')+'</a> · <span class="mono" style="font-size:12px">'+u.telegram_id+'</span>';
  const tags=[];
  if(u.is_blocked)tags.push(tag('blocked'));
  if(u.is_admin)tags.push(tag('admin'));
  if(u.is_creator)tags.push(tag('creator'));
  if(!u.is_blocked&&!u.is_admin&&!u.is_creator)tags.push(tag('active'));
  document.getElementById('udTags').innerHTML=tags.join('');
  document.getElementById('udCreated').textContent=fmtDs(u.created_at);
  document.getElementById('udPhone').innerHTML=u.phone_number?'<a href="tel:'+u.phone_number+'" style="color:var(--violl)" class="mono">'+u.phone_number+'</a>':'—';
  document.getElementById('udTx').innerHTML=(d.transactions||[]).map(t=>dli('<div class="mono" style="font-size:11px;color:var(--fg3)">'+(t.txid||'').substring(0,20)+'…</div>','<div style="display:flex;gap:6px;align-items:center"><span class="mono">'+fmtR(t.amount)+'</span>'+tag(t.status)+'</div>')).join('')||'<div class="empty" style="padding:16px"><div class="et">sem transações</div></div>';
  const acts=document.getElementById('udActs');
  acts.innerHTML='<button class="btn bgh" onclick="closeM(\\'mUser\\')">Fechar</button>';
  if(u.is_blocked)acts.innerHTML+='<button class="btn bg_ bfl" onclick="unblockUser(\\''+u.telegram_id+'\\')">✓ Desbloquear</button>';
  else acts.innerHTML+='<button class="btn br bfl" onclick="blockUser(\\''+u.telegram_id+'\\')">Bloquear usuário</button>';
}
async function blockUser(tid){await api('blockUser',{method:'POST',body:{telegram_id:tid}});toast('Bloqueado.','warn');closeM('mUser');resetUserScroll();}
async function unblockUser(tid){await api('unblockUser',{method:'POST',body:{telegram_id:tid}});toast('Desbloqueado.');closeM('mUser');resetUserScroll();}
function setUsersPg(p){uState.offset=(p-1)*uState.limit;loadMoreUsers();}

// ── CONFIÁVEIS ────────────────────────────────────────
async function loadTrusted(){
  const d=await api('trustedUsers');
  if(!d.data?.length){document.getElementById('trustedTable').innerHTML='<div class="empty"><div class="ei">★</div><div class="et">nenhum usuário confiável</div></div>';return;}
  document.getElementById('trustedTable').innerHTML='<table><thead><tr><th>Usuário</th><th>Trust Score</th><th class="hm">Aprovadas</th><th class="hm">Rejeitadas</th><th class="hm">Auto aprova</th><th>Ação</th></tr></thead><tbody>'
    +d.data.map(u=>{
      const sc=parseFloat(u.trust_score||0);
      const cl=sc>=80?'#10b981':sc>=50?'#f59e0b':'#ef4444';
      const tg=u.username?'https://t.me/'+u.username:'tg://user?id='+u.telegram_id;
      return'<tr><td><a href="'+tg+'" target="_blank" style="font-weight:500;color:var(--fg)">'+u.telegram_id+'</a>'+(u.username?'<br><span class="mono" style="font-size:10px;color:var(--violl)">@'+u.username+'</span>':'')+'</td>'
      +'<td><div style="min-width:80px"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span class="mono" style="font-size:11px;color:'+cl+'">'+sc.toFixed(0)+'</span></div><div class="tbar"><div class="tfill" style="width:'+sc+'%;background:'+cl+'"></div></div></div></td>'
      +'<td class="hm mono">'+( u.approved_transactions||0)+'</td>'
      +'<td class="hm mono">'+(u.rejected_transactions||0)+'</td>'
      +'<td class="hm mono">'+(u.auto_approve_threshold||'—')+'</td>'
      +'<td><button class="btn br bxs" onclick="remTrust(\\''+u.telegram_id+'\\')">Remover</button></td></tr>';
    }).join('')+'</tbody></table>';
}
async function remTrust(tid){if(!confirm('Remover da lista de confiáveis?'))return;await api('removeTrustedUser',{method:'DELETE',params:{telegram_id:tid}});toast('Removido.','warn');loadTrusted();}

// ── TICKETS ───────────────────────────────────────────
async function loadTickets(p){
  if(p!==undefined)pg.tick=p;
  const st=document.getElementById('tickSt').value;
  const pri=document.getElementById('tickPri').value;
  const ld='<div class="loader"><div class="spin"></div></div>';
  document.getElementById('tickTable').innerHTML=ld;
  document.getElementById('tickCards').innerHTML=ld;
  const d=await api('tickets',{params:{page:pg.tick,limit:20,status:st,priority:pri}});
  if(!d.data?.length){
    const emp='<div class="empty"><div class="ei">▧</div><div class="et">nenhum ticket</div></div>';
    document.getElementById('tickTable').innerHTML=emp;document.getElementById('tickCards').innerHTML='';return;
  }
  document.getElementById('tickTable').innerHTML='<table><thead><tr><th>#</th><th>Usuário</th><th class="hm">Assunto</th><th>Prioridade</th><th>Status</th><th>Ação</th></tr></thead><tbody>'
    +d.data.map(t=>'<tr><td class="mono" style="font-size:11px">'+t.id+'</td>'
    +'<td class="mono" style="font-size:11px">'+t.telegram_id+'</td>'
    +'<td class="hm" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(t.subject||'—')+'</td>'
    +'<td>'+tag(t.priority||'normal')+'</td>'
    +'<td>'+tag(t.status)+'</td>'
    +'<td><button class="btn bd bxs" onclick="viewTicket(\\''+t.id+'\\')">Ver</button></td></tr>'
    ).join('')+'</tbody></table>';
  document.getElementById('tickCards').innerHTML=d.data.map(t=>'<div class="mrow" onclick="viewTicket(\\''+t.id+'\\')"><div class="mr-top"><div><div class="mr-id">#'+t.id+' · '+t.telegram_id+'</div><div style="font-size:12px;font-weight:500;margin-top:2px;color:var(--fg)">'+(t.subject||'sem assunto')+'</div></div></div><div class="mr-mid">'+tag(t.status)+tag(t.priority||'normal')+'</div><div class="mr-bot"><div class="mr-date">'+fmtD(t.created_at)+'</div></div></div>').join('');
  pager('tickPager',d.page,d.pages,'loadTickets');
}
async function viewTicket(id){
  openM('mTicket');
  document.getElementById('mTickMsgs').innerHTML='<div class="loader"><div class="spin"></div></div>';
  const d=await api('ticketMessages',{params:{ticket_id:id}});
  const t=d.ticket;if(!t)return;
  document.getElementById('mTickTit').textContent='Ticket #'+t.id+(t.subject?' — '+t.subject:'');
  document.getElementById('mTickInfo').innerHTML=[tag(t.status),tag(t.priority||'normal'),'<span class="mono">'+t.telegram_id+'</span>','<span>'+fmtD(t.created_at)+'</span>'].join('');
  document.getElementById('mTickMsgs').innerHTML=(d.messages||[]).map(m=>'<div class="msg '+(m.sender_type==='admin'?'adm':'usr')+'">'+m.message+'<div class="msg-m">'+(m.sender_type==='admin'?'Admin · ':'')+fmtD(m.created_at)+'</div></div>').join('')||'<div style="text-align:center;padding:20px;color:var(--fg3);font-size:12px">sem mensagens</div>';
  const btnPT=document.getElementById('btnPT');
  btnPT.style.display=t.status==='open'?'inline-flex':'none';
  btnPT.onclick=()=>{progressT(id);};
  document.getElementById('btnCT').onclick=()=>{closeT(id);};
  document.getElementById('btnRT').onclick=()=>{resolveT(id);};
  document.getElementById('tickReply').value='';
}
async function replyTicket(){
  const ticket_id=document.querySelector('#mTickTit').textContent.match(/#(\\d+)/)?.[1];
  const message=document.getElementById('tickReply').value.trim();
  if(!ticket_id||!message)return;
  await api('replyTicket',{method:'POST',body:{ticket_id,message}});
  document.getElementById('tickReply').value='';toast('Resposta enviada.');viewTicket(ticket_id);
}
async function progressT(id){await api('progressTicket',{method:'POST',body:{ticket_id:id}});toast('Em andamento.','warn');closeM('mTicket');loadTickets();}
async function closeT(id){await api('closeTicket',{method:'POST',body:{ticket_id:id}});toast('Fechado.','warn');closeM('mTicket');loadTickets();}
async function resolveT(id){await api('resolveTicket',{method:'POST',body:{ticket_id:id}});toast('✓ Resolvido!');closeM('mTicket');loadTickets();}
function setTickPg(p){loadTickets(p);}

// ── BROADCAST ─────────────────────────────────────────
async function loadBC(){
  const d=await api('broadcasts');
  if(!d.data?.length){document.getElementById('bcList').innerHTML='<div class="empty"><div class="ei">◎</div><div class="et">nenhuma campanha</div></div>';return;}
  const colDot={sending:'#10b981',sent:'#34d399',pending_broadcast:'#a78bfa',draft:'#606080',failed:'#f87171'};
  document.getElementById('bcList').innerHTML=d.data.map(b=>'<div class="bc"><div class="bc-dot" style="background:'+(colDot[b.status]||'#606080')+'"></div><div class="bc-body"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><b style="font-size:13px">'+(b.campaign_name||'Sem nome')+'</b>'+tag(b.status)+'</div><div style="font-size:11px;color:var(--fg3);margin:4px 0">'+fmtD(b.created_at)+(b.target_audience?' · '+b.target_audience:'')+(b.coupon_code?' · 🏷'+b.coupon_code:'')+'</div><div style="font-size:11px;color:var(--fg3)">✓ '+(b.success_count||0)+' · ✗ '+(b.failed_count||0)+'</div><div style="margin-top:8px"><button class="btn bd bxs" onclick="viewBC(\\''+b.id+'\\')">Detalhes</button>'+(b.status==='sending'||b.status==='pending_broadcast'?' <button class="btn br bxs" onclick="cancelBC(\\''+b.id+'\\')">Cancelar</button>':'')+'</div></div></div>').join('');
}
async function viewBC(id){
  const d=await api('broadcasts');
  const b=(d.data||[]).find(x=>x.id==id);if(!b)return;
  document.getElementById('mBCTit').textContent=b.campaign_name||'Campanha #'+id;
  document.getElementById('mBCBody').innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+tag(b.status)+(b.target_audience?'<span class="tag">'+b.target_audience+'</span>':'')+(b.coupon_code?'<span class="tag t-pending">🏷 '+b.coupon_code+'</span>':'')+'</div><div style="font-size:12px;color:var(--fg3);margin-bottom:8px">✓ '+(b.success_count||0)+' entregues &nbsp;·&nbsp; ✗ '+(b.failed_count||0)+' falhas</div>'+(b.message?'<div style="font-size:11px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Mensagem</div><div style="background:var(--s3);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:200px;overflow-y:auto">'+b.message+'</div>':'');
  const btnC=document.getElementById('btnCBC');
  btnC.style.display=(b.status==='sending'||b.status==='pending_broadcast')?'inline-flex':'none';
  btnC.onclick=()=>{cancelBC(id);closeM('mBC');};
  openM('mBC');
}
async function cancelBC(id){if(!confirm('Cancelar campanha?'))return;await api('cancelBroadcast',{method:'POST',body:{id}});toast('Campanha cancelada.','warn');loadBC();}

// ── AUTO RESPOSTAS ────────────────────────────────────
async function loadAR(){
  const d=await api('autoResponses');
  if(!d.data?.length){document.getElementById('arTable').innerHTML='<div class="empty"><div class="ei">◈</div><div class="et">nenhuma resposta automática</div></div>';return;}
  document.getElementById('arTable').innerHTML='<table><thead><tr><th>Keyword</th><th class="hm">Resposta</th><th class="hm">Prior.</th><th>Status</th><th>Ação</th></tr></thead><tbody>'
    +d.data.map(r=>'<tr><td><b>'+r.keyword+'</b></td><td class="hm" style="font-size:11px;color:var(--fg3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.response+'</td><td class="hm mono">'+r.priority+'</td><td>'+tag(r.is_active?'active':'inactive')+'</td><td><button class="btn br bxs" onclick="delAR(\\''+r.id+'\\')">✕</button></td></tr>').join('')+'</tbody></table>';
}
async function saveAR(){const b={keyword:document.getElementById('ar_kw').value,response:document.getElementById('ar_resp').value,priority:document.getElementById('ar_pri').value};const d=await api('createAutoResponse',{method:'POST',body:b});if(d.ok){closeM('mAR');toast('Criada.');loadAR();}else toast(d.error||'Erro','err');}
async function delAR(id){if(!confirm('Remover resposta?'))return;await api('deleteAutoResponse',{method:'DELETE',params:{id}});toast('Removida.','warn');loadAR();}

// ── ENTREGA MANUAL ────────────────────────────────────
async function loadDeliver(){
  const d=await api('manualDeliverOptions');
  delData.product=(d.products||[]);
  delData.mediapack=(d.mediapacks||[]);
  delData.group=(d.groups||[]);
  updateDelProduct();
}
function updateDelProduct(){
  const type=document.getElementById('delType').value;
  const items=delData[type]||[];
  const sel=document.getElementById('delProduct');
  sel.innerHTML=items.length?items.map(i=>'<option value="'+(i.product_id||i.pack_id||i.group_id)+'">'+(i.name||i.product_id||i.pack_id)+'</option>').join(''):'<option>Nenhum disponível</option>';
}
async function lookupDelUser(){
  const tid=document.getElementById('delUserId').value;
  if(!tid)return;
  const d=await api('userDetail',{params:{telegram_id:tid}});
  const box=document.getElementById('delUserInfo');
  if(!d.user){box.style.display='block';box.innerHTML='<span style="color:var(--danger)">❌ Usuário não encontrado</span>';return;}
  const u=d.user;
  box.style.display='block';
  box.innerHTML='<b>'+(u.first_name||'N/A')+(u.last_name?' '+u.last_name:'')+'</b>'+(u.username?' @'+u.username:'')+(u.is_blocked?' <span style="color:var(--danger)">(bloqueado)</span>':'');
}
async function doManualDeliver(){
  const tid=document.getElementById('delUserId').value;
  const type=document.getElementById('delType').value;
  const item_id=document.getElementById('delProduct').value;
  if(!tid||!item_id)return toast('Preencha todos os campos','err');
  const d=await api('manualDeliver',{method:'POST',body:{telegram_id:tid,type,item_id}});
  if(d.ok)toast('✓ Entregue com sucesso!');
  else toast(d.error||'Erro na entrega','err');
}

// ── CONFIGURAÇÕES ─────────────────────────────────────
async function loadSettings(){
  const d=await api('settings');
  const s=d.settings||{};
  document.getElementById('pixKey').value=s.pix_key||'';
  document.getElementById('supportLink').value=s.support_contact||'';
  document.getElementById('creatorId').value=s.creator_telegram_id||'';
  document.getElementById('creator2Id').value=s.creator2_telegram_id||'';
  const cb=document.getElementById('bcCoupEnabled');
  if(cb)cb.checked=(s.broadcast_coupon_enabled==='true');
  // Status da loja
  const shopOn=s.shop_enabled!=='false';
  _renderShopStatus(shopOn);
}
function _renderShopStatus(on){
  const dot=document.getElementById('shopDot');
  const txt=document.getElementById('shopStatusTxt');
  const btn=document.getElementById('shopToggleBtn');
  const hint=document.getElementById('shopHint');
  const block=document.getElementById('shopBlock');
  if(!dot)return;
  if(on){
    dot.style.background='var(--ok)';
    dot.style.boxShadow='0 0 6px #10b98166';
    txt.textContent='Loja ABERTA';
    txt.style.color='var(--ok)';
    btn.textContent='🔒 Fechar loja';
    btn.className='btn br bxs';
    block.style.borderColor='';
    if(hint)hint.textContent='Usuários podem ver e comprar produtos normalmente.';
  }else{
    dot.style.background='var(--danger)';
    dot.style.boxShadow='0 0 6px #ef444466';
    txt.textContent='Loja FECHADA';
    txt.style.color='var(--danger)';
    btn.textContent='🟢 Abrir loja';
    btn.className='btn bg_ bxs';
    block.style.borderColor='#ef444440';
    if(hint)hint.textContent='Nenhum usuário consegue comprar. Somente suporte disponível.';
  }
}
async function toggleShop(){
  const dot=document.getElementById('shopDot');
  if(!dot)return;
  // Descobrir estado atual pelo texto do botão
  const btn=document.getElementById('shopToggleBtn');
  const isOpen=btn.textContent.includes('Fechar');
  const newVal=isOpen?'false':'true';
  const msg=isOpen?'Loja fechada. Compras desativadas.':'Loja aberta. Compras ativadas!';
  btn.disabled=true;
  btn.textContent='Salvando...';
  const d=await api('saveSetting',{method:'POST',body:{key:'shop_enabled',value:newVal}});
  btn.disabled=false;
  if(d.ok){
    _renderShopStatus(newVal==='true');
    toast(msg, isOpen?'warn':'ok');
  }else{
    toast(d.error||'Erro ao salvar','err');
    _renderShopStatus(isOpen); // reverter visual
  }
}
async function saveSetting(key,value,msg){
  if(value===undefined||value===''){toast('Valor não pode ser vazio','err');return;}
  await api('saveSetting',{method:'POST',body:{key,value:String(value)}});
  toast(msg||'Salvo.');
}
async function saveCreatorIds(){
  const v1=document.getElementById('creatorId').value;
  const v2=document.getElementById('creator2Id').value;
  await Promise.all([
    v1?api('saveSetting',{method:'POST',body:{key:'creator_telegram_id',value:v1}}):null,
    v2?api('saveSetting',{method:'POST',body:{key:'creator2_telegram_id',value:v2}}):null
  ]);
  toast('IDs de criador salvos.');
}

// ── DDDs ──────────────────────────────────────────────
async function loadDDDs(){
  const d=await api('blockedDDDs');
  if(!d.data?.length){document.getElementById('dddTable').innerHTML='<div class="empty"><div class="ei">◬</div><div class="et">nenhum DDD bloqueado</div></div>';return;}
  document.getElementById('dddTable').innerHTML='<table><thead><tr><th>DDD</th><th>Estado</th><th class="hm">Motivo</th><th class="hm">Adicionado</th><th>Ação</th></tr></thead><tbody>'
    +d.data.map(x=>'<tr><td><b class="mono">'+x.area_code+'</b></td><td style="color:var(--fg2)">'+(x.state||'—')+'</td><td class="hm" style="color:var(--fg3)">'+(x.reason||'—')+'</td><td class="hm" style="font-size:10px;color:var(--fg3)">'+fmtDs(x.created_at)+'</td><td><button class="btn bd bxs" onclick="remDDD(\\''+x.area_code+'\\')">Desbloquear</button></td></tr>').join('')+'</tbody></table>';
}
async function addDDD(){const b={area_code:document.getElementById('ddd_c').value,state:document.getElementById('ddd_s').value,reason:document.getElementById('ddd_r').value};const d=await api('addDDD',{method:'POST',body:b});if(d.ok){closeM('mDDD');toast('DDD '+b.area_code+' bloqueado.','warn');loadDDDs();}else toast(d.error||'Erro','err');}
async function remDDD(code){if(!confirm('Desbloquear DDD '+code+'?'))return;await api('removeDDD',{method:'DELETE',params:{area_code:code}});toast('DDD '+code+' desbloqueado.');loadDDDs();}

// ── SCROLL INFINITO (usuários) ────────────────────────
document.getElementById('cnt').addEventListener('scroll',function(){
  if(cur!=='users')return;
  if(this.scrollHeight-this.scrollTop-this.clientHeight<300)loadMoreUsers();
},{passive:true});

// ── INIT ─────────────────────────────────────────────
checkAuth().then(()=>loadDash());
setInterval(()=>{if(cur==='dashboard')loadDash();},60000);
</script>
</div><!-- /wrap -->
</body>
</html>
`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
