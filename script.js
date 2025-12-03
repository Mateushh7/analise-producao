// Configuração Global do Chart.js
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#64748b'; 
Chart.defaults.scale.grid.color = '#f1f5f9';
Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b'; 
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 6;

// Cores Oficiais
const brandColors = {
    manha: '#6DAFB8',      
    tarde: '#2C6E7A',      
    noite: '#163A4A',      
    foraHorario: '#C63832' 
};

if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// Variáveis Globais
let myChart;
let hourlyChartInstance;
let overviewPieChartInstance; 
let currentSelectedDate = '';
let rawPasteData = ''; 

// Formatadores
const formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatterPct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

const periodDurations = { manha: 4.75, tarde: 4, foraHorario: 7, noite: 7.61 };

let parsedDataCache = {};
let analysisResultsCache = {};

// --- EVENT LISTENERS ---

// Listener especial de COLAGEM (Paste)
const pasteBox = document.getElementById('pasteBox');
pasteBox.addEventListener('paste', (e) => {
    e.preventDefault(); 
    
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedHtml = clipboardData.getData('text/html');
    const pastedText = clipboardData.getData('text/plain');
    
    const contentToAnalyze = pastedHtml || pastedText;

    if (!contentToAnalyze) {
        renderPasteState('empty');
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentToAnalyze;
    const table = findTargetTable(tempDiv);

    if (table) {
        rawPasteData = contentToAnalyze; 
        renderPasteState('success');
        showMessage(""); 
    } else {
        rawPasteData = '';
        renderPasteState('error');
    }
});

pasteBox.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) return; 
    e.preventDefault();
});

// Funções de Renderização do Estado da Caixa
function renderPasteState(state) {
    const box = document.getElementById('pasteBox');
    
    if (state === 'success') {
        // CORRIGIDO: Removido h-full para não forçar altura, w-full para centralizar no align-items: center
        box.innerHTML = `
            <div class="w-full flex flex-col items-center justify-center text-center animate-pulse-once">
                <div class="bg-green-100 text-green-600 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-slate-800">Dados Recebidos!</h3>
                <p class="text-sm text-slate-500 mt-1">Tabela identificada corretamente.</p>
                <p class="text-xs text-brand-medium mt-2 font-medium">Clique em "Gerar Dashboard" para processar.</p>
            </div>
        `;
        box.classList.add('bg-green-50');
    } else if (state === 'error') {
        box.innerHTML = `
            <div class="w-full flex flex-col items-center justify-center text-center">
                <div class="bg-red-100 text-red-600 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-slate-800">Tabela não encontrada</h3>
                <p class="text-sm text-slate-500 mt-1">O conteúdo colado não parece ser o relatório correto.</p>
                <p class="text-xs text-slate-400 mt-2">Tente copiar novamente usando Ctrl+A na página do sistema.</p>
            </div>
        `;
        box.classList.remove('bg-green-50');
    } else {
        box.innerHTML = '';
        box.classList.remove('bg-green-50');
    }
}


document.getElementById('clearButton').addEventListener('click', () => {
    rawPasteData = '';
    renderPasteState('empty');
    document.getElementById('statusMessage').textContent = '';
    document.getElementById('pasteBox').focus();
});

document.getElementById('extractButton').addEventListener('click', () => {
    const dateInput = document.getElementById('reportDate');
    const resultsArea = document.getElementById('resultsArea');
    const inputSection = document.getElementById('inputSection');
    const headerControls = document.getElementById('headerControls');
    const displayDateSpan = document.getElementById('displayDate');
    
    // Elementos do novo header
    const reportHeaderInfo = document.getElementById('reportHeaderInfo');
    const headerLegend = document.getElementById('headerLegend');

    resultsArea.classList.add('hidden');
    showMessage(""); 

    if (!dateInput.value) {
        showMessage("Por favor, selecione a Data de Referência.", "error");
        dateInput.focus();
        return;
    }
    
    const dateObj = new Date(dateInput.value);
    const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
    const dateAdjusted = new Date(dateObj.getTime() + userTimezoneOffset);
    currentSelectedDate = dateAdjusted.toLocaleDateString('pt-BR');
    displayDateSpan.textContent = currentSelectedDate;
    
    if (!rawPasteData) {
        showMessage("Nenhum dado válido foi colado. Cole a tabela primeiro.", "error");
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawPasteData;

    const table = findTargetTable(tempDiv);
    if (!table) {
        showMessage("Erro inesperado: Tabela perdida. Tente colar novamente.", "error");
        return;
    }

    try {
        const parsedData = parseHtmlTable(table);
        if (parsedData.data.length === 0) {
            showMessage("Tabela encontrada, mas sem dados válidos.", "error");
            return;
        }

        parsedDataCache = parsedData;
        const analysisResults = analyzeProductionData(parsedData.data);
        analysisResultsCache = analysisResults;

        displaySectorTable(analysisResults.sectorBreakdown);
        displayProductionChart(analysisResults.sectorBreakdown);

        let defaultIndex = 0;
        if (parsedData.data.length >= 2) defaultIndex = 1; 

        initOverviewSection(parsedData.data, analysisResults.sectorBreakdown, defaultIndex);
        populateSectorCheckboxes(parsedData.data, defaultIndex);
        
        if (parsedData.data[defaultIndex]) {
            const defaultSectorName = parsedData.data[defaultIndex][Object.keys(parsedData.data[defaultIndex])[0]];
            displayHourlyChart([defaultSectorName]); 
        }

        // Troca de Telas
        inputSection.classList.add('hidden'); 
        resultsArea.classList.remove('hidden');
        headerControls.classList.remove('hidden'); 
        
        // Mostra info do header
        reportHeaderInfo.classList.remove('hidden');
        // headerLegend continua hidden, só abre com botão
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error(error);
        showMessage("Erro ao processar dados.", "error");
    }
});

// Listener do Botão de Info (Toggle Legend)
document.getElementById('toggleInfoBtn').addEventListener('click', () => {
    const legend = document.getElementById('headerLegend');
    legend.classList.toggle('hidden');
});

document.getElementById('downloadExcelBtn').addEventListener('click', () => {
    if (!analysisResultsCache.sectorBreakdown) return;
    const wb = XLSX.utils.book_new();
    
    const ws_data = [
        ["Relatório de Produção"],
        ["Data:", currentSelectedDate],
        [], 
        ["Setor", "Total (m²)", "Manhã Total", "Manhã Média", "Manhã %", "Tarde Total", "Tarde Média", "Tarde %", "Fora Total", "Fora Média", "Fora %", "Noite Total", "Noite Média", "Noite %"]
    ];

    analysisResultsCache.sectorBreakdown.forEach(item => {
        const total = item.totalSetor || 0;
        const calcAvg = (val, dur) => dur > 0 ? val / dur : 0;
        const calcPct = (val) => total > 0 ? val / total : 0;

        ws_data.push([
            item.setor, item.totalSetor,
            item.manha, calcAvg(item.manha, periodDurations.manha), calcPct(item.manha),
            item.tarde, calcAvg(item.tarde, periodDurations.tarde), calcPct(item.tarde),
            item.foraHorario, calcAvg(item.foraHorario, periodDurations.foraHorario), calcPct(item.foraHorario),
            item.noite, calcAvg(item.noite, periodDurations.noite), calcPct(item.noite)
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const fileNameDate = currentSelectedDate.replace(/\//g, '-');
    XLSX.writeFile(wb, `Analise_${fileNameDate}.xlsx`);
});

document.getElementById('showInputBtn').addEventListener('click', () => {
    document.getElementById('inputSection').classList.remove('hidden');
    document.getElementById('headerControls').classList.add('hidden');
    document.getElementById('resultsArea').classList.add('hidden'); 
    
    // Oculta elementos do header ao voltar
    document.getElementById('reportHeaderInfo').classList.add('hidden');
    document.getElementById('headerLegend').classList.add('hidden');
    
    rawPasteData = '';
    renderPasteState('empty');
    document.getElementById('reportDate').value = '';
});

// --- LÓGICA DE DADOS ---

function findTargetTable(container) {
    const tables = container.querySelectorAll('table');
    for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            const firstCell = rows[i].querySelector('th, td');
            if (firstCell && firstCell.innerText.trim().toLowerCase().startsWith('setor')) {
                return table; 
            }
        }
    }
    return null;
}

function parseLocalizedNumber(str) {
    if (!str) return 0;
    let clean = str.replace(/[^\d.,-]/g, '').trim(); 
    if (!clean) return 0;
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) clean = clean.replace(/\./g, '').replace(',', '.');  
    else if (lastDot > lastComma) clean = clean.replace(/,/g, '');  
    return parseFloat(clean) || 0;
}

function parseHtmlTable(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const headerRowIndex = rows.findIndex(row => {
        const cell = row.querySelector('th, td');
        return cell && cell.innerText.trim().toLowerCase().startsWith('setor');
    });

    if (headerRowIndex === -1) return { headers: [], data: [] };

    const headers = [];
    rows[headerRowIndex].querySelectorAll('th, td').forEach(cell => headers.push(cell.innerText.replace(/\n/g, '').trim()));

    const data = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length < headers.length) continue;

        const rowData = {};
        let isTotalRow = false;
        headers.forEach((header, index) => {
            const cellText = cells[index] ? cells[index].innerText.trim() : '';
            if (index === 0) {
                rowData[header] = cellText;
                if (cellText.toLowerCase() === 'total') isTotalRow = true;
            } else {
                rowData[header] = parseLocalizedNumber(cellText);
            }
        });
        if (!isTotalRow) data.push(rowData);
    }
    return { headers, data };
}

function analyzeProductionData(data) {
    let grandTotalManha = 0, grandTotalTarde = 0, grandTotalFora = 0, grandTotalNoite = 0, grandTotal = 0;
    const sectorBreakdown = [];
    const ignoreHeaders = ['setor', 'total'];

    data.forEach(row => {
        let manha = 0, tarde = 0, fora = 0, noite = 0;
        const setor = row[Object.keys(row)[0]];

        Object.keys(row).forEach(header => {
            if (ignoreHeaders.some(h => header.toLowerCase().includes(h))) return;
            const hourMatch = header.match(/(\d+)/);
            if (!hourMatch) return;
            const hour = parseInt(hourMatch[0]);
            const val = row[header];

            if (hour >= 7 && hour <= 11) manha += val;
            else if (hour >= 13 && hour <= 16) tarde += val;
            else if (hour === 12 || (hour >= 17 && hour <= 21) || hour === 2) fora += val;
            else noite += val;
        });

        const totalSetor = row[Object.keys(row).find(k => k.toLowerCase() === 'total')] || (manha + tarde + fora + noite);
        grandTotal += totalSetor;
        grandTotalManha += manha; grandTotalTarde += tarde; grandTotalFora += fora; grandTotalNoite += noite;

        sectorBreakdown.push({ setor, manha, tarde, foraHorario: fora, noite, totalSetor });
    });

    return { grandTotalManha, grandTotalTarde, grandTotalFora, grandTotalNoite, grandTotal, sectorBreakdown }; 
}

// --- VISUALIZAÇÃO ---

function initOverviewSection(rawData, sectorBreakdown, defaultIndex) {
    const select = document.getElementById('overviewSectorSelect');
    select.innerHTML = ''; 
    sectorBreakdown.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = index; 
        option.text = item.setor;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => updateOverviewData(e.target.value, sectorBreakdown));

    const initialIdx = (sectorBreakdown.length > defaultIndex) ? defaultIndex : 0;
    select.selectedIndex = initialIdx;
    updateOverviewData(initialIdx, sectorBreakdown);
}

function updateOverviewData(index, sectorBreakdown) {
    const item = sectorBreakdown[index];
    if (!item) return;

    // Atualiza o texto do título com o nome do setor selecionado
    document.getElementById('performanceTitle').textContent = `Performance do setor ${item.setor}`;

    const calcAvg = (val, dur) => dur > 0 ? val / dur : 0;
    
    document.getElementById('avgManhaDisplay').textContent = formatter.format(calcAvg(item.manha, periodDurations.manha));
    document.getElementById('avgTardeDisplay').textContent = formatter.format(calcAvg(item.tarde, periodDurations.tarde));
    document.getElementById('avgForaDisplay').textContent = formatter.format(calcAvg(item.foraHorario, periodDurations.foraHorario));
    document.getElementById('avgNoiteDisplay').textContent = formatter.format(calcAvg(item.noite, periodDurations.noite));

    // Chart Pizza
    const ctx = document.getElementById('overviewPieChart').getContext('2d');
    if (overviewPieChartInstance) overviewPieChartInstance.destroy();

    overviewPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Manhã', 'Tarde', 'Fora Horário', 'Noite'],
            datasets: [{
                data: [item.manha, item.tarde, item.foraHorario, item.noite],
                backgroundColor: [brandColors.manha, brandColors.tarde, brandColors.foraHorario, brandColors.noite],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            layout: { padding: { top: 0, bottom: 0, left: 20, right: 20 } },
            plugins: {
                datalabels: { display: false },
                legend: { 
                    position: 'right',
                    align: 'center',
                    labels: { 
                        usePointStyle: true, 
                        pointStyle: 'circle',
                        font: { size: 15, family: "'Inter', sans-serif" }, 
                        padding: 20,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    const value = data.datasets[0].data[i];
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    return {
                                        text: `${label}: ${formatter.format(value)} m² (${percentage})`,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        lineWidth: style.borderWidth,
                                        hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    } 
                },
                tooltip: { callbacks: { label: function(context) { return ` ${context.label}: ${formatter.format(context.parsed)} m²`; } } }
            }
        }
    });
}

function displaySectorTable(sectorBreakdown) {
    const tbody = document.getElementById('sectorTableBody');
    tbody.innerHTML = ''; 

    sectorBreakdown.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        
        const calcData = (val, duration, total) => ({
            avg: duration > 0 ? val / duration : 0,
            pct: total > 0 ? val / total : 0
        });

        const m = calcData(item.manha, periodDurations.manha, item.totalSetor);
        const t = calcData(item.tarde, periodDurations.tarde, item.totalSetor);
        const f = calcData(item.foraHorario, periodDurations.foraHorario, item.totalSetor);
        const n = calcData(item.noite, periodDurations.noite, item.totalSetor);
        
        const td = (content, classes) => `<td class="${classes}">${content}</td>`;
        
        tr.innerHTML = `
            ${td(item.setor, 'px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 border-r border-slate-200 sticky left-0 bg-white print-force-bg-gray')}
            ${td(formatter.format(item.totalSetor), 'px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-800 bg-slate-50 border-r border-slate-200 text-center print-force-bg-darker')}

            ${td(formatter.format(item.manha), 'px-2 py-2 whitespace-nowrap text-sm text-slate-600 text-center')}
            ${td(formatter.format(m.avg), 'px-2 py-2 whitespace-nowrap text-sm text-slate-500 text-center')}
            ${td(formatterPct.format(m.pct), 'px-2 py-2 whitespace-nowrap text-xs font-semibold text-brand-medium bg-slate-50 border-r border-slate-200 text-center print-force-bg-gray')}

            ${td(formatter.format(item.tarde), 'px-2 py-2 whitespace-nowrap text-sm text-slate-600 text-center')}
            ${td(formatter.format(t.avg), 'px-2 py-2 whitespace-nowrap text-sm text-slate-500 text-center')}
            ${td(formatterPct.format(t.pct), 'px-2 py-2 whitespace-nowrap text-xs font-semibold text-brand-medium bg-slate-50 border-r border-slate-200 text-center print-force-bg-gray')}

            ${td(formatter.format(item.foraHorario), 'px-2 py-2 whitespace-nowrap text-sm text-slate-600 text-center')}
            ${td(formatter.format(f.avg), 'px-2 py-2 whitespace-nowrap text-sm text-slate-500 text-center')}
            ${td(formatterPct.format(f.pct), 'px-2 py-2 whitespace-nowrap text-xs font-semibold text-brand-red bg-slate-50 border-r border-slate-200 text-center print-force-bg-gray')}

            ${td(formatter.format(item.noite), 'px-2 py-2 whitespace-nowrap text-sm text-slate-600 text-center')}
            ${td(formatter.format(n.avg), 'px-2 py-2 whitespace-nowrap text-sm text-slate-500 text-center')}
            ${td(formatterPct.format(n.pct), 'px-2 py-2 whitespace-nowrap text-xs font-semibold text-brand-dark bg-slate-50 text-center print-force-bg-gray')}
        `;
        tbody.appendChild(tr);
    });
}

function displayProductionChart(sectorBreakdown) {
    const ctx = document.getElementById('productionChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sectorBreakdown.map(i => i.setor),
            datasets: [
                { label: 'Manhã', data: sectorBreakdown.map(i => i.manha), backgroundColor: brandColors.manha },
                { label: 'Tarde', data: sectorBreakdown.map(i => i.tarde), backgroundColor: brandColors.tarde },
                { label: 'Fora Horário', data: sectorBreakdown.map(i => i.foraHorario), backgroundColor: brandColors.foraHorario },
                { label: 'Noite', data: sectorBreakdown.map(i => i.noite), backgroundColor: brandColors.noite }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { borderDash: [2, 4] } }, x: { grid: { display: false } } },
            plugins: { datalabels: { display: false } }
        }
    });
}

function populateSectorCheckboxes(data, defaultIndex) {
    const container = document.getElementById('sectorCheckboxContainer');
    container.innerHTML = ''; 
    data.forEach((row, index) => {
        const sectorName = row[Object.keys(row)[0]];
        const isChecked = index === defaultIndex ? 'checked' : '';
        const id = `cb-${index}`;
        
        const html = `
            <div class="flex items-center p-2 rounded hover:bg-slate-100 transition-colors">
                <input type="checkbox" id="${id}" value="${sectorName}" ${isChecked} 
                       class="h-4 w-4 text-brand-medium border-slate-300 rounded focus:ring-brand-medium cursor-pointer">
                <label for="${id}" class="ml-2 text-sm text-slate-700 cursor-pointer w-full select-none truncate" title="${sectorName}">${sectorName}</label>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });

    container.addEventListener('change', () => {
        const selected = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
        displayHourlyChart(selected);
    });
}

const periodBackgroundPlugin = {
    id: 'periodBackgroundPlugin',
    beforeDraw: (chart) => {
        const { ctx, chartArea: { bottom }, scales: { x } } = chart;
        ctx.save();
        const ticks = x.getTicks();
        if (ticks.length < 1) { ctx.restore(); return; }
        
        const yPos = bottom;
        const height = 6;

        ticks.forEach((tick, index) => {
            const label = chart.data.labels[index];
            const hour = parseInt((label.match(/(\d+)h/i) || [])[1]);
            if (isNaN(hour)) return;

            let color;
            if (hour >= 7 && hour <= 11) color = brandColors.manha;
            else if (hour >= 13 && hour <= 16) color = brandColors.tarde;
            else if (hour === 12 || (hour >= 17 && hour <= 21) || hour === 2) color = brandColors.foraHorario;
            else color = brandColors.noite;

            const xPos = x.getPixelForValue(index);
            let width = 0;
            // Modificado para começar no tick atual e ir até o próximo (direita)
            if (index < ticks.length - 1) {
                width = x.getPixelForValue(index + 1) - xPos;
            } else if (index > 0) {
                // Para o último, usa a largura do anterior
                width = xPos - x.getPixelForValue(index - 1);
            }
            
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.4;
            // Desenha a partir de xPos (esquerda) para a direita
            ctx.fillRect(xPos, yPos, width, height);
        });
        ctx.restore();
    }
};

function displayHourlyChart(selectedSectors) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    const { headers, data } = parsedDataCache;
    
    const colors = [brandColors.tarde, brandColors.foraHorario, '#EAB308', brandColors.noite, '#8b5cf6', '#0ea5e9'];

    const labels = headers.filter(h => h.match(/(\d+)h/i));
    const datasets = selectedSectors.map((sec, idx) => {
        const row = data.find(r => r[Object.keys(r)[0]] === sec);
        const values = labels.map(l => row ? (row[l] || 0) : 0);
        const color = colors[idx % colors.length];
        
        return {
            label: sec,
            data: values,
            borderColor: color,
            backgroundColor: color + '10', 
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            tension: 0.3
        };
    });

    if (hourlyChartInstance) hourlyChartInstance.destroy();

    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        plugins: [periodBackgroundPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [4, 4] } }, 
                // Alterado: grid.display: true para mostrar linhas verticais
                x: { grid: { display: true, drawBorder: false } } 
            },
            plugins: { datalabels: { display: false } }
        }
    });
}

function showMessage(msg, type = "info") {
    const el = document.getElementById('statusMessage');
    el.textContent = msg;
    el.className = `mt-4 text-center text-sm font-medium ${type === 'error' ? 'text-red-500' : 'text-slate-500'}`;
}