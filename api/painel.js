// api/painel.js — Nexus Panel v3.1 — build limpo, paridade total bot Telegram
module.exports = function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nexus Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#060608;
  --s1:#0c0c10;
  --s2:#111116;
  --s3:#18181f;
  --s4:#1f1f28;
  --line:#ffffff08;
  --line2:#ffffff12;
  --line3:#ffffff1e;
  --violet:#7c3aed;
  --violet-l:#8b5cf6;
  --violet-ll:#a78bfa;
  --violet-d:#6d28d9;
  --glow:#7c3aed22;
  --glow2:#7c3aed44;
  --fg:#f8f8fc;
  --fg2:#a8a8c0;
  --fg3:#6060808;
  --fg3:#606080;
  --danger:#ef4444;
  --success:#10b981;
  --warn:#f59e0b;
  --info:#6366f1;
  --pink:#db2777;
  --grad:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);
  --grad2:linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%);
  --sidebar-w:220px;
  --topbar-h:52px;
  --radius:8px;
  --radius-lg:12px;
}

html{font-size:14px}
body{font-family:'Geist',sans-serif;background:var(--bg);color:var(--fg);display:flex;min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased}

/* noise overlay */
body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");opacity:1;pointer-events:none;z-index:9999}

/* ── SIDEBAR ─────────────────────────────── */
.sidebar{
  width:var(--sidebar-w);
  background:var(--s1);
  border-right:1px solid var(--line);
  position:fixed;top:0;left:0;height:100vh;
  display:flex;flex-direction:column;
  z-index:100;
}

.sidebar-top{padding:0 12px;height:var(--topbar-h);display:flex;align-items:center;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none}
.brand-mark{width:24px;height:24px;background:var(--grad);border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.brand-mark svg{width:13px;height:13px;fill:white}
.brand-text{font-size:13px;font-weight:600;color:var(--fg);letter-spacing:-.2px}
.brand-text em{font-style:normal;color:var(--fg3)}

.nav{flex:1;padding:8px 8px;overflow-y:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}

.nav-section{font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em;padding:12px 8px 5px;margin-top:4px}
.nav-section:first-child{margin-top:0}

.nav-item{
  display:flex;align-items:center;gap:8px;
  padding:6px 8px;border-radius:6px;
  cursor:pointer;transition:background .1s,color .1s;
  color:var(--fg3);font-size:13px;font-weight:400;
  position:relative;user-select:none;
}
.nav-item:hover{background:var(--s3);color:var(--fg2)}
.nav-item.active{background:var(--s3);color:var(--fg);font-weight:500}
.nav-item.active::before{content:'';position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:2px;height:16px;background:var(--violet-l);border-radius:0 2px 2px 0}
.nav-ico{width:15px;height:15px;opacity:.6;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-style:normal}
.nav-item.active .nav-ico,.nav-item:hover .nav-ico{opacity:1}
.nav-cnt{margin-left:auto;font-size:11px;font-family:'Geist Mono',monospace;background:var(--s4);color:var(--fg2);padding:1px 6px;border-radius:4px;line-height:1.6}
.nav-cnt.red{background:#ef444420;color:var(--danger)}
.nav-cnt.violet{background:#7c3aed20;color:var(--violet-ll)}

.sidebar-bottom{padding:8px;border-top:1px solid var(--line)}
.user-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:var(--s2);border:1px solid var(--line)}
.user-av{width:26px;height:26px;background:var(--grad);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;flex-shrink:0}
.user-meta{flex:1;min-width:0}
.user-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-role{font-size:10px;color:var(--fg3)}
.btn-out{background:none;border:none;color:var(--fg3);cursor:pointer;padding:4px;border-radius:4px;transition:color .1s;font-size:12px;flex-shrink:0}
.btn-out:hover{color:var(--danger)}

/* ── MAIN ─────────────────────────────── */
.main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh}

.topbar{
  height:var(--topbar-h);background:var(--s1);
  border-bottom:1px solid var(--line);
  padding:0 24px;display:flex;align-items:center;justify-content:space-between;
  position:sticky;top:0;z-index:50;
}
.page-crumb{display:flex;align-items:center;gap:6px;font-size:13px}
.crumb-root{color:var(--fg3)}
.crumb-sep{color:var(--line3);font-size:11px}
.crumb-cur{color:var(--fg);font-weight:500}
.top-right{display:flex;align-items:center;gap:8px}
.status-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3);background:var(--s2);border:1px solid var(--line2);padding:3px 10px;border-radius:20px}
.pulse{width:5px;height:5px;border-radius:50%;background:var(--success);animation:p 2s ease-in-out infinite}
@keyframes p{0%,100%{box-shadow:0 0 0 0 #10b98150}50%{box-shadow:0 0 0 3px transparent}}

.content{padding:24px;flex:1}

/* ── STAT CARDS ─────────────────────────── */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}}

.kpi{background:var(--s1);border:1px solid var(--line2);border-radius:var(--radius-lg);padding:16px;position:relative;overflow:hidden;transition:border-color .15s}
.kpi:hover{border-color:var(--line3)}
.kpi-label{font-size:11px;color:var(--fg3);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
.kpi-val{font-size:22px;font-weight:600;font-family:'Geist Mono',monospace;letter-spacing:-1px;line-height:1}
.kpi-val.violet{color:var(--violet-ll)}
.kpi-val.success{color:var(--success)}
.kpi-val.warn{color:var(--warn)}
.kpi-val.danger{color:var(--danger)}
.kpi-sub{font-size:11px;color:var(--fg3);margin-top:6px}
.kpi-ico{font-size:14px;opacity:.5}
.kpi-accent{position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--grad);opacity:0;transition:opacity .15s}
.kpi:hover .kpi-accent{opacity:.6}

/* ── TABLES ─────────────────────────────── */
.card{background:var(--s1);border:1px solid var(--line2);border-radius:var(--radius-lg);overflow:hidden}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)}
.card-title{font-size:13px;font-weight:500}
.card-actions{display:flex;gap:8px}

table{width:100%;border-collapse:collapse}
thead th{padding:9px 16px;text-align:left;font-size:10px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--line);background:var(--s2);white-space:nowrap}
tbody tr{border-bottom:1px solid var(--line);transition:background .08s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:var(--s2)}
td{padding:11px 16px;font-size:13px;color:var(--fg2);vertical-align:middle}
td b,td strong{color:var(--fg);font-weight:500}
.mono{font-family:'Geist Mono',monospace;font-size:12px}

/* ── BADGES ─────────────────────────────── */
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:11px;font-family:'Geist Mono',monospace;font-weight:500;white-space:nowrap;border:1px solid transparent}
.tag::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0}
.t-pending{background:#f59e0b0d;color:#f59e0b;border-color:#f59e0b20}.t-pending::before{background:#f59e0b}
.t-approved{background:#6366f10d;color:#818cf8;border-color:#6366f120}.t-approved::before{background:#818cf8}
.t-delivered{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-delivered::before{background:#34d399}
.t-rejected{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-rejected::before{background:#f87171}
.t-failed{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-failed::before{background:#f87171}
.t-reversed{background:#f97316 0d;color:#fb923c;border-color:#f9731620}.t-reversed::before{background:#fb923c}
.t-active{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-active::before{background:#34d399}
.t-inactive{background:#ffffff06;color:var(--fg3);border-color:var(--line2)}.t-inactive::before{background:var(--fg3)}
.t-blocked{background:#ef44440d;color:#f87171;border-color:#ef444420}.t-blocked::before{background:#f87171}
.t-open{background:#6366f10d;color:#818cf8;border-color:#6366f120}.t-open::before{background:#818cf8}
.t-resolved{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-resolved::before{background:#34d399}
.t-closed{background:#ffffff06;color:var(--fg3);border-color:var(--line2)}.t-closed::before{background:var(--fg3)}
.t-sending{background:#7c3aed0d;color:#a78bfa;border-color:#7c3aed20}.t-sending::before{background:#a78bfa}
.t-sent{background:#10b9810d;color:#34d399;border-color:#10b98120}.t-sent::before{background:#34d399}
.t-admin{background:#7c3aed0d;color:#a78bfa;border-color:#7c3aed20}.t-admin::before{background:#a78bfa}
.t-creator{background:#db27770d;color:#f472b6;border-color:#db277720}.t-creator::before{background:#f472b6}

/* ── BUTTONS ─────────────────────────────── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;font-family:'Geist',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .1s;border:1px solid transparent;white-space:nowrap;line-height:1.4}
.btn-primary{background:var(--violet);color:#fff;border-color:var(--violet);box-shadow:0 0 0 0 var(--glow)}
.btn-primary:hover{background:var(--violet-l);border-color:var(--violet-l);box-shadow:0 0 16px var(--glow2)}
.btn-default{background:var(--s3);color:var(--fg2);border-color:var(--line2)}
.btn-default:hover{background:var(--s4);color:var(--fg);border-color:var(--line3)}
.btn-danger{background:#ef44440d;color:#f87171;border-color:#ef444420}
.btn-danger:hover{background:#ef444420}
.btn-success{background:#10b9810d;color:#34d399;border-color:#10b98120}
.btn-success:hover{background:#10b98120}
.btn-ghost{background:transparent;color:var(--fg3);border-color:transparent}
.btn-ghost:hover{background:var(--s3);color:var(--fg2)}
.btn-xs{padding:3px 8px;font-size:11px;border-radius:5px}
.btn:disabled{opacity:.4;cursor:not-allowed}

/* ── INPUTS ─────────────────────────────── */
.fi{background:var(--s2);border:1px solid var(--line2);border-radius:6px;padding:6px 11px;color:var(--fg);font-family:'Geist',sans-serif;font-size:13px;outline:none;transition:border-color .1s;height:32px}
.fi:focus{border-color:var(--violet)}
.fi::placeholder{color:var(--fg3)}
.fi option{background:var(--s2)}
.fi-sm{height:28px;font-size:12px;padding:4px 9px}

/* ── FILTERS ─────────────────────────────── */
.filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}

/* ── PAGINATION ─────────────────────────── */
.pager{display:flex;align-items:center;gap:4px;margin-top:14px;justify-content:center}
.pg{background:var(--s2);border:1px solid var(--line2);color:var(--fg3);padding:4px 10px;border-radius:5px;cursor:pointer;font-family:'Geist Mono',monospace;font-size:11px;transition:all .1s}
.pg:hover{border-color:var(--line3);color:var(--fg2)}
.pg.on{background:var(--violet);color:#fff;border-color:var(--violet)}
.pg:disabled{opacity:.3;cursor:default}
.pg-info{font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3);padding:0 6px}

/* ── MODAL ─────────────────────────────── */
.overlay{position:fixed;inset:0;background:#00000070;z-index:400;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.overlay.show{display:flex}
.modal{background:var(--s2);border:1px solid var(--line3);border-radius:14px;padding:24px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px #00000080;animation:mshow .18s cubic-bezier(.16,1,.3,1)}
.modal.lg{max-width:580px}
@keyframes mshow{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.modal-title{font-size:15px;font-weight:600;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.frow{margin-bottom:14px}
.frow label{display:block;font-size:11px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.frow .fi{width:100%;height:34px}
.frow textarea.fi{height:auto;min-height:80px;resize:vertical;padding:8px 11px}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)}

/* ── LOADING / EMPTY ─────────────────────── */
.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px;gap:12px}
.spin{width:24px;height:24px;border:2px solid var(--line3);border-top-color:var(--violet-l);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loader-txt{font-size:12px;font-family:'Geist Mono',monospace;color:var(--fg3)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px;gap:8px;color:var(--fg3)}
.empty-ic{font-size:32px;opacity:.3}
.empty-txt{font-size:13px}

/* ── USER CARD (scroll infinito) ─────────── */
.user-card{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);transition:background .08s}
.user-card:hover{background:var(--s2)}
.user-card:last-child{border-bottom:none}
.uc-av{width:34px;height:34px;border-radius:8px;background:var(--s4);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--fg2);flex-shrink:0;border:1px solid var(--line2)}
.uc-info{flex:1;min-width:0}
.uc-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uc-sub{font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace;margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.uc-phone{color:var(--violet-ll);text-decoration:none}
.uc-phone:hover{text-decoration:underline}
.uc-badges{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.uc-actions{display:flex;gap:4px;flex-shrink:0}
.end-msg{text-align:center;padding:16px;font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3)}

/* ── TOAST ─────────────────────────────── */
.toasts{position:fixed;bottom:20px;right:20px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:var(--s3);border:1px solid var(--line3);border-radius:8px;padding:10px 14px;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px #00000060;animation:tin .25s cubic-bezier(.16,1,.3,1);pointer-events:auto;min-width:220px}
@keyframes tin{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.toast-line{width:2px;border-radius:2px;align-self:stretch;flex-shrink:0}
.toast.ok .toast-line{background:var(--success)}
.toast.err .toast-line{background:var(--danger)}
.toast.warn .toast-line{background:var(--warn)}

/* ── SECTIONS ─────────────────────────── */
.sec{display:none}
.sec.on{display:block;animation:secon .2s ease}
@keyframes secon{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

/* ── DASHBOARD GRID ─────────────────────── */
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
.dash-list-item{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--line)}
.dash-list-item:last-child{border-bottom:none}

/* BROADCAST */
.bc{background:var(--s2);border:1px solid var(--line2);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start}
.bc-status{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
.bc-body{flex:1;min-width:0}
.bc-name{font-size:13px;font-weight:500;margin-bottom:3px}
.bc-meta{font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace}
.progress{height:3px;background:var(--s4);border-radius:2px;overflow:hidden;margin-top:8px}
.progress-fill{height:100%;background:var(--grad);border-radius:2px;transition:width .5s}

/* TICKET MSGS */
.msg-thread{max-height:300px;overflow-y:auto;padding:4px;display:flex;flex-direction:column;gap:8px}
.msg{padding:9px 12px;border-radius:8px;max-width:82%;font-size:13px;line-height:1.5}
.msg.usr{background:var(--s3);border:1px solid var(--line);align-self:flex-start}
.msg.adm{background:#7c3aed18;border:1px solid #7c3aed25;align-self:flex-end}
.msg-meta{font-size:10px;color:var(--fg3);margin-top:4px;font-family:'Geist Mono',monospace}

/* CHART */
.bars{display:flex;align-items:flex-end;gap:3px;height:64px;padding-top:4px}
.bar{flex:1;border-radius:3px 3px 0 0;min-height:2px;opacity:.85;transition:opacity .1s}
.bar:hover{opacity:1}

/* SETTINGS */
.set-block{background:var(--s1);border:1px solid var(--line2);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;max-width:480px}
.set-block h3{font-size:13px;font-weight:500;margin-bottom:3px}
.set-block p{font-size:12px;color:var(--fg3);margin-bottom:14px}

/* USER DETAIL */
.ud-head{display:flex;align-items:center;gap:12px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.ud-av{width:44px;height:44px;background:var(--grad);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
</style>
</head>
<body>

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="sidebar-top">
    <a class="brand" href="#">
      <div class="brand-mark"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
      <span class="brand-text">Nexus <em>Panel</em></span>
    </a>
  </div>

  <nav class="nav">
    <div class="nav-section">Visão geral</div>
    <div class="nav-item active" onclick="go('dashboard',this)"><i class="nav-ico">◈</i>Dashboard</div>
    <div class="nav-item" onclick="go('stats',this)"><i class="nav-ico">◉</i>Analytics</div>

    <div class="nav-section">Financeiro</div>
    <div class="nav-item" onclick="go('transactions',this)"><i class="nav-ico">▦</i>Transações<span class="nav-cnt red" id="cnt-pend">0</span></div>
    <div class="nav-item" onclick="go('failures',this)"><i class="nav-ico">◬</i>Falhas<span class="nav-cnt red" id="cnt-fail">0</span></div>

    <div class="nav-section">Catálogo</div>
    <div class="nav-item" onclick="go('products',this)"><i class="nav-ico">▣</i>Produtos</div>
    <div class="nav-item" onclick="go('mediapacks',this)"><i class="nav-ico">▤</i>Media Packs</div>
    <div class="nav-item" onclick="go('groups',this)"><i class="nav-ico">◎</i>Grupos VIP</div>
    <div class="nav-item" onclick="go('coupons',this)"><i class="nav-ico">◈</i>Cupons</div>

    <div class="nav-section">Usuários</div>
    <div class="nav-item" onclick="go('users',this)"><i class="nav-ico">◯</i>Usuários</div>
    <div class="nav-item" onclick="go('topclientes',this)"><i class="nav-ico">★</i>Top Clientes</div>
    <div class="nav-item" onclick="go('trusted',this)"><i class="nav-ico">◎</i>Confiáveis</div>
    <div class="nav-item" onclick="go('tickets',this)"><i class="nav-ico">▧</i>Tickets<span class="nav-cnt violet" id="cnt-tick">0</span></div>

    <div class="nav-section">Marketing</div>
    <div class="nav-item" onclick="go('broadcast',this)"><i class="nav-ico">◎</i>Broadcast</div>
    <div class="nav-item" onclick="go('autoresponses',this)"><i class="nav-ico">◈</i>Respostas Auto</div>

    <div class="nav-section">Sistema</div>
    <div class="nav-item" onclick="go('settings',this)"><i class="nav-ico">◎</i>Configurações</div>
    <div class="nav-item" onclick="go('deliver',this)"><i class="nav-ico">↓</i>Entrega Manual</div>
    <div class="nav-item" onclick="go('ddds',this)"><i class="nav-ico">◬</i>DDDs Bloqueados</div>
  </nav>

  <div class="sidebar-bottom">
    <div class="user-row">
      <div class="user-av" id="uAv">A</div>
      <div class="user-meta">
        <div class="user-name" id="uName">Admin</div>
        <div class="user-role">administrator</div>
      </div>
      <button class="btn-out" onclick="logout()" title="Sair">⏻</button>
    </div>
  </div>
</aside>

<!-- MAIN -->
<div class="main">
  <div class="topbar">
    <div class="page-crumb">
      <span class="crumb-root">nexus</span>
      <span class="crumb-sep">/</span>
      <span class="crumb-cur" id="pgTitle">dashboard</span>
    </div>
    <div class="top-right">
      <div class="status-badge"><div class="pulse"></div>online</div>
    </div>
  </div>

  <div class="content">

    <!-- DASHBOARD -->
    <div id="s-dashboard" class="sec on">
      <div class="kpis" id="kpis"><div class="loader"><div class="spin"></div></div></div>
      <div class="dash-grid">
        <div class="card"><div class="card-head"><span class="card-title">Últimas transações</span></div><div id="recentTx"></div></div>
        <div class="card"><div class="card-head"><span class="card-title">Novos usuários</span></div><div id="recentUsers"></div></div>
      </div>
    </div>

    <!-- ANALYTICS -->
    <div id="s-stats" class="sec">
      <div class="dash-grid">
        <div class="card"><div class="card-head"><span class="card-title">Receita diária — 14 dias</span></div><div style="padding:16px"><div class="bars" id="chartRev"></div><div id="chartRevTotal" style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace;margin-top:10px"></div></div></div>
        <div class="card"><div class="card-head"><span class="card-title">Transações por status</span></div><div style="padding:4px 0" id="chartSt"></div></div>
      </div>
      <div class="dash-grid" style="margin-top:16px">
        <div class="card"><div class="card-head"><span class="card-title">Novos usuários — 14 dias</span></div><div style="padding:16px"><div class="bars" id="chartUsr"></div><div id="chartUsrTotal" style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace;margin-top:10px"></div></div></div>
      </div>
    </div>

    <!-- TRANSAÇÕES -->
    <div id="s-transactions" class="sec">
      <div class="filters">
        <input class="fi fi-sm" style="width:220px" id="txQ" placeholder="Buscar TXID ou Telegram ID..." oninput="dbounce(loadTx,400)()">
        <select class="fi fi-sm" id="txSt" onchange="loadTx()">
          <option value="all">Todos</option>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovado</option>
          <option value="delivered">Entregue</option>
          <option value="rejected">Rejeitado</option>
          <option value="delivery_failed">Falha entrega</option>
          <option value="reversed">Revertido</option>
        </select>
        <button class="btn btn-default btn-xs" onclick="loadTx()">↺ Atualizar</button>
      </div>
      <div class="card" id="txTable"><div class="loader"><div class="spin"></div><span class="loader-txt">carregando...</span></div></div>
      <div class="pager" id="txPager"></div>
    </div>

    <!-- FALHAS -->
    <div id="s-failures" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Falhas de entrega</span>
        <button class="btn btn-default btn-xs" onclick="loadFail()">↺ Atualizar</button>
      </div>
      <div class="card" id="failTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- PRODUTOS -->
    <div id="s-products" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Produtos</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-default btn-xs" onclick="loadProd(true)">+ inativos</button>
          <button class="btn btn-primary btn-xs" onclick="openM('mProd')">+ Novo produto</button>
        </div>
      </div>
      <div class="card" id="prodTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- MEDIA PACKS -->
    <div id="s-mediapacks" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Media Packs</span>
        <button class="btn btn-primary btn-xs" onclick="openM('mMP')">+ Novo pack</button>
      </div>
      <div class="card" id="mpTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- GRUPOS -->
    <div id="s-groups" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Grupos VIP</span>
        <button class="btn btn-primary btn-xs" onclick="openM('mGroup')">+ Novo grupo</button>
      </div>
      <div class="card" id="groupTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- CUPONS -->
    <div id="s-coupons" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Cupons de desconto</span>
        <button class="btn btn-primary btn-xs" onclick="openM('mCoupon')">+ Novo cupom</button>
      </div>
      <div class="card" id="couponTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- USUÁRIOS (SCROLL INFINITO) -->
    <div id="s-users" class="sec">
      <div class="filters">
        <input class="fi fi-sm" style="width:220px" id="userQ" placeholder="Nome, username ou ID..." oninput="dbounce('resetUserScroll',300)">
        <select class="fi fi-sm" id="userBl" onchange="resetUserScroll()">
          <option value="">Todos</option>
          <option value="false">Ativos</option>
          <option value="true">Bloqueados</option>
        </select>
        <button class="btn btn-default btn-xs" onclick="resetUserScroll()">↺</button>
        <span id="userCount" style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--fg3);margin-left:4px"></span>
      </div>
      <div class="card" id="usersWrap">
        <div id="usersList"></div>
        <div id="usersLoader" class="loader" style="display:none"><div class="spin"></div><span class="loader-txt">carregando...</span></div>
        <div id="usersEnd" class="end-msg" style="display:none">— fim da lista —</div>
      </div>
    </div>

    <!-- TOP CLIENTES -->
    <div id="s-topclientes" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Top Clientes</span>
        <button class="btn btn-default btn-xs" onclick="loadStats()">↺</button>
      </div>
      <div class="card" id="topTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- CONFIÁVEIS -->
    <div id="s-trusted" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Usuários confiáveis</span>
        <button class="btn btn-default btn-xs" onclick="loadTrusted()">↺</button>
      </div>
      <div class="card" id="trustedTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- TICKETS -->
    <div id="s-tickets" class="sec">
      <div class="filters">
        <select class="fi fi-sm" id="tickSt" onchange="loadTickets()">
          <option value="all">Todos</option>
          <option value="open">Abertos</option>
          <option value="resolved">Resolvidos</option>
          <option value="closed">Fechados</option>
        </select>
        <button class="btn btn-default btn-xs" onclick="loadTickets()">↺</button>
      </div>
      <div class="card" id="tickTable"><div class="loader"><div class="spin"></div></div></div>
      <div class="pager" id="tickPager"></div>
    </div>

    <!-- BROADCAST -->
    <div id="s-broadcast" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Campanhas broadcast</span>
        <button class="btn btn-default btn-xs" onclick="loadBC()">↺</button>
      </div>
      <div id="bcList"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- AUTO RESPONSES -->
    <div id="s-autoresponses" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">Respostas automáticas</span>
        <button class="btn btn-primary btn-xs" onclick="openM('mAR')">+ Nova resposta</button>
      </div>
      <div class="card" id="arTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

    <!-- SETTINGS -->
    <div id="s-deliver" class="sec">
      <div style="max-width:500px">
        <div class="set-block">
          <h3>Entrega manual de produto</h3>
          <p>Entregue qualquer produto a qualquer usuário, independente de transação.</p>
          <div class="frow"><label>Telegram ID do usuário *</label><input class="fi" id="delUserId" placeholder="Ex: 6224210204" type="number"></div>
          <div class="frow"><label>Tipo *</label>
            <select class="fi" id="delType" onchange="updateDelProduct()">
              <option value="product">Produto</option>
              <option value="mediapack">Media Pack</option>
              <option value="group">Grupo VIP</option>
            </select>
          </div>
          <div class="frow"><label>Item *</label><select class="fi" id="delProduct"><option>Carregando...</option></select></div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="btn btn-default" onclick="lookupDelUser()">🔍 Verificar usuário</button>
            <button class="btn btn-primary" onclick="doManualDeliver()">↓ Entregar agora</button>
          </div>
          <div id="delUserInfo" style="margin-top:12px;padding:10px;background:var(--s2);border:1px solid var(--line);border-radius:8px;font-size:12px;display:none"></div>
        </div>
      </div>
    </div>

    <div id="s-settings" class="sec">
      <div style="font-size:13px;font-weight:500;margin-bottom:18px">Configurações do sistema</div>
      <div class="set-block">
        <h3>Chave PIX</h3>
        <p>Chave utilizada para receber pagamentos</p>
        <div class="frow"><label>Chave PIX</label><input class="fi" id="pixKey" placeholder="Carregando..."></div>
        <button class="btn btn-primary btn-xs" onclick="saveSetting('pix_key',document.getElementById('pixKey').value,'Chave PIX salva.')">Salvar</button>
      </div>
      <div class="set-block">
        <h3>Suporte Telegram</h3>
        <p>Link do canal ou usuário de suporte</p>
        <div class="frow"><label>Link (ex: https://t.me/usuario)</label><input class="fi" id="supportLink" placeholder="Carregando..."></div>
        <button class="btn btn-primary btn-xs" onclick="saveSetting('support_contact',document.getElementById('supportLink').value,'Suporte atualizado.')">Salvar</button>
      </div>
      <div class="set-block">
        <h3>Recalcular total de vendas</h3>
        <p>Força recálculo do valor total com base nas transações entregues</p>
        <button class="btn btn-warn btn-xs" onclick="recalcValues()">↺ Recalcular agora</button>
        <span id="recalcResult" style="font-size:12px;color:var(--fg3);margin-left:10px"></span>
      </div>
    </div>

    <!-- DDDS -->
    <div id="s-ddds" class="sec">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:500">DDDs bloqueados</span>
        <button class="btn btn-danger btn-xs" onclick="openM('mDDD')">+ Bloquear DDD</button>
      </div>
      <div class="card" id="dddTable"><div class="loader"><div class="spin"></div></div></div>
    </div>

  </div>
</div>

<div class="overlay" id="mMP"><div class="modal">
  <div class="modal-title">Novo Media Pack</div>
  <div class="frow"><label>ID único *</label><input class="fi" id="mp_id" placeholder="pack_premium"></div>
  <div class="frow"><label>Nome *</label><input class="fi" id="mp_name" placeholder="Premium Pack"></div>
  <div class="frow"><label>Descrição</label><textarea class="fi" id="mp_desc" placeholder="..."></textarea></div>
  <div class="frow"><label>Preço R$ *</label><input class="fi" type="number" id="mp_price" step="0.01" placeholder="29.90"></div>
  <div class="frow"><label>Itens por entrega</label><input class="fi" type="number" id="mp_items" placeholder="3" value="3" min="1"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mMP')">Cancelar</button><button class="btn btn-primary" onclick="closeM('mMP')">Criar pack</button></div>
</div></div>

<div class="overlay" id="mMPItems"><div class="modal lg">
  <div class="modal-title" id="mMPItemsTitle">Itens do Pack</div>
  <div id="mMPItemsList" style="max-height:360px;overflow-y:auto;padding:4px 0"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mMPItems')">Fechar</button></div>
</div></div>

<div class="overlay" id="mProd"><div class="modal">
  <div class="modal-title">Novo produto</div>
  <div class="frow"><label>ID *</label><input class="fi" id="p_id" placeholder="pack_vip_01"></div>
  <div class="frow"><label>Nome *</label><input class="fi" id="p_name" placeholder="Nome do produto"></div>
  <div class="frow"><label>Descrição</label><textarea class="fi" id="p_desc" placeholder="..."></textarea></div>
  <div class="frow"><label>Preço R$ *</label><input class="fi" type="number" id="p_price" placeholder="29.90" step="0.01"></div>
  <div class="frow"><label>Tipo entrega</label><select class="fi" id="p_type"><option value="link">Link</option><option value="media_pack">Pack mídia</option><option value="group">Grupo</option></select></div>
  <div class="frow"><label>URL entrega</label><input class="fi" id="p_url" placeholder="https://..."></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mProd')">Cancelar</button><button class="btn btn-primary" onclick="saveProd()">Criar produto</button></div>
</div></div>

<div class="overlay" id="mGroup"><div class="modal">
  <div class="modal-title">Novo grupo VIP</div>
  <div class="frow"><label>ID Telegram (número negativo)</label><input class="fi" id="g_id" placeholder="-1001234567890"></div>
  <div class="frow"><label>Nome</label><input class="fi" id="g_name" placeholder="VIP Gold"></div>
  <div class="frow"><label>Link convite</label><input class="fi" id="g_link" placeholder="https://t.me/..."></div>
  <div class="frow"><label>Preço R$</label><input class="fi" type="number" id="g_price" placeholder="49.90"></div>
  <div class="frow"><label>Dias de acesso</label><input class="fi" type="number" id="g_days" placeholder="30"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mGroup')">Cancelar</button><button class="btn btn-primary" onclick="saveGroup()">Criar grupo</button></div>
</div></div>

<div class="overlay" id="mCoupon"><div class="modal">
  <div class="modal-title">Novo cupom</div>
  <div class="frow"><label>Código *</label><input class="fi" id="c_code" placeholder="PROMO20" style="text-transform:uppercase"></div>
  <div class="frow"><label>Desconto % *</label><input class="fi" type="number" id="c_disc" placeholder="20" min="1" max="100"></div>
  <div class="frow"><label>Produto específico (opcional)</label><select class="fi" id="c_prod"><option value="">Todos os produtos</option></select></div>
  <div class="frow"><label>Máx. usos (vazio = ilimitado)</label><input class="fi" type="number" id="c_uses" placeholder="100"></div>
  <div class="frow"><label>Expiração (opcional)</label><input class="fi" type="datetime-local" id="c_exp"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mCoupon')">Cancelar</button><button class="btn btn-primary" onclick="saveCoupon()">Criar cupom</button></div>
</div></div>

<div class="overlay" id="mAR"><div class="modal">
  <div class="modal-title">Nova resposta automática</div>
  <div class="frow"><label>Palavra-chave *</label><input class="fi" id="ar_kw" placeholder="ex: preço, quanto custa"></div>
  <div class="frow"><label>Resposta *</label><textarea class="fi" id="ar_resp" placeholder="Texto da resposta..." style="min-height:100px"></textarea></div>
  <div class="frow"><label>Prioridade</label><input class="fi" type="number" id="ar_pri" placeholder="0" value="0"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mAR')">Cancelar</button><button class="btn btn-primary" onclick="saveAR()">Criar</button></div>
</div></div>

<div class="overlay" id="mDDD"><div class="modal">
  <div class="modal-title">Bloquear DDD</div>
  <div class="frow"><label>DDD *</label><input class="fi" id="ddd_c" placeholder="11" maxlength="2"></div>
  <div class="frow"><label>Estado</label><input class="fi" id="ddd_s" placeholder="SP"></div>
  <div class="frow"><label>Motivo</label><input class="fi" id="ddd_r" placeholder="ex: Alta taxa de fraude"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mDDD')">Cancelar</button><button class="btn btn-danger" onclick="addDDD()">Bloquear</button></div>
</div></div>

<div class="overlay" id="mTicket"><div class="modal lg">
  <div class="modal-title" id="mTickTitle">Ticket</div>
  <div class="msg-thread" id="mTickMsgs"></div>
  <div style="margin-top:12px">
    <div class="frow"><label>Responder como admin</label><textarea class="fi" id="tickReplyTxt" placeholder="Digite sua resposta..." style="min-height:64px;margin-top:4px"></textarea></div>
  </div>
  <div class="modal-foot">
    <button class="btn btn-ghost" onclick="closeM('mTicket')">Fechar</button>
    <button class="btn btn-default btn-xs" id="btnCloseT">Fechar ticket</button>
    <button class="btn btn-default btn-xs" id="btnReplyT">Enviar resposta</button>
    <button class="btn btn-success btn-xs" id="btnResolveT">✓ Resolver</button>
  </div>
</div></div>

<div class="overlay" id="mUser"><div class="modal">
  <div class="ud-head"><div class="ud-av" id="udAv">👤</div><div id="udInfo"></div></div>
  <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap" id="udActions"></div>
  <div style="font-size:11px;font-weight:500;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Transações recentes</div>
  <div id="udTx"></div>
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mUser')">Fechar</button></div>
</div></div>

<div class="overlay" id="mReverse"><div class="modal">
  <div class="modal-title">Reverter transação</div>
  <div class="frow"><label>Motivo</label><textarea class="fi" id="revReason" placeholder="Motivo da reversão..."></textarea></div>
  <input type="hidden" id="revTxid">
  <div class="modal-foot"><button class="btn btn-ghost" onclick="closeM('mReverse')">Cancelar</button><button class="btn btn-danger" onclick="doReverse()">Reverter</button></div>
</div></div>

<div class="toasts" id="toasts"></div>

<script>
const API='/api/panel/data';
let TOKEN=localStorage.getItem('panel_token')||'';
let pg={tx:1,users:1,tick:1};
let dbt={};

// AUTH
async function checkAuth(){
  if(!TOKEN)return location.href='/login';
  const r=await fetch('/api/panel/auth',{headers:{Authorization:'Bearer '+TOKEN}});
  if(!r.ok){localStorage.clear();location.href='/login';return;}
  const u=JSON.parse(localStorage.getItem('panel_user')||'{}');
  document.getElementById('uName').textContent=u.name||'Admin';
  document.getElementById('uAv').textContent=(u.name||'A').charAt(0).toUpperCase();
}
function logout(){localStorage.clear();location.href='/login';}

async function api(action,opts={}){
  const{method='GET',body,params={}}=opts;
  const qs=new URLSearchParams({action,...params}).toString();
  const r=await fetch(API+'?'+qs,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:body?JSON.stringify(body):undefined});
  return r.json();
}

function dbounce(fn,ms){
  return function(...a){
    clearTimeout(dbt[fn.name]);
    dbt[fn.name]=setTimeout(()=>fn(...a),ms);
  };
}

// NAV
const meta={dashboard:'dashboard',stats:'analytics',transactions:'transactions',failures:'falhas',products:'produtos',groups:'grupos',coupons:'cupons',users:'usuários',trusted:'confiáveis',tickets:'tickets',broadcast:'broadcast',autoresponses:'respostas auto',settings:'configurações',ddds:'ddds bloqueados'};
const loads={dashboard:loadDash,stats:loadStats,transactions:loadTx,failures:loadFail,products:loadProd,groups:loadGroups,coupons:loadCoupons,users:initUsers,trusted:loadTrusted,tickets:loadTickets,broadcast:loadBC,autoresponses:loadAR,settings:loadSettings,ddds:loadDDDs,deliver:loadDeliver,mediapacks:loadMP};

function go(sec,el){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('s-'+sec).classList.add('on');
  if(el)el.classList.add('active');
  document.getElementById('pgTitle').textContent=meta[sec]||sec;
  if(loads[sec])loads[sec]();
}

// HELPERS
function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtD(d){if(!d)return'—';const dt=new Date(d);return dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function fmtDs(d){if(!d)return'—';return new Date(d).toLocaleDateString('pt-BR');}

function tag(st){
  const m={pending:['t-pending','pending'],approved:['t-approved','approved'],delivered:['t-delivered','delivered'],rejected:['t-rejected','rejected'],delivery_failed:['t-failed','failed'],reversed:['t-reversed','reversed'],active:['t-active','active'],inactive:['t-inactive','inactive'],blocked:['t-blocked','blocked'],open:['t-open','open'],resolved:['t-resolved','resolved'],closed:['t-closed','closed'],sending:['t-sending','sending'],pending_broadcast:['t-sending','pending'],sent:['t-sent','sent'],cancelled:['t-inactive','cancelled'],admin:['t-admin','admin'],creator:['t-creator','creator']};
  const[cls,lbl]=m[st]||['t-inactive',st];
  return'<span class="tag '+cls+'">'+lbl+'</span>';
}

function dlrow(left,right){
  return'<div class="dash-list-item">'+left+right+'</div>';
}

function toast(msg,type='ok'){
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML='<div class="toast-line"></div><span>'+msg+'</span>';
  document.getElementById('toasts').appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

function openM(id){document.getElementById(id).classList.add('show');}
function closeM(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');}));

function pager(id,cur,total,cb){
  if(!total||total<=1){document.getElementById(id).innerHTML='';return;}
  let h='<button class="pg" onclick="'+cb+'('+Math.max(1,cur-1)+')" '+(cur<=1?'disabled':'')+'>←</button>';
  for(let i=Math.max(1,cur-2);i<=Math.min(total,cur+2);i++)h+='<button class="pg '+(i===cur?'on':'')+'" onclick="'+cb+'('+i+')">'+i+'</button>';
  h+='<button class="pg" onclick="'+cb+'('+Math.min(total,cur+1)+')" '+(cur>=total?'disabled':'')+'>→</button>';
  h+='<span class="pg-info">'+cur+'/'+total+'</span>';
  document.getElementById(id).innerHTML=h;
}

// DASHBOARD
async function loadDash(){
  const d=await api('dashboard');
  document.getElementById('cnt-pend').textContent=d.pendentes||0;
  document.getElementById('cnt-tick').textContent=d.tickets||0;
  document.getElementById('cnt-fail').textContent=d.failures||0;

  document.getElementById('kpis').innerHTML=\`
    <div class="kpi"><div class="kpi-label">Receita total<span class="kpi-ico">$</span></div><div class="kpi-val violet">R$ \${fmt(d.totalSales)}</div><div class="kpi-sub">acumulado geral</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Hoje<span class="kpi-ico">↑</span></div><div class="kpi-val success">R$ \${fmt(d.vendasHoje)}</div><div class="kpi-sub">\${new Date().toLocaleDateString('pt-BR')}</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Esta semana<span class="kpi-ico">◈</span></div><div class="kpi-val">R$ \${fmt(d.vendasSemana)}</div><div class="kpi-sub">últimos 7 dias</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Pendentes<span class="kpi-ico">◬</span></div><div class="kpi-val \${d.pendentes>0?'warn':''}">\${d.pendentes||0}</div><div class="kpi-sub">aguardando revisão</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Usuários<span class="kpi-ico">◯</span></div><div class="kpi-val">\${(d.users||0).toLocaleString()}</div><div class="kpi-sub">cadastrados</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Transações<span class="kpi-ico">▦</span></div><div class="kpi-val">\${(d.transactions||0).toLocaleString()}</div><div class="kpi-sub">total histórico</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Tickets abertos<span class="kpi-ico">▧</span></div><div class="kpi-val \${d.tickets>0?'warn':''}">\${d.tickets||0}</div><div class="kpi-sub">suporte</div><div class="kpi-accent"></div></div>
    <div class="kpi"><div class="kpi-label">Falhas entrega<span class="kpi-ico">◬</span></div><div class="kpi-val \${d.failures>0?'danger':''}">\${d.failures||0}</div><div class="kpi-sub">requerem atenção</div><div class="kpi-accent"></div></div>
  \`;

  document.getElementById('recentTx').innerHTML=(d.recentTx||[]).map(t=>
    dlrow('<div><div class="mono" style="color:var(--fg)">'+(t.txid||'').substring(0,18)+'…</div><div style="font-size:11px;color:var(--fg3);margin-top:1px;font-family:\\'Geist Mono\\',monospace">'+fmtD(t.created_at)+'</div></div>',
    '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span style="font-family:\\'Geist Mono\\',monospace;font-size:12px;font-weight:500">R$ '+fmt(t.amount)+'</span>'+tag(t.status)+'</div>')
  ).join('')||'<div class="empty"><div class="empty-txt" style="color:var(--fg3)">sem transações</div></div>';

  document.getElementById('recentUsers').innerHTML=(d.recentUsers||[]).map(u=>
    dlrow('<div><div style="font-size:13px;font-weight:500">'+(u.first_name||'N/A')+'</div><div class="mono" style="font-size:11px;color:var(--fg3);margin-top:1px">@'+(u.username||u.telegram_id)+'</div></div>',
    '<div style="font-size:11px;font-family:\\'Geist Mono\\',monospace;color:var(--fg3)">'+fmtD(u.created_at)+'</div>')
  ).join('')||'<div class="empty"><div class="empty-txt">sem usuários</div></div>';
}

// ANALYTICS
async function loadStats(){
  const d=await api('stats');
  const days=Object.keys(d.byDay||{}).sort().slice(-14);
  const maxR=Math.max(...days.map(k=>d.byDay[k]),1);
  document.getElementById('chartRev').innerHTML=days.map(k=>'<div class="bar" style="height:'+Math.max(3,(d.byDay[k]/maxR)*60)+'px;background:linear-gradient(to top,#7c3aed,#db2777)" title="'+k+': R$ '+fmt(d.byDay[k])+'"></div>').join('');
  document.getElementById('chartRevTotal').textContent='14d total: R$ '+fmt(days.reduce((a,k)=>a+(d.byDay[k]||0),0));

  document.getElementById('chartSt').innerHTML=Object.entries(d.byStatus||{}).map(([st,cnt])=>
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 16px;border-bottom:1px solid var(--line)">'+tag(st)+'<span class="mono" style="color:var(--fg)">'+cnt+'</span></div>'
  ).join('')||'<div class="empty"><div class="empty-txt">sem dados</div></div>';

  const udays=Object.keys(d.byDayUsers||{}).sort().slice(-14);
  const maxU=Math.max(...udays.map(k=>d.byDayUsers[k]),1);
  document.getElementById('chartUsr').innerHTML=udays.map(k=>'<div class="bar" style="height:'+Math.max(3,(d.byDayUsers[k]/maxU)*60)+'px;background:linear-gradient(to top,#6366f1,#7c3aed)" title="'+k+': '+d.byDayUsers[k]+' usuários"></div>').join('');
  document.getElementById('chartUsrTotal').textContent='14d total: '+udays.reduce((a,k)=>a+(d.byDayUsers[k]||0),0)+' usuários';
}

// TRANSAÇÕES
async function loadTx(){
  document.getElementById('txTable').innerHTML='<div class="loader"><div class="spin"></div><span class="loader-txt">carregando</span></div>';
  const d=await api('transactions',{params:{page:pg.tx,limit:20,status:document.getElementById('txSt').value,search:document.getElementById('txQ').value}});
  if(!d.data){document.getElementById('txTable').innerHTML='<div class="empty"><div class="empty-txt">erro ao carregar</div></div>';return;}
  const rows=d.data.map(t=>\`<tr>
    <td><span class="mono">\${(t.txid||'').substring(0,20)}…</span></td>
    <td><span class="mono">\${t.telegram_id}</span></td>
    <td><b>R$ \${fmt(t.amount)}</b></td>
    <td>\${tag(t.status)}</td>
    <td style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace">\${fmtD(t.created_at)}</td>
    <td>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        \${t.status==='pending'?\`<button class="btn btn-success btn-xs" onclick="approveTx('\${t.txid}')">✓ Aprovar</button><button class="btn btn-danger btn-xs" onclick="rejectTx('\${t.txid}')">✗ Rejeitar</button>\`:''}
        \${['approved','delivery_failed'].includes(t.status)?\`<button class="btn btn-default btn-xs" onclick="deliverTx('\${t.txid}')">↓ Entregar</button>\`:''}
        \${t.status==='delivered'?\`<button class="btn btn-danger btn-xs" onclick="openRev('\${t.txid}')">↩ Reverter</button>\`:''}
      </div>
    </td>
  </tr>\`).join('');
  document.getElementById('txTable').innerHTML=\`<table><thead><tr><th>TXID</th><th>Telegram ID</th><th>Valor</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>\${rows||'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--fg3)">nenhuma transação</td></tr>'}</tbody></table>\`;
  pager('txPager',d.page,d.pages,'setTxPg');
}
function setTxPg(p){pg.tx=p;loadTx();}
async function approveTx(txid){await api('approveTransaction',{method:'POST',body:{txid}});toast('Transação aprovada.');loadTx();loadDash();}
async function rejectTx(txid){await api('rejectTransaction',{method:'POST',body:{txid}});toast('Transação rejeitada.','warn');loadTx();}
async function deliverTx(txid){await api('deliverByTxid',{method:'POST',body:{txid}});toast('Marcado como entregue.');loadTx();}
function openRev(txid){document.getElementById('revTxid').value=txid;document.getElementById('revReason').value='';openM('mReverse');}
async function doReverse(){const txid=document.getElementById('revTxid').value;const reason=document.getElementById('revReason').value;await api('reverseTransaction',{method:'POST',body:{txid,reason}});closeM('mReverse');toast('Transação revertida.','warn');loadTx();}

// FALHAS
async function loadFail(){
  const d=await api('deliveryFailures');
  if(!d.data?.length){document.getElementById('failTable').innerHTML='<div class="empty"><div class="empty-ic">✓</div><div class="empty-txt">nenhuma falha de entrega</div></div>';return;}
  const rows=d.data.map(f=>\`<tr>
    <td><span class="mono">\${(f.txid||'').substring(0,18)}…</span></td>
    <td><span class="mono">\${f.telegram_id}</span></td>
    <td><b>R$ \${fmt(f.amount)}</b></td>
    <td><span class="mono" style="font-size:11px;color:var(--fg3)">\${f.delivery_error_type||'unknown'}</span></td>
    <td><span class="mono">\${f.delivery_attempts||0}×</span></td>
    <td style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace">\${fmtD(f.last_delivery_attempt_at)}</td>
    <td><button class="btn btn-default btn-xs" onclick="forceDel('\${f.txid}')">Forçar entrega</button></td>
  </tr>\`).join('');
  document.getElementById('failTable').innerHTML=\`<table><thead><tr><th>TXID</th><th>Telegram ID</th><th>Valor</th><th>Erro</th><th>Tentativas</th><th>Última tentativa</th><th>Ação</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function forceDel(txid){await api('forceDelivered',{method:'POST',body:{txid}});toast('Entrega forçada.');loadFail();loadDash();}

// PRODUTOS
async function loadProd(){
  const d=await api('products');
  if(!d.data?.length){document.getElementById('prodTable').innerHTML='<div class="empty"><div class="empty-ic">▣</div><div class="empty-txt">nenhum produto</div></div>';return;}
  const rows=d.data.map(p=>\`<tr>
    <td><b>\${p.name}</b></td>
    <td><span class="mono">\${p.product_id}</span></td>
    <td><span class="mono">R$ \${fmt(p.price)}</span></td>
    <td style="font-size:12px;color:var(--fg3)">\${p.delivery_type}</td>
    <td>\${p.is_active?tag('active'):tag('inactive')}</td>
    <td><div style="display:flex;gap:4px"><button class="btn btn-default btn-xs" onclick="toggleProd('\${p.product_id}',\${!p.is_active})">\${p.is_active?'Pausar':'Ativar'}</button><button class="btn btn-danger btn-xs" onclick="delProd('\${p.product_id}')">Remover</button></div></td>
  </tr>\`).join('');
  document.getElementById('prodTable').innerHTML=\`<table><thead><tr><th>Nome</th><th>ID</th><th>Preço</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function saveProd(){const body={product_id:document.getElementById('p_id').value,name:document.getElementById('p_name').value,description:document.getElementById('p_desc').value,price:document.getElementById('p_price').value,delivery_type:document.getElementById('p_type').value,delivery_url:document.getElementById('p_url').value};const d=await api('createProduct',{method:'POST',body});if(d.ok){closeM('mProd');toast('Produto criado.');loadProd();}else toast(d.error||'Erro','err');}
async function toggleProd(id,a){await api('toggleProduct',{method:'POST',body:{product_id:id,is_active:a}});toast(a?'Produto ativado.':'Produto pausado.','warn');loadProd();}
async function delProd(id){if(!confirm('Desativar produto '+id+'?'))return;await api('deleteProduct',{method:'DELETE',params:{product_id:id}});toast('Produto removido.','warn');loadProd();}

// GRUPOS
async function loadGroups(){
  const d=await api('groups');
  if(!d.data?.length){document.getElementById('groupTable').innerHTML='<div class="empty"><div class="empty-ic">▤</div><div class="empty-txt">nenhum grupo</div></div>';return;}
  const rows=d.data.map(g=>\`<tr>
    <td><b>\${g.group_name}</b></td>
    <td><span class="mono" style="font-size:11px">\${g.group_id}</span></td>
    <td><span class="mono">R$ \${fmt(g.subscription_price)}</span></td>
    <td style="color:var(--fg3)">\${g.subscription_days}d</td>
    <td>\${g.is_active?tag('active'):tag('inactive')}</td>
    <td><div style="display:flex;gap:4px"><button class="btn btn-default btn-xs" onclick="toggleGrp('\${g.group_id}',\${!g.is_active})">\${g.is_active?'Pausar':'Ativar'}</button><button class="btn btn-danger btn-xs" onclick="delGrp('\${g.group_id}')">Remover</button></div></td>
  </tr>\`).join('');
  document.getElementById('groupTable').innerHTML=\`<table><thead><tr><th>Nome</th><th>ID</th><th>Preço</th><th>Duração</th><th>Status</th><th>Ações</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function saveGroup(){const body={group_id:document.getElementById('g_id').value,group_name:document.getElementById('g_name').value,group_link:document.getElementById('g_link').value,subscription_price:document.getElementById('g_price').value,subscription_days:document.getElementById('g_days').value};const d=await api('createGroup',{method:'POST',body});if(d.ok){closeM('mGroup');toast('Grupo criado.');loadGroups();}else toast(d.error||'Erro','err');}
async function toggleGrp(id,a){await api('toggleGroup',{method:'POST',body:{group_id:id,is_active:a}});toast(a?'Ativado.':'Pausado.','warn');loadGroups();}
async function delGrp(id){if(!confirm('Deletar grupo '+id+'?'))return;await api('deleteGroup',{method:'DELETE',params:{group_id:id}});toast('Grupo removido.','warn');loadGroups();}

// CUPONS
async function loadCoupons(){
  const d=await api('coupons');
  if(!d.data?.length){document.getElementById('couponTable').innerHTML='<div class="empty"><div class="empty-ic">◈</div><div class="empty-txt">nenhum cupom</div></div>';return;}
  const rows=d.data.map(c=>\`<tr>
    <td><b class="mono">\${c.code}</b></td>
    <td><span class="mono">\${c.discount_percentage}%</span></td>
    <td style="color:var(--fg3)">\${c.product_id||'todos'}</td>
    <td><span class="mono">\${c.current_uses||0}/\${c.max_uses||'∞'}</span></td>
    <td>\${c.is_active?tag('active'):tag('inactive')}</td>
    <td style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace">\${c.expires_at?fmtD(c.expires_at):'—'}</td>
    <td><div style="display:flex;gap:4px"><button class="btn btn-default btn-xs" onclick="toggleCoup('\${c.id}',\${!c.is_active})">\${c.is_active?'Pausar':'Ativar'}</button><button class="btn btn-danger btn-xs" onclick="delCoup('\${c.id}')">Remover</button></div></td>
  </tr>\`).join('');
  document.getElementById('couponTable').innerHTML=\`<table><thead><tr><th>Código</th><th>Desconto</th><th>Produto</th><th>Usos</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead><tbody>\${rows}</tbody></table>\`;
  const pd=await api('products');
  document.getElementById('c_prod').innerHTML='<option value="">Todos os produtos</option>'+(pd.data||[]).map(p=>\`<option value="\${p.product_id}">\${p.name}</option>\`).join('');
}
async function saveCoupon(){const body={code:document.getElementById('c_code').value,discount_percentage:document.getElementById('c_disc').value,product_id:document.getElementById('c_prod').value||null,max_uses:document.getElementById('c_uses').value||null,expires_at:document.getElementById('c_exp').value||null};const d=await api('createCoupon',{method:'POST',body});if(d.ok){closeM('mCoupon');toast('Cupom criado.');loadCoupons();}else toast(d.error||'Erro','err');}
async function toggleCoup(id,a){await api('toggleCoupon',{method:'POST',body:{coupon_id:id,is_active:a}});toast(a?'Ativado.':'Pausado.','warn');loadCoupons();}
async function delCoup(id){if(!confirm('Deletar cupom?'))return;await api('deleteCoupon',{method:'DELETE',params:{coupon_id:id}});toast('Cupom removido.','warn');loadCoupons();}

// USUÁRIOS
async function loadUsers(){
  document.getElementById('usersTable').innerHTML='<div class="loader"><div class="spin"></div></div>';
  const d=await api('users',{params:{page:pg.users,limit:25,search:document.getElementById('userQ').value,blocked:document.getElementById('userBl').value}});
  if(!d.data)return;
  const rows=d.data.map(u=>\`<tr>
    <td><b>\${u.first_name||'N/A'} \${u.last_name||''}</b></td>
    <td><span class="mono">@\${u.username||'—'}</span></td>
    <td><span class="mono">\${u.telegram_id}</span></td>
    <td><div style="display:flex;gap:4px;flex-wrap:wrap">\${u.is_blocked?tag('blocked'):tag('active')}\${u.is_admin?' '+tag('admin'):''}\${u.is_creator?' '+tag('creator'):''}</div></td>
    <td style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace">\${fmtD(u.created_at)}</td>
    <td><div style="display:flex;gap:4px">
      <button class="btn btn-default btn-xs" onclick="viewUser(\${u.telegram_id})">Ver</button>
      \${u.is_blocked?'<button class="btn btn-success btn-xs" onclick="unblockUser('+u.telegram_id+')">Desbloquear</button>':'<button class="btn btn-danger btn-xs" onclick="blockUser('+u.telegram_id+')">Bloquear</button>'}
    </div></td>
  </tr>\`).join('');
  document.getElementById('usersTable').innerHTML=\`<table><thead><tr><th>Nome</th><th>Username</th><th>Telegram ID</th><th>Status</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>\${rows||'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--fg3)">nenhum usuário</td></tr>'}</tbody></table>\`;
  pager('usersPager',d.page,d.pages,'setUsersPg');
}
function setUsersPg(p){pg.users=p;loadUsers();}
async function blockUser(tid){await api('blockUser',{method:'POST',body:{telegram_id:tid}});toast('Usuário bloqueado.','warn');loadUsers();}
async function unblockUser(tid){await api('unblockUser',{method:'POST',body:{telegram_id:tid}});toast('Usuário desbloqueado.');loadUsers();}
async function viewUser(tid){
  const d=await api('userDetail',{params:{telegram_id:tid}});
  const u=d.user||{};
  document.getElementById('udInfo').innerHTML='<div style="font-size:15px;font-weight:600">'+(u.first_name||'N/A')+' '+(u.last_name||'')+'</div><div class="mono" style="font-size:11px;color:var(--fg3)">@'+(u.username||'sem username')+' · '+u.telegram_id+'</div><div style="margin-top:6px;display:flex;gap:4px">'+(u.is_blocked?tag('blocked'):tag('active'))+(u.is_admin?' '+tag('admin'):'')+(u.is_creator?' '+tag('creator'):'')+'</div>';
  document.getElementById('udTx').innerHTML=(d.transactions||[]).map(t=>dlrow('<span class="mono">'+(t.txid||'').substring(0,16)+'…</span>','<div style="display:flex;gap:8px;align-items:center"><span class="mono">R$ '+fmt(t.amount)+'</span>'+tag(t.status)+'</div>')).join('')||'<div style="color:var(--fg3);font-size:13px;padding:12px">sem transações</div>';
  openM('mUser');
}

// CONFIÁVEIS
async function loadTrusted(){
  const d=await api('trustedUsers');
  if(!d.data?.length){document.getElementById('trustedTable').innerHTML='<div class="empty"><div class="empty-ic">◎</div><div class="empty-txt">nenhum usuário confiável</div></div>';return;}
  const rows=d.data.map(t=>\`<tr><td><span class="mono">\${t.telegram_id}</span></td><td>\${t.score||0}</td><td>\${t.is_approved?tag('active'):tag('pending')}</td><td style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace">\${fmtD(t.created_at)}</td></tr>\`).join('');
  document.getElementById('trustedTable').innerHTML=\`<table><thead><tr><th>Telegram ID</th><th>Score</th><th>Status</th><th>Data</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}

// TICKETS
async function loadTickets(){
  document.getElementById('tickTable').innerHTML='<div class="loader"><div class="spin"></div></div>';
  const d=await api('tickets',{params:{page:pg.tick,limit:20,status:document.getElementById('tickSt').value}});
  if(!d.data)return;
  const rows=d.data.map(t=>\`<tr>
    <td><b>#\${t.ticket_number||t.id?.substring(0,8)}</b></td>
    <td>\${t.user?.first_name||'N/A'} <span class="mono" style="font-size:11px;color:var(--fg3)">@\${t.user?.username||t.telegram_id||''}</span></td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg2)">\${t.subject||'—'}</td>
    <td>\${tag(t.status)}</td>
    <td style="font-size:11px;color:var(--fg3);font-family:'Geist Mono',monospace">\${fmtD(t.created_at)}</td>
    <td><div style="display:flex;gap:4px">
      <button class="btn btn-default btn-xs" onclick="viewTicket('\${t.id}','\${(t.subject||'Ticket').replace(/'/g,"\\\\'")}','\${t.status}')">Ver</button>
      \${t.status!=='resolved'?'<button class="btn btn-success btn-xs" onclick="resolveT(\\''+t.id+'\\')">Resolver</button>':''}
    </div></td>
  </tr>\`).join('');
  document.getElementById('tickTable').innerHTML=\`<table><thead><tr><th>#</th><th>Usuário</th><th>Assunto</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>\${rows||'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--fg3)">nenhum ticket</td></tr>'}</tbody></table>\`;
  pager('tickPager',d.page,d.pages,'setTickPg');
}
function setTickPg(p){pg.tick=p;loadTickets();}
async function viewTicket(id,subject,status){
  document.getElementById('mTickTitle').textContent=subject;
  document.getElementById('mTickMsgs').innerHTML='<div class="loader"><div class="spin"></div></div>';
  document.getElementById('btnResolveT').onclick=()=>{resolveT(id);closeM('mTicket');};
  document.getElementById('btnCloseT').onclick=()=>{closeT(id);closeM('mTicket');};
  document.getElementById('btnResolveT').style.display=status==='resolved'?'none':'';
  openM('mTicket');
  const d=await api('ticketMessages',{params:{ticket_id:id}});
  document.getElementById('mTickMsgs').innerHTML=(d.data||[]).map(m=>'<div class="msg '+(m.is_admin?'adm':'usr')+'"><div>'+m.message+'</div><div class="msg-meta">'+(m.is_admin?'admin':'usuário')+' · '+fmtD(m.created_at)+'</div></div>').join('')||'<div style="text-align:center;color:var(--fg3);padding:20px;font-size:12px">sem mensagens</div>';
}
async function resolveT(id){await api('resolveTicket',{method:'POST',body:{ticket_id:id}});toast('Ticket resolvido.');loadTickets();}
async function closeT(id){await api('closeTicket',{method:'POST',body:{ticket_id:id}});toast('Ticket fechado.','warn');loadTickets();}
async function progressT(id){await api('progressTicket',{method:'POST',body:{ticket_id:id}});toast('Em andamento.','warn');loadTickets();}

// BROADCAST
async function loadBC(){
  const d=await api('broadcasts');
  if(!d.data?.length){document.getElementById('bcList').innerHTML='<div class="empty"><div class="empty-ic">◎</div><div class="empty-txt">nenhuma campanha<br><span style="font-size:11px">crie pelo bot no Telegram</span></div></div>';return;}
  document.getElementById('bcList').innerHTML=d.data.map(c=>{
    const done=(c.success_count||0)+(c.failed_count||0);
    const pct=c.total_users>0?Math.round(done/c.total_users*100):0;
    const colors={sent:'var(--success)',sending:'var(--violet-l)',pending:'var(--warn)',cancelled:'var(--fg3)'};
    return\`<div class="bc">
      <div class="bc-status" style="background:\${colors[c.status]||'var(--fg3)'}"></div>
      <div class="bc-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <div class="bc-name">\${c.name||'Campanha'}</div>
          <div style="display:flex;gap:8px;align-items:center">\${tag(c.status)}\${(c.status==='pending'||c.status==='sending')?'<button class="btn btn-danger btn-xs" onclick="cancelBC(\\''+c.id+'\\')">Cancelar</button>':''}</div>
        </div>
        <div class="bc-meta">✓ \${c.success_count||0} &nbsp;✗ \${c.failed_count||0} &nbsp;total \${c.total_users||'?'} &nbsp;· \${fmtD(c.created_at)}</div>
        <div class="progress" style="margin-top:8px"><div class="progress-fill" style="width:\${pct}%"></div></div>
        <div style="font-size:10px;color:var(--fg3);font-family:'Geist Mono',monospace;margin-top:4px">\${pct}% concluído</div>
      </div>
    </div>\`;
  }).join('');
}
async function cancelBC(id){await api('cancelBroadcast',{method:'POST',body:{campaign_id:id}});toast('Campanha cancelada.','warn');loadBC();}

// AUTO RESPONSES
async function loadAR(){
  const d=await api('autoResponses');
  if(!d.data?.length){document.getElementById('arTable').innerHTML='<div class="empty"><div class="empty-ic">◈</div><div class="empty-txt">nenhuma resposta automática</div></div>';return;}
  const rows=d.data.map(r=>\`<tr>
    <td><b class="mono">\${r.keyword}</b></td>
    <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg2)">\${r.response}</td>
    <td><span class="mono">\${r.priority}</span></td>
    <td>\${r.is_active?tag('active'):tag('inactive')}</td>
    <td><span class="mono" style="color:var(--fg3)">\${r.usage_count||0}×</span></td>
    <td><button class="btn btn-danger btn-xs" onclick="delAR('\${r.id}')">Remover</button></td>
  </tr>\`).join('');
  document.getElementById('arTable').innerHTML=\`<table><thead><tr><th>Keyword</th><th>Resposta</th><th>Prioridade</th><th>Status</th><th>Usos</th><th>Ação</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function saveAR(){const body={keyword:document.getElementById('ar_kw').value,response:document.getElementById('ar_resp').value,priority:document.getElementById('ar_pri').value};const d=await api('createAutoResponse',{method:'POST',body});if(d.ok){closeM('mAR');toast('Resposta criada.');loadAR();}else toast(d.error||'Erro','err');}
async function delAR(id){if(!confirm('Remover resposta?'))return;await api('deleteAutoResponse',{method:'DELETE',params:{id}});toast('Removida.','warn');loadAR();}

// SETTINGS - ver abaixo

// DDDs
async function loadDDDs(){
  const d=await api('blockedDDDs');
  if(!d.data?.length){document.getElementById('dddTable').innerHTML='<div class="empty"><div class="empty-ic">◬</div><div class="empty-txt">nenhum DDD bloqueado</div></div>';return;}
  const rows=d.data.map(x=>\`<tr><td><b class="mono">\${x.area_code}</b></td><td style="color:var(--fg2)">\${x.state||'—'}</td><td style="color:var(--fg3)">\${x.reason||'—'}</td><td><button class="btn btn-default btn-xs" onclick="remDDD('\${x.area_code}')">Remover</button></td></tr>\`).join('');
  document.getElementById('dddTable').innerHTML=\`<table><thead><tr><th>DDD</th><th>Estado</th><th>Motivo</th><th>Ação</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function addDDD(){const body={area_code:document.getElementById('ddd_c').value,state:document.getElementById('ddd_s').value,reason:document.getElementById('ddd_r').value};const d=await api('addDDD',{method:'POST',body});if(d.ok){closeM('mDDD');toast('DDD bloqueado.','warn');loadDDDs();}else toast(d.error||'Erro','err');}
async function remDDD(code){if(!confirm('Desbloquear DDD '+code+'?'))return;await api('removeDDD',{method:'DELETE',params:{area_code:code}});toast('DDD desbloqueado.');loadDDDs();}


// MEDIA PACKS
async function loadMP(){
  const d=await api('mediaPacks');
  if(!d.data?.length){document.getElementById('mpTable').innerHTML='<div class=\\"empty\\"><div class=\\"empty-ic\\">▤</div><div class=\\"empty-txt\\">nenhum media pack</div></div>';return;}
  const rows=d.data.map(p=>'<tr><td><b>'+p.name+'</b></td><td class=\\"mono\\">'+p.pack_id+'</td><td class=\\"mono\\">R$ '+fmt(p.price)+'</td><td class=\\"mono\\">'+(p.items_per_delivery||3)+' itens/entrega</td><td>'+tag(p.is_active?'active':'inactive')+'</td><td><button class=\\"btn btn-default btn-xs\\" onclick=\\"viewMP(\\'' +p.pack_id+'\\',\\''+p.name.replace(/'/g,'\\\\\\'')+'\\')\\" >Ver itens</button></td></tr>').join('');
  document.getElementById('mpTable').innerHTML='<table><thead><tr><th>Nome</th><th>Pack ID</th><th>Preço</th><th>Entrega</th><th>Status</th><th>Ação</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
async function viewMP(packId,name){
  document.getElementById('mMPTitle').textContent=name;document.getElementById('mMPItems').innerHTML='<div class=\\"loader\\"><div class=\\"spin\\"></div></div>';openM('mMP');
  const d=await api('mediaItems',{params:{pack_id:packId}});const items=d.data||[];
  document.getElementById('mMPCount').textContent='('+items.length+' itens)';
  document.getElementById('mMPInfo').textContent='Pack ID: '+packId+' · '+items.length+' arquivos';
  document.getElementById('mMPItems').innerHTML=items.map(i=>{const isImg=i.file_type&&(i.file_type.includes('image')||i.file_type.includes('photo'));return'<div class=\\"media-thumb\\" title=\\"'+i.file_name+'\\">'+(isImg&&i.file_url?'<img src=\\"'+i.file_url+'\\" loading=\\"lazy\\">':'<span>'+(i.file_type||'file')+'</span>')+'</div>';}).join('')||'<div style=\\"grid-column:1/-1;color:var(--fg3);text-align:center;padding:20px;font-size:12px\\">sem itens</div>';
}

// USUÁRIOS INFINITE SCROLL
let uState={loading:false,done:false,offset:0,limit:30,q:'',bl:''};
function initUsers(){
  uState={loading:false,done:false,offset:0,limit:30,q:document.getElementById('userQ').value,bl:document.getElementById('userBl').value};
  document.getElementById('usersBody').innerHTML='';
  document.getElementById('usersEnd').style.display='none';
  loadMoreUsers();
}
function resetUserScroll(){
  uState.offset=0;uState.done=false;uState.q=document.getElementById('userQ').value;uState.bl=document.getElementById('userBl').value;
  document.getElementById('usersBody').innerHTML='';document.getElementById('usersEnd').style.display='none';
  loadMoreUsers();
}
function searchUsers(){resetUserScroll();}
async function loadMoreUsers(){
  if(uState.loading||uState.done)return;
  uState.loading=true;
  document.getElementById('usersLoader').style.display='flex';
  const d=await api('usersScroll',{params:{offset:uState.offset,limit:uState.limit,search:uState.q,blocked:uState.bl}});
  document.getElementById('usersLoader').style.display='none';
  const items=d.data||[];
  if(d.total!==undefined)document.getElementById('userCountLbl').textContent=d.total.toLocaleString()+' usuários';
  const tbody=document.getElementById('usersBody');
  items.forEach(u=>{
    const tr=document.createElement('tr');
    const tgLink=u.username?'https://t.me/'+u.username:'tg://user?id='+u.telegram_id;
    const phoneLink=u.phone_number?'https://t.me/+'+u.phone_number.replace(/\\D/g,''):'';
    tr.innerHTML='<td><b>'+(u.first_name||'N/A')+(u.last_name?' '+u.last_name:'')+'</b></td>'
      +'<td>'+(u.username?'<a href=\\"https://t.me/'+u.username+'\\" target=\\"_blank\\" class=\\"mono\\" style=\\"color:var(--violet-ll);font-size:12px;text-decoration:none\\">@'+u.username+'</a>':'<span style=\\"color:var(--fg3)\\">—</span>')+'</td>'
      +'<td><a href=\\"'+tgLink+'\\" target=\\"_blank\\" class=\\"mono\\" style=\\"color:var(--violet-ll);font-size:12px\\">'+u.telegram_id+'</a></td>'
      +'<td>'+(u.phone_number?'<a href=\\"'+phoneLink+'\\" target=\\"_blank\\" class=\\"mono\\" style=\\"color:var(--fg2);font-size:12px\\">'+u.phone_number+'</a>':'<span style=\\"color:var(--fg3)\\">—</span>')+'</td>'
      +'<td><div style=\\"display:flex;gap:3px;flex-wrap:wrap\\">'+tag(u.is_blocked?'blocked':'active')+(u.is_admin?tag('admin'):'')+(u.is_creator?tag('creator'):'')+'</div></td>'
      +'<td style=\\"font-size:10px;color:var(--fg3);font-family:\\'Geist Mono\\',monospace\\">'+fmtDs(u.created_at)+'</td>'
      +'<td><div style=\\"display:flex;gap:3px\\"><button class=\\"btn btn-default btn-xs\\" onclick=\\"viewUser('+u.telegram_id+')\\">Ver</button>'+(u.is_blocked?'<button class=\\"btn btn-success btn-xs\\" onclick=\\"unblockUser('+u.telegram_id+')\\">↑</button>':'<button class=\\"btn btn-danger btn-xs\\" onclick=\\"blockUser('+u.telegram_id+')\\">Bloquear</button>')+'</div></td>';
    tbody.appendChild(tr);
  });
  uState.offset+=items.length;uState.loading=false;
  if(items.length<uState.limit){uState.done=true;document.getElementById('usersEnd').style.display='block';}
}

// BROADCAST DETAIL
async function viewBC(id){
  const d=await api('broadcasts');const c=(d.data||[]).find(x=>x.id===id)||{};
  document.getElementById('mBCTitle').textContent=c.name||'Campanha';
  document.getElementById('mBCBody').innerHTML='<div style=\\"display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px\\"><div><div style=\\"font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px\\">Status</div>'+tag(c.status)+'</div><div><div style=\\"font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px\\">Público</div><span class=\\"mono\\" style=\\"font-size:12px\\">'+(c.target_audience||'all')+'</span></div><div><div style=\\"font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px\\">Sucesso / Falha</div><span class=\\"mono\\" style=\\"font-size:12px\\">✓'+(c.success_count||0)+' / ✗'+(c.failed_count||0)+'</span></div><div><div style=\\"font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px\\">Cupom</div><span class=\\"mono\\" style=\\"font-size:12px\\">'+(c.coupon_code||'—')+'</span></div></div>'+(c.message?'<div style=\\"font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px\\">Mensagem</div><div style=\\"background:var(--s3);border:1px solid var(--line);border-radius:6px;padding:10px;font-size:12px;color:var(--fg2);white-space:pre-wrap;max-height:160px;overflow:auto\\">'+c.message+'</div>':'');
  const running=c.status==='sending'||c.status==='pending_broadcast';
  document.getElementById('btnCancelBC').style.display=running?'':'none';
  document.getElementById('btnCancelBC').onclick=()=>{cancelBC(id);closeM('mBC');};
  openM('mBC');
}

// CONFIGURAÇÕES COMPLETAS
async function loadSettings(){
  const d=await api('settings');const s=d.settings||{};
  document.getElementById('pixKey').value=s.pix_key||'';
  document.getElementById('supportLink').value=s.support_contact||'';
  document.getElementById('creatorId').value=s.creator_telegram_id||'';
  document.getElementById('creator2Id').value=s.creator2_telegram_id||'';
  document.getElementById('bcCouponEnabled').checked=s.broadcast_coupon_enabled==='true';
}
async function saveSetting(key,value,msg){await api('saveSetting',{method:'POST',body:{key,value}});toast(msg||'Salvo.');}
async function saveCreatorIds(){
  await Promise.all([
    api('saveSetting',{method:'POST',body:{key:'creator_telegram_id',value:document.getElementById('creatorId').value}}),
    api('saveSetting',{method:'POST',body:{key:'creator2_telegram_id',value:document.getElementById('creator2Id').value}})
  ]);
  toast('IDs de criador salvos.');
}

// ANALYTICS - recalcular
async function recalcValues(){toast('Recalculando...','warn');const d=await api('recalculateValues',{method:'POST'});if(d.ok)toast('Recalculado. Correções: '+(d.fixed||0));else toast(d.error||'Erro ao recalcular','err');}

// ENTREGA MANUAL
let delProds={product:[],mediapack:[],group:[]};
async function loadDeliver(){
  const[pd,mp,gp]=await Promise.all([api('products'),api('mediaPacks'),api('groups')]);
  delProds.product=(pd.data||[]).filter(p=>p.is_active);
  delProds.mediapack=(mp.data||[]).filter(p=>p.is_active);
  delProds.group=(gp.data||[]).filter(g=>g.is_active);
  updateDelProduct();
}
function updateDelProduct(){
  const type=document.getElementById('delType').value;
  const items=delProds[type]||[];
  const kId=type==='product'?'product_id':type==='mediapack'?'pack_id':'group_id';
  const kName=type==='product'?'name':type==='mediapack'?'name':'group_name';
  document.getElementById('delProduct').innerHTML=items.map(p=>'<option value="'+p[kId]+'">'+(p[kName]||p[kId])+'</option>').join('')||'<option>Nenhum ativo disponível</option>';
}
async function lookupDelUser(){
  const tid=document.getElementById('delUserId').value;if(!tid)return;
  const d=await api('userDetail',{params:{telegram_id:tid}});const u=d.user;
  const div=document.getElementById('delUserInfo');
  if(!u){div.innerHTML='<span style="color:var(--danger)">Usuário não encontrado</span>';div.style.display='block';return;}
  div.innerHTML='<b>'+(u.first_name||'N/A')+' '+(u.last_name||'')+'</b> &nbsp;<span class="mono" style="color:var(--fg3)">@'+(u.username||u.telegram_id)+'</span>'+(u.is_blocked?'&nbsp;<span style="color:var(--danger)">🔴 BLOQUEADO</span>':'&nbsp;<span style="color:var(--success)">● ativo</span>');
  div.style.display='block';
}
async function doManualDeliver(){
  const telegram_id=document.getElementById('delUserId').value;
  const type=document.getElementById('delType').value;
  const product_id=document.getElementById('delProduct').value;
  if(!telegram_id||!product_id){toast('Preencha todos os campos','err');return;}
  if(!confirm('Entregar para usuário '+telegram_id+'?'))return;
  const d=await api('manualDeliver',{method:'POST',body:{telegram_id,type,product_id}});
  if(d.ok)toast('Entregue com sucesso!');else toast(d.error||'Erro na entrega','err');
}

// SCROLL INFINITO USUÁRIOS
document.getElementById('mainContent').addEventListener('scroll',function(){
  if(currentSec!=='users')return;
  if(this.scrollHeight-this.scrollTop-this.clientHeight<250)loadMoreUsers();
},{passive:true});

// INIT
checkAuth().then(()=>loadDash());
setInterval(()=>{if(currentSec==='dashboard')loadDash();},60000);
</script>
</body>
</html>
`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
