// Registra o plugin de DataLabels
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// Variável global para guardar a instância do gráfico e poder destruí-la
let myChart;
let hourlyChartInstance;
let overviewPieChartInstance; 

// Formatador de números global para 'pt-BR' (usa , como decimal e . como milhar)
const formatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

// Formatador de porcentagem para 'pt-BR'
const formatterPct = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
});

// Define a duração (em horas) de cada período (Divisores para média)
const periodDurations = {
    manha: 4.75,       // Definido pelo usuário
    tarde: 4,          // Definido pelo usuário
    foraHorario: 7,    // 12h + 17h-21h (5h) + 02h = 7 horas totais
    noite: 7.61        // Definido pelo usuário
};

let parsedDataCache = {};
let analysisResultsCache = {};

// --- BOTÃO LIMPAR ---
document.getElementById('clearButton').addEventListener('click', () => {
    const pasteBox = document.getElementById('pasteBox');
    const statusMessage = document.getElementById('statusMessage');
    
    // Limpa o conteúdo
    pasteBox.innerHTML = '';
    // Limpa mensagens de status
    statusMessage.textContent = '';
    // Foca na caixa para o usuário colar imediatamente
    pasteBox.focus();
});

// BOTÃO "PROCESSAR DADOS"
document.getElementById('extractButton').addEventListener('click', () => {
    const pasteBox = document.getElementById('pasteBox');
    const statusMessage = document.getElementById('statusMessage');
    const resultsArea = document.getElementById('resultsArea');
    const inputSection = document.getElementById('inputSection');
    const headerControls = document.getElementById('headerControls');

    resultsArea.classList.add('hidden');
    statusMessage.textContent = ''; 
    
    const pastedHtml = pasteBox.innerHTML;
    if (!pastedHtml.trim()) {
        showMessage("A caixa de colagem está vazia. Cole o conteúdo da página primeiro.", "error");
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedHtml;

    // 1. Tenta encontrar a tabela correta
    const table = findTargetTable(tempDiv);

    if (!table) {
        showMessage("Não foi possível encontrar a tabela começando com 'Setor'. Verifique se copiou a página correta.", "error");
        return;
    }

    try {
        // 2. Processa a tabela encontrada
        const parsedData = parseHtmlTable(table);
        
        if (parsedData.data.length === 0) {
            showMessage("A tabela foi encontrada, mas não contém dados legíveis.", "error");
            return;
        }

        parsedDataCache = parsedData;

        const analysisResults = analyzeProductionData(parsedData.data);
        analysisResultsCache = analysisResults;

        displaySectorTable(analysisResults.sectorBreakdown);
        displayProductionChart(analysisResults.sectorBreakdown);

        let defaultIndex = 0;
        // Tenta pegar o segundo item (índice 1) como padrão se houver dados suficientes
        if (parsedData.data.length >= 2) {
            defaultIndex = 1; 
        }

        initOverviewSection(parsedData.data, analysisResults.sectorBreakdown, defaultIndex);
        populateSectorCheckboxes(parsedData.data, defaultIndex);
        
        if (parsedData.data[defaultIndex]) {
            const defaultSectorName = parsedData.data[defaultIndex][Object.keys(parsedData.data[defaultIndex])[0]];
            displayHourlyChart([defaultSectorName]); 
        }

        // SUCESSO: Mostrar resultados e esconder inputs
        resultsArea.classList.remove('hidden');
        inputSection.classList.add('hidden'); 
        headerControls.classList.remove('hidden'); 
        
        statusMessage.textContent = ''; 

    } catch (error) {
        console.error("Erro ao analisar dados:", error);
        showMessage("Erro ao processar os dados. O formato numérico pode estar inconsistente.", "error");
    }
});

// --- FUNÇÃO PARA ENCONTRAR TABELA ---
function findTargetTable(container) {
    const tables = container.querySelectorAll('table');
    
    for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            const firstCell = rows[i].querySelector('th, td');
            if (firstCell) {
                const text = firstCell.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
                if (text.startsWith('setor')) {
                    return table; 
                }
            }
        }
    }
    return null;
}

// BOTÃO "NOVA CONSULTA"
document.getElementById('showInputBtn').addEventListener('click', () => {
    const inputSection = document.getElementById('inputSection');
    const headerControls = document.getElementById('headerControls');
    const resultsArea = document.getElementById('resultsArea');

    inputSection.classList.remove('hidden');
    headerControls.classList.add('hidden');
    resultsArea.classList.add('hidden'); 
});


// --- FUNÇÕES DA NOVA SEÇÃO DE VISÃO GERAL ---

function initOverviewSection(rawData, sectorBreakdown, defaultIndex) {
    const select = document.getElementById('overviewSectorSelect');
    select.innerHTML = ''; 

    sectorBreakdown.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = index; 
        option.text = item.setor;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        const selectedIdx = e.target.value;
        updateOverviewData(selectedIdx, sectorBreakdown);
    });

    if (sectorBreakdown.length > defaultIndex) {
        select.selectedIndex = defaultIndex;
        updateOverviewData(defaultIndex, sectorBreakdown);
    } else if (sectorBreakdown.length > 0) {
        select.selectedIndex = 0;
        updateOverviewData(0, sectorBreakdown);
    }
}

function updateOverviewData(index, sectorBreakdown) {
    const item = sectorBreakdown[index];
    if (!item) return;

    // 1. Cálculos de Médias
    const avgManha = periodDurations.manha > 0 ? item.manha / periodDurations.manha : 0;
    const avgTarde = periodDurations.tarde > 0 ? item.tarde / periodDurations.tarde : 0;
    const avgFora = periodDurations.foraHorario > 0 ? item.foraHorario / periodDurations.foraHorario : 0;
    const avgNoite = periodDurations.noite > 0 ? item.noite / periodDurations.noite : 0;

    // 2. Atualiza HTML dos números
    document.getElementById('avgManhaDisplay').textContent = formatter.format(avgManha);
    document.getElementById('avgTardeDisplay').textContent = formatter.format(avgTarde);
    document.getElementById('avgForaDisplay').textContent = formatter.format(avgFora);
    document.getElementById('avgNoiteDisplay').textContent = formatter.format(avgNoite);

    // 3. Atualiza Gráfico de Pizza
    const ctx = document.getElementById('overviewPieChart').getContext('2d');
    
    if (overviewPieChartInstance) {
        overviewPieChartInstance.destroy();
    }

    const labels = [
        `Manhã: ${formatter.format(item.manha)} m²`, 
        `Tarde: ${formatter.format(item.tarde)} m²`, 
        `Fora Horário: ${formatter.format(item.foraHorario)} m²`, 
        `Noite: ${formatter.format(item.noite)} m²`
    ];
    
    const dataValues = [item.manha, item.tarde, item.foraHorario, item.noite];

    overviewPieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 0, 130, 0.8)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: { display: false },
                legend: {
                    position: 'right',
                    labels: { boxWidth: 20, font: { size: 14 }, padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let originalLabel = context.label.split(':')[0]; 
                            let value = context.parsed;
                            let total = context.chart._metasets[context.datasetIndex].total;
                            let percentage = (total > 0) ? (value / total * 100).toFixed(1) + '%' : '0%';
                            return `${originalLabel}: ${formatter.format(value)} m² (${percentage})`;
                        }
                    }
                }
            }
        }
    });
}

// --- FUNÇÃO AUXILIAR INTELIGENTE PARA NÚMEROS ---
function parseLocalizedNumber(str) {
    if (!str) return 0;
    let clean = str.replace(/[^\d.,-]/g, '').trim(); 
    if (!clean) return 0;

    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');

    if (lastComma > lastDot) {
        clean = clean.replace(/\./g, ''); 
        clean = clean.replace(',', '.');  
    } else if (lastDot > lastComma) {
        clean = clean.replace(/,/g, '');  
    }
    
    return parseFloat(clean) || 0;
}

// --- FUNÇÃO DE PARSE DA TABELA ---
function parseHtmlTable(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    
    const headerRowIndex = rows.findIndex(row => {
        const firstCell = row.querySelector('th, td');
        if (!firstCell) return false;
        const text = firstCell.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
        return text.startsWith('setor');
    });

    if (headerRowIndex === -1) return { headers: [], data: [] };

    const headers = [];
    const headerRow = rows[headerRowIndex];
    headerRow.querySelectorAll('th, td').forEach(cell => {
        headers.push(cell.innerText.replace(/\n/g, '').trim());
    });

    const data = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        
        if (cells.length < headers.length) continue;

        const rowData = {};
        let isTotalRow = false;

        headers.forEach((header, index) => {
            const cell = cells[index];
            if (!cell) return;
            
            const cellText = cell.innerText.replace(/\s+/g, ' ').trim();

            if (index === 0) {
                rowData[header] = cellText;
                if (cellText.toLowerCase() === 'total') {
                    isTotalRow = true;
                }
            } else {
                rowData[header] = parseLocalizedNumber(cellText);
            }
        });

        if (!isTotalRow) {
            data.push(rowData);
        }
    }
    return { headers, data };
}

// --- LÓGICA DE ANÁLISE ---
function analyzeProductionData(data) {
    let grandTotalManha = 0;
    let grandTotalTarde = 0;
    let grandTotalForaHorario = 0;
    let grandTotalNoite = 0;
    let grandTotalProduction = 0;
    const sectorBreakdown = [];

    const nonProductionPeriodHeaders = ['setor', 'total'];

    data.forEach(row => {
        let manha = 0;
        let tarde = 0;
        let foraHorario = 0;
        let noite = 0;
        
        const firstKey = Object.keys(row)[0];
        const setor = row[firstKey];

        Object.keys(row).forEach(header => {
            const headerClean = header.toLowerCase();
            if (nonProductionPeriodHeaders.some(h => headerClean.includes(h))) return; 
            
            const hourMatch = headerClean.match(/(\d+)/);
            if (!hourMatch) return;
            
            const hour = parseInt(hourMatch[0]);
            const value = row[header];

            // --- LÓGICA DE PERÍODOS ---
            if (hour >= 7 && hour <= 11) {
                manha += value;
            } else if (hour >= 13 && hour <= 16) {
                tarde += value;
            } else if (hour === 12 || (hour >= 17 && hour <= 21) || hour === 2) {
                foraHorario += value;
            } else {
                noite += value;
            }
        });
        
        let totalSetor = 0;
        const totalKey = Object.keys(row).find(k => k.toLowerCase() === 'total');
        if (totalKey) {
            totalSetor = row[totalKey];
        } else {
            totalSetor = manha + tarde + foraHorario + noite;
        }
        
        grandTotalProduction += totalSetor;

        sectorBreakdown.push({ setor, manha, tarde, foraHorario, noite, totalSetor });

        grandTotalManha += manha;
        grandTotalTarde += tarde;
        grandTotalForaHorario += foraHorario;
        grandTotalNoite += noite;
    });

    return { grandTotalManha, grandTotalTarde, grandTotalForaHorario, grandTotalNoite, grandTotalProduction, sectorBreakdown }; 
}

// --- FUNÇÕES DE EXIBIÇÃO ---

function displaySectorTable(sectorBreakdown) {
    const tbody = document.getElementById('sectorTableBody');
    tbody.innerHTML = ''; 

    sectorBreakdown.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        const totalSetor = item.totalSetor || 0;

        const avgManha = (periodDurations.manha > 0) ? (item.manha / periodDurations.manha) : 0;
        const pctManha = (totalSetor > 0) ? (item.manha / totalSetor) : 0;

        const avgTarde = (periodDurations.tarde > 0) ? (item.tarde / periodDurations.tarde) : 0;
        const pctTarde = (totalSetor > 0) ? (item.tarde / totalSetor) : 0;

        const avgForaHorario = (periodDurations.foraHorario > 0) ? (item.foraHorario / periodDurations.foraHorario) : 0;
        const pctForaHorario = (totalSetor > 0) ? (item.foraHorario / totalSetor) : 0;

        const avgNoite = (periodDurations.noite > 0) ? (item.noite / periodDurations.noite) : 0;
        const pctNoite = (totalSetor > 0) ? (item.noite / totalSetor) : 0;
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.setor}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800 bg-gray-100 border-r border-gray-200">${formatter.format(totalSetor)}</td>

            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.manha)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgManha)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-blue-700 font-medium border-r border-blue-50">${formatterPct.format(pctManha)}</td>
            
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.tarde)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgTarde)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-green-700 font-medium border-r border-green-50">${formatterPct.format(pctTarde)}</td>
            
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.foraHorario)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgForaHorario)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-yellow-700 font-medium border-r border-yellow-50">${formatterPct.format(pctForaHorario)}</td>
            
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.noite)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgNoite)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-indigo-700 font-medium">${formatterPct.format(pctNoite)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function displayProductionChart(sectorBreakdown) {
    const ctx = document.getElementById('productionChart').getContext('2d');
    
    const labels = sectorBreakdown.map(item => item.setor);
    const manhaData = sectorBreakdown.map(item => item.manha);
    const tardeData = sectorBreakdown.map(item => item.tarde);
    const foraHorarioData = sectorBreakdown.map(item => item.foraHorario);
    const noiteData = sectorBreakdown.map(item => item.noite);

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Manhã', data: manhaData, backgroundColor: 'rgba(54, 162, 235, 0.6)', borderWidth: 1 },
                { label: 'Tarde', data: tardeData, backgroundColor: 'rgba(75, 192, 192, 0.6)', borderWidth: 1 },
                { label: 'Fora Horário', data: foraHorarioData, backgroundColor: 'rgba(255, 206, 86, 0.6)', borderWidth: 1 },
                { label: 'Noite', data: noiteData, backgroundColor: 'rgba(75, 0, 130, 0.6)', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: { callback: function(value) { return formatter.format(value); } } 
                } 
            },
            plugins: {
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatter.format(context.parsed.y) + ' m²';
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function populateSectorCheckboxes(data, defaultIndex) {
    const container = document.getElementById('sectorCheckboxContainer');
    container.innerHTML = ''; 

    data.forEach((row, index) => {
        const sectorName = row[Object.keys(row)[0]];
        const isChecked = (index === defaultIndex) ? 'checked' : '';

        const checkboxHTML = `
            <div class="flex items-center p-2 hover:bg-white rounded transition-colors cursor-pointer">
                <input type="checkbox" 
                       id="sector-cb-${index}" 
                       value="${sectorName}" 
                       class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                       ${isChecked}> 
                <label for="sector-cb-${index}" class="ml-2 block text-sm text-gray-700 cursor-pointer select-none">${sectorName}</label>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', checkboxHTML);
    });

    container.addEventListener('change', () => {
        const selectedSectors = [];
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedSectors.push(checkbox.value);
        });
        displayHourlyChart(selectedSectors);
    });
}

// --- PLUGIN CUSTOMIZADO (AJUSTADO: POSIÇÃO INFERIOR) ---
const periodBackgroundPlugin = {
    id: 'periodBackgroundPlugin',
    beforeDraw: (chart) => {
        const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
        
        ctx.save();
        
        const xTicks = x.getTicks(); 
        if (xTicks.length < 1) {
            ctx.restore();
            return;
        }

        const barHeight = 8; // Altura da barra
        const yPos = bottom; // Posiciona exatamente ABAIXO da linha do eixo X

        xTicks.forEach((tick, index) => {
            const label = chart.data.labels[index];
            const hourMatch = label ? label.match(/(\d+)h/i) : null;
            if (!hourMatch) return;
            const hour = parseInt(hourMatch[1]);
            
            let color = null;
            
            // Cores
            if (hour >= 7 && hour <= 11) {
                color = 'rgba(54, 162, 235, 0.4)'; // Manhã
            } else if (hour >= 13 && hour <= 16) {
                color = 'rgba(75, 192, 192, 0.4)'; // Tarde
            } else if (hour === 12 || (hour >= 17 && hour <= 21) || hour === 2) {
                color = 'rgba(255, 206, 86, 0.4)'; // Fora
            } else {
                color = 'rgba(75, 0, 130, 0.4)';   // Noite
            }
            
            if (color) {
                const currentX = x.getPixelForValue(index);
                let nextX;

                if (index < xTicks.length - 1) {
                    nextX = x.getPixelForValue(index + 1);
                } else {
                    const prevX = x.getPixelForValue(index - 1);
                    const stepWidth = currentX - prevX;
                    nextX = currentX + stepWidth;
                }

                const width = nextX - currentX;

                ctx.fillStyle = color;
                ctx.fillRect(currentX, yPos, width, barHeight);
            }
        });
        
        ctx.restore();
    }
};

function displayHourlyChart(selectedSectorNamesArray) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    const { headers, data } = parsedDataCache;

    const chartColors = ['rgba(239, 68, 68, 1)', 'rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 206, 86, 1)', 'rgba(139, 92, 246, 1)'];
    // Opacidade reduzida para não brigar com a barra
    const chartBgColors = ['rgba(239, 68, 68, 0.05)', 'rgba(54, 162, 235, 0.05)', 'rgba(75, 192, 192, 0.05)', 'rgba(255, 206, 86, 0.05)', 'rgba(139, 92, 246, 0.05)'];

    const chartLabels = [];
    const datasets = [];

    headers.forEach(header => {
        const match = header.match(/(\d+)h/i);
        if (match) {
             const hour = parseInt(match[1]);
             if (!isNaN(hour)) {
                 chartLabels.push(header);
             }
        }
    });

    selectedSectorNamesArray.forEach((sectorName, index) => {
        const sectorData = data.find(row => row[Object.keys(row)[0]] === sectorName);
        if (!sectorData) return; 

        const chartDataPoints = [];
        chartLabels.forEach(label => {
            chartDataPoints.push(sectorData[label] || 0);
        });

        const colorIndex = index % chartColors.length;

        datasets.push({
            label: `${sectorName}`,
            data: chartDataPoints,
            borderColor: chartColors[colorIndex],
            backgroundColor: chartBgColors[colorIndex],
            fill: true,
            tension: 0.1
        });
    });

    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }

    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets: datasets },
        plugins: [periodBackgroundPlugin], // Registra o plugin aqui
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: { callback: function(value) { return formatter.format(value); } }
                } 
            },
            plugins: {
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatter.format(context.parsed.y) + ' m²';
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function showMessage(message, type = "info") {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    if (type === "error") {
        statusMessage.className = "mt-4 text-center text-sm font-medium text-red-600";
    } else if (type === "success") {
        statusMessage.className = "mt-4 text-center text-sm font-medium text-green-600";
    } else {
        statusMessage.className = "mt-4 text-center text-sm font-medium text-gray-700";
    }
}