let dados = [];
let meta  = 0;
let filtroAtivo = 'todos';
let chart = null;

// ── INIT ────────────────────────────────────────────────────
(function init() {
  // Carrega dados
  try {
    const raw = localStorage.getItem('entregasPRO_v3');
    dados = raw ? JSON.parse(raw) : [];
    // migração: garante campo plataforma
    dados = dados.map(e => ({ plataforma: '', ...e }));
  } catch(e) { dados = []; }

  meta = parseFloat(localStorage.getItem('entregasPRO_meta')) || 0;

  // Preenche data/hora atuais
  const agora = new Date();
  document.getElementById('inp-data').value = isoDate(agora);
  document.getElementById('inp-hora').value = agora.toTimeString().slice(0,5);
  if (meta) document.getElementById('inp-meta').value = meta;

  // Header com data
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  document.getElementById('hdr-day').textContent = dias[agora.getDay()];
  document.getElementById('hdr-date').textContent = agora.toLocaleDateString('pt-BR');

  // Listeners
  document.getElementById('inp-meta').addEventListener('input', function() {
    meta = parseFloat(this.value) || 0;
    localStorage.setItem('entregasPRO_meta', meta);
    render();
  });

  document.getElementById('inp-valor').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addEntrega();
  });

  render();
})();

// ── PERSISTÊNCIA ────────────────────────────────────────────
function save() {
  try {
    localStorage.setItem('entregasPRO_v3', JSON.stringify(dados));
  } catch(e) {
    toast('Armazenamento cheio. Exporte e limpe os dados.', 'error');
  }
}

// ── ADICIONAR ───────────────────────────────────────────────
function addEntrega() {
  const d  = document.getElementById('inp-data').value;
  const h  = document.getElementById('inp-hora').value;
  const v  = parseFloat(document.getElementById('inp-valor').value);
  const pl = document.getElementById('inp-plataforma').value;

  if (!d || !h) return toast('Preencha data e hora.', 'error');
  if (isNaN(v) || v <= 0) return toast('Valor inválido.', 'error');
  if (v > 9999) return toast('Valor acima de R$ 9.999. Verifique.', 'error');

  dados.push({ id: Date.now(), data: d, hora: h, valor: v, plataforma: pl });
  document.getElementById('inp-valor').value = '';
  document.getElementById('inp-valor').focus();

  save();
  render();
  toast(`+R$ ${fmtNum(v)} adicionado!`, 'success');

  // Anima o stat de hoje
  const box = document.querySelector('.stat-box.stat-today');
  box.style.transform = 'scale(1.04)';
  setTimeout(() => box.style.transform = '', 250);
}

// ── REMOVER ─────────────────────────────────────────────────
function removeEntrega(id) {
  const e = dados.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Remover entrega de R$ ${fmtNum(e.valor)} (${fmtData(e.data)} ${e.hora})?`)) return;
  dados = dados.filter(x => x.id !== id);
  save();
  render();
  toast('Entrega removida.', 'info');
}

// ── EDITAR ──────────────────────────────────────────────────
function abrirEdicao(id) {
  const e = dados.find(x => x.id === id);
  if (!e) return;
  document.getElementById('edit-id').value        = id;
  document.getElementById('edit-data').value      = e.data;
  document.getElementById('edit-hora').value      = e.hora;
  document.getElementById('edit-valor').value     = e.valor;
  document.getElementById('edit-plataforma').value = e.plataforma || '';
  document.getElementById('modal-overlay').classList.add('open');
}

function fecharModal(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
}

function salvarEdicao() {
  const id = parseInt(document.getElementById('edit-id').value);
  const d  = document.getElementById('edit-data').value;
  const h  = document.getElementById('edit-hora').value;
  const v  = parseFloat(document.getElementById('edit-valor').value);
  const pl = document.getElementById('edit-plataforma').value;

  if (!d || !h) return toast('Preencha data e hora.', 'error');
  if (isNaN(v) || v <= 0) return toast('Valor inválido.', 'error');

  dados = dados.map(e => e.id === id ? { ...e, data: d, hora: h, valor: v, plataforma: pl } : e);
  save();
  render();
  document.getElementById('modal-overlay').classList.remove('open');
  toast('Entrega atualizada!', 'success');
}

// ── FILTRO ──────────────────────────────────────────────────
function setFiltro(f, btn) {
  filtroAtivo = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLista();
}

function filtrarDados(lista) {
  const hoje  = isoDate(new Date());
  const agora = new Date();
  if (filtroAtivo === 'hoje')   return lista.filter(e => e.data === hoje);
  if (filtroAtivo === 'semana') return lista.filter(e => isMesmaSemana(e.data, agora));
  if (filtroAtivo === 'mes')    return lista.filter(e => isMesmoMes(e.data, agora));
  return lista;
}

// ── RENDER PRINCIPAL ────────────────────────────────────────
function render() {
  renderStats();
  renderMeta();
  renderLista();
  renderGrafico();
}

function renderStats() {
  const hoje  = isoDate(new Date());
  const agora = new Date();

  let tHoje=0, nHoje=0, tSemana=0, nSemana=0, tMes=0, nMes=0, tTotal=0;

  dados.forEach(e => {
    tTotal += e.valor;
    if (e.data === hoje)              { tHoje   += e.valor; nHoje++;   }
    if (isMesmaSemana(e.data, agora)) { tSemana += e.valor; nSemana++; }
    if (isMesmoMes(e.data, agora))    { tMes    += e.valor; nMes++;    }
  });

  setText('st-hoje',     fmtMoeda(tHoje));
  setText('st-semana',   fmtMoeda(tSemana));
  setText('st-mes',      fmtMoeda(tMes));
  setText('st-total',    fmtMoeda(tTotal));
  setText('st-hoje-n',   `${nHoje} entrega${nHoje !== 1 ? 's' : ''}`);
  setText('st-semana-n', `${nSemana} entrega${nSemana !== 1 ? 's' : ''}`);
  setText('st-mes-n',    `${nMes} entrega${nMes !== 1 ? 's' : ''}`);
  setText('st-total-n',  `${dados.length} registros`);
}

function renderMeta() {
  const hoje  = isoDate(new Date());
  const tHoje = dados.filter(e => e.data === hoje).reduce((s,e) => s + e.valor, 0);
  const pct   = meta > 0 ? Math.min((tHoje / meta) * 100, 100) : 0;

  setText('meta-pct', Math.round(pct) + '%');
  const bar = document.getElementById('progress-fill');
  bar.style.width = pct + '%';
  bar.className = 'progress-fill' + (pct >= 100 ? ' reached' : '');

  if (meta <= 0) {
    setText('meta-falta', 'Meta não definida');
    setText('meta-status', '');
  } else if (pct >= 100) {
    setText('meta-falta', '🎉 Meta atingida!');
    setText('meta-status', `+R$ ${fmtNum(tHoje - meta)} acima`);
    document.getElementById('meta-status').style.color = 'var(--green)';
  } else {
    const falta = meta - tHoje;
    setText('meta-falta', `Faltam R$ ${fmtNum(falta)}`);
    setText('meta-status', `${Math.round(pct)}% concluído`);
    document.getElementById('meta-status').style.color = 'var(--text3)';
  }
}

function renderLista() {
  const lista = filtrarDados([...dados]).sort((a,b) => {
    const da = new Date(a.data + 'T' + a.hora);
    const db = new Date(b.data + 'T' + b.hora);
    return db - da;
  });

  const container  = document.getElementById('lista');
  const count      = document.getElementById('badge-count');
  const totalDiv   = document.getElementById('total-row');
  const divider    = document.getElementById('divider-total');
  const totalSpan  = document.getElementById('total-filtrado');

  count.textContent = `${lista.length} registro${lista.length !== 1 ? 's' : ''}`;

  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>Nenhuma entrega encontrada</div>`;
    totalDiv.style.display = divider.style.display = 'none';
    return;
  }

  const totalFiltrado = lista.reduce((s,e) => s + e.valor, 0);

  container.innerHTML = lista.map(e => `
    <div class="delivery-item">
      <div class="delivery-dot"></div>
      <div class="delivery-info">
        <div class="delivery-meta">
          ${fmtData(e.data)} às ${e.hora}
          ${e.plataforma ? `<span style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1px 7px;margin-left:4px;font-size:0.65rem">${e.plataforma}</span>` : ''}
        </div>
        <div class="delivery-value">R$ ${fmtNum(e.valor)}</div>
      </div>
      <div class="delivery-actions">
        <button class="btn btn-edit-ghost" onclick="abrirEdicao(${e.id})">✏️</button>
        <button class="btn btn-danger-ghost" onclick="removeEntrega(${e.id})">✕</button>
      </div>
    </div>
  `).join('');

  if (filtroAtivo !== 'todos') {
    totalDiv.style.display  = 'flex';
    divider.style.display   = 'block';
    totalSpan.textContent   = `R$ ${fmtNum(totalFiltrado)}`;
  } else {
    totalDiv.style.display  = 'none';
    divider.style.display   = 'none';
  }
}

function renderGrafico() {
  const canvas = document.getElementById('canvas-grafico');
  const empty  = document.getElementById('chart-empty');

  // Últimos 7 dias
  const dias = [];
  const agora = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(agora);
    d.setDate(agora.getDate() - i);
    dias.push(isoDate(d));
  }

  const totais = dias.map(d => dados.filter(e => e.data === d).reduce((s,e) => s+e.valor,0));

  if (totais.every(v => v === 0)) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  canvas.style.display = '';
  empty.style.display  = 'none';

  const labels = dias.map(d => {
    const [,m,dia] = d.split('-');
    return `${dia}/${m}`;
  });

  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(245,166,35,0.35)');
  gradient.addColorStop(1, 'rgba(245,166,35,0.0)');

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: totais,
        borderColor: '#f5a623',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointBackgroundColor: '#f5a623',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' R$ ' + fmtNum(ctx.parsed.y)
          },
          backgroundColor: '#18181c',
          titleColor: '#f0f0f2',
          bodyColor: '#f5a623',
          borderColor: '#2e2e38',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a5a6a', font: { size: 11, family: "'DM Sans', sans-serif" } },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a5a6a',
            font: { size: 10, family: "'DM Sans', sans-serif" },
            callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)
          },
          border: { display: false }
        }
      }
    }
  });
}

// ── EXPORTAÇÕES ─────────────────────────────────────────────
function exportCSV() {
  if (!dados.length) return toast('Sem dados para exportar.', 'error');
  let csv = 'ID,Data,Hora,Valor,Plataforma\n';
  dados.forEach(e => {
    csv += `${e.id},${e.data},${e.hora},${e.valor.toFixed(2)},${e.plataforma||''}\n`;
  });
  downloadFile(csv, `entregas_${isoDate(new Date())}.csv`, 'text/csv');
  toast('CSV exportado!', 'success');
}

function exportExcel() {
  if (!dados.length) return toast('Sem dados para exportar.', 'error');
  const rows = dados.map(e => ({
    Data: fmtData(e.data), Hora: e.hora,
    Valor: e.valor, Plataforma: e.plataforma || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch:12 },{ wch:8 },{ wch:10 },{ wch:14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
  XLSX.writeFile(wb, `entregas_${isoDate(new Date())}.xlsx`);
  toast('Excel exportado!', 'success');
}

function exportBackup() {
  if (!dados.length) return toast('Sem dados para backup.', 'error');
  const payload = {
    versao: '3.0',
    exportadoEm: new Date().toISOString(),
    meta,
    total: dados.length,
    entregas: dados
  };
  downloadFile(JSON.stringify(payload, null, 2), `backup_${isoDate(new Date())}.json`, 'application/json');
  toast('Backup criado!', 'success');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload.entregas || !Array.isArray(payload.entregas)) throw new Error();

      const confirmMsg = `Importar ${payload.entregas.length} entregas?\n\nAtenção: isso irá SUBSTITUIR os dados atuais (${dados.length} registros).`;
      if (!confirm(confirmMsg)) return;

      dados = payload.entregas.map(x => ({ plataforma: '', ...x }));
      if (payload.meta) {
        meta = payload.meta;
        localStorage.setItem('entregasPRO_meta', meta);
        document.getElementById('inp-meta').value = meta;
      }
      save();
      render();
      toast(`${dados.length} entregas importadas!`, 'success');
    } catch(err) {
      toast('Arquivo inválido. Use um backup gerado por este app.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function resetTudo() {
  if (!confirm(`⚠️ ZERAR TUDO?\n\nIsso apagará ${dados.length} entregas e a meta.\nEsta ação não pode ser desfeita.\n\nContinuar?`)) return;
  localStorage.removeItem('entregasPRO_v3');
  localStorage.removeItem('entregasPRO_meta');
  dados = []; meta = 0;
  document.getElementById('inp-meta').value = '';
  render();
  toast('Todos os dados apagados.', 'info');
}

// ── UTILIDADES ──────────────────────────────────────────────
function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function fmtData(isoStr) {
  const [y,m,d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

function fmtNum(v) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoeda(v) {
  if (v >= 1000) return 'R$ ' + (v/1000).toFixed(1).replace('.', ',') + 'k';
  return 'R$ ' + fmtNum(v);
}

function isMesmaSemana(isoStr, ref) {
  const d = new Date(isoStr + 'T00:00:00');
  const r = new Date(ref);
  const startOfWeek = new Date(r);
  startOfWeek.setDate(r.getDate() - r.getDay());
  startOfWeek.setHours(0,0,0,0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function isMesmoMes(isoStr, ref) {
  const [y,m] = isoStr.split('-');
  return parseInt(y) === ref.getFullYear() && parseInt(m) === (ref.getMonth()+1);
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'•'}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3100);
}