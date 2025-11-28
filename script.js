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

// Define a duração (em horas) de cada período
const periodDurations = {
    manha: 4.75,
    tarde: 4,
    foraHorario: 5,
    noite: 9
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
        showMessage("A caixa de colagem está vazia. Cole a tabela primeiro.", "error");
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedHtml;
    const table = tempDiv.querySelector('table');

    if (!table) {
        showMessage("Nenhuma tabela foi encontrada no conteúdo colado.", "error");
        return;
    }

    try {
        const parsedData = parseHtmlTable(table);
        parsedDataCache = parsedData;

        const analysisResults = analyzeProductionData(parsedData.data);
        analysisResultsCache = analysisResults;

        displaySectorTable(analysisResults.sectorBreakdown);
        displayProductionChart(analysisResults.sectorBreakdown);

        let defaultIndex = 0;
        if (parsedData.data.length >= 2) {
            defaultIndex = 1; 
        }

        initOverviewSection(parsedData.data, analysisResults.sectorBreakdown, defaultIndex);
        populateSectorCheckboxes(parsedData.data, defaultIndex);
        
        const defaultSectorName = parsedData.data[defaultIndex][Object.keys(parsedData.data[defaultIndex])[0]];
        displayHourlyChart([defaultSectorName]); 

        // SUCESSO: Mostrar resultados e esconder inputs
        resultsArea.classList.remove('hidden');
        inputSection.classList.add('hidden'); 
        headerControls.classList.remove('hidden'); 
        
        statusMessage.textContent = ''; 

    } catch (error) {
        console.error("Erro ao analisar dados:", error);
        showMessage("Erro ao analisar dados para gráfico/cálculos.", "error");
    }
});

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

    select.selectedIndex = defaultIndex;

    select.addEventListener('change', (e) => {
        const selectedIdx = e.target.value;
        updateOverviewData(selectedIdx, sectorBreakdown);
    });

    updateOverviewData(defaultIndex, sectorBreakdown);
}

function updateOverviewData(index, sectorBreakdown) {
    const item = sectorBreakdown[index];
    if (!item) return;

    // 1. Cálculos de Médias (REMOVIDO Média Geral)
    const avgManha = periodDurations.manha > 0 ? item.manha / periodDurations.manha : 0;
    const avgTarde = periodDurations.tarde > 0 ? item.tarde / periodDurations.tarde : 0;
    const avgFora = periodDurations.foraHorario > 0 ? item.foraHorario / periodDurations.foraHorario : 0;
    const avgNoite = periodDurations.noite > 0 ? item.noite / periodDurations.noite : 0;

    // 2. Atualiza HTML dos números (APENAS POR PERÍODO)
    document.getElementById('avgManhaDisplay').textContent = formatter.format(avgManha);
    document.getElementById('avgTardeDisplay').textContent = formatter.format(avgTarde);
    document.getElementById('avgForaDisplay').textContent = formatter.format(avgFora);
    document.getElementById('avgNoiteDisplay').textContent = formatter.format(avgNoite);

    // 3. Atualiza Gráfico de Pizza
    const ctx = document.getElementById('overviewPieChart').getContext('2d');
    
    if (overviewPieChartInstance) {
        overviewPieChartInstance.destroy();
    }

    // Prepara labels para a legenda (Inclui unidade m²)
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
                    'rgba(54, 162, 235, 0.8)', // Azul
                    'rgba(75, 192, 192, 0.8)', // Verde
                    'rgba(255, 206, 86, 0.8)', // Amarelo
                    'rgba(75, 0, 130, 0.8)'    // Roxo
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    display: false
                },
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 20, 
                        font: {
                            size: 14 
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let originalLabel = context.label.split(':')[0]; 
                            let value = context.parsed;
                            let total = context.chart._metasets[context.datasetIndex].total;
                            let percentage = (value / total * 100).toFixed(1) + '%';
                            // Exibe unidade m² no tooltip
                            return `${originalLabel}: ${formatter.format(value)} m² (${percentage})`;
                        }
                    }
                }
            }
        }
    });
}

// --- FUNÇÕES DE PARSE E CÁLCULO ---

function parseHtmlTable(table) {
    const headers = [];
    table.querySelectorAll('tr')[0].querySelectorAll('th, td').forEach(cell => {
        headers.push(cell.innerText.trim());
    });

    const data = [];
    const rows = table.querySelectorAll('tr');

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) continue;

        const rowData = {};
        let isTotalRow = false;

        headers.forEach((header, index) => {
            const cell = cells[index];
            if (!cell) return;
            
            const cellText = cell.innerText.trim();

            if (index === 0) {
                rowData[header] = cellText;
                if (cellText.toLowerCase() === 'total') {
                    isTotalRow = true;
                }
            } else {
                // Remove vírgula para processamento interno (assumindo input US ou 'clean')
                const numericValue = cellText.replace(/,/g, ''); 
                rowData[header] = parseFloat(numericValue) || 0;
            }
        });

        if (!isTotalRow) {
            data.push(rowData);
        }
    }
    return { headers, data };
}

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
        const setor = row[Object.keys(row)[0]];

        Object.keys(row).forEach(header => {
            const headerClean = header.toLowerCase();
            if (nonProductionPeriodHeaders.includes(headerClean)) return; 
            
            const hour = parseInt(header.replace('h', ''));
            if (isNaN(hour)) return;

            const value = row[header];

            if (hour >= 7 && hour <= 12) {
                manha += value;
            } else if (hour >= 13 && hour <= 16) {
                tarde += value;
            } else if (hour >= 17 && hour <= 21) {
                foraHorario += value;
            } else if (hour >= 22 || (hour >= 0 && hour <= 6)) {
                noite += value;
            }
        });
        
        const totalSetor = row['Total'] || 0;
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
            maintainAspectRatio: false, // Permite altura customizada
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatter.format(value); // Usa formato BR no eixo
                        }
                    } 
                } 
            },
            plugins: {
                datalabels: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatter.format(context.parsed.y) + ' m²';
                            }
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

function displayHourlyChart(selectedSectorNamesArray) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    const { headers, data } = parsedDataCache;

    const chartColors = ['rgba(239, 68, 68, 1)', 'rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 206, 86, 1)', 'rgba(139, 92, 246, 1)'];
    const chartBgColors = ['rgba(239, 68, 68, 0.1)', 'rgba(54, 162, 235, 0.1)', 'rgba(75, 192, 192, 0.1)', 'rgba(255, 206, 86, 0.1)', 'rgba(139, 92, 246, 0.1)'];

    const chartLabels = [];
    const datasets = [];

    headers.forEach(header => {
        const hour = parseInt(header.replace('h', ''));
        if (!isNaN(hour) && hour >= 0 && hour <= 23) {
            chartLabels.push(header);
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
        options: {
            responsive: true,
            maintainAspectRatio: false, // Permite altura customizada
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatter.format(value);
                        }
                    }
                } 
            },
            plugins: {
                datalabels: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatter.format(context.parsed.y) + ' m²';
                            }
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