/* Feature Panels — mini functional pages for Guru & Murid dashboards.
   Opens as a full-screen overlay driven by nav-item[data-feature]. */
(function(){
  const LS = {
    get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(_){ return d; } },
    set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){ } }
  };
  const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ── inject styles (Polished UI/UX) ──
  const css = `
  .fp-overlay{position:fixed;inset:0;background:rgba(15,23,42,.65);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:none;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  .fp-overlay.open{display:flex}
  .fp-modal{background:#fff;border-radius:20px;max-width:1120px;width:100%;box-shadow:0 25px 70px -10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.04);overflow:hidden;animation:fpIn .22s cubic-bezier(0.16, 1, 0.3, 1)}
  @keyframes fpIn{from{transform:translateY(12px) scale(0.98);opacity:0}to{transform:none;opacity:1}}
  .fp-head{display:flex;align-items:center;justify-content:space-between;padding:20px 26px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)}
  .fp-title{font-size:19px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:12px;letter-spacing:-0.02em}
  .fp-title .fp-ico{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;display:grid;place-items:center;font-weight:800;font-size:16px;box-shadow:0 4px 12px rgba(79,70,229,.35)}
  .fp-sub{font-size:12.5px;color:#64748b;margin-top:3px;font-weight:500}
  .fp-close{width:36px;height:36px;border-radius:11px;background:#fff;border:1px solid #e2e8f0;cursor:pointer;display:grid;place-items:center;font-size:19px;color:#64748b;transition:all .15s}
  .fp-close:hover{background:#f1f5f9;color:#0f172a;transform:scale(1.05)}
  .fp-body{padding:24px 26px;max-height:calc(100vh - 160px);overflow-y:auto}
  .fp-body::-webkit-scrollbar{width:7px}
  .fp-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
  .fp-grid{display:grid;gap:16px}
  .fp-grid.c2{grid-template-columns:repeat(2,1fr)}
  .fp-grid.c3{grid-template-columns:repeat(3,1fr)}
  .fp-grid.c4{grid-template-columns:repeat(4,1fr)}
  @media(max-width:840px){.fp-grid.c2,.fp-grid.c3,.fp-grid.c4{grid-template-columns:1fr}}
  .fp-card{border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.02);transition:border-color .15s}
  .fp-card h4{margin:0 0 6px;font-size:14.5px;font-weight:700;color:#0f172a}
  .fp-card p{margin:0;font-size:13px;color:#64748b;line-height:1.6}
  .fp-stat{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.02)}
  .fp-stat .v{font-size:24px;font-weight:800;color:#4f46e5;font-variant-numeric:tabular-nums}
  .fp-stat .l{font-size:12px;color:#64748b;font-weight:600}
  .fp-btn{background:#4f46e5;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:7px;transition:all .15s;box-shadow:0 3px 10px rgba(79,70,229,.22)}
  .fp-btn:hover{background:#4338ca;box-shadow:0 5px 14px rgba(79,70,229,.32);transform:translateY(-1px)}
  .fp-btn.ghost{background:#fff;color:#334155;border:1px solid #cbd5e1;box-shadow:none}
  .fp-btn.ghost:hover{background:#f8fafc;border-color:#94a3b8;color:#0f172a}
  .fp-btn.danger{background:#ef4444;box-shadow:0 3px 10px rgba(239,68,68,.25)}
  .fp-btn.danger:hover{background:#dc2626}
  .fp-btn.sm{padding:6px 12px;font-size:12px;border-radius:8px}
  .fp-input,.fp-select,.fp-textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:10px 13px;font-size:13px;font-family:inherit;background:#fff;color:#0f172a;transition:all .15s}
  .fp-input:focus,.fp-select:focus,.fp-textarea:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.15)}
  .fp-textarea{resize:vertical;min-height:75px}
  .fp-label{display:block;font-size:12px;font-weight:700;color:#475569;margin:0 0 6px}
  .fp-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .fp-table{width:100%;border-collapse:collapse;font-size:13px}
  .fp-table th,.fp-table td{padding:11px 13px;text-align:left;border-bottom:1px solid #f1f5f9}
  .fp-table th{background:#f8fafc;font-size:12px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
  .fp-table tr:hover td{background:#fafbff}
  .fp-badge{display:inline-block;padding:3.5px 10px;border-radius:999px;font-size:11.5px;font-weight:700}
  .fp-badge.ok{background:#dcfce7;color:#15803d}
  .fp-badge.warn{background:#fef3c7;color:#b45309}
  .fp-badge.err{background:#fee2e2;color:#b91c1c}
  .fp-badge.info{background:#e0e7ff;color:#3730a3}
  .fp-tabs{display:flex;gap:6px;border-bottom:1px solid #e2e8f0;margin-bottom:16px}
  .fp-tab{padding:10px 16px;font-size:13.5px;font-weight:700;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
  .fp-tab.on{color:#4f46e5;border-color:#4f46e5}
  .fp-tab:hover:not(.on){color:#0f172a}
  .fp-list{display:flex;flex-direction:column;gap:10px}
  .fp-item{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.02);transition:all .15s}
  .fp-item:hover{border-color:#cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,.04)}
  .fp-item .t{font-weight:700;color:#0f172a;font-size:14px}
  .fp-item .m{font-size:12px;color:#64748b;margin-top:3px}
  .fp-empty{padding:42px 20px;text-align:center;color:#94a3b8;font-size:13.5px}
  .fp-chat{display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;padding:12px;background:#f8fafc;border-radius:12px;margin-bottom:12px;border:1px solid #e2e8f0}
  .fp-msg{max-width:80%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55}
  .fp-msg.u{background:#4f46e5;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .fp-msg.a{background:#fff;color:#0f172a;align-self:flex-start;border:1px solid #e2e8f0;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  .fp-chk{display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none;font-size:13px;font-weight:500}
  .fp-chk input{width:17px;height:17px;accent-color:#4f46e5}
  .fp-sbar{height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin-top:8px}
  .fp-sfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#4f46e5,#06b6d4);transition:width .35s ease}
  .fp-mpick{position:relative;display:inline-block;min-width:155px}
  .fp-mpick-btn{text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:26px}
  .fp-mpick-pop{display:none;position:fixed;z-index:10050;width:272px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;box-shadow:0 20px 50px rgba(15,23,42,.28)}
  .fp-mpick.open .fp-mpick-pop{display:block}
  .fp-mpick-pre{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}
  .fp-mpick-list{display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:210px;overflow-y:auto}
  [data-theme="dark"] .fp-mpick-pop{background:#1e293b;border-color:#475569;color:#f8fafc}
  [data-theme="dark"] .fp-mpick-pre{border-color:#334155}
  [data-theme="dark"] .fp-modal{background:#0f172a;color:#e2e8f0;box-shadow:0 25px 70px -10px rgba(0,0,0,.7),0 0 0 1px rgba(148,163,184,.15)}
  [data-theme="dark"] .fp-head{background:linear-gradient(135deg,#1e293b 0%,#1e1b4b 100%);border-color:#334155}
  [data-theme="dark"] .fp-title,[data-theme="dark"] .fp-card h4,[data-theme="dark"] .fp-item .t{color:#f8fafc}
  [data-theme="dark"] .fp-sub,[data-theme="dark"] .fp-card p,[data-theme="dark"] .fp-item .m,[data-theme="dark"] .fp-stat .l,[data-theme="dark"] .fp-label{color:#94a3b8}
  [data-theme="dark"] .fp-card,[data-theme="dark"] .fp-stat,[data-theme="dark"] .fp-item{background:#1e293b;border-color:#334155}
  [data-theme="dark"] .fp-close,[data-theme="dark"] .fp-btn.ghost{background:#1e293b;color:#e2e8f0;border-color:#475569}
  [data-theme="dark"] .fp-input,[data-theme="dark"] .fp-select,[data-theme="dark"] .fp-textarea{background:#0f172a;color:#f8fafc;border-color:#475569}
  [data-theme="dark"] .fp-table th{background:#1e293b;color:#cbd5e1;border-color:#334155}
  [data-theme="dark"] .fp-table td{border-color:#1e293b}
  [data-theme="dark"] .fp-table tr:hover td{background:#1e293b}
  [data-theme="dark"] .fp-chat{background:#0f172a;border-color:#334155}
  [data-theme="dark"] .fp-msg.a{background:#1e293b;color:#e2e8f0;border-color:#334155}
  [data-theme="dark"] .fp-sbar{background:#334155}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ── overlay skeleton ──
  const overlay = document.createElement('div');
  overlay.className = 'fp-overlay';
  overlay.innerHTML = `<div class="fp-modal" role="dialog" aria-modal="true">
    <div class="fp-head">
      <div>
        <div class="fp-title"><span class="fp-ico" id="fpIco">•</span><span id="fpT">Judul</span></div>
        <div class="fp-sub" id="fpS"></div>
      </div>
      <button class="fp-close" aria-label="Tutup">×</button>
    </div>
    <div class="fp-body" id="fpB"></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if(e.target===overlay){ close(); return; }
    const btn = e.target.closest('.fp-mpick-btn');
    if(btn){
      const wrap = btn.closest('.fp-mpick');
      const was = wrap.classList.contains('open');
      overlay.querySelectorAll('.fp-mpick.open').forEach(x=>x.classList.remove('open'));
      if(!was){
        wrap.classList.add('open');
        const pop = wrap.querySelector('.fp-mpick-pop');
        if(pop){
          const r = btn.getBoundingClientRect();
          const ph = pop.offsetHeight || 260;
          const pw = pop.offsetWidth || 272;
          const top = (r.bottom + 6 + ph > window.innerHeight - 12 && r.top - ph - 6 > 12) ? (r.top - ph - 6) : Math.min(window.innerHeight - ph - 12, r.bottom + 6);
          const left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left));
          pop.style.top = Math.max(12, top) + 'px';
          pop.style.left = left + 'px';
        }
      }
      return;
    }
    const preBtn = e.target.closest('[data-pre]');
    if(preBtn){
      const wrap = preBtn.closest('.fp-mpick');
      const pre = preBtn.dataset.pre;
      const cbs = [...wrap.querySelectorAll('.fp-mpick-list input[type="checkbox"]')];
      if(pre==='ALL'){ cbs.forEach(c=>c.checked=false); }
      else {
        const group = cbs.filter(c=>c.value.startsWith(pre+'-'));
        const allOn = group.every(c=>c.checked);
        group.forEach(c=>c.checked=!allOn);
      }
      syncMultiPick(wrap);
      return;
    }
    if(!e.target.closest('.fp-mpick')) overlay.querySelectorAll('.fp-mpick.open').forEach(x=>x.classList.remove('open'));
  });
  overlay.addEventListener('change', e => {
    if(e.target.matches('.fp-mpick-list input[type="checkbox"]')) syncMultiPick(e.target.closest('.fp-mpick'));
  });
  overlay.querySelector('.fp-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if(e.key==='Escape') close(); });

  let _currentFeat=null;
  function open(feat){
    const def = FEATURES[feat]; if(!def) return;
    _currentFeat = feat;
    document.getElementById('fpIco').textContent = def.ico || '★';
    document.getElementById('fpT').textContent = def.title;
    document.getElementById('fpS').textContent = def.sub || '';
    document.getElementById('fpB').innerHTML = '';
    overlay.classList.add('open');
    def.render(document.getElementById('fpB'));
  }
  function close(){ overlay.classList.remove('open'); _currentFeat=null; emitSync(); }
  try{ window.__fpOpen = open; window.__fpClose = close; window.__fpSync = () => Promise.all([SharedCatalog.pull(), Activity.pull()]).then(emitSync); }catch(_){}
  // Live-sync: kalau guru update di tab lain, panel terbuka ikut refresh
  window.addEventListener('storage', e=>{
    if(!_currentFeat || !e.key) return;
    if(/^pb\.guru\.(materi|tugas|lkpd|quiz|kelas)/.test(e.key)){
      const def=FEATURES[_currentFeat]; if(def) def.render(document.getElementById('fpB'));
    }
  });

  // ── data helpers ──
  const ROLE = /murid/i.test(location.pathname) ? 'murid' : 'guru';
  const K = k => `pb.${ROLE}.${k}`;
  // Konten yang dibagikan guru→siswa memakai satu kunci bersama,
  // supaya materi/tugas/LKPD yang diunggah guru langsung terlihat di akun siswa.
  const SK = k => `pb.guru.${k}`;

  // ── Katalog kelas yang diampu guru (whitelist untuk gate murid) ──
  // VIII A–D → KKA · X-1..4 → Informatika+KKA · XI-2, XI-4 → KKA · XII-2, XII-4 → Informatika
  const CLASS_CATALOG = [
    {n:'VIII-A',mapel:['KKA']}, {n:'VIII-B',mapel:['KKA']}, {n:'VIII-C',mapel:['KKA']}, {n:'VIII-D',mapel:['KKA']},
    {n:'X-1',mapel:['Informatika','KKA']}, {n:'X-2',mapel:['Informatika','KKA']}, {n:'X-3',mapel:['Informatika','KKA']}, {n:'X-4',mapel:['Informatika','KKA']},
    {n:'XI-2',mapel:['KKA']}, {n:'XI-4',mapel:['KKA']},
    {n:'XII-2',mapel:['Informatika']}, {n:'XII-4',mapel:['Informatika']}
  ];
  const ALL_CLASSES = CLASS_CATALOG.map(c=>c.n);
  const classOptionsHtml = (sel)=>`<option value="ALL" ${sel==='ALL'?'selected':''}>🌐 Semua Kelas</option>`+ALL_CLASSES.map(n=>`<option value="${n}" ${n===sel?'selected':''}>${n}</option>`).join('');
  const canonOne = (value)=>{
    const raw=String(value||'').trim().toUpperCase().replace(/\s+/g,'-').replace(/--+/g,'-');
    if(raw==='ALL'||raw==='SEMUA-KELAS'||raw==='SEMUA') return 'ALL';
    const roman=raw.match(/^(VIII|XII|XI|X)-?([A-D]|[1-4])$/);
    return roman ? `${roman[1]}-${roman[2]}` : raw;
  };
  const canonicalClass = (value)=>{
    if(Array.isArray(value)){
      const arr=value.map(canonOne).filter(Boolean);
      return (!arr.length || arr.includes('ALL')) ? 'ALL' : [...new Set(arr)].join(', ');
    }
    const str=String(value||'').trim();
    if(!str) return '';
    if(str.includes(',')){
      const arr=str.split(',').map(canonOne).filter(Boolean);
      return (!arr.length || arr.includes('ALL')) ? 'ALL' : [...new Set(arr)].join(', ');
    }
    return canonOne(str);
  };
  const parseClassList = (k)=>{
    if(Array.isArray(k)) return k.map(canonOne).filter(Boolean);
    const s=String(k||'').trim();
    if(!s) return [];
    return s.split(',').map(canonOne).filter(Boolean);
  };
  const multiPickLabel = (val)=>{
    const list=parseClassList(val);
    if(!list.length || list.includes('ALL')) return '🌐 Semua Kelas';
    return list.length===1 ? '🎯 '+list[0] : '✅ '+list.slice(0,2).join(', ')+(list.length>2?' +'+(list.length-2):'')+' ('+list.length+')';
  };
  const syncMultiPick = (wrap)=>{
    if(!wrap) return;
    const cbs=[...wrap.querySelectorAll('.fp-mpick-list input[type="checkbox"]')];
    const sel=cbs.filter(c=>c.checked).map(c=>c.value);
    const val=(!sel.length || sel.length===cbs.length) ? 'ALL' : sel.join(', ');
    const inp=wrap.querySelector('input[type="hidden"]');
    const btn=wrap.querySelector('.fp-mpick-btn');
    if(inp){ inp.value=val; inp.dispatchEvent(new Event('change',{bubbles:true})); }
    if(btn) btn.textContent=multiPickLabel(val)+' ▾';
  };
  const multiClassPickerHtml = (id, sel='ALL', style='width:165px')=>{
    const clean=canonicalClass(sel)||'ALL';
    const chosen=clean==='ALL'?[]:parseClassList(clean);
    return `<div class="fp-mpick" style="${style}">
      <input type="hidden" id="${id}" value="${esc(clean)}"/>
      <button type="button" class="fp-select fp-mpick-btn" aria-label="Pilih satu atau lebih kelas">${esc(multiPickLabel(clean))} ▾</button>
      <div class="fp-mpick-pop">
        <div class="fp-mpick-pre">
          <button type="button" class="fp-btn sm" data-pre="ALL">🌐 Semua</button>
          <button type="button" class="fp-btn sm ghost" data-pre="VIII">VIII</button>
          <button type="button" class="fp-btn sm ghost" data-pre="X">X</button>
          <button type="button" class="fp-btn sm ghost" data-pre="XI">XI</button>
          <button type="button" class="fp-btn sm ghost" data-pre="XII">XII</button>
        </div>
        <div class="fp-mpick-list">${ALL_CLASSES.map(n=>`<label class="fp-chk"><input type="checkbox" value="${n}" ${chosen.includes(n)?'checked':''}> ${n}</label>`).join('')}</div>
      </div>
    </div>`;
  };
  const kelasLabel = (k)=> canonicalClass(k)==='ALL' ? 'Semua Kelas' : (canonicalClass(k)||'-');
  const matchesClass = (k, my)=>{
    const list=parseClassList(k);
    if(!list.length) return false;
    const mc=canonOne(my);
    return list.includes('ALL') || list.includes(mc);
  };
  const isValidClass = (k)=>{
    const list=parseClassList(k);
    return list.length>0 && list.every(c=>c==='ALL'||ALL_CLASSES.includes(c));
  };
  const SUBJECTS = {KKA:'Koding dan Kecerdasan Artifisial (KKA)',Informatika:'Informatika'};
  const materialSubject = m => Object.hasOwn(SUBJECTS,m.mapel) ? m.mapel : '';
  const subjectOptionsHtml = (selected, allowed=Object.keys(SUBJECTS), empty='Belum dikelompokkan') =>
    `<option value="">${empty}</option>`+allowed.map(s=>`<option value="${s}" ${s===selected?'selected':''}>${esc(SUBJECTS[s])}</option>`).join('');

  // ── Master Katalog Data Bawaan (Kurikulum Merdeka Informatika & KKA) ──
  const DEFAULT_CATALOG = {
    materi: [
      { j: 'Pengenalan Koding dan Algoritma Dasar', k: 'ALL', mapel: 'KKA', s: 'Terbit', l: 'https://id.wikipedia.org/wiki/Algoritme' },
      { j: 'Dasar Pemrograman Visual dengan Scratch & Blok', k: 'VIII-A', mapel: 'KKA', s: 'Terbit', l: 'https://scratch.mit.edu' },
      { j: 'Logika Percabangan (If-Else) & Perulangan (Loops)', k: 'VIII-B', mapel: 'KKA', s: 'Terbit', l: 'https://scratch.mit.edu/ideas' },
      { j: 'Berpikir Komputasional & Logika Pemecahan Masalah', k: 'X-1', mapel: 'Informatika', s: 'Terbit', l: 'https://bebras.or.id' },
      { j: 'Teknologi Informasi & Komunikasi: Integrasi Cloud Office', k: 'X-1', mapel: 'Informatika', s: 'Terbit', l: 'https://support.google.com/docs' },
      { j: 'Sistem Komputer: Hardware, Software & Interaksinya', k: 'X-2', mapel: 'Informatika', s: 'Terbit', l: 'https://id.wikipedia.org/wiki/Sistem_komputer' },
      { j: 'Dasar Pemrograman Python: Tipe Data, Variabel & Kondisi', k: 'X-1', mapel: 'Informatika', s: 'Terbit', l: 'https://docs.python.org/3/tutorial/' },
      { j: 'Pengantar Kecerdasan Artifisial & Machine Learning', k: 'X-1', mapel: 'KKA', s: 'Terbit', l: 'https://teachablemachine.withgoogle.com' },
      { j: 'Prompt Engineering & Pemanfaatan LLM Generatif', k: 'X-3', mapel: 'KKA', s: 'Terbit', l: 'https://learnprompting.org' },
      { j: 'Model Pembelajaran Mesin: Supervised & Unsupervised', k: 'XI-2', mapel: 'KKA', s: 'Terbit', l: 'https://scikit-learn.org' },
      { j: 'Computer Vision & Pengenalan Pola Citra Digital', k: 'XI-4', mapel: 'KKA', s: 'Terbit', l: 'https://opencv.org' },
      { j: 'Rekayasa Web: Struktur HTML5, CSS Modern & JavaScript', k: 'XII-2', mapel: 'Informatika', s: 'Terbit', l: 'https://developer.mozilla.org' },
      { j: 'Jaringan Komputer, Protokol TCP/IP & Keamanan Siber', k: 'XII-4', mapel: 'Informatika', s: 'Terbit', l: 'https://www.cloudflare.com/learning/' },
      { j: 'Basis Data Relasional, Desain ERD & Perintah SQL', k: 'XII-2', mapel: 'Informatika', s: 'Terbit', l: 'https://www.w3schools.com/sql/' }
    ],
    tugas: [
      { j: 'Tugas 1: Implementasi Algoritma Pencarian & Pengurutan', k: 'X-1', mapel: 'Informatika', s: 'Aktif', d: '2026-12-15', desc: 'Tuliskan kode program Python sederhana untuk mencari data siswa menggunakan Binary Search dan urutkan menggunakan Bubble Sort.' },
      { j: 'Tugas 2: Eksperimen Klasifikasi Gambar Teachable Machine', k: 'X-1', mapel: 'KKA', s: 'Aktif', d: '2026-12-20', desc: 'Latih model AI Teachable Machine untuk membedakan minimal 3 objek di sekitarmu, lalu lampirkan link model dan tangkapan layar pengujian.' },
      { j: 'Tugas 3: Analisis Data Hasil Ujian Menggunakan Spreadsheet', k: 'X-2', mapel: 'Informatika', s: 'Aktif', d: '2026-12-18', desc: 'Gunakan fungsi SUM, AVERAGE, IF, dan VLOOKUP pada tabel nilai yang diberikan, lalu buat diagram batang visualisasi nilainya.' },
      { j: 'Tugas 1: Proyek Game Interaktif Sederhana Scratch', k: 'VIII-A', mapel: 'KKA', s: 'Aktif', d: '2026-12-10', desc: 'Buat proyek animasi/game di Scratch dengan minimal 2 karakter (sprite), 1 variabel skor, dan suara latar.' },
      { j: 'Tugas 1: Evaluasi Model Klasifikasi Sentimen Teks', k: 'XI-2', mapel: 'KKA', s: 'Aktif', d: '2026-12-22', desc: 'Uji dataset ulasan produk dan tentukan apakah kalimat bernada positif atau negatif berdasarkan algoritma klasifikasi Naive Bayes.' },
      { j: 'Tugas 1: Perancangan Skema Database Perpustakaan Sekolah', k: 'XII-2', mapel: 'Informatika', s: 'Aktif', d: '2026-12-25', desc: 'Rancang ERD untuk sistem perpustakaan dengan tabel: Siswa, Buku, dan Peminjaman. Tuliskan query SQL pembuatan tabel beserta relasi foreign key.' }
    ],
    lkpd: [
      { j: 'LKPD 1: Praktik Analisis Kasus Algoritma Percabangan', k: 'X-1', mapel: 'Informatika', s: 'Aktif', d: '2026-12-12', desc: 'Lembar kerja analisis logika penentuan kelulusan dan pemberian grade siswa berdasarkan input nilai kuis, tugas, dan ujian.' },
      { j: 'LKPD 2: Eksperimen Deteksi Emosi Menggunakan AI Vision', k: 'X-1', mapel: 'KKA', s: 'Aktif', d: '2026-12-16', desc: 'Uji responsivitas kamera terhadap ekspresi senang, sedih, dan kaget menggunakan model computer vision terkalibrasi.' },
      { j: 'LKPD 1: Panduan Eksplorasi Blok Logika & Event Scratch', k: 'VIII-A', mapel: 'KKA', s: 'Aktif', d: '2026-12-14', desc: 'Panduan langkah demi langkah memindahkan karakter dengan tombol panah keyboard dan mendeteksi tabrakan (collision detection).' },
      { j: 'LKPD 1: Praktik Audit Keamanan Kata Sandi & Wi-Fi', k: 'XII-2', mapel: 'Informatika', s: 'Aktif', d: '2026-12-19', desc: 'Uji kekuatan kata sandi menggunakan metode entropy bits dan pelajari prinsip otentikasi WPA2/WPA3 pada jaringan nirkabel.' }
    ],
    quiz: [
      {
        j: 'Paket Quiz Informatika & Koding Kelas X (Komprehensif)', k: 'X-1', durasi: 30,
        soal: [
          { q: 'Manakah dari berikut yang BUKAN merupakan pilar Berpikir Komputasional?', o: ['Dekomposisi', 'Pengenalan Pola', 'Kompilasi Manual', 'Abstraksi'], a: 2 },
          { q: 'Apa fungsi dari algoritma Binary Search?', o: ['Mencari data pada list yang sudah terurut', 'Mengacak urutan angka', 'Menghapus data ganda', 'Mengubah data menjadi string'], a: 0 },
          { q: 'Simbol belah ketupat (diamond) pada flowchart berfungsi untuk menyatakan...', o: ['Awal atau akhir program', 'Keputusan / percabangan kondisi', 'Proses komputasi', 'Input / Output data'], a: 1 },
          { q: 'Perintah Python yang digunakan untuk menampilkan teks ke layar adalah...', o: ['echo()', 'System.out()', 'print()', 'write()'], a: 2 },
          { q: 'Tipe data di Python yang hanya bernilai True atau False disebut...', o: ['Integer', 'Boolean', 'Float', 'String'], a: 1 },
          { q: 'Struktur perulangan yang digunakan saat jumlah perulangan sudah diketahui pasti adalah...', o: ['for', 'while', 'do-while', 'goto'], a: 0 },
          { q: 'Apa kepanjangan dari CPU pada sistem komputer?', o: ['Central Processing Unit', 'Core Power Unit', 'Computer Process Utility', 'Central Protocol Unit'], a: 0 },
          { q: 'Komponen memori yang datanya hilang saat daya listrik mati (volatile) adalah...', o: ['Hard Disk', 'ROM', 'RAM', 'Flash Drive'], a: 2 },
          { q: 'Di dalam spreadsheet, rumus untuk menghitung nilai rata-rata dari range A1:A10 adalah...', o: ['=SUM(A1:A10)', '=AVERAGE(A1:A10)', '=COUNT(A1:A10)', '=MEDIAN(A1:A10)'], a: 1 },
          { q: 'Proses menyembunyikan detail kompleks dan hanya menampilkan hal penting disebut...', o: ['Abstraksi', 'Dekomposisi', 'Algoritma', 'Enkripsi'], a: 0 }
        ]
      },
      {
        j: 'Paket Quiz Koding & Kecerdasan Artifisial (KKA) Kelas X', k: 'X-1', durasi: 25,
        soal: [
          { q: 'Apa yang membedakan Machine Learning dari pemrograman tradisional?', o: ['Machine learning belajar dari data, bukan aturan kaku', 'Machine learning tidak butuh komputer', 'Machine learning hanya bisa bahasa Inggris', 'Machine learning tidak menggunakan matematika'], a: 0 },
          { q: 'Contoh penerapan Artificial Intelligence di kehidupan sehari-hari adalah...', o: ['Kalkulator mekanik', 'Rekomendasi video YouTube', 'Lampu bohlam pijar', 'Pita kaset audio'], a: 1 },
          { q: 'Cabang AI yang fokus pada pemrosesan bahasa manusia disebut...', o: ['NLP (Natural Language Processing)', 'Computer Vision', 'Robotics', 'Data Mining'], a: 0 },
          { q: 'Apa tujuan utama dari proses training (pelatihan) pada model AI?', o: ['Menghapus data lama', 'Menemukan pola hubungan dari data input dan output', 'Mempercepat koneksi internet', 'Menghemat baterai perangkat'], a: 1 },
          { q: 'Teknik menyusun instruksi yang jelas agar model LLM menghasilkan respons akurat disebut...', o: ['Prompt Engineering', 'Reverse Engineering', 'Social Engineering', 'Feature Scaling'], a: 0 },
          { q: 'Jika model AI diberi data latih berupa foto kucing berlabel "kucing", metode ini termasuk...', o: ['Supervised Learning', 'Unsupervised Learning', 'Reinforcement Learning', 'Zero-shot Learning'], a: 0 },
          { q: 'Apa risiko etika utama dalam penggunaan AI yang perlu diwaspadai?', o: ['Bias data dan pelanggaran privasi', 'AI membuat komputer terlalu cepat', 'AI tidak bisa digunakan di malam hari', 'AI membutuhkan listrik AC'], a: 0 },
          { q: 'Di platform Teachable Machine Google, kita dapat melatih model untuk mengenali...', o: ['Gambar, Suara, dan Pose', 'File PDF dan Word saja', 'Hanya tulisan tangan', 'Suhu ruangan'], a: 0 }
        ]
      },
      {
        j: 'Paket Quiz Koding & Logika Algoritma Kelas VIII (SMP)', k: 'VIII-A', durasi: 20,
        soal: [
          { q: 'Urutan langkah-langkah logis dan sistematis untuk menyelesaikan masalah disebut...', o: ['Algoritma', 'Diagram', 'Variabel', 'Animasi'], a: 0 },
          { q: 'Di Scratch, karakter atau objek yang dapat digerakkan dan diberi kode disebut...', o: ['Sprite', 'Costume', 'Backdrop', 'Sound'], a: 0 },
          { q: 'Blok perintah di Scratch yang berfungsi menjalankan kode saat tombol bendera hijau diklik termasuk kategori...', o: ['Events', 'Motion', 'Looks', 'Operators'], a: 0 },
          { q: 'Jika nilai >= 75 maka "Lulus", selain itu "Remedial". Konsep ini merupakan contoh dari...', o: ['Percabangan kondisi', 'Perulangan selamanya', 'Pengacakan angka', 'Dekomposisi'], a: 0 },
          { q: 'Tempat penyimpanan nilai data di dalam program yang nilainya dapat berubah-ubah disebut...', o: ['Variabel', 'Konstanta', 'Komentar', 'Fungsi'], a: 0 }
        ]
      },
      {
        j: 'Paket Quiz Kecerdasan Artifisial Lanjut Kelas XI', k: 'XI-2', durasi: 25,
        soal: [
          { q: 'Algoritma Supervised Learning yang populer untuk klasifikasi data adalah...', o: ['K-Nearest Neighbors (KNN)', 'K-Means Clustering', 'Apriori', 'DBSCAN'], a: 0 },
          { q: 'Model kecerdasan buatan yang terinspirasi dari struktur sel saraf otak manusia disebut...', o: ['Artificial Neural Networks', 'Binary Search Tree', 'Relational Model', 'Turing Machine'], a: 0 },
          { q: 'Bagian pada Neural Network yang berada di antara Input Layer dan Output Layer disebut...', o: ['Hidden Layer', 'Middle Core', 'Buffer Layer', 'Filter Node'], a: 0 },
          { q: 'Apa yang dimaksud dengan Overfitting pada model machine learning?', o: ['Model sangat hafal data latih namun gagal memprediksi data baru', 'Model tidak bisa membaca data latih', 'Model berjalan terlalu lambat', 'Model kekurangan memori RAM'], a: 0 }
        ]
      },
      {
        j: 'Paket Quiz Informatika & Web Development Kelas XII', k: 'XII-2', durasi: 25,
        soal: [
          { q: 'Tag HTML yang digunakan untuk membuat hyperlink adalah...', o: ['<a>', '<link>', '<href>', '<url>'], a: 0 },
          { q: 'Protokol jaringan yang menjamin transfer data terenkripsi dan aman di web adalah...', o: ['HTTPS', 'HTTP', 'FTP', 'Telnet'], a: 0 },
          { q: 'Dalam basis data relasional, kolom yang unik mengidentifikasi setiap baris disebut...', o: ['Primary Key', 'Foreign Key', 'Index Key', 'Composite Key'], a: 0 },
          { q: 'Perintah SQL untuk mengambil data siswa dengan nilai di atas 80 adalah...', o: ['SELECT * FROM siswa WHERE nilai > 80;', 'GET * FROM siswa IF nilai > 80;', 'FIND siswa WHERE nilai > 80;', 'QUERY siswa VALUES nilai > 80;'], a: 0 },
          { q: 'Lapisan protokol OSI yang bertanggung jawab untuk perutean (routing) paket data adalah...', o: ['Network Layer', 'Data Link Layer', 'Transport Layer', 'Application Layer'], a: 0 }
        ]
      }
    ],
    pengumuman: [
      { j: 'Selamat Datang di Portal Belajar Informatika & KKA SMA NU Kaplongan!', tgl: '2026-11-16', isi: 'Platform ini telah terhubung ke sinkronisasi Cloud. Siswa dan guru dapat mengakses materi pelajaran, mengumpulkan tugas secara digital, mengikuti kuis interaktif, dan memantau rekap nilai secara realtime.' },
      { j: 'Jadwal Penilaian Sumatif Akhir Semester (PSAS) Genap', tgl: '2026-11-15', isi: 'Penilaian Sumatif Akhir Semester mata pelajaran Informatika dan KKA akan dilaksanakan serentak mulai tanggal 10 Desember 2026. Mohon siswa menyelesaikan seluruh LKPD dan tugas tepat waktu.' },
      { j: 'Workshop Koding & Robotik AI Setiap Hari Sabtu', tgl: '2026-11-14', isi: 'Ekstrakurikuler Komputer membuka kelas intensif pengembangan AI dan pembuatan game edukasi di Laboratorium Komputer SMA NU Kaplongan setiap hari Sabtu pukul 09.00 WIB.' }
    ]
  };

  const DEFAULT_ACCOUNTS = [
    { nis: '1001', nama: 'Ahmad Fauzi', kelas: 'X-1', terakhirMasuk: Date.now() - 3600000 },
    { nis: '1002', nama: 'Siti Nurhaliza', kelas: 'X-1', terakhirMasuk: Date.now() - 7200000 },
    { nis: '1003', nama: 'Rizky Pratama', kelas: 'X-1', terakhirMasuk: Date.now() - 14400000 },
    { nis: '1004', nama: 'Dewi Lestari', kelas: 'X-2', terakhirMasuk: Date.now() - 28800000 },
    { nis: '1005', nama: 'Budi Santoso', kelas: 'X-3', terakhirMasuk: Date.now() - 86400000 },
    { nis: '1006', nama: 'Anisa Rahma', kelas: 'VIII-A', terakhirMasuk: Date.now() - 43200000 },
    { nis: '1007', nama: 'Fajar Hidayat', kelas: 'VIII-B', terakhirMasuk: Date.now() - 50000000 },
    { nis: '1008', nama: 'Nabila Putri', kelas: 'XI-2', terakhirMasuk: Date.now() - 12000000 },
    { nis: '1009', nama: 'Muhammad Ilham', kelas: 'XII-2', terakhirMasuk: Date.now() - 3600000 },
    { nis: '1010', nama: 'Putri Ayu', kelas: 'XII-4', terakhirMasuk: Date.now() - 7200000 }
  ];

  // Auto-seed: jika penyimpanan lokal masih kosong, isi dengan master katalog bawaan
  (function seedInitialCatalog(){
    try {
      const initKey = 'pb.catalog.auto_seeded_v2';
      if(!localStorage.getItem(initKey)){
        ['materi','tugas','lkpd','quiz','pengumuman'].forEach(k=>{
          const stored = LS.get(SK(k), null);
          if(!stored || (Array.isArray(stored) && stored.length===0)){
            LS.set(SK(k), DEFAULT_CATALOG[k]||[]);
          }
        });
        localStorage.setItem(initKey, '1');
      }
      const cachedAcc = LS.get('pb.cached.accounts', null);
      if(!cachedAcc || (Array.isArray(cachedAcc) && cachedAcc.length===0)){
        LS.set('pb.cached.accounts', DEFAULT_ACCOUNTS);
      }
    } catch(_){}
  })();

  // ── Pengelola Modul & Fungsi Fitur (Tambah/Kurangi fitur & sub-fungsi per sekolah) ──
  const MODULE_DEFS = [
    {id:'kelas',ico:'🏫',name:'Kelas Saya',who:'Semua'},
    {id:'akun',ico:'👤',name:'Akun Siswa',who:'Guru'},
    {id:'progres',ico:'📈',name:'Progres Siswa',who:'Guru'},
    {id:'progres_saya',ico:'📈',name:'Progres Saya',who:'Siswa'},
    {id:'materi',ico:'📚',name:'Materi Ajar',who:'Semua'},
    {id:'tugas',ico:'📝',name:'Tugas',who:'Semua'},
    {id:'lkpd',ico:'📋',name:'LKPD',who:'Semua'},
    {id:'quiz',ico:'❓',name:'Quiz',who:'Semua'},
    {id:'bank',ico:'🗃️',name:'Bank Soal',who:'Guru'},
    {id:'absensi',ico:'✅',name:'Absensi',who:'Guru'},
    {id:'nilai',ico:'📊',name:'Nilai',who:'Semua'},
    {id:'laporan',ico:'📑',name:'Laporan',who:'Guru'},
    {id:'skill',ico:'⚡',name:'Skill & Kompetensi',who:'Semua'},
    {id:'jadwal',ico:'📅',name:'Jadwal',who:'Semua'},
    {id:'pengumuman',ico:'📢',name:'Pengumuman',who:'Semua'},
    {id:'ai',ico:'✨',name:'AI Assistant',who:'Semua'},
    {id:'game',ico:'🎮',name:'Game Quiz & Petualangan',who:'Semua'}
  ];
  const SUB_FLAGS_DEF = [
    {id:'materi_upload',label:'Materi: Izinkan unggah file ke Drive/Lokal'},
    {id:'materi_filter',label:'Materi: Filter berdasarkan mata pelajaran'},
    {id:'tugas_upload',label:'Tugas & LKPD: Lampiran file & edit instruksi'},
    {id:'skill_practice',label:'Skill: Latihan mini interaktif (+XP) untuk siswa'},
    {id:'skill_endorse',label:'Skill: Pemberian lencana pengakuan oleh guru'},
    {id:'ai_custom',label:'AI Assistant: Kelola tombol prompt cepat oleh guru'}
  ];
  const DEFAULT_SCHEDULE = [
    {hari:'Senin',jam:'07:30–09:00',kelas:'X-1',mapel:'Informatika',ruang:'Lab Komputer'},
    {hari:'Senin',jam:'10:00–11:30',kelas:'X-2',mapel:'Informatika',ruang:'Lab Komputer'},
    {hari:'Selasa',jam:'08:15–09:45',kelas:'XI-2',mapel:'KKA',ruang:'R. 104'},
    {hari:'Rabu',jam:'07:30–09:00',kelas:'VIII-A',mapel:'KKA',ruang:'Lab Komputer'},
    {hari:'Kamis',jam:'09:45–11:15',kelas:'XII-2',mapel:'Informatika',ruang:'Lab Komputer'},
    {hari:'Jumat',jam:'07:30–09:00',kelas:'XI-4',mapel:'KKA',ruang:'R. 105'}
  ];
  const FeatureConfig = {
    KEY:'pb.modules.config',
    get(){
      const local = LS.get(this.KEY, {}) || {};
      const sharedAll = LS.get('pb.shared.absensi', {}) || {};
      const remote = sharedAll['__CONFIG__|modules'] || {};
      const merged = { disabled:[], subFlags:{}, customModules:[], customSkills:null, jadwal:null, aiPrompts:null, ...local, ...remote };
      if(!Array.isArray(merged.disabled)) merged.disabled = [];
      if(!merged.subFlags || typeof merged.subFlags!=='object') merged.subFlags = {};
      if(!Array.isArray(merged.customModules)) merged.customModules = [];
      return merged;
    },
    save(next){
      LS.set(this.KEY, next);
      Activity.absensi.set('__CONFIG__', 'modules', next);
      this.applySidebarConfig();
      emitSync();
    },
    isEnabled(featId){
      if(!featId || featId==='dashboard' || featId==='pengaturan' || featId==='modul') return true;
      return !this.get().disabled.includes(featId);
    },
    subEnabled(flagId){
      const flags = this.get().subFlags || {};
      return flags[flagId] !== false;
    },
    applySidebarConfig(){
      const cfg = this.get();
      document.querySelectorAll('.sb-nav .nav-item').forEach(el => {
        if(el.classList.contains('fp-custom-nav')) return;
        const href = (el.getAttribute('href') || '').toLowerCase();
        const feat = el.dataset.feature || (href.includes('game-quiz') ? 'game' : '');
        if(!feat || feat==='dashboard' || feat==='pengaturan' || feat==='modul') return;
        el.style.display = cfg.disabled.includes(feat) ? 'none' : '';
      });
      const nav = document.querySelector('.sb-nav');
      if(!nav) return;
      nav.querySelectorAll('.fp-custom-nav, .fp-custom-lbl').forEach(x=>x.remove());
      const mine = (cfg.customModules||[]).filter(m => m && (m.target==='all' || m.target===ROLE || (ROLE==='guru'&&m.target==='guru') || (ROLE==='murid'&&m.target==='murid')));
      if(mine.length){
        const lbl = document.createElement('div'); lbl.className='nav-lbl fp-custom-lbl'; lbl.textContent='Fitur Tambahan';
        nav.appendChild(lbl);
        mine.forEach(m => {
          const item = document.createElement('div');
          item.className = 'nav-item fp-custom-nav';
          item.dataset.feature = 'custom:' + m.id;
          item.style.cursor = 'pointer';
          item.innerHTML = `<span style="width:16px;text-align:center">${esc(m.ico||'✨')}</span><span>${esc(m.title||'Fitur')}</span>`;
          item.onclick = () => open('custom:' + m.id);
          nav.appendChild(item);
          FEATURES['custom:' + m.id] = {
            ico: m.ico || '✨', title: m.title || 'Fitur Kustom', sub: m.sub || 'Modul tambahan Portal Belajar',
            render(body){
              const notesKey = 'pb.custom.notes.' + m.id;
              const notes = LS.get(notesKey, []);
              body.innerHTML = `
                <div class="fp-card" style="margin-bottom:14px">
                  <h4>${esc(m.ico||'✨')} ${esc(m.title)}</h4>
                  <p style="margin-top:6px;white-space:pre-wrap">${esc(m.desc||'Belum ada deskripsi modul.')}</p>
                  ${m.url?`<div style="margin-top:12px"><a class="fp-btn sm" href="${esc(m.url)}" target="_blank" rel="noopener">🔗 Buka Tautan / Alat</a></div>`:''}
                </div>
                ${m.url && /^https?:\/\//i.test(m.url) ? `<div class="fp-card" style="margin-bottom:14px;padding:8px"><iframe src="${esc(m.url)}" style="width:100%;height:340px;border:0;border-radius:10px;background:#fff"></iframe></div>` : ''}
                <div class="fp-card">
                  <h4>📝 Catatan &amp; Aktivitas di Fitur Ini</h4>
                  <div class="fp-row" style="margin:10px 0"><input class="fp-input" id="cmNote" placeholder="Tambahkan catatan / poin baru..." style="flex:1"><button class="fp-btn sm" id="cmAdd">+ Tambah</button></div>
                  <div class="fp-list">${notes.map((n,i)=>`<div class="fp-item"><span>${esc(n)}</span><button class="fp-btn sm danger" data-cd="${i}">Hapus</button></div>`).join('')||'<div class="fp-empty" style="padding:18px">Belum ada catatan.</div>'}</div>
                </div>`;
              body.querySelector('#cmAdd').onclick=()=>{const v=body.querySelector('#cmNote').value.trim();if(!v)return;notes.unshift(v);LS.set(notesKey,notes);FEATURES['custom:'+m.id].render(body);};
              body.querySelectorAll('[data-cd]').forEach(btn=>btn.onclick=()=>{notes.splice(+btn.dataset.cd,1);LS.set(notesKey,notes);FEATURES['custom:'+m.id].render(body);});
            }
          };
        });
      }
    }
  };

  function emitSync(){
    try { FeatureConfig.applySidebarConfig(); } catch(_){}
    try { window.dispatchEvent(new CustomEvent('pb:sync')); } catch(_){}
  }
  const getMyClass = ()=>{
    const stored = LS.get('pb.murid.myClass', null);
    const v = stored ? canonicalClass(stored) : null;
    // Reject tampered/invalid class values → forces gate to reappear
    if(v && !ALL_CLASSES.includes(v)){
      try{ localStorage.removeItem('pb.murid.myClass'); }catch(_){}
      Guard.notify('Kelas tidak valid terdeteksi — silakan pilih ulang kelas.','err');
      return null;
    }
    return v;
  };
  const setMyClass = (v)=>{
    if(!ALL_CLASSES.includes(v)){
      Guard.notify('Kelas "'+v+'" tidak diizinkan.','err');
      return false;
    }
    LS.set('pb.murid.myClass', canonicalClass(v)); return true;
  };

  // ── AccessGuard: server-style validation on every data request ──
  // Rationale: karena data disimpan client-side (localStorage), kita tidak bisa
  // memberi jaminan setara backend. Sebagai gantinya SEMUA query murid melewati
  // satu pintu (Guard.filter/Guard.assert) yang: (1) memvalidasi kelas terkunci,
  // (2) membuang record milik kelas lain, (3) mencatat & memberi notifikasi bila
  // ada upaya manipulasi (mis. localStorage di-edit lewat DevTools), (4) menolak
  // penulisan submission/nilai dengan kelas yang bukan miliknya.
  const Guard = {
    _toastEl:null,
    notify(msg, type){
      try{
        if(!this._toastEl){
          const t=document.createElement('div');
          t.style.cssText='position:fixed;top:16px;right:16px;z-index:20000;max-width:340px;padding:12px 14px;border-radius:10px;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);display:none';
          document.body.appendChild(t); this._toastEl=t;
        }
        const t=this._toastEl;
        t.style.background = type==='err' ? '#fee2e2' : '#dbeafe';
        t.style.color      = type==='err' ? '#991b1b' : '#1e40af';
        t.style.border     = '1px solid '+(type==='err'?'#fecaca':'#bfdbfe');
        t.textContent = msg; t.style.display='block';
        clearTimeout(this._toastT); this._toastT=setTimeout(()=>{t.style.display='none';},4200);
      }catch(_){}
    },
    audit(kind, detail){
      try{
        const log = LS.get('pb.audit.access', []);
        log.push({t:Date.now(), kind, ...detail});
        LS.set('pb.audit.access', log.slice(-100));
      }catch(_){}
      try{ console.warn('[AccessGuard]', kind, detail); }catch(_){}
    },
    /** Filter a list for the current student. Only items with k==='ALL' or k===myClass pass.
     *  Anything else is dropped AND surfaced as a tamper/config alert. */
    filter(list, opts){
      opts = opts||{};
      const myClass = opts.myClass!==undefined ? opts.myClass : getMyClass();
      const field = opts.field || 'k';
      if(ROLE!=='murid') return list||[];
      if(!myClass){ return []; } // no class → block everything until gate resolved
      const out=[]; let blocked=0; const blockedClasses=new Set();
      (list||[]).forEach(item=>{
        const k = item && item[field];
        if(k==null){ out.push(item); return; } // record has no class scope
        if(matchesClass(k, myClass)) out.push(item);
        else { blocked++; blockedClasses.add(k); }
      });
      if(blocked>0){
        this.audit('query-blocked',{feature:opts.label||'?', myClass, blocked, kelas:[...blockedClasses]});
      }
      return out;
    },
    /** Assert single item belongs to student. Returns true if ok, else notifies + audits. */
    assert(item, opts){
      opts=opts||{};
      const myClass = opts.myClass!==undefined ? opts.myClass : getMyClass();
      const field = opts.field || 'k';
      if(ROLE!=='murid') return true;
      if(!myClass) return false;
      const k = item && item[field];
      if(k==null || matchesClass(k, myClass)) return true;
      this.audit('access-denied',{feature:opts.label||'?', myClass, kelas:k});
      this.notify('🚫 Data untuk kelas '+k+' ditolak — kamu terdaftar di kelas '+myClass+'.','err');
      return false;
    },
    /** Force student submissions to carry their own class; reject foreign class writes. */
    stampSubmission(payload){
      if(ROLE!=='murid') return payload;
      const my = getMyClass();
      if(!my){ this.notify('Kelas belum dipilih.','err'); throw new Error('no-class'); }
      if(payload && payload.kelas && payload.kelas!==my){
        this.audit('write-blocked',{tried:payload.kelas, myClass:my});
        this.notify('🚫 Pengiriman untuk kelas lain diblokir.','err');
        throw new Error('foreign-class-write');
      }
      return Object.assign({}, payload, {kelas: my, userId: localStorage.getItem('pb.murid.nis') || (localStorage.getItem('pb.murid.nama')||payload.nama||'Siswa')+'|'+my, nama:localStorage.getItem('pb.murid.nama')||payload.nama});
    }
  };
  // Expose for debugging & other scripts
  try{ window.__accessGuard = Guard; }catch(_){}

  const isMine=s=>s&&(s.userId===localStorage.getItem('pb.murid.nis')||(s.nama===localStorage.getItem('pb.murid.nama')&&canonicalClass(s.kelas)===getMyClass()));
  // ── FEATURES ──
  const FEATURES = {};


  FEATURES.kelas = {
    ico:'K', title:'Kelas Saya', sub:'Daftar kelas yang kamu ampu',
    render(b){
      const key=K('kelas');
      let list=LS.get(key, CLASS_CATALOG.map(c=>({n:c.n, s:30, m:c.mapel.join(' & '), avg: 80+Math.floor(Math.random()*8)})));

       const save=()=>LS.set(key,list);
      const draw=()=>{
        b.innerHTML=`
        <div class="fp-row" style="margin-bottom:12px;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div class="fp-row" style="flex-wrap:wrap;gap:6px">
            <input class="fp-input" id="kn" placeholder="Nama kelas (mis. XII-A)" style="width:180px"/>
            <input class="fp-input" id="km" placeholder="Mapel" style="width:140px"/>
            <input class="fp-input" id="ks" type="number" min="1" placeholder="Jml siswa" style="width:110px"/>
            <button class="fp-btn sm" id="kAdd">+ Tambah Kelas</button>
          </div>
          <span class="fp-badge info">${list.length} kelas</span>
        </div>
        <div class="fp-grid c3">${list.map((k,i)=>`
          <div class="fp-card"><h4>Kelas ${esc(k.n)}</h4><p>${esc(k.m)} · ${k.s} siswa</p>
          <div class="fp-row" style="margin-top:10px;justify-content:space-between">
            <span class="fp-badge info">Rata-rata ${k.avg||'–'}</span>
            <div class="fp-row" style="gap:4px">
              <button class="fp-btn sm ghost" data-e="${i}">Edit</button>
              <button class="fp-btn sm danger" data-d="${i}">Hapus</button>
            </div>
          </div></div>`).join('')}</div>`;
        b.querySelector('#kAdd').onclick=()=>{
          const n=b.querySelector('#kn').value.trim();
          const m=b.querySelector('#km').value.trim()||'Informatika';
          const s=+b.querySelector('#ks').value||30;
          if(!n)return alert('Nama kelas wajib diisi');
          if(list.some(x=>x.n.toLowerCase()===n.toLowerCase()))return alert('Kelas sudah ada');
          list.push({n,m,s,avg:0});save();draw();
        };
        b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{if(confirm('Hapus kelas ini?')){list.splice(+x.dataset.d,1);save();draw();}});
        b.querySelectorAll('[data-e]').forEach(x=>x.onclick=()=>{
          const i=+x.dataset.e,k=list[i];
          const n=prompt('Nama kelas:',k.n);if(n===null)return;
          const m=prompt('Mapel:',k.m);if(m===null)return;
          const s=prompt('Jumlah siswa:',k.s);if(s===null)return;
          list[i]={...k,n:n.trim()||k.n,m:m.trim()||k.m,s:+s||k.s};save();draw();
        });
      };draw();
    }
  };

  // ── Akun siswa (guru): dibuat & disimpan di Google Drive, password ter-hash ──
  const Accounts = {
    pass(force){
      let p = localStorage.getItem('pb.guru.passphrase') || '';
      if(!p || force){
        p = prompt(force? 'Passphrase guru salah. Masukkan ulang:' : 'Masukkan passphrase Guru untuk mengelola akun siswa:', force? '' : (p||''))||'';
        if(p) localStorage.setItem('pb.guru.passphrase', p);
        else localStorage.removeItem('pb.guru.passphrase');
      }
      return p;
    },
    // Sekali gagal karena passphrase, minta ulang lalu coba lagi otomatis.
    async call(init, retry){
      try {
        const pass = this.pass(retry);
        if(!pass && ROLE==='guru') return (LS.get('pb.cached.accounts', []) || []).concat(DEFAULT_ACCOUNTS);
        if(window.colabDb && window.colabDb.isReady()){
          try{
            const j = (init && init.method === 'POST')
              ? await window.colabDb.accounts.mutate(JSON.parse(init.body || '{}'), pass||'')
              : await window.colabDb.accounts.list(pass||'');
            const remote = j.accounts||[];
            if(remote.length > 0) {
              LS.set('pb.cached.accounts', remote);
              return remote;
            }
            return (init && init.method === 'POST') ? [] : (LS.get('pb.cached.accounts', []) || []).concat(DEFAULT_ACCOUNTS);
          }catch(colErr){
            if(colErr && colErr.status===401){
              localStorage.removeItem('pb.guru.passphrase');
              if(!retry) return this.call(init, true);
              throw new Error(colErr.message||'Passphrase guru salah.');
            }
            throw colErr;
          }
        }
        const r = await fetch('/api/drive/materials?accounts=1',{
          cache:'no-store',
          ...init,
          headers:{...(init && init.headers ? init.headers : {}), 'x-guru-passphrase':pass||''}
        });
        const ct = r.headers.get('content-type') || '';
        if(r.status===404 || (r.ok && !ct.includes('json'))){
          return (LS.get('pb.cached.accounts', []) || []).concat(DEFAULT_ACCOUNTS);
        }
        const j = await r.json().catch(()=>({}));
        if(r.status===401){
          localStorage.removeItem('pb.guru.passphrase');
          if(!retry) return this.call(init, true);
          throw new Error(j.error||'Passphrase guru salah.');
        }
        if(!r.ok) throw new Error(j.error||('Gagal memproses akun ('+r.status+')'));
        const remote = j.accounts||[];
        if(remote.length > 0) {
          LS.set('pb.cached.accounts', remote);
          return remote;
        }
        return (LS.get('pb.cached.accounts', []) || []).concat(DEFAULT_ACCOUNTS);
      } catch(err) {
        if(init && init.method==='POST') throw err;
        return (LS.get('pb.cached.accounts', []) || []).concat(DEFAULT_ACCOUNTS);
      }
    },
    list(){ return this.call({}); },
    send(body){
      return this.call({
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
    }
  };


  FEATURES.akun = {
    ico:'A', title:'Akun Siswa', sub:'Buat akun pribadi tiap siswa (NIS + password)',
    render(b){
      let list=[]; let filter=''; let loadErr='';
      b.innerHTML = `<div id="akWrap"><div class="fp-empty">Memuat akun…</div></div>`;
      const wrap = b.querySelector('#akWrap');

      const draw = ()=>{
        const rows = list
          .filter(a=>!filter || canonicalClass(a.kelas)===filter)
          .sort((x,y)=> (x.kelas+x.nama).localeCompare(y.kelas+y.nama));
        wrap.innerHTML = `
          ${loadErr? `<div class="fp-card" style="border-color:#fca5a5;background:#fef2f2;margin-bottom:12px">
            <b>Daftar akun gagal dimuat:</b> ${esc(loadErr)}
            <div class="fp-row" style="margin-top:8px"><button class="fp-btn ghost sm" id="akRetry">Coba lagi</button></div>
          </div>`:''}
          <div class="fp-grid c2" style="margin-bottom:14px">
            <div class="fp-card">
              <h4>➕ Tambah / perbarui akun</h4>
              <div style="display:grid;gap:8px;margin-top:10px">
                <div><label class="fp-label">NIS</label><input class="fp-input" id="akNis" placeholder="2024001"></div>
                <div><label class="fp-label">Nama lengkap</label><input class="fp-input" id="akNama" placeholder="Nama siswa"></div>
                <div><label class="fp-label">Kelas</label><select class="fp-select" id="akKelas">${ALL_CLASSES.map(n=>`<option>${n}</option>`).join('')}</select></div>
                <div><label class="fp-label">Password</label><input class="fp-input" id="akPw" placeholder="min. 4 karakter"></div>
                <div class="fp-row">
                  <button class="fp-btn" id="akSave">Simpan akun</button>
                  <button class="fp-btn ghost sm" id="akGen">Acak password</button>
                </div>
              </div>
            </div>
            <div class="fp-card">
              <h4>📥 Impor massal</h4>
              <p>Satu baris per siswa: <code>NIS,Nama,Kelas,Password</code></p>
              <textarea class="fp-textarea" id="akBulk" style="min-height:120px;margin-top:8px" placeholder="2024001,Andi Saputra,X-1,andi123&#10;2024002,Bunga Lestari,X-1,bunga123"></textarea>
              <div class="fp-row" style="margin-top:8px">
                <button class="fp-btn" id="akImport">Impor</button>
                <button class="fp-btn ghost sm" id="akCsv">Unduh daftar (CSV)</button>
              </div>
            </div>
          </div>
          <div class="fp-row" style="margin-bottom:10px">
            <select class="fp-select" id="akFilter" style="max-width:220px">
              <option value="">Semua kelas (${list.length} akun)</option>
              ${ALL_CLASSES.map(n=>`<option value="${n}" ${filter===n?'selected':''}>${n}</option>`).join('')}
            </select>
            <span style="font-size:12px;color:#64748b">${rows.length} akun ditampilkan</span>
          </div>
          ${rows.length? `<table class="fp-table"><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Terakhir masuk</th><th></th></tr></thead><tbody>
            ${rows.map(a=>`<tr>
              <td><b>${esc(a.nis)}</b></td><td>${esc(a.nama)}</td><td><span class="fp-badge info">${esc(a.kelas)}</span></td>
              <td style="font-size:12px;color:#64748b">${a.terakhirMasuk? new Date(a.terakhirMasuk).toLocaleString('id-ID') : 'belum pernah'}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="fp-btn ghost sm akReset" data-n="${esc(a.nis)}">Reset password</button>
                <button class="fp-btn danger sm akDel" data-n="${esc(a.nis)}">Hapus</button>
              </td></tr>`).join('')}
          </tbody></table>` : `<div class="fp-empty">Belum ada akun siswa. Tambahkan lewat form di atas.</div>`}
        `;

        const gen = ()=> Math.random().toString(36).slice(2,8);
        const val = id => (wrap.querySelector('#'+id)||{}).value||'';
        const run = async (fn, button)=>{
          const old = button && button.textContent;
          if(button){ button.disabled=true; button.textContent='Memproses…'; }
          try{ list = await fn(); loadErr=''; draw(); }
          catch(e){ alert(e.message||e); if(button){ button.disabled=false; button.textContent=old; } }
        };
        const retryBtn = wrap.querySelector('#akRetry');
        if(retryBtn) retryBtn.onclick = ()=> load();

        wrap.querySelector('#akGen').onclick = ()=>{ wrap.querySelector('#akPw').value = gen(); };
        wrap.querySelector('#akSave').onclick = ()=>{
          const nis=val('akNis').trim(), nama=val('akNama').trim(), kelas=val('akKelas'), pw=val('akPw').trim();
          if(!nis||!nama) return alert('NIS dan nama wajib diisi.');
          if(!pw) return alert('Isi password (klik "Acak password" bila perlu).');
          run(()=>Accounts.send({nis,nama,kelas,password:pw}).then(r=>{
            alert(`Akun dibuat:\nNIS: ${nis}\nPassword: ${pw}\n\nBagikan ke siswa yang bersangkutan.`);
            wrap.querySelector('#akNis').value=''; wrap.querySelector('#akNama').value=''; wrap.querySelector('#akPw').value='';
            return r;
          }));
        };
        wrap.querySelector('#akImport').onclick = ()=>{
          const raw = val('akBulk').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
          const skipped=[];
          const rowsIn = raw.map(l=>{
            const [nis,nama,kelas,password]=l.split(/[,;\t]/).map(s=>(s||'').trim());
            const kls = canonicalClass(kelas);
            if(!nis || !/^[A-Za-z0-9._-]{3,30}$/.test(nis) || !ALL_CLASSES.includes(kls)){ skipped.push(l); return null; }
            return {nis,nama:nama||nis,kelas:kls,password:password||Math.random().toString(36).slice(2,8)};
          }).filter(Boolean);
          if(!rowsIn.length) return alert('Tidak ada baris valid.\nFormat: NIS,Nama,Kelas,Password\nKelas harus salah satu dari: '+ALL_CLASSES.join(', '));
          const importBtn = wrap.querySelector('#akImport');
          run(()=>Accounts.send({action:'bulk',accounts:rowsIn}).then(r=>{
            alert(rowsIn.length+' akun diproses.'+(skipped.length? '\n'+skipped.length+' baris dilewati (kelas/NIS tidak valid).':'')+'\n\n'+rowsIn.map(x=>`${x.nis} · ${x.password}`).join('\n'));
            wrap.querySelector('#akBulk').value=''; return r;
          }), importBtn);
        };
        wrap.querySelector('#akCsv').onclick = ()=>{
          const csv='NIS,Nama,Kelas,Terakhir Masuk\n'+list.map(a=>[a.nis,a.nama,a.kelas,a.terakhirMasuk||''].join(',')).join('\n');
          const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
          const a=document.createElement('a'); a.href=url; a.download='akun-siswa.csv'; a.click(); URL.revokeObjectURL(url);
        };
        wrap.querySelector('#akFilter').onchange = e=>{ filter=e.target.value; draw(); };
        wrap.querySelectorAll('.akReset').forEach(btn=>btn.onclick=()=>{
          const acc = list.find(a=>a.nis===btn.dataset.n); if(!acc) return;
          const pw = prompt('Password baru untuk '+acc.nama+':', Math.random().toString(36).slice(2,8));
          if(!pw) return;
          run(()=>Accounts.send({nis:acc.nis,nama:acc.nama,kelas:acc.kelas,password:pw}).then(r=>{
            alert('Password '+acc.nis+' diubah menjadi: '+pw); return r;
          }));
        });
        wrap.querySelectorAll('.akDel').forEach(btn=>btn.onclick=()=>{
          if(!confirm('Hapus akun '+btn.dataset.n+'?')) return;
          run(()=>Accounts.send({action:'delete',nis:btn.dataset.n}));
        });
      };

      const load = ()=> Accounts.list()
        .then(a=>{ list=a; loadErr=''; draw(); })
        .catch(e=>{ list=[]; loadErr=(e&&e.message)||String(e); draw(); });
      load();
    }
  };


  FEATURES.materi = {
    ico:'M', title:'Materi Ajar', sub:'Kelola bahan ajar per bab',
    render(b){
      const key=SK('materi');
      const rawList = LS.get(key, []);
      let changed=false;
      let list = rawList.map(m=>{if(m.s==='Draft'&&(m.f||m.l)){changed=true;return{...m,s:'Terbit'};}return m;});
      let subjectFilter='ALL';
      if(changed){ LS.set(key,list); }
      QuizAlerts.startPolling();

      const save=()=>{LS.set(key,list);SharedCatalog.publish();};
      const fmtSize=(n)=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
      const draw=()=>{
        const dr = Drive.state();
        const upOk = FeatureConfig.subEnabled('materi_upload');
        const fltOk = FeatureConfig.subEnabled('materi_filter');
        const storeNote = dr.ready
          ? `<span style="font-size:12px;color:#047857">☁️ Tersimpan di Google Drive — maks. ${Math.round(dr.maxBytes/1048576)}MB per file, otomatis bisa dibuka semua siswa.</span>`
          : `<span style="font-size:12px;color:#b45309">⚠️ Google Drive belum aktif — file disimpan lokal (maks. 5MB, hanya di browser ini).</span>`;
        b.innerHTML=`
        <div class="fp-card" style="display:grid;gap:10px;margin-bottom:12px">
          <div class="fp-row">
            <input class="fp-input" id="mj" placeholder="Judul materi" style="flex:1;min-width:200px"/>
            ${multiClassPickerHtml('mk','ALL','width:170px')}
            <select class="fp-select" id="mm" aria-label="Mata pelajaran materi baru" style="flex:1;min-width:200px">${subjectOptionsHtml('',undefined,'Pilih mata pelajaran')}</select>
          </div>
          <div class="fp-row">
            <input class="fp-input" id="ml" placeholder="Link materi (opsional, mis. https://drive.google.com/...)" style="flex:1;min-width:220px"/>
            ${upOk?`<input type="file" id="mf" class="fp-input" style="width:220px" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.html,.htm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.zip"/>`:''}
            <button class="fp-btn sm" id="mAdd">+ Tambah</button>
          </div>
          <div class="fp-row" style="justify-content:space-between">
            ${storeNote}
            <span class="fp-badge info">${list.length} materi</span>
          </div>
          <div id="mStat" style="font-size:12px;color:#475569"></div>
        </div>
        ${fltOk?`<label class="fp-label" for="mFilter">Mata pelajaran</label>
        <select class="fp-select" id="mFilter" style="margin-bottom:12px"><option value="ALL">Semua mata pelajaran</option>${subjectOptionsHtml(subjectFilter)}</select>`:''}
        <div style="overflow-x:auto"><table class="fp-table"><thead><tr><th>Judul</th><th>Mata pelajaran</th><th>Kelas</th><th>Sumber</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map((m,i)=>{
          if(fltOk && subjectFilter!=='ALL' && materialSubject(m)!==subjectFilter) return '';
          const srcs=[];
          if(m.l) srcs.push(`<a href="${esc(m.l)}" target="_blank" rel="noopener" style="color:#4f46e5;text-decoration:underline">Link</a>`);
          if(m.f) srcs.push(`<a href="${esc(m.f.data)}" ${m.f.drive?'target="_blank" rel="noopener"':`download="${esc(m.f.name)}"`} style="color:#4f46e5;text-decoration:underline">${esc(m.f.name)}</a> <span style="color:#94a3b8;font-size:11px">(${fmtSize(m.f.size)}${m.f.drive?' · Drive':' · lokal'})</span>`);
          if(!srcs.length) srcs.push('<span style="color:#94a3b8">—</span>');
          return `<tr><td><b>${esc(m.j)}</b></td><td><select class="fp-select" data-subject="${i}" aria-label="Mata pelajaran ${esc(m.j)}" style="min-width:180px">${subjectOptionsHtml(materialSubject(m))}</select></td><td>${m.k==='ALL'?'<span class="fp-badge info">Semua Kelas</span>':esc(m.k)}</td><td>${srcs.join('<br>')}</td>
          <td><span class="fp-badge ${m.s==='Terbit'?'ok':'warn'}">${m.s}</span></td>
          <td style="text-align:right;white-space:nowrap">
          <button class="fp-btn sm ghost" data-ed="${i}">✏️ Edit</button>
          <button class="fp-btn sm ghost" data-t="${i}">Toggle</button>
          <button class="fp-btn sm danger" data-d="${i}">Hapus</button></td></tr>`;
        }).join('')}</tbody></table></div>`;
        if(fltOk && b.querySelector('#mFilter')){
          b.querySelector('#mFilter').value=subjectFilter;
          b.querySelector('#mFilter').onchange=e=>{subjectFilter=e.target.value;draw();};
        }
        b.querySelectorAll('[data-subject]').forEach(el=>el.onchange=()=>{list[+el.dataset.subject].mapel=el.value;save();draw();});
        const stat=b.querySelector('#mStat');
        const setStat=(t,c)=>{stat.textContent=t||''; stat.style.color=c||'#475569';};
        b.querySelector('#mAdd').onclick=async(ev)=>{
          const btn=ev.currentTarget;
          const j=b.querySelector('#mj').value.trim();if(!j)return alert('Judul materi wajib diisi');
          const mapel=b.querySelector('#mm').value;if(!mapel)return alert('Pilih mata pelajaran materi terlebih dahulu.');
          const l=b.querySelector('#ml').value.trim();
          const fEl=b.querySelector('#mf'); const file=fEl&&fEl.files&&fEl.files[0];
          const entry={j,k:b.querySelector('#mk').value,mapel,s:'Terbit'};
          if(l) entry.l=l;
          if(file){
            btn.disabled=true;
            try{
              if(Drive.state().ready){
                setStat(`Mengunggah "${file.name}" ke Google Drive…`,'#0369a1');
                const up=await Drive.upload(file, entry.k);
                entry.f={name:up.name,size:up.size,type:up.mimeType,data:up.viewLink,preview:up.previewLink,download:up.downloadLink,id:up.id,drive:true};
                setStat('✅ Berhasil diunggah ke Google Drive.','#047857');
              }else{
                if(file.size>5*1048576){btn.disabled=false;return alert('Google Drive belum aktif, jadi file dibatasi 5MB. Aktifkan Drive untuk file besar.');}
                const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
                entry.f={name:file.name,size:file.size,type:file.type,data};
                setStat('Disimpan lokal (Drive belum aktif).','#b45309');
              }
            }catch(err){
              btn.disabled=false;
              return alert('Gagal mengunggah: '+(err&&err.message?err.message:err));
            }
            btn.disabled=false;
          }
          list.push(entry);save();draw();
        };
        b.querySelectorAll('[data-ed]').forEach(x=>x.onclick=()=>{
          const m=list[+x.dataset.ed];
          const nj=prompt('Edit judul materi:', m.j); if(nj===null) return;
          const nk=prompt('Edit kelas (ALL atau mis. X-1):', m.k||'ALL'); if(nk===null) return;
          const nl=prompt('Edit link materi (opsional):', m.l||''); if(nl===null) return;
          if(nj.trim()) m.j=nj.trim();
          m.k=canonicalClass(nk)||'ALL';
          if(nl.trim()) m.l=nl.trim(); else delete m.l;
          save(); draw();
        });
        b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{const i=+x.dataset.t;list[i].s=list[i].s==='Terbit'?'Draft':'Terbit';save();draw();});
        b.querySelectorAll('[data-d]').forEach(x=>x.onclick=async()=>{
          if(!confirm('Hapus materi ini?'))return;
          const i=+x.dataset.d; const m=list[i];
          if(m.f&&m.f.drive&&m.f.id&&confirm('Hapus juga file-nya dari Google Drive?')){
            try{await Drive.remove(m.f.id);}catch(err){alert('File Drive gagal dihapus: '+err.message);}
          }
          list.splice(i,1);save();draw();
        });
      };
      SharedCatalog.pull().then(ok=>{if(ok&&b.isConnected){list=LS.get(key,[]);draw();}});
      Drive.ensure().then(()=>{if(b.isConnected)draw();});
      draw();
    }
  };

  // ── Google Drive (penyimpanan hybrid: file besar ke Drive guru) ──
  const Drive = (function(){
    let st={ready:false,passphraseRequired:false,maxBytes:5*1048576,checked:false};
    const PASS_KEY='pb.guru.passphrase';
    const pass=()=>localStorage.getItem(PASS_KEY)||'';
    async function ensure(){
      if(window.colabDb && window.colabDb.isReady()){
        st.checked=true; st.ready=true; st.passphraseRequired=true; st.maxBytes=25*1048576;
        return st;
      }
      if(st.checked) return st;
      st.checked=true;
      try{
        const r=await fetch('/api/drive/materials');
        if(r.ok && (r.headers.get('content-type')||'').includes('json')){const j=await r.json(); st.ready=!!j.ready&&!!j.passphraseRequired; st.passphraseRequired=!!j.passphraseRequired; st.maxBytes=j.maxBytes||st.maxBytes;}
      }catch(e){/* offline / belum dideploy → tetap mode lokal */}
      return st;
    }
    function askPass(force){
      let p=pass();
      if(!p||force){
        p=prompt('Masukkan passphrase Guru untuk mengunggah ke Google Drive:')||'';
        if(p) localStorage.setItem(PASS_KEY,p);
      }
      return p;
    }
    async function upload(file, kelas){
      let p=askPass(false);
      if(!p) throw new Error('Passphrase guru dibutuhkan.');
      const send=async(pw)=>{
        if(window.colabDb && window.colabDb.isReady()){
          return await window.colabDb.files.upload(file, kelas||'', pw);
        }
        const fd=new FormData(); fd.append('file',file); fd.append('kelas',kelas||'');
        const r=await fetch('/api/drive/materials',{method:'POST',headers:{'x-guru-passphrase':pw},body:fd});
        const j=await r.json().catch(()=>({error:'Respons server tidak valid'}));
        if(!r.ok) { const e=new Error(j.error||('Gagal ('+r.status+')')); e.status=r.status; throw e; }
        return j;
      };
      try{ return await send(p); }
      catch(err){
        if(err.status===401){ const p2=askPass(true); if(!p2) throw err; return await send(p2); }
        throw err;
      }
    }
    async function remove(id){
      if(window.colabDb && window.colabDb.isReady()) return;
      const p=askPass(false); if(!p) throw new Error('Passphrase guru dibutuhkan.');
      const r=await fetch('/api/drive/materials?id='+encodeURIComponent(id),{method:'DELETE',headers:{'x-guru-passphrase':p}});
      if(!r.ok){const j=await r.json().catch(()=>({})); throw new Error(j.error||('Gagal hapus ('+r.status+')'));}
    }
    return {ensure, state:()=>st, upload, remove};
  })();

  // ── Katalog bersama: metadata materi/tugas disimpan di Google Colab SQLite (+ fallback lokal) agar akun siswa
  // di browser/perangkat lain melihat publikasi guru yang sama. ──
  const SharedCatalog = (function(){
    const KINDS=['materi','tugas','lkpd','quiz','pengumuman'];
    let pulling=null, revision=null;
    async function pull(){
      if(pulling) return pulling;
      pulling=(async()=>{
        try{
          if(window.colabDb && window.colabDb.isReady()){
            const data=await window.colabDb.catalog.pull();
            revision=data.updatedAt||null;
            const hasRemote=!!data.updatedAt || KINDS.some(k=>Array.isArray(data[k])&&data[k].length>0);
            if(hasRemote) KINDS.forEach(k=>{ if(Array.isArray(data[k])) LS.set('pb.guru.'+k, data[k]); });
            return true;
          }

          const r=await fetch('/api/drive/materials?catalog=1',{cache:'no-store'});
          const ct=r.headers.get('content-type')||'';
          if(r.status===404 || (r.ok && !ct.includes('json'))) return true;
          if(!r.ok) return false;
          const data=await r.json();
          revision=data.updatedAt||null;
          const hasRemote=!!data.updatedAt || KINDS.some(k=>Array.isArray(data[k])&&data[k].length>0);
          if(hasRemote) KINDS.forEach(k=>{ if(Array.isArray(data[k])) LS.set('pb.guru.'+k, data[k]); });
          return true;
        }catch(_){ return false; }
        finally{ pulling=null; }
      })();
      return pulling;
    }
    async function publish(opts){
      if(ROLE!=='guru') return;
      if(pulling) await pulling;
      const silent=opts&&opts.silent;

      let p=localStorage.getItem('pb.guru.passphrase')||'';
      if(!p){
        if(silent) return;
        p=(prompt('Masukkan password admin (atau passphrase guru) agar tugas/materi terkirim ke akun siswa:')||'').trim();
        if(!p){ Guard.notify('Belum terkirim ke siswa: passphrase guru belum diisi.','err'); return; }
        localStorage.setItem('pb.guru.passphrase',p);
      }
      const body={updatedAt:revision}; KINDS.forEach(k=>{ body[k]=LS.get('pb.guru.'+k,[])||[]; });
      try{
        if(window.colabDb && window.colabDb.isReady()){
          try{
            const saved=await window.colabDb.catalog.publish(body, p);
            revision=(saved&&saved.updatedAt)||revision;
            emitSync();
            if(!silent) Guard.notify('Tersimpan di Google Colab SQLite & terkirim ke akun siswa.');
            return;
          }catch(colErr){
            if(colErr && colErr.status===401){
              localStorage.removeItem('pb.guru.passphrase');
              if(!silent){ Guard.notify('Passphrase guru salah, silakan coba lagi.','err'); return publish(); }
              return;
            }
            throw colErr;
          }
        }
        const r=await fetch('/api/drive/materials?catalog=1',{
          method:'POST',
          headers:{'Content-Type':'application/json','x-guru-passphrase':p},
          body:JSON.stringify(body)
        });
        if(r.status===401){
          localStorage.removeItem('pb.guru.passphrase');
          if(!silent){ Guard.notify('Passphrase guru salah, silakan coba lagi.','err'); return publish(); }
          return;
        }
        const ct=r.headers.get('content-type')||'';
        if(r.status===404 || (r.ok && !ct.includes('json'))){
          if(!silent) Guard.notify('Tersimpan di perangkat lokal.');
          emitSync();
          return;
        }
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Sinkronisasi gagal');}
        const saved=await r.json(); revision=saved.updatedAt||revision;
        emitSync();
        if(!silent) Guard.notify('Tersimpan dan terkirim ke akun siswa.');
      }catch(err){ Guard.notify('Data tersimpan lokal, tetapi sinkronisasi akun siswa gagal: '+(err.message||err),'err'); }
    }
    return {pull,publish};
  })();

  // ── Aktivitas bersama: pengumpulan siswa, hasil quiz, rekap absensi ──
  // Siswa boleh menambah miliknya sendiri (tanpa passphrase, hanya lewat
  // endpoint yang membuang field nilai/status), guru menulis ulang saat menilai.
  const Activity = (function(){
    const LKEY={tugas:'pb.submissions.tugas', lkpd:'pb.submissions.lkpd', quiz:'pb.submissions.quiz'};
    const ABS_KEY='pb.shared.absensi';
    let pulling=null;
    function cache(data){
      ['tugas','lkpd','quiz'].forEach(k=>{ if(data[k]&&typeof data[k]==='object'){ if(k==='quiz')Object.values(data[k]).forEach(list=>(list||[]).forEach(e=>{if(e.total>0&&e.benar>=0&&e.benar<=e.total&&e.nilai==null)e.nilai=Math.round(e.benar/e.total*100);})); LS.set(LKEY[k],data[k]); } });
      if(data.absensi&&typeof data.absensi==='object') LS.set(ABS_KEY,data.absensi);
    }
    async function pull(){
      if(pulling) return pulling;
      pulling=(async()=>{
        try{
          if(window.colabDb && window.colabDb.isReady()){
            cache(await window.colabDb.activity.pull());
            return true;
          }

          const r=await fetch('/api/drive/materials?activity=1',{cache:'no-store'});
          const ct=r.headers.get('content-type')||'';
          if(r.status===404 || (r.ok && !ct.includes('json'))) return true;
          if(!r.ok) return false;
          cache(await r.json());
          return true;
        }catch(_){ return false; }
        finally{ pulling=null; }
      })();
      return pulling;
    }
    function local(){
      return {
        tugas:LS.get(LKEY.tugas,{})||{},
        lkpd:LS.get(LKEY.lkpd,{})||{},
        quiz:LS.get(LKEY.quiz,{})||{},
        absensi:LS.get(ABS_KEY,{})||{}
      };
    }
    /** Siswa mengirim satu pengumpulan/hasil quiz. */
    async function submit(jenis, itemKey, entry){
      const all=local(); all[jenis]=all[jenis]||{};
      const list=(all[jenis][itemKey]||[]).slice();
      const at=list.findIndex(s=>s&&s.userId===entry.userId);
      if(at>=0) list[at]={...list[at],...entry}; else list.push(entry);
      all[jenis][itemKey]=list; LS.set(LKEY[jenis],all[jenis]);

      try{
        if(window.colabDb && window.colabDb.isReady()){
          cache(await window.colabDb.submissions.submit(jenis, String(itemKey), entry));
          emitSync();
          return true;
        }
        const r=await fetch('/api/drive/materials?submit=1',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({jenis,itemKey:String(itemKey),entry})
        });
        const ct=r.headers.get('content-type')||'';
        if(r.status===404 || (r.ok && !ct.includes('json'))){ emitSync(); return true; }
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Gagal mengirim');}
        cache(await r.json());
        emitSync();
        return true;
      }catch(err){
        Guard.notify('Tersimpan di perangkat ini, tapi belum sampai ke guru: '+(err.message||err),'err');
        return false;
      }
    }
    /** Guru menyimpan penilaian / rekap absensi ke penyimpanan bersama. */
    async function publish(){
      if(ROLE!=='guru') return;
      let p=localStorage.getItem('pb.guru.passphrase')||'';
      if(!p){
        p=(prompt('Masukkan password admin (atau passphrase guru) agar nilai terkirim ke siswa:')||'').trim();
        if(!p) return;
        localStorage.setItem('pb.guru.passphrase',p);
      }
      try{
        if(window.colabDb && window.colabDb.isReady()){
          try{
            await window.colabDb.activity.publish(local(), p);
            return true;
          }catch(colErr){
            if(colErr && colErr.status===401){ localStorage.removeItem('pb.guru.passphrase'); throw new Error('password admin / passphrase guru salah'); }
            throw colErr;
          }
        }
        const r=await fetch('/api/drive/materials?activity=1',{
          method:'POST',
          headers:{'Content-Type':'application/json','x-guru-passphrase':p},
          body:JSON.stringify(local())
        });
        if(r.status===401){ localStorage.removeItem('pb.guru.passphrase'); throw new Error('password admin / passphrase guru salah'); }
        const ct=r.headers.get('content-type')||'';
        if(r.status===404 || (r.ok && !ct.includes('json'))) return true;
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Sinkronisasi gagal');}
        return true;
      }catch(err){
        Guard.notify('Penilaian tersimpan lokal, sinkronisasi gagal: '+(err.message||err),'err');
      }
    }
    const absensi = {
      key:(kelas,tgl)=>canonicalClass(kelas)+'|'+tgl,
      all:()=>LS.get(ABS_KEY,{})||{},
      set(kelas,tgl,data){ const a=this.all(); a[this.key(kelas,tgl)]=data; LS.set(ABS_KEY,a); publish(); },
      get(kelas,tgl){ return this.all()[this.key(kelas,tgl)]||null; }
    };
    /** Guru menilai satu pengumpulan: ambil data terbaru dulu agar kiriman siswa lain tidak tertimpa. */
    async function grade(jenis, itemKey, match, patch){
      await pull();
      const all=local()[jenis]||{}; const list=(all[itemKey]||[]).slice();
      let at=list.findIndex(s=>s&&((match.kode&&s.kode===match.kode)||(match.userId&&s.userId===match.userId&&s.nama===match.nama)));
      if(at<0){ list.push({...match,...patch}); } else list[at]={...list[at],...patch};
      all[itemKey]=list; LS.set(LKEY[jenis],all);

      const ok=await publish();
      emitSync();
      if(ok) Guard.notify('Nilai tersimpan dan terkirim ke siswa.');
      return ok;
    }
    return {pull,submit,publish,local,absensi,grade};
  })();

  // ── Google Colab Live Polling Sync Listener ──
  (function initRealtimeSync(){
    if(!window.colabDb || !window.colabDb.isReady()) return;
    const refreshPanel = () => {
      if(_currentFeat && FEATURES[_currentFeat]) {
        const b = document.getElementById('fpB');
        if(b && overlay.classList.contains('open')) FEATURES[_currentFeat].render(b);
      }
    };
    const syncOnce = () => {
      if(document.hidden || !window.colabDb.isReady()) return;
      SharedCatalog.pull().then(()=>Activity.pull()).then(()=>{ emitSync(); refreshPanel(); }).catch(()=>{});
    };
    setInterval(syncOnce, 20000);
    window.addEventListener('focus', syncOnce);
  })();

  // ── QuizAlerts: indikator "pengerjaan baru" untuk guru ──
  // Bandingkan hasil quiz terbaru di Activity dengan tanda "sudah dilihat"
  // yang tersimpan lokal, lalu tandai di menu Quiz + daftar quiz.
  const QuizAlerts = (function(){
    const SEEN='pb.guru.quizSeen';
    const seen=()=>LS.get(SEEN,{})||{};
    const sig=(list)=>list.map(s=>`${s&&s.userId||''}:${s&&s.nama||''}:${s&&s.nilai||0}:${s&&s.ts||''}`).join('|');
    /** Jumlah pengerjaan yang belum dilihat guru untuk satu quiz. */
    function unseen(itemKey){
      if(ROLE!=='guru') return 0;
      const list=(Activity.local().quiz||{})[itemKey]||[];
      const mark=seen()[itemKey];
      if(!mark) return list.length;
      if(mark.sig===sig(list)) return 0;
      return Math.max(list.length-(mark.count||0), list.length?1:0);
    }
    function markSeen(itemKey){
      const list=(Activity.local().quiz||{})[itemKey]||[];
      const s=seen(); s[itemKey]={count:list.length, sig:sig(list), at:Date.now()}; LS.set(SEEN,s);
      paintNav();
    }
    function total(){
      if(ROLE!=='guru') return 0;
      const q=Activity.local().quiz||{};
      return Object.keys(q).reduce((a,k)=>a+unseen(k),0);
    }
    /** Titik/angka merah di menu Quiz. */
    function paintNav(){
      if(ROLE!=='guru') return;
      const n=total();
      document.querySelectorAll('.nav-item').forEach(el=>{
        const feat=el.dataset.feature||'';
        const txt=(el.textContent||'').trim().toLowerCase();
        if(feat!=='quiz' && !txt.startsWith('quiz')) return;
        let dot=el.querySelector('.fp-navdot');
        if(!n){ if(dot) dot.remove(); return; }
        if(!dot){
          dot=document.createElement('span'); dot.className='fp-navdot';
          dot.style.cssText='margin-left:auto;background:#ef4444;color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:2px 7px;line-height:1.4';
          el.appendChild(dot);
        }
        dot.textContent=n>99?'99+':String(n);
        dot.title=`${n} pengerjaan quiz baru`;
      });
    }
    let last=-1;
    function check(announce){
      const n=total();
      if(announce && n>last && last>=0 && n>0) Guard.notify(`🔔 ${n} pengerjaan quiz baru dari siswa.`,'info');
      last=n; paintNav();
      const b=document.getElementById('fpB');
      if(_currentFeat==='quiz' && b && FEATURES.quiz) FEATURES.quiz.render(b);
    }
    function startPolling(){
      if(ROLE!=='guru') return;
      check(false);
      Activity.pull().then(()=>check(true));
      setInterval(()=>{ Activity.pull().then(()=>check(true)); }, 60000);
      window.addEventListener('focus',()=>{ Activity.pull().then(()=>check(true)); });
    }
    return {unseen, markSeen, total, paintNav, check, startPolling};
  })();


  // ── SubAlerts: tugas/LKPD yang menunggu dinilai (guru & admin) ──
  const SubAlerts = (function(){
    const pending=(jenis)=>{const a=Activity.local()[jenis]||{};return Object.entries(a).filter(([key])=>key!=='game-progress').reduce((n,[,l])=>n+(l||[]).filter(s=>s&&s.status!=='Selesai'&&s.status!=='Revisi').length,0);};
    let last=-1;
    function paint(){
      if(ROLE!=='guru') return;
      ['tugas','lkpd'].forEach(j=>{
        const n=pending(j);
        document.querySelectorAll('.nav-item').forEach(el=>{
          const feat=el.dataset.feature||''; const txt=(el.textContent||'').trim().toLowerCase();
          if(feat!==j && !txt.startsWith(j)) return;
          let dot=el.querySelector('.fp-subdot');
          if(!n){ if(dot) dot.remove(); return; }
          if(!dot){ dot=document.createElement('span'); dot.className='fp-subdot';
            dot.style.cssText='margin-left:auto;background:#f59e0b;color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:2px 7px;line-height:1.4';
            el.appendChild(dot); }
          dot.textContent=n>99?'99+':String(n); dot.title=n+' pengumpulan menunggu dinilai';
        });
      });
    }
    function check(announce){
      const n=pending('tugas')+pending('lkpd');
      if(announce && last>=0 && n>last) Guard.notify(`📥 ${n-last} tugas/LKPD baru dari siswa — siap dinilai.`,'info');
      const changed=announce && n!==last; last=n; paint();
      const b=document.getElementById('fpB');
      if((_currentFeat==='tugas'||_currentFeat==='lkpd') && b && changed) FEATURES[_currentFeat].render(b);
    }
    function markSeen(){ paint(); }
    function start(){
      if(ROLE!=='guru') return;
      check(false);
      Activity.pull().then(()=>check(true));
      setInterval(()=>{ Activity.pull().then(()=>check(true)); }, 30000);
      window.addEventListener('focus',()=>{ Activity.pull().then(()=>check(true)); });
    }
    return {check, paint, markSeen, start};
  })();

  // ── util: baca file jadi dataURL ──
  const readFile = (file, maxMB=5) => new Promise((res,rej)=>{
    if(!file) return res(null);
    if(file.size > maxMB*1048576) return rej(new Error(`File terlalu besar (maks ${maxMB}MB)`));
    const r=new FileReader(); r.onload=()=>res({name:file.name,size:file.size,type:file.type,data:r.result}); r.onerror=rej; r.readAsDataURL(file);
  });
  const fmtSize=(n)=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';

  // ── link unduh berkas (HTML dari Drive diunduh lewat proxy kita) ──
  const isHtmlFile = (f)=> !!(f && (/^(text\/html|application\/xhtml\+xml)$/.test(f.type||'') || /\.html?$/i.test(f.name||'')));
  const dlUrl = (f)=>{
    if(!f) return '';
    if(f.drive && isHtmlFile(f) && f.id) return `/api/drive/materials?fileId=${encodeURIComponent(f.id)}&download=1`;
    if(f.drive) return f.download || f.data;
    return f.data;
  };
  const dlAttrs = (f)=> (f && f.drive && !isHtmlFile(f)) ? 'target="_blank" rel="noopener"' : `download="${esc((f&&f.name)||'materi')}"`;

  // ── viewer inline (materi / lampiran) ──
  function openViewer(title, {link, file}){
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
    const isDrive = !!(file && file.drive);
    const isHtml = isHtmlFile(file);
    // Drive tidak bisa merender .html; sajikan lewat proxy kita sendiri (sandboxed).
    const driveSrc = isHtml && file.id
      ? `/api/drive/materials?fileId=${encodeURIComponent(file.id)}`
      : (file && (file.preview || file.data));
    const src = file ? (isDrive ? driveSrc : file.data) : link;
    const dlHref = dlUrl(file);
    const isImg = !isDrive && file && (file.type||'').startsWith('image/');
    const body = isImg
      ? `<img src="${src}" style="max-width:100%;max-height:75vh;display:block;margin:auto;border-radius:8px"/>`
      : `<iframe src="${esc(src)}" allow="autoplay"${isHtml?' sandbox="allow-scripts allow-popups"':''} style="width:100%;height:75vh;border:0;border-radius:8px;background:#fff"></iframe>`;
    wrap.innerHTML=`<div style="background:#fff;border-radius:14px;padding:16px;max-width:1000px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0;font-size:16px">${esc(title)}${isDrive?' <span class="fp-badge info" style="font-size:10px">Drive</span>':''}</h3>
        <div style="display:flex;gap:8px">
          ${file?`<a class="fp-btn sm" href="${esc(dlHref)}" ${dlAttrs(file)}>⬇️ Unduh${isHtml?' HTML asli':''}</a>`:''}
          ${link?`<a class="fp-btn sm ghost" href="${esc(link)}" target="_blank" rel="noopener">Buka Tab Baru</a>`:''}
          <button class="fp-btn sm danger" id="vClose">Tutup</button>
        </div></div>${body}</div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('#vClose').onclick=()=>wrap.remove();
    wrap.onclick=(e)=>{if(e.target===wrap) wrap.remove();};
  }

  FEATURES.tugas = {
    ico:'T', title:'Tugas', sub: ROLE==='guru'?'Kelola tugas & lihat pengumpulan':'Tugas yang perlu kamu kerjakan',
    render(b){
      const key=SK('tugas'); let list=LS.get(key,[]);
      const save=()=>{LS.set(key,list);SharedCatalog.publish();};
      const subKey='pb.submissions.tugas'; const subs=()=>LS.get(subKey,{});
      const saveSubs=(v)=>LS.set(subKey,v);
      const myClass = getMyClass();
      const draw=()=>{
        if(ROLE==='guru'){
          const upOk = FeatureConfig.subEnabled('tugas_upload');
          b.innerHTML=`
          <div class="fp-card" style="display:grid;gap:10px;margin-bottom:12px">
            <div class="fp-row">
              <input class="fp-input" id="tj" placeholder="Judul tugas" style="flex:1;min-width:200px"/>
              <input class="fp-input" id="td" placeholder="Deadline" style="width:160px"/>
              ${multiClassPickerHtml('tk','ALL','width:165px')}
            </div>
            <textarea class="fp-input" id="tdesc" placeholder="Instruksi tugas..." style="width:100%;min-height:60px;resize:vertical"></textarea>
            <div class="fp-row">
              <input class="fp-input" id="tl" placeholder="Link lampiran (opsional)" style="flex:1;min-width:220px"/>
              ${upOk?`<input type="file" id="tf" class="fp-input" style="width:220px"/>`:''}
              <button class="fp-btn sm" id="tAdd">+ Tugas</button>
            </div>
          </div>
          <table class="fp-table"><thead><tr><th>Judul</th><th>Kelas</th><th>Deadline</th><th>Pengumpulan</th><th>Status</th><th></th></tr></thead>
          <tbody>${list.map((t,i)=>{
            const sm=subs()[i]||[];
            return `<tr><td><b>${esc(t.j)}</b></td><td>${esc(t.k)}</td><td>${esc(t.d)}</td>
            <td><button class="fp-btn sm ghost" data-v="${i}">${sm.length} pengumpulan</button></td>
            <td><span class="fp-badge ${t.s==='Aktif'?'ok':'warn'}">${t.s}</span></td>
            <td style="text-align:right;white-space:nowrap">
              <button class="fp-btn sm ghost" data-ed="${i}">✏️ Edit</button>
              <button class="fp-btn sm ghost" data-t="${i}">Toggle</button>
              <button class="fp-btn sm danger" data-d="${i}">Hapus</button></td></tr>`;
          }).join('')}</tbody></table>`;
          b.querySelector('#tAdd').onclick=async()=>{
            const j=b.querySelector('#tj').value.trim(); if(!j) return alert('Judul wajib');
            const entry={j,k:b.querySelector('#tk').value,d:b.querySelector('#td').value.trim()||'TBD',s:'Aktif',desc:b.querySelector('#tdesc').value.trim()};
            const l=b.querySelector('#tl').value.trim(); if(l) entry.l=l;
            const tfEl=b.querySelector('#tf');
            if(tfEl&&tfEl.files&&tfEl.files[0]){ try{const f=await readFile(tfEl.files[0]); if(f) entry.f=f;}catch(e){return alert(e.message);} }
            list.push(entry); save(); draw();
          };
          b.querySelectorAll('[data-ed]').forEach(x=>x.onclick=()=>{
            const t=list[+x.dataset.ed];
            const nj=prompt('Edit judul tugas:', t.j); if(nj===null) return;
            const nd=prompt('Edit deadline:', t.d||'TBD'); if(nd===null) return;
            const ndesc=prompt('Edit instruksi tugas:', t.desc||''); if(ndesc===null) return;
            const nk=prompt('Edit kelas (ALL atau mis. X-1):', t.k||'ALL'); if(nk===null) return;
            if(nj.trim()) t.j=nj.trim();
            t.d=nd.trim()||'TBD'; t.desc=ndesc.trim(); t.k=canonicalClass(nk)||'ALL';
            save(); draw();
          });
          b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{const i=+x.dataset.t;list[i].s=list[i].s==='Aktif'?'Draft':'Aktif';save();draw();});
          b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{if(confirm('Hapus?')){list.splice(+x.dataset.d,1);save();draw();}});
          b.querySelectorAll('[data-v]').forEach(x=>x.onclick=()=>{
            const i=+x.dataset.v; const sm=subs()[i]||[];
            if(!sm.length) return alert('Belum ada pengumpulan.');
            const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
            const renderRows=()=>sm.map((s,j)=>`<tr>
              <td>${esc(s.nama||'-')}${s.kode?`<div style="font-size:10px;color:#64748b">${esc(s.kode)}</div>`:''}</td><td>${esc(s.kelas||'-')}</td><td>${esc(s.ts||'')}${s.terlambat?' <span class="fp-badge warn">Terlambat</span>':''}</td>
              <td style="max-width:220px">${esc(s.jawaban||'-').slice(0,140)}</td>
              <td>${s.f?`<a href="${s.f.data}" download="${esc(s.f.name)}" style="color:#4f46e5;text-decoration:underline">${esc(s.f.name)}</a>`:'-'}</td>
              <td><input type="number" min="0" max="100" class="fp-input" data-n="${j}" value="${s.nilai??''}" placeholder="0-100" style="width:75px"/></td>
              <td><input class="fp-input" data-c="${j}" value="${esc(s.catatan||'')}" placeholder="Catatan..." style="width:150px"/></td>
              <td>${s.status==='Selesai'?'<span class="fp-badge ok">Selesai</span>':s.status==='Revisi'?'<span class="fp-badge warn">Revisi</span>':'<span class="fp-badge info">Belum</span>'}</td>
              <td style="white-space:nowrap">
                <button class="fp-btn sm" data-sv="${j}">Simpan</button>
                <button class="fp-btn sm ghost" data-rv="${j}">Revisi</button>
              </td></tr>`).join('');
            w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px;max-width:1100px;width:100%;max-height:85vh;overflow:auto">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0">Penilaian: ${esc(list[i].j)}</h3><button class="fp-btn sm danger" id="xC">Tutup</button></div>
              <div style="font-size:12px;color:#64748b;margin-bottom:8px">Isi nilai (0–100) & catatan, lalu tekan <b>Simpan</b> untuk menandai selesai, atau <b>Revisi</b> untuk minta perbaikan.</div>
              <table class="fp-table" id="gTbl"><thead><tr><th>Nama</th><th>Kelas</th><th>Waktu</th><th>Jawaban</th><th>File</th><th>Nilai</th><th>Catatan</th><th>Status</th><th></th></tr></thead><tbody>${renderRows()}</tbody></table></div>`;
            document.body.appendChild(w); w.querySelector('#xC').onclick=()=>w.remove();
            const rerender=()=>{w.querySelector('#gTbl tbody').innerHTML=renderRows();bindRow();};
            const commit=(j,status)=>{
              const nv=+w.querySelector(`[data-n="${j}"]`).value; const cv=w.querySelector(`[data-c="${j}"]`).value.trim();
              if(status==='Selesai' && (isNaN(nv)||nv<0||nv>100)) return alert('Nilai harus 0–100');
              const all=subs(); all[i][j]={...all[i][j], nilai:isNaN(nv)?null:nv, catatan:cv, status, dinilaiPada:new Date().toLocaleString('id-ID')};
              sm[j]=all[i][j]; saveSubs(all); rerender(); draw();
              Activity.grade(subKey.split('.').pop(), i, sm[j], {nilai:sm[j].nilai, catatan:cv, status, dinilaiPada:sm[j].dinilaiPada}).then(()=>{SubAlerts.check(false);});
            };
            const bindRow=()=>{
              w.querySelectorAll('[data-sv]').forEach(el=>el.onclick=()=>commit(+el.dataset.sv,'Selesai'));
              w.querySelectorAll('[data-rv]').forEach(el=>el.onclick=()=>commit(+el.dataset.rv,'Revisi'));
            }; bindRow();
          });
        } else {
          const my = Guard.filter(list, {label:'tugas'}).map((t)=>({t,i:list.indexOf(t)})).filter(({t})=>t.s==='Aktif');
          b.innerHTML=`<div style="font-size:12px;color:#64748b;margin-bottom:10px">Tugas untuk kelas <b>${esc(myClass||'-')}</b></div>
          <div class="fp-list">${my.map(({t,i})=>{
            const mine=(subs()[i]||[]).find(s=>isMine(s));
            const graded = mine && mine.status==='Selesai';
            const revisi = mine && mine.status==='Revisi';
            const badge = graded ? `<span class="fp-badge ok">Dinilai · ${mine.nilai ?? '-'}</span>`
                        : revisi ? `<span class="fp-badge warn">Perlu Revisi</span>`
                        : mine   ? `<span class="fp-badge info">✓ Terkirim · Menunggu penilaian</span>${mine.kode?`<div style="font-size:10px;color:#64748b">Bukti: ${esc(mine.kode)}</div>`:''}` : '';
            return `<div class="fp-item"><div style="flex:1">
              <div class="t">${esc(t.j)}</div>
              <div class="m">${esc(t.k)} · Deadline ${esc(t.d)}</div>
              ${t.desc?`<div style="font-size:12px;color:#475569;margin-top:4px">${esc(t.desc)}</div>`:''}
              <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">
                ${t.l?`<a href="${esc(t.l)}" target="_blank" rel="noopener" style="color:#4f46e5;text-decoration:underline;font-size:12px">🔗 Link</a>`:''}
                ${t.f?`<button class="fp-btn sm ghost" data-view="${i}" style="padding:2px 8px;font-size:11px">📄 ${esc(t.f.name)}</button>`:''}
              </div>
              ${mine && mine.catatan?`<div style="margin-top:6px;padding:6px 8px;background:#fef9c3;border-radius:6px;font-size:12px"><b>Catatan guru:</b> ${esc(mine.catatan)}</div>`:''}
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;gap:6px;align-items:flex-end">
              ${badge}
              ${(!mine || revisi)?`<button class="fp-btn sm" data-sub="${i}">${revisi?'Kirim Ulang':'Kerjakan'}</button>`:''}
            </div></div>`;
          }).join('')||'<div class="fp-empty">Tidak ada tugas aktif 🎉</div>'}</div>`;
          b.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>{const i=+x.dataset.view;openViewer(list[i].j,{link:list[i].l,file:list[i].f});});
          b.querySelectorAll('[data-sub]').forEach(x=>x.onclick=()=>{
            const i=+x.dataset.sub; const t=list[i];
            if(!Guard.assert(t,{label:'tugas'})) return;
            const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
            w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px;max-width:520px;width:100%">
              <h3 style="margin:0 0 10px">Kerjakan: ${esc(t.j)}</h3>
              <input class="fp-input" id="sN" placeholder="Nama kamu" style="width:100%;margin-bottom:8px"/>
              <textarea class="fp-input" id="sJ" placeholder="Tulis jawaban..." style="width:100%;min-height:100px;resize:vertical;margin-bottom:8px"></textarea>
              <input type="file" id="sF" class="fp-input" style="width:100%;margin-bottom:12px"/>
              <div style="display:flex;gap:8px;justify-content:flex-end"><button class="fp-btn sm ghost" id="xC">Batal</button><button class="fp-btn sm" id="xS">Kirim</button></div></div>`;
            document.body.appendChild(w); w.querySelector('#xC').onclick=()=>w.remove();
            w.querySelector('#xS').onclick=async()=>{
              const nama=w.querySelector('#sN').value.trim();
              const jawaban=w.querySelector('#sJ').value.trim();
              const file=w.querySelector('#sF').files[0];
              // Validasi sebelum dikirim
              const errs=[];
              if(nama.length<3) errs.push('• Nama wajib diisi (minimal 3 huruf).');
              if(!jawaban && !file) errs.push('• Isi jawaban atau lampirkan file.');
              if(jawaban && jawaban.length<10 && !file) errs.push('• Jawaban terlalu singkat (minimal 10 karakter).');
              if(file){
                if(file.size>5*1024*1024) errs.push('• Ukuran file maksimal 5 MB.');
                if(!/\.(pdf|docx?|pptx?|xlsx?|txt|png|jpe?g|html?|zip)$/i.test(file.name)) errs.push('• Tipe file tidak didukung (PDF, Word, PPT, Excel, gambar, HTML, ZIP).');
              }
              if(errs.length) return alert('Tugas belum bisa dikirim:\n'+errs.join('\n'));
              const dl=Date.parse(t.d); const telat=!isNaN(dl) && Date.now()>dl+86400000;
              if(!confirm(`Periksa lagi sebelum mengirim:\n\nNama: ${nama}\nKelas: ${myClass||'-'}\nTugas: ${t.j}\nJawaban: ${jawaban?jawaban.length+' karakter':'-'}\nFile: ${file?file.name:'-'}${telat?'\n\n⚠️ Melewati deadline — akan ditandai TERLAMBAT.':''}\n\nKirim sekarang?`)) return;
              let f=null; try{f=await readFile(file);}catch(e){return alert(e.message);}
              const kode='TG-'+Date.now().toString(36).toUpperCase().slice(-6);
              let entry; try{ entry = Guard.stampSubmission({userId:'me',nama,jawaban,f,kode,terlambat:telat,ts:new Date().toLocaleString('id-ID')}); }catch(_){ return; }
              const send=w.querySelector('#xS');send.disabled=true;
              const sent=await Activity.submit('tugas',String(i),entry);send.disabled=false;
              if(!sent)return;
              w.remove(); draw();
              alert(`✅ Tugas berhasil dikirim & tervalidasi!\n\nKode bukti: ${kode}\nWaktu: ${entry.ts}${telat?'\nStatus: Terlambat':''}\n\nSimpan kode ini sebagai bukti pengumpulan.`);
            };
          });
        }
      }; draw(); if(ROLE==='guru') Activity.pull().then(ok=>{ if(ok&&b.isConnected) draw(); SubAlerts.markSeen(); });
    }
  };

  FEATURES.lkpd = {
    ico:'L', title:'LKPD', sub: ROLE==='guru'?'Kelola LKPD & lihat pengerjaan':'Lembar Kerja untuk kamu isi',
    render(b){
      const key=SK('lkpd'); let list=LS.get(key,[
        {j:'LKPD 1 — Berpikir Komputasional',k:'X-1',desc:'Jawab pertanyaan tentang dekomposisi masalah.'},
        {j:'LKPD 2 — Algoritma Runtutan',k:'X-1',desc:'Tulis algoritma menyeduh kopi.'},
        {j:'LKPD KKA — Pengenalan',k:'VIII-A',desc:'Identifikasi kegiatan keagamaan.'}
      ]);
      const save=()=>{LS.set(key,list);SharedCatalog.publish();};
      const subKey='pb.submissions.lkpd'; const subs=()=>LS.get(subKey,{}); const saveSubs=(v)=>LS.set(subKey,v);
      const myClass=getMyClass();
      const draw=()=>{
        if(ROLE==='guru'){
          const upOk = FeatureConfig.subEnabled('tugas_upload');
          b.innerHTML=`
          <div class="fp-card" style="display:grid;gap:10px;margin-bottom:12px">
            <div class="fp-row">
              <input class="fp-input" id="lj" placeholder="Judul LKPD" style="flex:1;min-width:200px"/>
              ${multiClassPickerHtml('lk','ALL','width:165px')}
            </div>
            <textarea class="fp-input" id="ldesc" placeholder="Petunjuk pengerjaan..." style="width:100%;min-height:60px;resize:vertical"></textarea>
            <div class="fp-row">
              <input class="fp-input" id="ll" placeholder="Link (opsional)" style="flex:1;min-width:220px"/>
              ${upOk?`<input type="file" id="lf" class="fp-input" style="width:220px"/>`:''}
              <button class="fp-btn sm" id="lAdd">+ LKPD</button>
            </div></div>
          <div class="fp-list">${list.map((x,i)=>{
            const n=(subs()[i]||[]).length;
            return `<div class="fp-item"><div style="flex:1"><div class="t">${esc(x.j)}</div>
              <div class="m">${esc(x.k)} · ${esc(x.desc||'')}</div></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="fp-btn sm ghost" data-ed="${i}">✏️ Edit</button>
              <button class="fp-btn sm ghost" data-v="${i}">${n} pengerjaan</button>
              <button class="fp-btn sm danger" data-d="${i}">Hapus</button></div></div>`;
          }).join('')||'<div class="fp-empty">Belum ada LKPD.</div>'}</div>`;
          b.querySelector('#lAdd').onclick=async()=>{
            const j=b.querySelector('#lj').value.trim(); if(!j) return alert('Judul wajib');
            const entry={j,k:b.querySelector('#lk').value,desc:b.querySelector('#ldesc').value.trim()};
            const l=b.querySelector('#ll').value.trim(); if(l) entry.l=l;
            const lfEl=b.querySelector('#lf');
            if(lfEl&&lfEl.files&&lfEl.files[0]){ try{const f=await readFile(lfEl.files[0]); if(f) entry.f=f;}catch(e){return alert(e.message);} }
            list.push(entry); save(); draw();
          };
          b.querySelectorAll('[data-ed]').forEach(x=>x.onclick=()=>{
            const it=list[+x.dataset.ed];
            const nj=prompt('Edit judul LKPD:', it.j); if(nj===null) return;
            const nd=prompt('Edit petunjuk:', it.desc||''); if(nd===null) return;
            const nk=prompt('Edit kelas (ALL atau mis. X-1):', it.k||'ALL'); if(nk===null) return;
            if(nj.trim()) it.j=nj.trim();
            it.desc=nd.trim(); it.k=canonicalClass(nk)||'ALL';
            save(); draw();
          });
          b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{if(confirm('Hapus?')){list.splice(+x.dataset.d,1);save();draw();}});
          b.querySelectorAll('[data-v]').forEach(x=>x.onclick=()=>{
            const i=+x.dataset.v; const sm=subs()[i]||[];
            if(!sm.length) return alert('Belum ada pengerjaan.');
            const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
            const renderRows=()=>sm.map((s,j)=>`<tr>
              <td>${esc(s.nama||'-')}</td><td>${esc(s.kelas||'-')}</td><td>${esc(s.ts||'')}</td>
              <td style="max-width:220px">${esc(s.jawaban||'-').slice(0,140)}</td>
              <td>${s.f?`<a href="${s.f.data}" download="${esc(s.f.name)}" style="color:#4f46e5">${esc(s.f.name)}</a>`:'-'}</td>
              <td><input type="number" min="0" max="100" class="fp-input" data-n="${j}" value="${s.nilai??''}" placeholder="0-100" style="width:75px"/></td>
              <td><input class="fp-input" data-c="${j}" value="${esc(s.catatan||'')}" placeholder="Catatan..." style="width:150px"/></td>
              <td>${s.status==='Selesai'?'<span class="fp-badge ok">Selesai</span>':s.status==='Revisi'?'<span class="fp-badge warn">Revisi</span>':'<span class="fp-badge info">Belum</span>'}</td>
              <td style="white-space:nowrap"><button class="fp-btn sm" data-sv="${j}">Simpan</button> <button class="fp-btn sm ghost" data-rv="${j}">Revisi</button></td>
            </tr>`).join('');
            w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px;max-width:1100px;width:100%;max-height:85vh;overflow:auto">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Penilaian LKPD: ${esc(list[i].j)}</h3><button class="fp-btn sm danger" id="xC">Tutup</button></div>
              <div style="font-size:12px;color:#64748b;margin-bottom:8px">Isi nilai (0–100) & catatan, lalu <b>Simpan</b> untuk menandai selesai atau <b>Revisi</b> untuk minta perbaikan.</div>
              <table class="fp-table" id="gTbl"><thead><tr><th>Nama</th><th>Kelas</th><th>Waktu</th><th>Jawaban</th><th>File</th><th>Nilai</th><th>Catatan</th><th>Status</th><th></th></tr></thead><tbody>${renderRows()}</tbody></table></div>`;
            document.body.appendChild(w); w.querySelector('#xC').onclick=()=>w.remove();
            const rerender=()=>{w.querySelector('#gTbl tbody').innerHTML=renderRows();bindRow();};
            const commit=(j,status)=>{
              const nv=+w.querySelector(`[data-n="${j}"]`).value; const cv=w.querySelector(`[data-c="${j}"]`).value.trim();
              if(status==='Selesai' && (isNaN(nv)||nv<0||nv>100)) return alert('Nilai harus 0–100');
              const all=subs(); all[i][j]={...all[i][j], nilai:isNaN(nv)?null:nv, catatan:cv, status, dinilaiPada:new Date().toLocaleString('id-ID')};
              sm[j]=all[i][j]; saveSubs(all); rerender(); draw();
              Activity.grade(subKey.split('.').pop(), i, sm[j], {nilai:sm[j].nilai, catatan:cv, status, dinilaiPada:sm[j].dinilaiPada}).then(()=>{SubAlerts.check(false);});
            };
            const bindRow=()=>{
              w.querySelectorAll('[data-sv]').forEach(el=>el.onclick=()=>commit(+el.dataset.sv,'Selesai'));
              w.querySelectorAll('[data-rv]').forEach(el=>el.onclick=()=>commit(+el.dataset.rv,'Revisi'));
            }; bindRow();
          });
        } else {
          const my=Guard.filter(list,{label:'lkpd'}).map(x=>({x,i:list.indexOf(x)}));
          b.innerHTML=`<div style="font-size:12px;color:#64748b;margin-bottom:10px">LKPD untuk kelas <b>${esc(myClass||'-')}</b></div>
          <div class="fp-list">${my.map(({x,i})=>{
            const mine=(subs()[i]||[]).find(s=>isMine(s));
            const graded = mine && mine.status==='Selesai';
            const revisi = mine && mine.status==='Revisi';
            const badge = graded ? `<span class="fp-badge ok">Dinilai · ${mine.nilai ?? '-'}</span>`
                        : revisi ? `<span class="fp-badge warn">Perlu Revisi</span>`
                        : mine   ? `<span class="fp-badge info">Menunggu penilaian</span>` : '';
            return `<div class="fp-item"><div style="flex:1"><div class="t">${esc(x.j)}</div>
              <div class="m">${esc(x.desc||'')}</div>
              <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">
                ${x.l?`<a href="${esc(x.l)}" target="_blank" rel="noopener" style="color:#4f46e5;font-size:12px">🔗 Link</a>`:''}
                ${x.f?`<button class="fp-btn sm ghost" data-view="${i}" style="padding:2px 8px;font-size:11px">📄 Lihat Lampiran</button>`:''}
              </div>
              ${mine && mine.catatan?`<div style="margin-top:6px;padding:6px 8px;background:#fef9c3;border-radius:6px;font-size:12px"><b>Catatan guru:</b> ${esc(mine.catatan)}</div>`:''}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                ${badge}
                ${(!mine || revisi)?`<button class="fp-btn sm" data-do="${i}">${revisi?'Kirim Ulang':'Kerjakan'}</button>`:''}
              </div></div>`;
          }).join('')||'<div class="fp-empty">Belum ada LKPD untuk kelas kamu.</div>'}</div>`;
          b.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{const i=+el.dataset.view;openViewer(list[i].j,{link:list[i].l,file:list[i].f});});
          b.querySelectorAll('[data-do]').forEach(el=>el.onclick=()=>{
            const i=+el.dataset.do; const x=list[i];
            if(!Guard.assert(x,{label:'lkpd'})) return;
            const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
            w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px;max-width:520px;width:100%">
              <h3 style="margin:0 0 6px">${esc(x.j)}</h3>
              <div style="font-size:12px;color:#64748b;margin-bottom:10px">${esc(x.desc||'')}</div>
              <input class="fp-input" id="sN" placeholder="Nama kamu" style="width:100%;margin-bottom:8px"/>
              <textarea class="fp-input" id="sJ" placeholder="Isi jawaban LKPD..." style="width:100%;min-height:120px;margin-bottom:8px"></textarea>
              <input type="file" id="sF" class="fp-input" style="width:100%;margin-bottom:12px"/>
              <div style="display:flex;gap:8px;justify-content:flex-end"><button class="fp-btn sm ghost" id="xC">Batal</button><button class="fp-btn sm" id="xS">Kirim</button></div></div>`;
            document.body.appendChild(w); w.querySelector('#xC').onclick=()=>w.remove();
            w.querySelector('#xS').onclick=async()=>{
              const jawaban=w.querySelector('#sJ').value.trim(); if(!jawaban) return alert('Isi jawaban.');
              let f=null; try{f=await readFile(w.querySelector('#sF').files[0]);}catch(e){return alert(e.message);}
              let entry; try{ entry = Guard.stampSubmission({userId:'me',nama:w.querySelector('#sN').value.trim()||'Siswa',jawaban,f,ts:new Date().toLocaleString('id-ID')}); }catch(_){ return; }
              const send=w.querySelector('#xS');send.disabled=true;
              const sent=await Activity.submit('lkpd',String(i),entry);send.disabled=false;
              if(!sent)return;
              w.remove(); draw(); alert('LKPD terkirim ✓');
            };
          });
        }
      }; draw(); if(ROLE==='guru') Activity.pull().then(ok=>{ if(ok&&b.isConnected) draw(); SubAlerts.markSeen(); });
    }
  };

  // ── Bank soal bawaan: BAB 1 Berpikir Komputasional (Koding & KA, kelas VIII) ──
  const SOAL_BK_BAB1 = [
    {q:'Berpikir komputasional adalah cara berpikir untuk...',o:['Menghafal rumus komputer','Menyelesaikan masalah secara sistematis sehingga dapat dikerjakan manusia maupun komputer','Merakit perangkat keras','Mengetik cepat di keyboard'],a:1},
    {q:'Empat fondasi utama berpikir komputasional adalah...',o:['Dekomposisi, pengenalan pola, abstraksi, algoritma','Input, proses, output, feedback','Analisis, sintesis, evaluasi, kreasi','Data, informasi, pengetahuan, kebijakan'],a:0},
    {q:'Memecah masalah besar menjadi bagian kecil yang lebih mudah disebut...',o:['Abstraksi','Dekomposisi','Algoritma','Iterasi'],a:1},
    {q:'Mencari kesamaan atau keteraturan pada beberapa masalah disebut...',o:['Pengenalan pola','Dekomposisi','Abstraksi','Debugging'],a:0},
    {q:'Mengabaikan detail yang tidak penting dan fokus pada hal utama disebut...',o:['Kompilasi','Abstraksi','Simulasi','Enkripsi'],a:1},
    {q:'Langkah-langkah yang runtut dan logis untuk menyelesaikan masalah disebut...',o:['Algoritma','Sintaks','Program','Variabel'],a:0},
    {q:'Contoh penerapan dekomposisi dalam kehidupan sehari-hari adalah...',o:['Membaca buku sampai habis','Membagi tugas piket kelas menjadi menyapu, mengepel, dan membuang sampah','Menonton video tutorial','Menghafal jadwal pelajaran'],a:1},
    {q:'Bentuk penyajian algoritma yang menggunakan simbol-simbol bagan alir disebut...',o:['Pseudocode','Flowchart','Narasi','Tabel'],a:1},
    {q:'Simbol belah ketupat (diamond) pada flowchart digunakan untuk...',o:['Awal/akhir program','Proses perhitungan','Pengambilan keputusan','Input/output'],a:2},
    {q:'Simbol oval pada flowchart menandakan...',o:['Mulai atau selesai','Percabangan','Perulangan','Penyimpanan data'],a:0},
    {q:'Urutan langkah yang benar untuk mengirim pesan: (1) tulis pesan (2) buka aplikasi (3) tekan kirim (4) pilih kontak',o:['1-2-3-4','2-4-1-3','4-2-1-3','2-1-4-3'],a:1},
    {q:'Struktur algoritma yang menjalankan perintah berulang kali disebut...',o:['Sekuensial','Perulangan (looping)','Percabangan','Deklarasi'],a:1},
    {q:'Struktur yang memilih tindakan berdasarkan syarat tertentu disebut...',o:['Percabangan (kondisional)','Perulangan','Runtunan','Fungsi'],a:0},
    {q:'Pernyataan "Jika nilai ≥ 75 maka LULUS, selain itu REMEDIAL" merupakan contoh...',o:['Perulangan','Percabangan','Dekomposisi','Abstraksi'],a:1},
    {q:'Proses mencari dan memperbaiki kesalahan pada algoritma/program disebut...',o:['Debugging','Compiling','Booting','Formatting'],a:0},
    {q:'Peta atau denah sekolah adalah contoh nyata dari...',o:['Algoritma','Abstraksi','Perulangan','Dekomposisi'],a:1},
    {q:'Kecerdasan artifisial (KA/AI) adalah...',o:['Robot yang selalu berbentuk manusia','Kemampuan mesin meniru kemampuan berpikir manusia seperti belajar dan mengambil keputusan','Aplikasi mengetik otomatis','Jaringan kabel komputer'],a:1},
    {q:'Agar kecerdasan artifisial dapat belajar, hal utama yang dibutuhkan adalah...',o:['Data','Kertas','Printer','Baterai'],a:0},
    {q:'Berikut yang BUKAN contoh penerapan kecerdasan artifisial adalah...',o:['Asisten suara di ponsel','Rekomendasi video otomatis','Kalkulator penjumlahan sederhana','Penerjemah bahasa otomatis'],a:2},
    {q:'Sikap yang benar saat menggunakan kecerdasan artifisial untuk belajar adalah...',o:['Menyalin hasilnya tanpa memeriksa','Menggunakan sebagai alat bantu dan tetap memeriksa kebenarannya','Memakainya untuk menyontek ujian','Menyebarkan hasilnya sebagai karya sendiri'],a:1},
    {q:'Dalam algoritma, "input" berarti...',o:['Data yang dimasukkan untuk diproses','Hasil akhir program','Kesalahan program','Nama variabel'],a:0},
    {q:'Perhatikan pola bilangan 2, 4, 8, 16, ... Bilangan berikutnya adalah...',o:['18','24','32','30'],a:2},
    {q:'Manfaat berpikir komputasional bagi siswa adalah...',o:['Membuat siswa hanya bisa memakai komputer','Melatih pemecahan masalah secara runtut dan efisien','Mengganti peran guru','Menghilangkan kebutuhan belajar matematika'],a:1},
    {q:'Menyusun langkah membuat mi instan lalu mengujinya sampai berhasil menunjukkan proses...',o:['Menyusun algoritma dan mengujinya','Enkripsi data','Instalasi perangkat lunak','Pengelolaan jaringan'],a:0},
    {q:'Jika sebuah algoritma memberi hasil yang salah, tindakan yang tepat adalah...',o:['Membiarkannya','Menelusuri langkah demi langkah untuk menemukan kesalahannya','Menghapus seluruh pekerjaan','Mengganti komputer'],a:1}
  ];
  const QUIZ_SEEDS = ['VIII-A','VIII-B','VIII-C','VIII-D'].map(k=>({
    j:'Quiz BAB 1 — Berpikir Komputasional ('+k+')', k, soal: SOAL_BK_BAB1.map(s=>({...s, o:[...s.o]}))
  }));
  /** Pastikan quiz bawaan tersedia (tanpa menimpa quiz buatan guru). */
  function seedQuizzes(list){
    let changed=false;
    QUIZ_SEEDS.forEach(seed=>{
      if(!list.some(x=>String(x&&x.j||'')===seed.j)){ list.push(seed); changed=true; }
    });
    return changed;
  }

  FEATURES.quiz = {
    ico:'Q', title:'Quiz', sub: ROLE==='guru'?'Buat quiz per kelas':'Kerjakan quiz dari guru',
    render(b){
      const key='pb.guru.quiz'; let list=LS.get(key,[]);
      if(!Array.isArray(list)) list=[];
      const save=()=>{LS.set(key,list);SharedCatalog.publish();};
      if(seedQuizzes(list)) save();
      const scoreKey='pb.murid.quizScores'; const scores=()=>LS.get(scoreKey,{}); const saveScore=(v)=>LS.set(scoreKey,v);
      const myClass=getMyClass();
      // Kunci stabil per quiz (judul), supaya hasil tidak tertukar saat urutan berubah.
      const qKey=(q,i)=>((String(q&&q.j||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60))||('quiz-'+i));
      const hasil=(q,i)=>{
        const all=(Activity.local().quiz||{})[qKey(q,i)];
        return Array.isArray(all)?all:[];
      };


      const draw=()=>{
        if(ROLE==='guru'){
          b.innerHTML=`
          <div class="fp-card" style="display:grid;gap:10px;margin-bottom:12px">
            <div class="fp-row">
              <input class="fp-input" id="qj" placeholder="Judul quiz" style="flex:1;min-width:200px"/>
              ${multiClassPickerHtml('qk','ALL','width:165px')}
              <button class="fp-btn sm" id="qAdd">+ Quiz</button>
            </div>
            <div style="font-size:11px;color:#64748b">Setelah dibuat, klik "Soal" untuk menambah pertanyaan, lalu "Hasil" untuk rekap nilai siswa. Semua quiz otomatis muncul di Arena Game Quiz.</div>
          </div>
          <div class="fp-list">${list.map((x,i)=>{
            const h=hasil(x,i);
            const baru=QuizAlerts.unseen(qKey(x,i));
            const rata=h.length?Math.round(h.reduce((a,s)=>a+(Number(s.nilai)||0),0)/h.length):0;
            return `<div class="fp-item"><div style="flex:1"><div class="t">${esc(x.j)}</div>
              <div class="m">${esc(x.k)} · ${x.soal.length} soal · ${h.length?`<b>${h.length}</b> siswa mengerjakan · rata-rata <b>${rata}</b>`:'belum ada pengerjaan'}${baru?` · <span style="color:#b91c1c;font-weight:700">🔔 ${baru} pengerjaan baru</span>`:''}</div></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="fp-btn sm ghost" data-ed="${i}">✏️ Edit</button>
                <button class="fp-btn sm ghost" data-e="${i}">Soal</button>
                <button class="fp-btn sm" data-h="${i}">Hasil${h.length?` (${h.length})`:''}${baru?` <span style="background:#ef4444;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;margin-left:2px">${baru} baru</span>`:''}</button>
                <button class="fp-btn sm danger" data-d="${i}">Hapus</button>
              </div></div>`;}).join('')||'<div class="fp-empty">Belum ada quiz.</div>'}</div>`;
          b.querySelector('#qAdd').onclick=()=>{const j=b.querySelector('#qj').value.trim();if(!j)return;list.push({id:crypto.randomUUID(),j,k:b.querySelector('#qk').value,soal:[]});save();draw();};
          b.querySelectorAll('[data-ed]').forEach(x=>x.onclick=()=>{
            const q=list[+x.dataset.ed];
            const nj=prompt('Edit judul quiz:', q.j); if(nj===null) return;
            const nk=prompt('Edit kelas (ALL atau mis. X-1):', q.k||'ALL'); if(nk===null) return;
            if(nj.trim()) q.j=nj.trim();
            q.k=canonicalClass(nk)||'ALL';
            save(); draw();
          });
          b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{if(confirm('Hapus quiz?')){list.splice(+x.dataset.d,1);save();draw();}});
          b.querySelectorAll('[data-e]').forEach(x=>x.onclick=()=>editSoal(+x.dataset.e));
          b.querySelectorAll('[data-h]').forEach(x=>x.onclick=()=>lihatHasil(+x.dataset.h));
        } else {
          const my=Guard.filter(list,{label:'quiz'}).map(x=>({x,i:list.indexOf(x)})).filter(({x})=>x.soal.length);
          b.innerHTML=`<div style="font-size:12px;color:#64748b;margin-bottom:10px">Quiz untuk kelas <b>${esc(myClass||'-')}</b></div>
          <div class="fp-list">${my.map(({x,i})=>{
            const sc=scores()[i];
            return `<div class="fp-item"><div style="flex:1"><div class="t">${esc(x.j)}</div>
              <div class="m">${x.soal.length} soal ${sc!=null?`· skor terakhir: <b>${sc}/${x.soal.length}</b>`:''}</div></div>
              <button class="fp-btn sm" data-play="${i}">${sc!=null?'Ulangi':'Mulai'}</button></div>`;
          }).join('')||'<div class="fp-empty">Belum ada quiz untuk kelas kamu.</div>'}</div>`;
          b.querySelectorAll('[data-play]').forEach(el=>el.onclick=()=>{ const qi=+el.dataset.play; if(!Guard.assert(list[qi],{label:'quiz'})) return; playQuiz(qi); });
        }
      };

      /** Rekap nilai & status pengerjaan siswa untuk satu quiz (guru). */
      const lihatHasil=(qi)=>{
        const q=list[qi];
        const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
        document.body.appendChild(w);
        const render=(loading)=>{
          const rows=hasil(q,qi).slice().sort((a,b2)=>(Number(b2.nilai)||0)-(Number(a.nilai)||0));
          const n=rows.length;
          const rata=n?Math.round(rows.reduce((a,s)=>a+(Number(s.nilai)||0),0)/n):0;
          const tertinggi=n?Math.max(...rows.map(s=>Number(s.nilai)||0)):0;
          const terendah=n?Math.min(...rows.map(s=>Number(s.nilai)||0)):0;
          const tuntas=rows.filter(s=>(Number(s.nilai)||0)>=75).length;
          const stat=(l,v)=>`<div style="flex:1;min-width:96px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px"><div style="font-size:11px;color:#64748b">${l}</div><div style="font-weight:700;font-size:16px">${v}</div></div>`;
          w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px;max-width:680px;width:100%;max-height:85vh;overflow:auto">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:10px">
              <div><h3 style="margin:0">Hasil Quiz: ${esc(q.j)}</h3>
                <div style="font-size:12px;color:#64748b">${esc(q.k)} · ${q.soal.length} soal${loading?' · memuat...':''}</div></div>
              <div style="display:flex;gap:6px"><button class="fp-btn sm ghost" id="xR">↻ Segarkan</button><button class="fp-btn sm danger" id="xC">Tutup</button></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
              ${stat('Mengerjakan',n)}${stat('Rata-rata',rata)}${stat('Tertinggi',tertinggi)}${stat('Terendah',n?terendah:0)}${stat('Tuntas (≥75)',tuntas+'/'+n)}
            </div>
            ${n?`<table class="fp-table"><thead><tr><th>Nama</th><th>Kelas</th><th>Benar</th><th>Nilai</th><th>Status</th><th>Waktu</th></tr></thead>
            <tbody>${rows.map(s=>{
              const nilai=Number(s.nilai)||0;
              const badge=nilai>=75?'ok':(nilai>=60?'info':'warn');
              return `<tr><td>${esc(s.nama||'Siswa')}</td><td>${esc(s.kelas||'-')}</td>
                <td>${s.benar!=null?`${s.benar}/${s.total!=null?s.total:q.soal.length}`:'-'}</td>
                <td><b>${nilai}</b></td>
                <td><span class="fp-badge ${badge}">${nilai>=75?'Tuntas':'Perlu remedial'}</span></td>
                <td style="font-size:11px;color:#64748b">${esc(s.ts||'-')}</td></tr>`;
            }).join('')}</tbody></table>`
            :'<div class="fp-empty">Belum ada siswa yang mengerjakan quiz ini.</div>'}</div>`;
          w.querySelector('#xC').onclick=()=>{w.remove();draw();};
          w.querySelector('#xR').onclick=()=>{render(true);Activity.pull().then(()=>render(false));};
        };
        render(true);
        Activity.pull().then(()=>{ render(false); QuizAlerts.markSeen(qKey(q,qi)); });
        QuizAlerts.markSeen(qKey(q,qi));
      };



      const editSoal=(qi)=>{
        const q=list[qi];
        const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
        const render=()=>{
          w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px;max-width:620px;width:100%;max-height:85vh;overflow:auto">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Soal: ${esc(q.j)}</h3><button class="fp-btn sm danger" id="xC">Tutup</button></div>
            <div class="fp-list" style="margin-bottom:12px">${q.soal.map((s,i)=>`<div class="fp-item"><div style="flex:1"><div class="t">${i+1}. ${esc(s.q)}</div><div class="m">Jawaban: ${String.fromCharCode(65+s.a)}. ${esc(s.o[s.a])}</div></div><button class="fp-btn sm danger" data-x="${i}">Hapus</button></div>`).join('')||'<div class="fp-empty">Belum ada soal.</div>'}</div>
            <div style="padding:12px;background:#f8fafc;border-radius:10px">
              <input class="fp-input" id="nq" placeholder="Pertanyaan" style="width:100%;margin-bottom:6px"/>
              <input class="fp-input" id="o0" placeholder="Opsi A" style="width:100%;margin-bottom:4px"/>
              <input class="fp-input" id="o1" placeholder="Opsi B" style="width:100%;margin-bottom:4px"/>
              <input class="fp-input" id="o2" placeholder="Opsi C" style="width:100%;margin-bottom:4px"/>
              <input class="fp-input" id="o3" placeholder="Opsi D" style="width:100%;margin-bottom:6px"/>
              <div class="fp-row"><select class="fp-select" id="na" style="width:140px"><option value="0">Jawaban: A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select>
              <button class="fp-btn sm" id="addQ">+ Tambah Soal</button></div>
            </div></div>`;
          w.querySelector('#xC').onclick=()=>{w.remove();draw();};
          w.querySelector('#addQ').onclick=()=>{
            const nq=w.querySelector('#nq').value.trim(); if(!nq) return;
            const o=[0,1,2,3].map(i=>w.querySelector('#o'+i).value.trim()); if(o.some(x=>!x)) return alert('Isi semua opsi');
            q.soal.push({q:nq,o,a:+w.querySelector('#na').value}); save(); render();
          };
          w.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>{q.soal.splice(+x.dataset.x,1);save();render();});
        };
        document.body.appendChild(w); render();
      };

      const playQuiz=(qi)=>{
        const q=list[qi]; let idx=0,score=0;
        const w=document.createElement('div'); w.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
        document.body.appendChild(w);
        const render=()=>{
          if(idx>=q.soal.length){
            const all=scores(); all[qi]=score; saveScore(all);
            const nilai=q.soal.length?Math.round(score/q.soal.length*100):0;
            const nama=(localStorage.getItem('pb.murid.nama')||'').trim();
            w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:24px;max-width:420px;width:100%;text-align:center"><div style="font-size:52px">🎯</div><h3 style="margin:12px 0 6px">Skor: ${score}/${q.soal.length} · Nilai ${nilai}</h3><p style="color:#64748b">${score===q.soal.length?'Sempurna!':'Terus berlatih!'}</p>
              <input class="fp-input" id="qN" placeholder="Nama kamu" value="${esc(nama)}" style="width:100%;margin-bottom:10px"/>
              <div style="display:flex;gap:8px;justify-content:center"><button class="fp-btn ghost" id="xC">Tutup</button><button class="fp-btn" id="xS">Kirim ke guru</button></div>
              <div id="qMsg" style="font-size:12px;color:#64748b;margin-top:8px"></div></div>`;
            w.querySelector('#xC').onclick=()=>{w.remove();draw();};
            w.querySelector('#xS').onclick=async()=>{
              const nm=w.querySelector('#qN').value.trim()||'Siswa';
              localStorage.setItem('pb.murid.nama',nm);
              let entry; try{ entry=Guard.stampSubmission({userId:'me',nama:nm,benar:score,total:q.soal.length,nilai,ts:new Date().toLocaleString('id-ID')}); }catch(_){ return; }
              const msg=w.querySelector('#qMsg'); msg.textContent='Mengirim...';
              const ok=await Activity.submit('quiz',qKey(q,qi),entry);
              msg.textContent=ok?'Hasil terkirim ke guru ✓':'Tersimpan di perangkat ini.';
            };
            return;
          }
          const s=q.soal[idx];
          w.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px;max-width:520px;width:100%">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px">Soal ${idx+1} dari ${q.soal.length}</div>
            <h3 style="margin:0 0 14px">${esc(s.q)}</h3>
            <div class="fp-list">${s.o.map((o,i)=>`<button class="fp-item" style="cursor:pointer;text-align:left;font:inherit;width:100%" data-i="${i}">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}</div></div>`;
          w.querySelectorAll('[data-i]').forEach(el=>el.onclick=()=>{const i=+el.dataset.i;if(i===s.a)score++;el.style.background=i===s.a?'#dcfce7':'#fee2e2';setTimeout(()=>{idx++;render();},550);});
        };
        render();
      };
      draw();
      // Guru selalu melihat pengerjaan terbaru; siswa cukup katalog + hasil miliknya.
      Activity.pull().then(ok=>{ if(ok) draw(); QuizAlerts.paintNav(); });
      // Ambil quiz terbaru dari katalog bersama (akun siswa di perangkat lain).
      SharedCatalog.pull().then(()=>{
        const fresh=LS.get(key,[]); if(Array.isArray(fresh)) list=fresh;
        if(seedQuizzes(list)) save();
        draw();
      });


    }
  };

  FEATURES.bank = {
    ico:'B', title:'Bank Soal', sub:'Kumpulan soal siap pakai — tambah, edit, atau kirim langsung ke Quiz',
    render(b){
      const key=K('bank'); let list=LS.get(key,[
        {q:'Jelaskan pengertian algoritma.',t:'Esai',b:'X'},
        {q:'Sebutkan 3 struktur kontrol dasar.',t:'Isian',b:'X'},
        {q:'Perbedaan RAM dan ROM?',t:'Esai',b:'X'}
      ]); const save=()=>LS.set(key,list);
      const draw=()=>{
        b.innerHTML=`
        <div class="fp-card" style="margin-bottom:12px">
          <div class="fp-row">
            <input class="fp-input" id="bq" placeholder="Tulis soal baru..." style="flex:1;min-width:200px"/>
            <select class="fp-select" id="bt" style="width:120px"><option>Esai</option><option>Isian</option><option>PG</option></select>
            <select class="fp-select" id="bk" style="width:110px">${ALL_CLASSES.map(c=>`<option>${c}</option>`).join('')}</select>
            <button class="fp-btn sm" id="bAdd">+ Simpan</button>
          </div>
        </div>
        <table class="fp-table"><thead><tr><th>Soal</th><th>Tipe</th><th>Kelas</th><th></th></tr></thead>
        <tbody>${list.map((x,i)=>`<tr><td>${esc(x.q)}</td><td><span class="fp-badge info">${esc(x.t)}</span></td><td>${esc(x.b||'X')}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="fp-btn sm ghost" data-toq="${i}" title="Kirim ke paket Quiz">📤 Ke Quiz</button>
          <button class="fp-btn sm ghost" data-ed="${i}">✏️ Edit</button>
          <button class="fp-btn sm danger" data-d="${i}">Hapus</button>
        </td></tr>`).join('')}</tbody></table>`;
        b.querySelector('#bAdd').onclick=()=>{const q=b.querySelector('#bq').value.trim();if(!q)return;list.unshift({q,t:b.querySelector('#bt').value,b:b.querySelector('#bk').value||'X'});save();draw();};
        b.querySelectorAll('[data-ed]').forEach(x=>x.onclick=()=>{
          const it=list[+x.dataset.ed];
          const nq=prompt('Edit pertanyaan:', it.q); if(nq===null) return;
          if(nq.trim()) it.q=nq.trim();
          save(); draw();
        });
        b.querySelectorAll('[data-toq]').forEach(x=>x.onclick=()=>{
          const it=list[+x.dataset.toq];
          const quizzes=LS.get('pb.guru.quiz',[])||[];
          if(!quizzes.length) return alert('Buat paket Quiz dulu di menu Quiz.');
          const idxStr=prompt('Kirim soal ke Quiz nomor (0 s/d '+(quizzes.length-1)+'):\n'+quizzes.map((q,n)=>n+': '+q.j).join('\n'), '0');
          if(idxStr===null) return;
          const qi=+idxStr; if(!quizzes[qi]) return alert('Nomor quiz tidak ditemukan.');
          const ops=prompt('Masukkan 4 opsi PG dipisah "|" (Opsi A | B | C | D):', 'Pilihan A | Pilihan B | Pilihan C | Pilihan D');
          if(ops===null) return;
          const o=ops.split('|').map(s=>s.trim()).concat(['-','-','-','-']).slice(0,4);
          quizzes[qi].soal.push({q:it.q, o, a:0});
          LS.set('pb.guru.quiz', quizzes); SharedCatalog.publish();
          Guard.notify('Soal disalin ke "' + quizzes[qi].j + '" ✓');
        });
        b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{list.splice(+x.dataset.d,1);save();draw();});
      }; draw();
    }
  };

  FEATURES.absensi = {
    ico:'A', title:'Absensi', sub:'Catat kehadiran siswa',
    render(b){
      const rosterKey=K('absensi.roster');
      const emptyRoster=()=>{const o={};ALL_CLASSES.forEach(n=>o[n]=[]);return o;};
      let roster=LS.get(rosterKey,emptyRoster());
      ALL_CLASSES.forEach(n=>{ if(!Array.isArray(roster[n])) roster[n]=[]; });
      const saveRoster=()=>LS.set(rosterKey,roster);
      const today=new Date().toISOString().slice(0,10);
      let selKelas=ALL_CLASSES[0];
      let tgl=today;
      const namesOf=()=>roster[selKelas]||[];
      const dataKey=()=>K('absensi.'+selKelas+'.'+tgl);
      let data=LS.get(dataKey(),{});
      const ensureData=()=>{namesOf().forEach(s=>{if(!data[s])data[s]='H';});};
      const save=()=>{LS.set(dataKey(),data);Activity.absensi.set(selKelas,tgl,data);emitSync();};
      const load=()=>{data=LS.get(dataKey(),{});ensureData();save();};
      const stat=()=>{const c={H:0,I:0,S:0,A:0};namesOf().forEach(s=>c[data[s]||'H']++);return c;};
      const draw=()=>{
        load();
        const c=stat();
        const kelasOpts=Object.keys(roster).map(k=>`<option value="${k}" ${k===selKelas?'selected':''}>${k} (${roster[k].length})</option>`).join('');
        b.innerHTML=`<div class="fp-row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:end">
          <div><div style="font-size:12px;color:#64748b;margin-bottom:4px">Filter Kelas</div>
            <select id="fKelas" class="fp-btn sm ghost" style="min-width:140px">${kelasOpts}</select></div>
          <div><div style="font-size:12px;color:#64748b;margin-bottom:4px">Tanggal</div>
            <input id="fTgl" type="date" class="fp-btn sm ghost" value="${tgl}"></div>
          <button id="bUpload" class="fp-btn sm">⬆ Upload Massal</button>
          <button id="bTemplate" class="fp-btn sm ghost">📄 Template CSV</button>
          <button id="bAllH" class="fp-btn sm ghost">Set Semua Hadir</button>
        </div>
        <div class="fp-row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
          <div class="fp-stat"><div><div class="l">Hadir</div><div class="v">${c.H}</div></div></div>
          <div class="fp-stat"><div><div class="l">Izin</div><div class="v">${c.I}</div></div></div>
          <div class="fp-stat"><div><div class="l">Sakit</div><div class="v">${c.S}</div></div></div>
          <div class="fp-stat"><div><div class="l">Alpa</div><div class="v">${c.A}</div></div></div>
        </div>
        ${namesOf().length? `<table class="fp-table"><thead><tr><th>Nama</th><th style="width:280px">Status</th></tr></thead>
        <tbody>${namesOf().map(s=>`<tr><td>${esc(s)}</td><td><div class="fp-row" style="gap:4px">
        ${['H','I','S','A'].map(v=>`<button class="fp-btn sm ${data[s]===v?'':'ghost'}" data-s="${esc(s)}" data-v="${v}">${v}</button>`).join('')}
        </div></td></tr>`).join('')}</tbody></table>` : `<div class="fp-empty">Belum ada siswa terdaftar di kelas ${esc(selKelas)}. Daftar terisi otomatis dari Akun Siswa.</div>`}
        <div id="upPane" style="display:none;margin-top:14px" class="fp-card">
          <h4>Upload Absensi Massal</h4>
          <p style="font-size:13px;color:#64748b;margin:4px 0 8px">Format CSV/paste: <code>kelas,nama,status,tanggal</code> — status: H/I/S/A, tanggal opsional (default hari ini). Baris pertama boleh header.</p>
          <input id="upFile" type="file" accept=".csv,text/csv,text/plain" style="margin-bottom:8px"><br>
          <textarea id="upText" rows="6" style="width:100%;font-family:monospace;font-size:12px;padding:8px;border:1px solid #e2e8f0;border-radius:6px" placeholder="X-1,Nama Siswa,H,${today}&#10;X-1,Nama Siswa Lain,I&#10;X-2,Nama Siswa,A"></textarea>
          <div class="fp-row" style="margin-top:8px;gap:6px">
            <button id="upDo" class="fp-btn sm">Proses Upload</button>
            <button id="upCancel" class="fp-btn sm ghost">Batal</button>
          </div>
          <div id="upLog" style="margin-top:8px;font-size:12px"></div>
        </div>`;
        b.querySelector('#fKelas').onchange=e=>{selKelas=e.target.value;draw();};
        b.querySelector('#fTgl').onchange=e=>{tgl=e.target.value||today;draw();};
        b.querySelector('#bAllH').onclick=()=>{namesOf().forEach(s=>data[s]='H');save();draw();};
        b.querySelectorAll('[data-v]').forEach(x=>x.onclick=()=>{data[x.dataset.s]=x.dataset.v;save();draw();});
        const pane=b.querySelector('#upPane');
        b.querySelector('#bUpload').onclick=()=>{pane.style.display=pane.style.display==='none'?'block':'none';};
        b.querySelector('#upCancel').onclick=()=>{pane.style.display='none';};
        b.querySelector('#bTemplate').onclick=()=>{
          const csv='kelas,nama,status,tanggal\n'+Object.keys(roster).flatMap(k=>roster[k].map(n=>`${k},${n},H,${today}`)).join('\n');
          const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='template-absensi.csv';a.click();
        };
        b.querySelector('#upFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{b.querySelector('#upText').value=r.result;};r.readAsText(f);};
        b.querySelector('#upDo').onclick=()=>{
          const txt=b.querySelector('#upText').value.trim();if(!txt){b.querySelector('#upLog').innerHTML='<span style="color:#dc2626">Kosong.</span>';return;}
          const lines=txt.split(/\r?\n/).filter(Boolean);
          let ok=0,skip=0,added=0;const byKey={};
          lines.forEach((ln,i)=>{
            const parts=ln.split(',').map(x=>x.trim());
            if(i===0&&/kelas/i.test(parts[0])&&/nama/i.test(parts[1]))return;
            const [k,n,s,t]=parts;if(!k||!n){skip++;return;}
            const st=(s||'H').toUpperCase();if(!'HISA'.includes(st)){skip++;return;}
            const dt=t||today;
            if(!roster[k]){roster[k]=[];}
            if(!roster[k].includes(n)){roster[k].push(n);added++;}
            const dk=K('absensi.'+k+'.'+dt);const d=LS.get(dk,{});d[n]=st;LS.set(dk,d);ok++;
          });
          saveRoster();
          b.querySelector('#upLog').innerHTML=`<span style="color:#16a34a">✓ ${ok} baris diproses</span> · ${added} nama baru ditambah · ${skip} baris dilewati`;
          setTimeout(()=>draw(),900);
        };
      };
      draw();
      // Isi daftar nama dari akun siswa yang benar-benar terdaftar.
      (async()=>{
        try{
          const accs = await Accounts.list();
          const fresh = emptyRoster();
          (accs||[]).forEach(a=>{
            const k = canonicalClass(a.kelas);
            const n = String(a.nama||'').trim();
            if(n && fresh[k] && !fresh[k].includes(n)) fresh[k].push(n);
          });
          Object.keys(fresh).forEach(k=>fresh[k].sort((x,y)=>x.localeCompare(y)));
          roster = fresh; saveRoster(); draw();
        }catch(_){}
      })();
    }
  };

  async function renderResults(b){
    b.innerHTML='<div class="fp-empty">Memuat hasil siswa…</div>';
    let accounts;
    try { accounts=await Accounts.list(); }
    catch(e){ b.innerHTML='<div class="fp-empty"></div><button class="fp-btn" id="rRetry">Coba lagi</button>'; b.firstElementChild.textContent='Gagal memuat akun: '+e.message; b.querySelector('#rRetry').onclick=()=>renderResults(b); return; }
    const ok=await Activity.pull();
    if(!ok){ b.innerHTML='<div class="fp-empty">Hasil belum dapat diambil. Data lama tidak digunakan sebagai rekap terbaru.</div><button class="fp-btn" id="rRetry">Coba lagi</button>'; b.querySelector('#rRetry').onclick=()=>renderResults(b); return; }
    await SharedCatalog.pull();
    const act=Activity.local(), rows=accounts.map(a=>({...a,kelas:canonicalClass(a.kelas),items:[]}));
    const norm=n=>String(n||'').trim().toLowerCase().replace(/\s+/g,' ');
    const grade=s=>s.nilai!=null&&s.nilai!==''&&Number.isFinite(+s.nilai)?+s.nilai:null;
    ['tugas','lkpd','quiz'].forEach(kind=>Object.entries(act[kind]||{}).forEach(([key,entries])=>{
      const catalog=LS.get('pb.guru.'+kind,[])||[];
      const title=kind==='quiz'?(catalog.find(q=>String(q.j||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)===key)||{}).j:(catalog[Number(key)]||{}).j;
      (entries||[]).forEach(e=>{
        if(!e)return;
        let game={}; if(key==='game-progress'){try{game=typeof e.answer==='string'?JSON.parse(e.answer):e;}catch(_){game=e;}}
        const kelas=canonicalClass(e.kelas||game.kelas||String(e.userId||'').split('|')[1]);
        const nama=e.nama||game.nama||String(e.userId||'').split('|')[0];
        let row=rows.find(a=>String(a.nis)===String(e.userId)||String(a.nis)===String(e.nis));
        if(!row)row=rows.find(a=>norm(a.nama)===norm(nama)&&a.kelas===kelas);
        if(!row){row={nis:e.userId==='me'?'':e.userId,nama:nama||'Siswa',kelas,items:[]};rows.push(row);}
        row.items.push({...e,kind:key==='game-progress'?'game':kind,key,title:title||key,game,nilai:grade(e)});
      });
    }));
    const avg=items=>{const v=items.map(i=>i.nilai).filter(n=>n!==null);return v.length?(v.reduce((a,n)=>a+n,0)/v.length).toFixed(1):'—';};
    let filter='ALL',search='';
    const list=()=>rows.filter(r=>(filter==='ALL'||r.kelas===filter)&&norm(r.nama+' '+r.nis).includes(norm(search))).sort((a,c)=>a.kelas.localeCompare(c.kelas)||a.nama.localeCompare(c.nama));
    const summary=r=>{
      const game=r.items.filter(i=>i.kind==='game').at(-1)?.game||{};
      return [r.nis||'—',r.nama,r.kelas,r.items.filter(i=>i.kind==='tugas').length,r.items.filter(i=>i.kind==='lkpd').length,r.items.filter(i=>i.kind==='quiz').length,avg(r.items.filter(i=>i.kind==='tugas')),avg(r.items.filter(i=>i.kind==='quiz')),avg(r.items.filter(i=>i.kind!=='game')),game.level||'—',game.xp??'—',game.points??game.skor??'—',game.answered??'—',r.items.filter(i=>['tugas','lkpd'].includes(i.kind)&&!['Selesai','Revisi'].includes(i.status)).length];
    };
    const headers=['NIS','Nama','Kelas','Tugas terkirim','LKPD terkirim','Quiz selesai','Nilai tugas','Nilai quiz','Rata-rata nilai','Level game','XP','Poin ronde terakhir','Soal game terjawab','Menunggu penilaian'];
    b.innerHTML=`<div class="fp-row"><label for="rClass">Kelas</label><select class="fp-select" id="rClass">${classOptionsHtml('ALL')}</select><input class="fp-input" id="rSearch" placeholder="Cari nama atau NIS" aria-label="Cari siswa"><button class="fp-btn ghost" id="rRefresh">↻ Perbarui</button><button class="fp-btn" id="rExport">⬇ Unduh CSV</button></div><div id="rTable"></div><div id="rDetail"></div>`;
    const draw=()=>{const shown=list();b.querySelector('#rTable').innerHTML=`<p>${shown.length} siswa · ${shown.filter(r=>r.items.length).length} sudah mengirim hasil</p><div style="overflow:auto"><table class="fp-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}<th>Rincian</th></tr></thead><tbody>${shown.map((r,i)=>`<tr>${summary(r).map(v=>`<td>${esc(v)}</td>`).join('')}<td><button class="fp-btn sm ghost" data-detail="${i}">Lihat</button></td></tr>`).join('')}</tbody></table></div>`;
      b.querySelectorAll('[data-detail]').forEach(btn=>btn.onclick=()=>{
        const row=shown[+btn.dataset.detail];
        b.querySelector('#rDetail').innerHTML=`<h3>${esc(row.nama)} · ${esc(row.kelas)}</h3><div style="overflow:auto"><table class="fp-table"><thead><tr><th>Jenis</th><th>Judul</th><th>Status</th><th>Nilai</th><th>Jawaban</th><th>Lampiran</th><th>Penilaian</th></tr></thead><tbody>${row.items.map((it,i)=>`<tr><td>${esc(it.kind)}</td><td>${esc(it.title)}</td><td>${esc(it.status||(['quiz','game'].includes(it.kind)?'Selesai':'Menunggu'))}</td><td>${esc(it.nilai??'—')}</td><td>${esc(it.jawaban||it.answer||'—')}</td><td>${it.f?`<a class="fp-btn sm ghost" href="${esc(dlUrl(it.f))}" ${dlAttrs(it.f)}>Unduh</a>`:'—'}</td><td>${['tugas','lkpd'].includes(it.kind)?`<input class="fp-input" type="number" min="0" max="100" aria-label="Nilai ${i}" id="rn${i}" value="${it.nilai??''}"><input class="fp-input" aria-label="Catatan ${i}" id="rc${i}" value="${esc(it.catatan||'')}"><button class="fp-btn sm" data-grade="${i}">Simpan nilai</button>`:'Otomatis'}</td></tr>`).join('')}</tbody></table></div>`;
        b.querySelectorAll('[data-grade]').forEach(x=>x.onclick=async()=>{const i=+x.dataset.grade,it=row.items[i],raw=b.querySelector('#rn'+i).value,n=+raw;if(!raw||n<0||n>100)return alert('Nilai harus 0–100');x.disabled=true;const saved=await Activity.grade(it.kind,it.key,it,{nilai:n,status:'Selesai',catatan:b.querySelector('#rc'+i).value,dinilaiPada:new Date().toISOString()});x.disabled=false;if(saved)renderResults(b);});
      });
    };
    b.querySelector('#rClass').onchange=e=>{filter=e.target.value;b.querySelector('#rDetail').innerHTML='';draw();};
    b.querySelector('#rSearch').oninput=e=>{search=e.target.value;draw();};
    b.querySelector('#rRefresh').onclick=()=>renderResults(b);
    b.querySelector('#rExport').onclick=()=>{const cell=v=>'"'+String(v).replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';const csv='\ufeff'+[headers,...list().map(summary)].map(row=>row.map(cell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rekap-hasil-'+filter+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    draw();
  }

  FEATURES.nilai = {
    ico:'N', title:'Nilai', sub: ROLE==='guru'?'Input & lihat nilai siswa':'Nilai kamu dari guru',
    render(b){
      if(ROLE==='guru'){
        renderResults(b);
        return;
      }
      // Murid: tarik penilaian nyata dari submissions tugas & LKPD
      const myClass=getMyClass();
      const tugasList=LS.get('pb.guru.tugas',[])||[];
      const lkpdList=LS.get('pb.guru.lkpd',[])||[];
      const tugasSubs=LS.get('pb.submissions.tugas',{})||{};
      const lkpdSubs =LS.get('pb.submissions.lkpd',{})||{};
      const quizScores=LS.get('pb.murid.quizScores',{})||{};
      const gather=(list,subs,jenis)=>list.map((it,i)=>{
        if(it.k && !matchesClass(it.k,myClass)) return null;
        const mine=(subs[i]||[]).find(s=>isMine(s));
        if(!mine) return {jenis,judul:it.j,status:'Belum dikerjakan',nilai:null,catatan:''};
        return {jenis,judul:it.j,status:mine.status||'Menunggu',nilai:mine.nilai??null,catatan:mine.catatan||'',ts:mine.dinilaiPada||mine.ts};
      }).filter(Boolean);
      const items=[...gather(tugasList,tugasSubs,'Tugas'), ...gather(lkpdList,lkpdSubs,'LKPD')];
      // quiz scores → per quiz
      const quizList=LS.get('pb.guru.quiz',[])||[];
      quizList.forEach((q,i)=>{ if(q.k && !matchesClass(q.k,myClass)) return;
        const sc=quizScores[i]; if(sc!=null) items.push({jenis:'Quiz',judul:q.j,status:'Selesai',nilai:sc,catatan:''});
      });
      const graded=items.filter(x=>typeof x.nilai==='number');
      const avg = graded.length ? (graded.reduce((a,b)=>a+b.nilai,0)/graded.length).toFixed(1) : '—';
      b.innerHTML=`
        <div class="fp-grid c3" style="margin-bottom:12px">
          <div class="fp-stat"><div><div class="l">Rata-rata nilai</div><div class="v">${avg}</div></div></div>
          <div class="fp-stat"><div><div class="l">Sudah dinilai</div><div class="v">${graded.length}</div></div></div>
          <div class="fp-stat"><div><div class="l">Total item</div><div class="v">${items.length}</div></div></div>
        </div>
        ${items.length?`<table class="fp-table"><thead><tr><th>Jenis</th><th>Judul</th><th>Status</th><th>Nilai</th><th>Catatan Guru</th></tr></thead>
        <tbody>${items.map(x=>{
          const badge = x.status==='Selesai'?'<span class="fp-badge ok">Selesai</span>'
                      : x.status==='Revisi'?'<span class="fp-badge warn">Revisi</span>'
                      : x.status==='Menunggu'?'<span class="fp-badge info">Menunggu</span>'
                      : `<span class="fp-badge warn">${esc(x.status)}</span>`;
          const nil = x.nilai==null?'-':`<b>${x.nilai}</b>`;
          return `<tr><td>${x.jenis}</td><td>${esc(x.judul)}</td><td>${badge}</td><td>${nil}</td><td style="max-width:260px">${esc(x.catatan||'-')}</td></tr>`;
        }).join('')}</tbody></table>`:'<div class="fp-empty">Belum ada tugas/LKPD/quiz. Nilai akan muncul setelah guru memberi penilaian.</div>'}`;
    }
  };


  FEATURES.laporan = {ico:'R', title:'Rekap Hasil Siswa', sub:'Tugas, LKPD, quiz, dan game per kelas', render:renderResults};

  FEATURES.jadwal = {
    ico:'📅', title:'Jadwal Mengajar', sub:'Kelola jadwal mingguan kelas — tersinkron otomatis ke dashboard siswa',
    render(b){
      if(ROLE==='murid') return FEATURES.jadwal_murid.render(b);
      const getRows = ()=>{
        const cfg = FeatureConfig.get();
        return Array.isArray(cfg.jadwal) ? cfg.jadwal.slice() : DEFAULT_SCHEDULE.map(x=>({...x}));
      };
      const saveRows = rows => {
        const cfg = FeatureConfig.get();
        cfg.jadwal = rows;
        FeatureConfig.save(cfg);
      };
      const draw = ()=>{
        const rows = getRows();
        b.innerHTML=`
          ${ROLE==='guru'?`<div class="fp-card" style="margin-bottom:14px">
            <h4>➕ Tambah Jadwal Mengajar</h4>
            <div class="fp-row" style="margin-top:8px">
              <select class="fp-select" id="jdH" style="width:115px"><option>Senin</option><option>Selasa</option><option>Rabu</option><option>Kamis</option><option>Jumat</option><option>Sabtu</option></select>
              <input class="fp-input" id="jdJ" placeholder="07:30–09:00" style="width:130px"/>
              ${multiClassPickerHtml('jdK','X-1','width:160px')}
              <select class="fp-select" id="jdM" style="width:160px"><option>Informatika</option><option>KKA</option></select>
              <input class="fp-input" id="jdR" placeholder="Ruang (mis. Lab Kom)" style="flex:1;min-width:140px"/>
              <button class="fp-btn sm" id="jdAdd">+ Tambah</button>
            </div>
          </div>`:''}
          <table class="fp-table"><thead><tr><th>Hari</th><th>Jam</th><th>Kelas</th><th>Mapel</th><th>Ruang</th>${ROLE==='guru'?'<th></th>':''}</tr></thead>
          <tbody>${rows.map((r,i)=>`<tr><td><b>${esc(r.hari)}</b></td><td>${esc(r.jam)}</td><td><span class="fp-badge info">${esc(r.kelas)}</span></td><td>${esc(r.mapel)}</td><td>${esc(r.ruang||'-')}</td>${ROLE==='guru'?`<td style="text-align:right"><button class="fp-btn sm danger" data-jd="${i}">Hapus</button></td>`:''}</tr>`).join('')||'<tr><td colspan="6" class="fp-empty">Belum ada jadwal.</td></tr>'}</tbody></table>`;
        if(ROLE==='guru'){
          b.querySelector('#jdAdd').onclick=()=>{
            const jam=b.querySelector('#jdJ').value.trim()||'07:30–09:00';
            rows.push({hari:b.querySelector('#jdH').value,jam,kelas:b.querySelector('#jdK').value,mapel:b.querySelector('#jdM').value,ruang:b.querySelector('#jdR').value.trim()||'Lab Kom'});
            saveRows(rows); draw();
          };
          b.querySelectorAll('[data-jd]').forEach(btn=>btn.onclick=()=>{rows.splice(+btn.dataset.jd,1);saveRows(rows);draw();});
        }
      };
      draw();
    }
  };

  FEATURES.pengaturan = {
    ico:'⚙️', title:'Pengaturan & Kelola Fitur', sub:'Koneksi Google Colab SQLite serta tambah/kurangi fitur dan sub-fungsi aplikasi',
    render(b, opts){
      const colabUrl = window.colabDb ? window.colabDb.getUrl() : '';
      const ready = window.colabDb && window.colabDb.isReady();
      const migrated = localStorage.getItem('pb.migrated.colab.v1') === 'done';
      const shareUrl = colabUrl ? (location.origin + '/?colab=' + encodeURIComponent(colabUrl)) : '';
      let activeTab = (opts && opts.tab) || this._tab || 'colab';
      this._tab = activeTab;
      const cfg = FeatureConfig.get();

      const draw = ()=>{
        b.innerHTML=`
          <div class="fp-tabs">
            <div class="fp-tab ${activeTab==='colab'?'on':''}" data-tab="colab">⚙️ Database Google Colab</div>
            <div class="fp-tab ${activeTab==='modul'?'on':''}" data-tab="modul">🧩 Tambah / Kurangi Fitur (${cfg.customModules.length} kustom)</div>
          </div>
          <div id="cfgPane"></div>`;
        b.querySelectorAll('[data-tab]').forEach(t=>t.onclick=()=>{activeTab=t.dataset.tab;this._tab=activeTab;draw();});
        const pane = b.querySelector('#cfgPane');
        if(activeTab === 'colab'){
          pane.innerHTML=`
            <div class="fp-card" style="margin-bottom:14px">
              <div class="fp-row" style="justify-content:space-between">
                <div>
                  <h4>Status Database Google Colab SQLite</h4>
                  <p>${ready ? 'Terhubung ke server Google Colab ('+esc(colabUrl)+'). Semua materi, tugas, quiz & nilai tersimpan ke Google Drive.' : 'Mode Lokal (belum dihubungkan ke Google Colab tunnel).'}</p>
                </div>
                <span class="fp-badge ${ready?'ok':'warn'}">${ready?'🟢 Colab Terhubung':'🟡 Mode Lokal'}</span>
              </div>
            </div>
            <div class="fp-card" style="margin-bottom:14px">
              <h4>URL Public Tunnel Google Colab</h4>
              <p style="font-size:12px;color:#64748b;margin:4px 0 8px">Jalankan notebook <code>colab/portalbelajar_colab_database.ipynb</code> di Google Colab lalu tempel link tunnel (Cloudflare/Ngrok) di bawah ini:</p>
              <div style="display:grid;gap:10px;margin-top:10px">
                <div><label class="fp-label">URL Server Colab</label><input class="fp-input" id="cfgUrl" value="${esc(colabUrl)}" placeholder="https://xxxx-xxxx.trycloudflare.com"/></div>
                <div class="fp-row" style="flex-wrap:wrap;gap:8px">
                  <button class="fp-btn sm" id="cfgSave">💾 Simpan &amp; Uji Koneksi</button>
                  <button class="fp-btn sm ghost" id="cfgSync" ${ready?'':'disabled'}>🔄 Migrasi Data Lokal ke Colab</button>
                  <button class="fp-btn sm ghost" id="cfgCopyLink" ${shareUrl?'':'disabled'}>📋 Salin Link Siswa</button>
                </div>
                ${shareUrl ? `<div style="font-size:12px;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;word-break:break-all"><b>Link Auto-Connect Siswa:</b> <span id="cfgShareTxt">${esc(shareUrl)}</span></div>` : ''}
                <div id="cfgMsg" style="font-size:12.5px;color:#475569"></div>
              </div>
            </div>
            <div class="fp-card">
              <h4>Ringkasan Data Lokal</h4>
              <p>Materi: <b>${(LS.get(SK('materi'),[])||[]).length}</b> · Tugas: <b>${(LS.get(SK('tugas'),[])||[]).length}</b> · LKPD: <b>${(LS.get(SK('lkpd'),[])||[]).length}</b> · Quiz: <b>${(LS.get(SK('quiz'),[])||[]).length}</b> · Migrasi Colab: <b>${migrated?'Sudah':'Belum'}</b></p>
            </div>`;
          pane.querySelector('#cfgSave').onclick=async()=>{
            const u=pane.querySelector('#cfgUrl').value.trim();
            const msgEl=pane.querySelector('#cfgMsg');
            if(!window.colabDb) return;
            window.colabDb.setUrl(u);
            if(!u){ msgEl.textContent='URL Google Colab dikosongkan (kembali ke mode lokal).'; FEATURES.pengaturan.render(b); return; }
            msgEl.textContent='⏳ Menguji koneksi ke Google Colab SQLite...';
            try{
              const h=await window.colabDb.testConnection(u);
              msgEl.textContent='✅ Terhubung ke Google Colab SQLite! Mengambil data terbaru... ('+(h.counts?.accounts||0)+' akun, '+(h.counts?.submissions||0)+' kiriman)';
              await SharedCatalog.pull(); await Activity.pull(); emitSync();
              setTimeout(()=>FEATURES.pengaturan.render(b), 600);
            }catch(err){ msgEl.textContent='⚠️ URL disimpan, namun server belum merespons: '+(err.message||err); }
          };
          const copyBtn=pane.querySelector('#cfgCopyLink');
          if(copyBtn){
            copyBtn.onclick=async()=>{
              try{ await navigator.clipboard.writeText(shareUrl); pane.querySelector('#cfgMsg').textContent='✅ Link auto-connect siswa disalin!'; }
              catch(_){ prompt('Salin link ini untuk dibagikan ke siswa:', shareUrl); }
            };
          }
          pane.querySelector('#cfgSync').onclick=async()=>{
            if(typeof window.runMigration==='function'){
              pane.querySelector('#cfgMsg').textContent='⏳ Mengirim semua data lokal ke Google Colab SQLite...';
              const res=await window.runMigration({force:true});
              if(res&&res.ok){
                pane.querySelector('#cfgMsg').textContent='✅ Migrasi selesai! Semua data kini tersimpan di Google Colab & Google Drive.';
                await SharedCatalog.pull(); await Activity.pull(); emitSync();
              }else{ pane.querySelector('#cfgMsg').textContent='⚠️ Migrasi gagal: '+((res&&res.error)||'Pastikan URL & passphrase guru benar.'); }
            }
          };
          return;
        }

        // Tab 2: Kelola Modul & Fungsi (Tambah / Kurangi fitur & sub-fungsi)
        pane.innerHTML=`
          <div class="fp-card" style="margin-bottom:14px">
            <h4>➕ Tambah Fitur Baru ke Portal</h4>
            <p style="margin-bottom:10px">Buat modul atau pintasan alat belajar baru yang langsung tampil di sidebar guru &amp; siswa.</p>
            <div style="display:grid;gap:8px">
              <div class="fp-row">
                <input class="fp-input" id="cmIco" value="🚀" placeholder="Ikon" style="width:70px;text-align:center"/>
                <input class="fp-input" id="cmTitle" placeholder="Nama fitur baru (mis. Lab Virtual / Simulasi Python)" style="flex:1;min-width:200px"/>
                <select class="fp-select" id="cmTarget" style="width:140px"><option value="all">Guru &amp; Siswa</option><option value="guru">Khusus Guru</option><option value="murid">Khusus Siswa</option></select>
              </div>
              <input class="fp-input" id="cmUrl" placeholder="Link / URL Embed eksternal (opsional, mis. https://trinket.io/python atau Google Form)"/>
              <textarea class="fp-textarea" id="cmDesc" placeholder="Deskripsi / panduan penggunaan fitur..."></textarea>
              <div><button class="fp-btn sm" id="cmCreate">➕ Tambah Fitur ke Sidebar</button></div>
            </div>
          </div>
          ${cfg.customModules.length?`<div class="fp-card" style="margin-bottom:14px">
            <h4>📦 Fitur Tambahan Aktif (${cfg.customModules.length})</h4>
            <div class="fp-list" style="margin-top:8px">${cfg.customModules.map((m,i)=>`
              <div class="fp-item">
                <div><div class="t">${esc(m.ico||'✨')} ${esc(m.title)}</div><div class="m">Target: ${esc(m.target)} ${m.url?'· '+esc(m.url):''}</div></div>
                <button class="fp-btn sm danger" data-del-cm="${i}">Hapus Fitur</button>
              </div>`).join('')}</div>
          </div>`:''}
          <div class="fp-grid c2">
            <div class="fp-card">
              <h4>🧩 Aktif / Nonaktifkan Menu Fitur</h4>
              <p style="margin-bottom:10px">Hilangkan atau munculkan kembali fitur dari sidebar.</p>
              <div style="display:grid;gap:8px">
                ${MODULE_DEFS.map(m => {
                  const on = !cfg.disabled.includes(m.id);
                  return `<label class="fp-chk"><input type="checkbox" data-mod="${m.id}" ${on?'checked':''}/> <span>${m.ico} <b>${m.name}</b> <small style="color:#64748b">(${m.who})</small></span></label>`;
                }).join('')}
              </div>
            </div>
            <div class="fp-card">
              <h4>⚙️ Aktif / Nonaktifkan Sub-Fungsi Fitur</h4>
              <p style="margin-bottom:10px">Atur fungsi detail di dalam masing-masing panel.</p>
              <div style="display:grid;gap:10px">
                ${SUB_FLAGS_DEF.map(f => {
                  const on = cfg.subFlags[f.id] !== false;
                  return `<label class="fp-chk"><input type="checkbox" data-subf="${f.id}" ${on?'checked':''}/> <span>${esc(f.label)}</span></label>`;
                }).join('')}
              </div>
            </div>
          </div>`;

        pane.querySelectorAll('[data-mod]').forEach(cb=>cb.onchange=()=>{
          const id=cb.dataset.mod;
          const idx=cfg.disabled.indexOf(id);
          if(cb.checked && idx>=0) cfg.disabled.splice(idx,1);
          else if(!cb.checked && idx<0) cfg.disabled.push(id);
          FeatureConfig.save(cfg); Guard.notify((cb.checked?'Mengaktifkan':'Menonaktifkan')+' fitur '+id);
        });
        pane.querySelectorAll('[data-subf]').forEach(cb=>cb.onchange=()=>{
          cfg.subFlags[cb.dataset.subf] = cb.checked;
          FeatureConfig.save(cfg); Guard.notify('Pengaturan fungsi diperbarui ✓');
        });
        pane.querySelector('#cmCreate').onclick=()=>{
          const title=pane.querySelector('#cmTitle').value.trim(); if(!title) return alert('Nama fitur wajib diisi.');
          const id=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24)+'-'+Date.now().toString(36).slice(-3);
          cfg.customModules.push({id, ico:pane.querySelector('#cmIco').value.trim()||'🚀', title, url:pane.querySelector('#cmUrl').value.trim(), desc:pane.querySelector('#cmDesc').value.trim(), target:pane.querySelector('#cmTarget').value});
          FeatureConfig.save(cfg); Guard.notify('Fitur baru "' + title + '" ditambahkan ke sidebar!'); draw();
        };
        pane.querySelectorAll('[data-del-cm]').forEach(btn=>btn.onclick=()=>{
          if(!confirm('Hapus fitur tambahan ini?')) return;
          cfg.customModules.splice(+btn.dataset.delCm,1);
          FeatureConfig.save(cfg); Guard.notify('Fitur dihapus.'); draw();
        });
      };
      draw();
    }
  };
  FEATURES.modul = { ico:'🧩', title:'Tambah / Kurangi Fitur', sub:'Atur modul portal & tambah fitur baru', render(b){ FEATURES.pengaturan.render(b, {tab:'modul'}); } };

  const SKILLS_CATALOG = [
    {
      id:'ct', ico:'🧠', title:'Berpikir Komputasional', mapel:'Informatika & KKA',
      desc:'Dekomposisi masalah, pengenalan pola, abstraksi, dan perancangan algoritma.',
      challenge:{ q:'Pilar Berpikir Komputasional untuk memecah masalah besar menjadi bagian kecil adalah...', opts:['Abstraksi','Dekomposisi','Debugging','Kompilasi'], a:1 }
    },
    {
      id:'algo', ico:'🐍', title:'Algoritma & Pemrograman', mapel:'Informatika',
      desc:'Struktur kontrol percabangan, perulangan, flowchart, dan pemrograman Python/Scratch.',
      challenge:{ q:'Simbol flowchart berbentuk belah ketupat digunakan untuk menyatakan...', opts:['Proses hitung','Input/Output','Keputusan / Percabangan','Mulai / Selesai'], a:2 }
    },
    {
      id:'ai', ico:'🤖', title:'Kecerdasan Artifisial (KKA)', mapel:'KKA',
      desc:'Machine Learning, NLP, Prompt Engineering, serta etika dan bias pada model AI.',
      challenge:{ q:'Pelatihan model AI menggunakan data yang sudah diberi label jawaban disebut...', opts:['Supervised Learning','Unsupervised Learning','Clustering','Reinforcement'], a:0 }
    },
    {
      id:'net', ico:'🌐', title:'Jaringan & Keamanan Siber', mapel:'Informatika',
      desc:'Protokol HTTPS, arsitektur web, routing jaringan, serta proteksi kredensial.',
      challenge:{ q:'Protokol web terenkripsi yang mengamankan pertukaran data antara browser dan server adalah...', opts:['FTP','HTTP','HTTPS','Telnet'], a:2 }
    },
    {
      id:'data', ico:'📊', title:'Analisis & Basis Data', mapel:'Informatika',
      desc:'Perintah SQL, Primary Key, relasi tabel, serta pengolahan data spreadsheet.',
      challenge:{ q:'Kolom unik yang menjadi pengenal utama setiap baris pada tabel SQL disebut...', opts:['Foreign Key','Primary Key','Index Key','Candidate View'], a:1 }
    },
    {
      id:'game', ico:'🎮', title:'Tantangan & Konsistensi', mapel:'Semua Mapel',
      desc:'Ketuntasan tugas, LKPD, dan pencapaian XP dari Arena Game Quiz.',
      challenge:{ q:'Langkah terbaik agar hasil quiz & progres skill tersinkron ke guru adalah...', opts:['Menutup tab sebelum selesai','Menyelesaikan quiz sampai layar hasil & XP tersimpan','Menghapus cache browser','Mengganti NIS secara acak'], a:1 }
    }
  ];

  FEATURES.skill = {
    ico:'⚡', title:'Skill & Kompetensi Digital', sub:'Peta penguasaan Informatika & KKA, tambah/hapus skill, latihan cepat, dan lencana siswa',
    render(b){
      const PRACTICE_KEY = 'pb.skill.practice.v1';
      const readPractice = () => LS.get(PRACTICE_KEY, {}) || {};
      const endorseMap = () => Activity.absensi.get('__SKILLS__', 'endorse') || {};
      const cfg = FeatureConfig.get();
      const skillList = Array.isArray(cfg.customSkills) ? cfg.customSkills.slice() : SKILLS_CATALOG.map(s=>({...s}));
      const saveSkills = next => { const c = FeatureConfig.get(); c.customSkills = next; FeatureConfig.save(c); };
      const pracAllowed = FeatureConfig.subEnabled('skill_practice');
      const endAllowed = FeatureConfig.subEnabled('skill_endorse');
      const act = Activity.local();
      const myNis = localStorage.getItem('pb.murid.nis') || '';
      const myName = localStorage.getItem('pb.murid.nama') || 'Siswa';
      const myCls = ROLE==='murid' ? getMyClass() : '';
      const practice = readPractice();
      const endorsed = endorseMap();

      const levelOf = (pct) => pct>=90 ? {lbl:'🏆 Master',cls:'ok'} : pct>=75 ? {lbl:'🚀 Mahir',cls:'info'} : pct>=50 ? {lbl:'⚡ Terampil',cls:'warn'} : {lbl:'🌱 Dasar',cls:'warn'};

      function computeStudentSkills(nis, nama, cls){
        let quizPct = [];
        Object.values(act.quiz || {}).forEach(list => (list||[]).forEach(s => {
          if(s && (s.userId===nis || (s.nama===nama && canonicalClass(s.kelas)===canonicalClass(cls))) && s.nilai!=null) quizPct.push(+s.nilai);
        }));
        let taskDone = 0;
        ['tugas','lkpd'].forEach(k => Object.values(act[k] || {}).forEach(list => (list||[]).forEach(s => {
          if(s && (s.userId===nis || (s.nama===nama && canonicalClass(s.kelas)===canonicalClass(cls)))) taskDone++;
        })));
        const gameXp = nis === myNis ? +(localStorage.getItem('pb.game.xp') || 0) : 0;
        const avgQ = quizPct.length ? Math.round(quizPct.reduce((a,b)=>a+b,0)/quizPct.length) : 0;
        const myPrac = nis === myNis ? practice : {};
        const myEnd = endorsed[nis] || [];

        return skillList.map((sk, idx) => {
          const pracBonus = myPrac[sk.id] ? 35 : 0;
          const endBonus = myEnd.includes(sk.id) ? 25 : 0;
          const base = sk.id==='game'
            ? Math.min(100, Math.round(gameXp/5) + taskDone*12 + pracBonus + endBonus)
            : Math.min(100, Math.round(avgQ*0.55) + Math.min(25, taskDone*8) + (idx%2===0?10:5) + pracBonus + endBonus);
          return { ...sk, pct: base, badge: myEnd.includes(sk.id), practiced: !!myPrac[sk.id], level: levelOf(base) };
        });
      }

      if(ROLE === 'guru'){
        const accounts = (LS.get('pb.cached.accounts', []) || []).concat(DEFAULT_ACCOUNTS.filter(d => !(LS.get('pb.cached.accounts', [])||[]).some(a=>a.nis===d.nis)));
        const selCls = this._cls || 'ALL';
        const visible = selCls==='ALL' ? accounts : accounts.filter(a=>canonicalClass(a.kelas)===selCls);
        const avgSkills = skillList.map(sk => {
          if(!visible.length) return { ...sk, avg: 0 };
          const sum = visible.reduce((acc, a) => {
            const st = computeStudentSkills(a.nis, a.nama, a.kelas).find(x=>x.id===sk.id);
            return acc + (st ? st.pct : 0);
          }, 0);
          return { ...sk, avg: Math.round(sum / visible.length) };
        });

        b.innerHTML = `
          <div class="fp-row" style="justify-content:space-between;margin-bottom:14px">
            <div class="fp-row" style="gap:8px">
              <label class="fp-label" style="margin:0">Filter Kelas:</label>
              <select class="fp-select" id="skCls" style="width:auto">${classOptionsHtml(selCls)}</select>
            </div>
            <div class="fp-row" style="gap:8px">
              <button type="button" class="fp-btn sm" id="skToggleAdd">➕ Tambah Skill Baru</button>
              <span class="fp-badge info">📊 ${visible.length} siswa</span>
            </div>
          </div>
          <div id="skAddBox" class="fp-card" style="display:none;margin-bottom:16px">
            <h4>➕ Tambah Kompetensi Skill Baru</h4>
            <div style="display:grid;gap:8px;margin-top:8px">
              <div class="fp-row">
                <input class="fp-input" id="skIco" value="💡" style="width:65px;text-align:center"/>
                <input class="fp-input" id="skTitle" placeholder="Nama Skill (mis. Desain UI/UX)" style="flex:1;min-width:180px"/>
                <input class="fp-input" id="skMapel" placeholder="Mapel (Informatika / KKA)" style="width:180px"/>
              </div>
              <input class="fp-input" id="skDesc" placeholder="Deskripsi kompetensi..."/>
              <input class="fp-input" id="skQ" placeholder="Pertanyaan tantangan mini (untuk asah skill siswa)"/>
              <input class="fp-input" id="skOpts" placeholder="4 opsi jawaban dipisah | (Opsi Benar pertama, mis: Wireframe | Compiler | Router | BIOS)"/>
              <div><button type="button" class="fp-btn sm" id="skCreate">💾 Simpan Skill</button></div>
            </div>
          </div>
          <div class="fp-grid c3" style="margin-bottom:18px">
            ${avgSkills.map((sk, idx) => `
              <div class="fp-card">
                <div class="fp-row" style="justify-content:space-between">
                  <h4>${esc(sk.ico)} ${esc(sk.title)}</h4>
                  <div class="fp-row" style="gap:4px">
                    <span class="fp-badge ${levelOf(sk.avg).cls}">${sk.avg}%</span>
                    <button type="button" class="fp-btn sm danger" data-del-sk="${idx}" title="Hapus skill">×</button>
                  </div>
                </div>
                <p>${esc(sk.desc)}</p>
                <div class="fp-sbar"><div class="fp-sfill" style="width:${sk.avg}%"></div></div>
              </div>`).join('')}
          </div>
          ${endAllowed?`<div class="fp-card">
            <h4>🏅 Beri Lencana Keahlian Siswa</h4>
            <p style="margin-bottom:12px">Klik lencana untuk memberi/mencabut penghargaan skill ke siswa (tersinkron otomatis ke database Colab &amp; dashboard siswa).</p>
            <div style="overflow:auto">
              <table class="fp-table">
                <thead><tr><th>Siswa</th><th>Kelas</th><th>Lencana Skill Aktif</th></tr></thead>
                <tbody>
                  ${visible.slice(0,25).map(a => {
                    const list = endorsed[a.nis] || [];
                    return `<tr>
                      <td><b>${esc(a.nama)}</b><div style="font-size:11px;color:#64748b">NIS ${esc(a.nis)}</div></td>
                      <td>${esc(canonicalClass(a.kelas))}</td>
                      <td><div class="fp-row" style="gap:6px">${skillList.map(sk => {
                        const on = list.includes(sk.id);
                        return `<button type="button" class="fp-btn sm ${on?'':'ghost'}" data-end-nis="${esc(a.nis)}" data-end-sk="${sk.id}" title="${esc(sk.title)}">${esc(sk.ico)} ${on?'✓':''}</button>`;
                      }).join('')}</div></td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`:''}`;
        b.querySelector('#skCls').onchange = e => { this._cls = e.target.value; FEATURES.skill.render(b); };
        b.querySelector('#skToggleAdd').onclick = () => { const box=b.querySelector('#skAddBox'); box.style.display=box.style.display==='none'?'block':'none'; };
        b.querySelector('#skCreate').onclick = () => {
          const title=b.querySelector('#skTitle').value.trim(); if(!title) return alert('Nama skill wajib diisi.');
          const q=b.querySelector('#skQ').value.trim() || ('Konsep utama pada ' + title + ' bertujuan untuk?');
          const optsRaw=b.querySelector('#skOpts').value.split('|').map(x=>x.trim()).filter(Boolean);
          const opts=optsRaw.length>=2 ? optsRaw.concat(['-','-','-','-']).slice(0,4) : ['Meningkatkan ketepatan & efisiensi','Mengabaikan data','Mengacak kode tanpa rencana','Menghapus file'];
          const id=title.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,16)+'_'+Date.now().toString(36).slice(-3);
          skillList.push({id, ico:b.querySelector('#skIco').value.trim()||'💡', title, mapel:b.querySelector('#skMapel').value.trim()||'Informatika', desc:b.querySelector('#skDesc').value.trim()||'Kompetensi tambahan dari guru.', challenge:{q, opts, a:0}});
          saveSkills(skillList); Guard.notify('Skill baru ditambahkan ✓'); FEATURES.skill.render(b);
        };
        b.querySelectorAll('[data-del-sk]').forEach(btn=>btn.onclick=()=>{
          if(skillList.length<=1) return alert('Minimal sisakan 1 skill aktif.');
          if(!confirm('Hapus skill ini dari portal?')) return;
          skillList.splice(+btn.dataset.delSk,1); saveSkills(skillList); FEATURES.skill.render(b);
        });
        b.querySelectorAll('[data-end-nis]').forEach(btn => {
          btn.onclick = () => {
            const nis = btn.dataset.endNis, skId = btn.dataset.endSk;
            const cur = Activity.absensi.get('__SKILLS__', 'endorse') || {};
            const arr = Array.isArray(cur[nis]) ? cur[nis].slice() : [];
            const idx = arr.indexOf(skId);
            if(idx >= 0) arr.splice(idx, 1); else arr.push(skId);
            cur[nis] = arr;
            Activity.absensi.set('__SKILLS__', 'endorse', cur);
            Guard.notify('Lencana skill siswa diperbarui & disinkronkan.');
            FEATURES.skill.render(b);
          };
        });
        return;
      }

      const mySkills = computeStudentSkills(myNis, myName, myCls);
      const overall = mySkills.length ? Math.round(mySkills.reduce((a,s)=>a+s.pct,0)/mySkills.length) : 0;
      const badgeCount = mySkills.filter(s=>s.badge || s.pct>=75).length;

      b.innerHTML = `
        <div class="fp-grid c3" style="margin-bottom:16px">
          <div class="fp-stat"><div><div class="l">Skor Penguasaan</div><div class="v">${overall}%</div></div><span style="font-size:24px">⚡</span></div>
          <div class="fp-stat"><div><div class="l">Lencana Diraih</div><div class="v">${badgeCount}/${mySkills.length}</div></div><span style="font-size:24px">🏅</span></div>
          <div class="fp-stat"><div><div class="l">XP Arena Game</div><div class="v">${+(localStorage.getItem('pb.game.xp')||0)}</div></div><span style="font-size:24px">🎮</span></div>
        </div>
        <div class="fp-grid c2" style="margin-bottom:16px">
          ${mySkills.map(sk => `
            <div class="fp-card">
              <div class="fp-row" style="justify-content:space-between;align-items:flex-start">
                <div>
                  <h4>${esc(sk.ico)} ${esc(sk.title)}</h4>
                  <div style="font-size:11.5px;color:#64748b">${esc(sk.mapel)}${sk.badge?' · 🏅 Diakui Guru':''}</div>
                </div>
                <span class="fp-badge ${sk.level.cls}">${sk.level.lbl} (${sk.pct}%)</span>
              </div>
              <p style="margin-top:8px">${esc(sk.desc)}</p>
              <div class="fp-sbar"><div class="fp-sfill" style="width:${sk.pct}%"></div></div>
              <div class="fp-row" style="margin-top:12px;justify-content:space-between">
                ${pracAllowed?`<button type="button" class="fp-btn sm ${sk.practiced?'ghost':''}" data-prac="${sk.id}">${sk.practiced?'✓ Latihan Lulus (+35%)':'🎯 Asah Skill Cepat'}</button>`:''}
                <a href="/game-quiz.html" class="fp-btn sm ghost" style="text-decoration:none">🎮 Main Quiz</a>
              </div>
            </div>`).join('')}
        </div>
        <div id="skPracticeBox"></div>`;

      b.querySelectorAll('[data-prac]').forEach(btn => {
        btn.onclick = () => {
          const sk = skillList.find(x=>x.id===btn.dataset.prac);
          if(!sk) return;
          const box = b.querySelector('#skPracticeBox');
          box.innerHTML = `
            <div class="fp-card" style="border-color:#4f46e5">
              <h4>🎯 Tantangan Mini: ${esc(sk.ico)} ${esc(sk.title)}</h4>
              <p style="margin:6px 0 12px;font-weight:600">${esc(sk.challenge.q)}</p>
              <div class="fp-grid c2" style="gap:8px">
                ${sk.challenge.opts.map((opt, idx) => `<button type="button" class="fp-btn ghost" data-opt="${idx}" style="justify-content:flex-start">${'ABCD'[idx]}. ${esc(opt)}</button>`).join('')}
              </div>
              <div id="skPracMsg" style="margin-top:10px;font-size:13px"></div>
            </div>`;
          box.querySelectorAll('[data-opt]').forEach(o => {
            o.onclick = () => {
              const picked = +o.dataset.opt;
              const msg = box.querySelector('#skPracMsg');
              if(picked === sk.challenge.a){
                const cur = readPractice();
                cur[sk.id] = new Date().toISOString();
                LS.set(PRACTICE_KEY, cur);
                localStorage.setItem('pb.game.xp', String(+(localStorage.getItem('pb.game.xp')||0) + 15));
                msg.innerHTML = '<span class="fp-badge ok">✅ Tepat! Penguasaan skill naik &amp; +15 XP!</span>';
                emitSync();
                setTimeout(() => FEATURES.skill.render(b), 700);
              } else {
                msg.innerHTML = '<span class="fp-badge err">❌ Belum tepat, coba baca deskripsi skill dan pilih lagi!</span>';
              }
            };
          });
          box.scrollIntoView({ behavior:'smooth', block:'nearest' });
        };
      });
    }
  };

  FEATURES.ai = {
    ico:'✨', title:'AI Assistant', sub:'Bantuan pintar terhubung ke materi, tugas, jadwal & skill kelas',
    render(b){
      const cfg = FeatureConfig.get();
      const prompts = Array.isArray(cfg.aiPrompts) ? cfg.aiPrompts.slice() : [
        'Daftar materi aktif', 'Daftar tugas & deadline', 'Info jadwal kelas', 'Ringkas materi jaringan komputer', 'Ide proyek untuk siswa SMA'
      ];
      const aiCust = ROLE==='guru' && FeatureConfig.subEnabled('ai_custom');
      const draw = ()=>{
        b.innerHTML=`<div class="fp-chat" id="cc"></div>
        <div class="fp-row"><input class="fp-input" id="ai" placeholder="Tanyakan tentang materi, tugas, jadwal, atau soal..." style="flex:1"/>
        <button class="fp-btn" id="asend">Kirim</button></div>
        <div class="fp-row" style="margin-top:10px;gap:6px;flex-wrap:wrap">
          ${prompts.map((p,i)=>`<span style="display:inline-flex;align-items:center;gap:2px"><button class="fp-btn sm ghost" data-p="${esc(p)}">${esc(p)}</button>${aiCust?`<button class="fp-btn sm danger" data-dp="${i}" style="padding:4px 7px">×</button>`:''}</span>`).join('')}
          ${aiCust?`<button class="fp-btn sm" id="aiAddP">+ Tambah Prompt</button>`:''}
        </div>`;
        const cc=b.querySelector('#cc');
        const add=(t,r)=>{const d=document.createElement('div');d.className='fp-msg '+r;d.textContent=t;cc.appendChild(d);cc.scrollTop=cc.scrollHeight;};
        add('Halo! Saya AI Assistant Portal Belajar. Tanya saja soal materi, tugas, jadwal, skill, atau latihan soal!','a');
        const reply=q=>{
          const l=q.toLowerCase();
          const myCls=ROLE==='murid'?getMyClass():'ALL';
          const mats=(LS.get('pb.guru.materi',[])||[]).filter(m=>ROLE!=='murid'||matchesClass(m.k,myCls));
          const tugs=(LS.get('pb.guru.tugas',[])||[]).filter(t=>ROLE!=='murid'||matchesClass(t.k,myCls));
          const jd=(Array.isArray(cfg.jadwal)?cfg.jadwal:DEFAULT_SCHEDULE).filter(r=>ROLE!=='murid'||matchesClass(r.kelas,myCls));
          if(l.includes('jadwal')) return jd.length ? 'Jadwal aktif:\n• '+jd.map(r=>`${r.hari} ${r.jam} — ${r.mapel} (${r.kelas}, ${r.ruang||'-'})`).join('\n• ') : 'Belum ada jadwal tercatat.';
          if(l.includes('materi')&&!l.includes('ringkas')) return mats.length ? 'Materi tersedia ('+mats.length+'):\n• '+mats.slice(0,6).map(m=>`${m.j} (${m.mapel||'Umum'} · ${m.k})`).join('\n• ') : 'Belum ada materi yang diterbitkan.';
          if(l.includes('tugas')||l.includes('deadline')) return tugs.length ? 'Daftar tugas aktif ('+tugs.length+'):\n• '+tugs.slice(0,5).map(t=>`${t.j} — Deadline ${t.d||'TBD'}`).join('\n• ') : 'Belum ada tugas aktif.';
          if(l.includes('soal'))return'Berikut contoh latihan:\n1) Apa itu dekomposisi dalam berpikir komputasional?\n2) Kapan memakai if/else vs loop for?\n3) Sebutkan perbedaan supervised & unsupervised learning!';
          if(l.includes('ringkas'))return'Ringkasan: Jaringan menghubungkan perangkat via TCP/IP & HTTPS. Berpikir komputasional memakai Dekomposisi, Pengenalan Pola, Abstraksi, dan Algoritma.';
          if(l.includes('proyek')||l.includes('ide'))return'Ide proyek:\n• Chatbot info kelas dengan Python\n• Dashboard absensi QR\n• Klasifikasi gambar sampah memakai Google Teachable Machine';
          return`Terhubung dengan ${mats.length} materi, ${tugs.length} tugas, & ${jd.length} jadwal kelas. Coba tanyakan "daftar materi", "daftar tugas", atau "info jadwal"!`;
        };
        const send=()=>{const i=b.querySelector('#ai'),v=i.value.trim();if(!v)return;add(v,'u');i.value='';setTimeout(()=>add(reply(v),'a'),320);};
        b.querySelector('#asend').onclick=send;
        b.querySelector('#ai').addEventListener('keydown',e=>{if(e.key==='Enter')send();});
        b.querySelectorAll('[data-p]').forEach(x=>x.onclick=()=>{b.querySelector('#ai').value=x.dataset.p;send();});
        if(aiCust){
          const addB=b.querySelector('#aiAddP');
          if(addB) addB.onclick=()=>{const np=prompt('Tulis teks prompt cepat baru:');if(!np||!np.trim())return;prompts.push(np.trim());const c=FeatureConfig.get();c.aiPrompts=prompts;FeatureConfig.save(c);draw();};
          b.querySelectorAll('[data-dp]').forEach(x=>x.onclick=()=>{prompts.splice(+x.dataset.dp,1);const c=FeatureConfig.get();c.aiPrompts=prompts;FeatureConfig.save(c);draw();});
        }
      };
      draw();
    }
  };

  // ── Pengumuman sekolah & guru ──
  FEATURES.pengumuman = {
    ico:'!', title:'Pengumuman', sub:'Info terbaru dari sekolah & guru',
    render(b){
      const key = SK('pengumuman');
      let items = LS.get(key, DEFAULT_CATALOG.pengumuman);
      if(!Array.isArray(items) || !items.length) items = DEFAULT_CATALOG.pengumuman;
      const save = ()=>{ LS.set(key, items); SharedCatalog.publish({silent:true}); };
      const draw = ()=>{
        const formHtml = ROLE==='guru' ? `
          <div class="fp-card" style="display:grid;gap:8px;margin-bottom:14px">
            <div class="fp-row">
              <input class="fp-input" id="pj" placeholder="Judul pengumuman..." style="flex:1;min-width:200px"/>
              <input class="fp-input" id="ptgl" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:155px"/>
            </div>
            <textarea class="fp-textarea" id="pisi" placeholder="Isi pengumuman untuk siswa..."></textarea>
            <div class="fp-row" style="justify-content:flex-end">
              <button class="fp-btn sm" id="pAdd">+ Terbitkan Pengumuman</button>
            </div>
          </div>` : '';
        b.innerHTML = `${formHtml}<div class="fp-list">${items.map((x,i)=>`<div class="fp-item">
          <div style="flex:1">
            <div class="t">${esc(x.j||x.t||'Pengumuman')}</div>
            <div class="m" style="line-height:1.5">${esc(x.isi||x.m||'')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap">
            <span class="fp-badge info">${esc(x.tgl||x.d||'Terbaru')}</span>
            ${ROLE==='guru'?`<button class="fp-btn sm ghost" data-pe="${i}">✏️ Edit</button><button class="fp-btn sm danger" data-pd="${i}">Hapus</button>`:''}
          </div>
        </div>`).join('')||'<div class="fp-empty">Belum ada pengumuman.</div>'}</div>`;
        if(ROLE==='guru'){
          const addBtn = b.querySelector('#pAdd');
          if(addBtn) addBtn.onclick = ()=>{
            const j=b.querySelector('#pj').value.trim();
            const isi=b.querySelector('#pisi').value.trim();
            const tgl=b.querySelector('#ptgl').value || new Date().toISOString().slice(0,10);
            if(!j || !isi) return alert('Judul dan isi pengumuman wajib diisi.');
            items.unshift({j, tgl, isi}); save(); draw();
          };
          b.querySelectorAll('[data-pe]').forEach(btn=>btn.onclick=()=>{
            const x=items[+btn.dataset.pe];
            const nj=prompt('Edit judul:', x.j||x.t||''); if(nj===null) return;
            const nisi=prompt('Edit isi:', x.isi||x.m||''); if(nisi===null) return;
            if(nj.trim()) x.j=nj.trim();
            x.isi=nisi.trim(); save(); draw();
          });
          b.querySelectorAll('[data-pd]').forEach(btn=>btn.onclick=()=>{
            if(confirm('Hapus pengumuman ini?')){ items.splice(+btn.dataset.pd,1); save(); draw(); }
          });
        }
      };
      draw();
    }
  };

  FEATURES.jadwal_murid = {
    ico:'📅', title:'Jadwal Pelajaran', sub:'Jadwal pelajaran yang diterbitkan guru untuk kelasmu',
    render(b){
      const myClass = getMyClass();
      const cfg = FeatureConfig.get();
      const all = Array.isArray(cfg.jadwal) ? cfg.jadwal : DEFAULT_SCHEDULE;
      const rows = all.filter(r => !r.kelas || matchesClass(r.kelas, myClass));
      if(!rows.length){
        b.innerHTML=`<div class="fp-empty">Belum ada jadwal untuk kelas ${esc(myClass||'-')}.</div>`;
        return;
      }
      b.innerHTML=`<table class="fp-table"><thead><tr><th>Hari</th><th>Jam</th><th>Mapel</th><th>Ruang</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td><b>${esc(r.hari)}</b></td><td>${esc(r.jam)}</td><td><span class="fp-badge info">${esc(r.mapel)}</span></td><td>${esc(r.ruang||'-')}</td></tr>`).join('')}</tbody></table>`;
    }
  };

  // For murid: reuse most panels; override title for own perspective
  if(ROLE==='murid'){
    FEATURES.materi = {ico:'M',title:'Materi Belajar',sub:'Bahan belajar dari guru',render(b){
      const myClass = getMyClass();
      const allowedSubjects=CLASS_CATALOG.find(c=>c.n===myClass)?.mapel||[];
      let subjectFilter='ALL';
      const draw=()=>{
        // Materi lama yang sudah memiliki file/link dianggap sudah dikirim,
        // meskipun versi terdahulu masih menyimpannya dengan label "Draft".
        const classList = Guard.filter((LS.get('pb.guru.materi', [])||[]).filter(m=>m.s==='Terbit'||m.f||m.l),{label:'materi'});
        const guruList=classList.filter(m=>!materialSubject(m)||allowedSubjects.includes(materialSubject(m))).filter(m=>subjectFilter==='ALL'||materialSubject(m)===subjectFilter);
        b.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;margin-bottom:12px;font-size:13px">
          <span>📚 Materi untuk kelas <b>${esc(myClass||'-')}</b></span>
          <span class="fp-badge info" title="Kelas terkunci — hubungi guru untuk perubahan">🔒 Terkunci</span>
        </div>
        <label class="fp-label" for="mFilter">Mata pelajaran</label>
        <select class="fp-select" id="mFilter" style="margin-bottom:12px"><option value="ALL">Semua mata pelajaran</option>${subjectOptionsHtml(subjectFilter,allowedSubjects)}</select>
        ${guruList.length?`<div class="fp-list">${guruList.map((x,i)=>{
          const canRead = !!(x.l || x.f);
          return `<div class="fp-item">
          <div style="flex:1"><div class="t">${esc(x.j)}</div>
          <div class="m">${esc(SUBJECTS[materialSubject(x)]||'Belum dikelompokkan')} · ${x.k==='ALL'?'🌐 Semua Kelas':esc(x.k||'')} · Pengajar: Pak Cisko</div>
          ${x.f?`<div style="font-size:11px;color:#94a3b8;margin-top:4px">${esc(x.f.name)} · ${fmtSize(x.f.size)}${x.f.drive?' · ☁️ Drive':''}</div>`:''}</div>
          <div style="display:flex;gap:6px">
            ${canRead?`<button class="fp-btn sm" data-read="${i}">📖 Baca</button>`:''}
            ${x.f?`<a class="fp-btn sm ghost" href="${esc(dlUrl(x.f))}" ${dlAttrs(x.f)}>⬇️ Unduh${isHtmlFile(x.f)?' HTML':''}</a>`:''}
          </div></div>`;
        }).join('')}</div>`:`<div class="fp-empty">Belum ada materi ${esc(SUBJECTS[subjectFilter]||'')} untuk kelas <b>${esc(myClass||'-')}</b>.</div>`}`;
        b.querySelector('#mFilter').value=subjectFilter;
        b.querySelector('#mFilter').onchange=e=>{subjectFilter=e.target.value;draw();};
        b.querySelectorAll('[data-read]').forEach(el=>el.onclick=()=>{const x=guruList[+el.dataset.read];openViewer(x.j,{link:x.l,file:x.f});});
      };
      b.innerHTML='<div class="fp-empty">Memuat materi kelas…</div>';
      SharedCatalog.pull().then(draw);
    }};
    FEATURES.jadwal = FEATURES.jadwal_murid;
    FEATURES.kelas = {ico:'K',title:'Kelas Saya',sub:'Kelas yang kamu ikuti',render(b){
      const myClass = getMyClass();
      const info = CLASS_CATALOG.find(c=>c.n===myClass);
      const mapel = info ? info.mapel : [];
      const rows = mapel.map(m=>({m, g:'Pak Cisko', j: m==='Informatika'?'Sen & Rab · 07:30':'Sel & Kam · 09:15'}));
      b.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;margin-bottom:12px;font-size:13px">
          <span>🏫 Kelas kamu: <b>${esc(myClass||'-')}</b></span>
          <span class="fp-badge info" title="Kelas terkunci — hubungi guru untuk perubahan">🔒 Terkunci</span>
        </div>
        <div class="fp-grid c3">${rows.map(k=>`
          <div class="fp-card"><h4>${esc(k.m)}</h4><p>Kelas ${esc(myClass||'-')}</p>
          <div style="margin:8px 0;color:#64748b;font-size:13px">Pengajar: <b>${esc(k.g)}</b><br>Jadwal: ${esc(k.j)}</div>
          <div class="fp-row" style="justify-content:space-between">
            <span class="fp-badge info">Aktif</span>
            <button class="fp-btn sm" data-enter-materi="1">Masuk</button>
          </div></div>`).join('')}</div>`;
      b.querySelectorAll('[data-enter-materi]').forEach(btn=>btn.onclick=()=>open('materi'));
      const c=b.querySelector('#chgKelas'); if(c) c.onclick=()=>{ setMyClass(null); close(); showClassGate(); };
    }};
  }

  // ── Gate kelas untuk MURID ──
  function showClassGate(){
    if(ROLE!=='murid') return;
    let gate = document.getElementById('fpClassGate');
    if(!gate){
      gate = document.createElement('div');
      gate.id='fpClassGate';
      gate.style.cssText='position:fixed;inset:0;background:linear-gradient(135deg,#4f46e5,#7c3aed);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Plus Jakarta Sans",system-ui,sans-serif;overflow:auto';
      document.body.appendChild(gate);
    }
    const groups = {
      'SMP (KKA)': CLASS_CATALOG.filter(c=>c.n.startsWith('VIII')),
      'SMA Kelas X': CLASS_CATALOG.filter(c=>c.n.startsWith('X-')),
      'SMA Kelas XI': CLASS_CATALOG.filter(c=>c.n.startsWith('XI-')),
      'SMA Kelas XII': CLASS_CATALOG.filter(c=>c.n.startsWith('XII-'))
    };
    gate.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:28px;max-width:560px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="text-align:center;margin-bottom:18px">
          <div style="width:56px;height:56px;background:#4f46e5;border-radius:16px;display:inline-grid;place-items:center;color:#fff;font-size:26px;margin-bottom:12px">🔒</div>
          <h2 style="margin:0;color:#0f172a;font-size:22px;font-weight:800">Verifikasi Kelas</h2>
          <p style="margin:6px 0 0;color:#64748b;font-size:13.5px">Pilih kelas kamu untuk mengakses portal.<br>Hanya kelas yang diampu <b>Pak Cisko</b> yang tersedia.</p>
        </div>
        ${Object.entries(groups).map(([g,list])=>`
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:.5px;margin-bottom:6px">${g.toUpperCase()}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${list.map(c=>`<button class="fpClsBtn" data-k="${c.n}" style="padding:9px 12px;border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;color:#0f172a;text-align:left;min-width:88px">${c.n}<div style="font-size:10px;color:#64748b;font-weight:500;margin-top:2px">${c.mapel.join(' · ')}</div></button>`).join('')}
            </div>
          </div>`).join('')}
        <p style="font-size:11px;color:#94a3b8;text-align:center;margin:14px 0 0">Kelas lain diproteksi & tidak dapat diakses.</p>
      </div>`;
    gate.querySelectorAll('.fpClsBtn').forEach(btn=>{
      btn.onmouseenter=()=>{btn.style.borderColor='#4f46e5';btn.style.background='#eef2ff';};
      btn.onmouseleave=()=>{btn.style.borderColor='#e5e7eb';btn.style.background='#fff';};
      btn.onclick=()=>{ setMyClass(btn.dataset.k); gate.remove(); };
    });
  }

  // inference map for murid nav text
  // ── Progres game siswa (guru/admin): rekap level, poin, soal terjawab per kelas ──
  FEATURES.progres = {ico:'📈', title:'Progres Siswa', sub:'Rekap hasil belajar dan permainan per kelas', render:renderResults};
  // ── Progres saya (siswa): level, poin, soal terjawab milik sendiri ──
  FEATURES.progres_saya = {
    ico:'📈', title:'Progres Saya', sub:'Level game, poin, dan soal yang sudah kamu jawab',
    render(b){
      const rd=k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(_){return null}};
      const xp=+(rd('pb.game.xp')||0), ans=+(rd('pb.game.answered')||0), cor=+(rd('pb.game.correct')||0);
      const lv=Math.floor(Math.sqrt(xp/50))+1, acc=ans?Math.round(cor/ans*100):0;
      const MODES=[['gold','💰 Gold Rush'],['balon','🎈 Balon Pecah'],['tikus','🔨 Pukul Tikus'],['roket','🚀 Balap Roket'],['cocok','🧩 Kartu Cocok'],['candy','🍬 Candy Quest'],['fish','🦈 Fishing Frenzy'],['cyber','💻 Cyber Hack']];
      b.innerHTML=`
      <div class="fp-grid c4" style="margin-bottom:14px">
        <div class="fp-stat"><div><div class="v">${lv}</div><div class="l">Level kamu</div></div>⭐</div>
        <div class="fp-stat"><div><div class="v">${xp}</div><div class="l">Total XP</div></div>✨</div>
        <div class="fp-stat"><div><div class="v">${ans}</div><div class="l">Soal terjawab</div></div>📝</div>
        <div class="fp-stat"><div><div class="v">${acc}%</div><div class="l">Akurasi</div></div>🎯</div>
      </div>
      <h4 style="margin:0 0 8px;font-size:14px">Level kesulitan per game</h4>
      <div class="fp-grid c4">${MODES.map(([k,n])=>{const d=Math.max(1,Math.min(10,+(rd('pb.game.diff.'+k)||1)));
        return `<div class="fp-card"><h4>${n}</h4><p>Level <b>${d}/10</b> ${'🔥'.repeat(Math.ceil(d/2))}</p><div style="height:6px;background:#f1f5f9;border-radius:99px;margin-top:6px"><div style="height:6px;width:${d*10}%;background:#4f46e5;border-radius:99px"></div></div></div>`}).join('')}</div>
      <p style="font-size:12px;color:#64748b;margin-top:14px">Semakin sering kamu menjawab benar, level game naik dan soal makin menantang. Ayo kejar level 10! 🚀</p>`;
    }
  };

  const MURID_MAP = {dashboard:'dashboard','kelas saya':'kelas',materi:'materi',tugas:'tugas',quiz:'quiz',lkpd:'lkpd',nilai:'nilai',jadwal:'jadwal',ai:'ai',pengumuman:'pengumuman','progres saya':'progres_saya','progres':'progres_saya'};

  // ── Deep-link guard: notifikasi jelas bila murid coba akses kelas lain via URL / hash ──
  // Contoh URL yang dijaga:
  //   ?kelas=X-2      ?class=XI-4      #kelas=VIII-A       #/kelas/X-3
  function parseRequestedClass(){
    try{
      const url = new URL(location.href);
      const q = url.searchParams.get('kelas') || url.searchParams.get('class');
      if(q) return decodeURIComponent(q).trim();
      const h = (location.hash||'').replace(/^#\/?/, '');
      const m = h.match(/(?:^|[?&/])(?:kelas|class)[=/]([^&]+)/i);
      if(m) return decodeURIComponent(m[1]).trim();
    }catch(_){}
    return null;
  }
  function showAccessDeniedToast(requested, myClass){
    const known = ALL_CLASSES.includes(requested);
    const wrap = document.createElement('div');
    wrap.setAttribute('role','alert');
    wrap.setAttribute('aria-live','assertive');
    wrap.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100000;max-width:min(560px,92vw);background:#fff;border:1.5px solid #fecaca;border-left:6px solid #ef4444;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:16px 18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;animation:fpSlideDown .25s ease-out';
    wrap.innerHTML = `
      <style>@keyframes fpSlideDown{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}</style>
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:36px;height:36px;background:#fee2e2;border-radius:10px;display:grid;place-items:center;font-size:20px;flex-shrink:0">🚫</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:15px;margin-bottom:4px">Akses kelas ditolak</div>
          <div style="font-size:13px;color:#475569;line-height:1.5">
            Kamu mencoba membuka <b>Kelas ${esc(requested)}</b>${known?'':' <span style="color:#94a3b8">(kelas tidak dikenal)</span>'} melalui tautan,
            padahal kamu terdaftar di <b>Kelas ${esc(myClass)}</b>.<br>
            Kamu hanya dapat mengakses materi & tugas untuk kelasmu sendiri.
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button id="fpAdOk" style="padding:8px 14px;background:#0f172a;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">Mengerti, kembali ke Kelas ${esc(myClass)}</button>
          </div>
        </div>
        <button id="fpAdX" aria-label="Tutup" style="background:transparent;border:0;font-size:20px;color:#94a3b8;cursor:pointer;line-height:1;padding:0 2px">×</button>
      </div>`;
    document.body.appendChild(wrap);
    const clear = ()=>{
      try{
        const url = new URL(location.href);
        url.searchParams.delete('kelas'); url.searchParams.delete('class');
        const cleanHash = (location.hash||'').replace(/(^|[#?&/])(kelas|class)[=/][^&]+/gi,'').replace(/^#[\/?&]+/,'#');
        history.replaceState(null,'', url.pathname + url.search + (cleanHash==='#'?'':cleanHash));
      }catch(_){}
      wrap.remove();
    };
    wrap.querySelector('#fpAdOk').onclick = clear;
    wrap.querySelector('#fpAdX').onclick = clear;
  }
  function guardDeepLink(myClass){
    const req = parseRequestedClass();
    if(req && req !== myClass) showAccessDeniedToast(req, myClass);
  }
  window.addEventListener('hashchange', ()=>{ const mc=getMyClass(); if(mc) guardDeepLink(mc); });
  window.addEventListener('popstate', ()=>{ const mc=getMyClass(); if(mc) guardDeepLink(mc); });

  // ── wire nav ──
  function init(){
    document.querySelectorAll('.nav-item').forEach((el,i)=>{
      let feat = el.dataset.feature;
      if(!feat){
        const t=(el.textContent||'').trim().toLowerCase();
        if(t.startsWith('kelas saya')) feat='kelas';
        else if(t.startsWith('dashboard')) feat='dashboard';
        else if(t.startsWith('materi')) feat='materi';
        else if(t.startsWith('tugas')) feat='tugas';
        else if(t.startsWith('quiz')) feat='quiz';
        else if(t.startsWith('lkpd')) feat='lkpd';
        else if(t.startsWith('nilai')) feat='nilai';
        else if(t.startsWith('jadwal')) feat='jadwal';
        else if(t.startsWith('ai')) feat='ai';
        else if(t.startsWith('pengumuman')) feat='pengumuman';
        else if(t.startsWith('progres saya')) feat='progres_saya';
        else if(t.startsWith('progres siswa')) feat='progres';
        else if(t.startsWith('skill')) feat='skill';
        else if(t.startsWith('kelola fitur')) feat='modul';
        if(feat) el.dataset.feature=feat;
      }
      el.style.cursor='pointer';
      el.addEventListener('click',()=>{
        if(!feat || feat==='dashboard'){
          document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
          el.classList.add('active');
          return;
        }
        if(ROLE==='murid' && (feat==='tugas'||feat==='lkpd'||feat==='quiz'||feat==='nilai')){
          const body=document.getElementById('fpB');
          body.innerHTML='<div class="fp-empty">Memuat data kelas…</div>';
          Promise.all([SharedCatalog.pull(),Activity.pull()]).then(()=>open(feat));
          return;
        }
        open(feat);
      });
    });
    // Gate: murid wajib pilih kelas dulu (dan kelas harus valid dari katalog)
    if(ROLE==='murid'){
      const mc0 = getMyClass();
      if(!mc0 || !ALL_CLASSES.includes(mc0)){ setMyClass(null); showClassGate(); }
      else guardDeepLink(mc0);
      Promise.all([SharedCatalog.pull(), Activity.pull()]).then(()=>FeatureConfig.applySidebarConfig());
    } else {
      // Migrasikan publikasi lama dan kirim katalog ke penyimpanan bersama saat
      // guru membuka dashboard, tanpa harus mengedit ulang setiap materi/tugas.
      SharedCatalog.pull();
      Activity.pull().then(()=>FeatureConfig.applySidebarConfig());
      SubAlerts.start();
    }
    FeatureConfig.applySidebarConfig();

    // Tampilkan indikator kelas di header/sidebar bila ada
    if(ROLE==='murid'){
      const mc = getMyClass();
      if(mc){
        // sisipkan badge kelas di dekat nama pengguna, jika elemen tersedia
        document.querySelectorAll('.user-name, .profile-name, [data-user-class]').forEach(e=>{
          if(!e.querySelector('.mc-badge')){
            const s=document.createElement('span');
            s.className='mc-badge';
            s.style.cssText='margin-left:8px;padding:2px 8px;background:#eef2ff;color:#4f46e5;border-radius:99px;font-size:11px;font-weight:700';
            s.textContent='Kelas '+mc; e.appendChild(s);
          }
        });
      }
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();

})();
