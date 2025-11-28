// Variável global para guardar a instância do gráfico e poder destruí-la
let myChart;

// Formatador de números global para 'en-US' (usa . como decimal)
const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

// Formatador de porcentagem para 'en-US'
const formatterPct = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
});

// Define a duração (em horas) de cada período
const periodDurations = {
    manha: 6,       // 7, 8, 9, 10, 11, 12 (6 horas)
    tarde: 4,       // 13, 14, 15, 16 (4 horas)
    foraHorario: 5, // 17, 18, 19, 20, 21 (5 horas)
    noite: 9        // 22, 23, 0, 1, 2, 3, 4, 5, 6 (9 horas)
};
// Variável global para o novo gráfico de linha
let hourlyChartInstance;
// Variáveis globais para guardar os dados parseados
let parsedDataCache = {};


document.getElementById('extractButton').addEventListener('click', () => {
    const pasteBox = document.getElementById('pasteBox');
    const statusMessage = document.getElementById('statusMessage');
    const resultsArea = document.getElementById('resultsArea');

    // Esconde resultados antigos
    resultsArea.classList.add('hidden');
    
    // 1. Obter o HTML colado
    const pastedHtml = pasteBox.innerHTML;
    if (!pastedHtml.trim()) {
        showMessage("A caixa de colagem está vazia. Cole a tabela primeiro.", "error");
        return;
    }

    // 2. Criar um elemento temporário para analisar o HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedHtml;
    const table = tempDiv.querySelector('table');

    if (!table) {
        showMessage("Nenhuma tabela foi encontrada no conteúdo colado.", "error");
        return;
    }

    // --- 4. ANÁLISE DE DADOS ---
    try {
        // Parseia a tabela para um objeto JS com números
        const parsedData = parseHtmlTable(table);
        // Salva os dados no cache global
        parsedDataCache = parsedData;

        // Calcula os totais dos períodos
        const analysisResults = analyzeProductionData(parsedData.data);

        // Exibe a nova tabela de detalhes
        displaySectorTable(analysisResults.sectorBreakdown);

        // Exibe o gráfico
        displayProductionChart(analysisResults.sectorBreakdown);

        // Popula o seletor de setor
        populateSectorCheckboxes(parsedData.data);

        // Exibe o gráfico de linha para o primeiro setor por padrão
        if (parsedData.data.length > 0) {
            const firstSectorName = parsedData.data[0][Object.keys(parsedData.data[0])[0]];
            displayHourlyChart([firstSectorName]); // Passa como um array
        }

        // Mostra a área de resultados
        resultsArea.classList.remove('hidden');
        showMessage("Dados processados com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao analisar dados:", error);
        showMessage("Erro ao analisar dados para gráfico/cálculos.", "error");
    }
});

// Função para parsear a tabela para objetos JS
function parseHtmlTable(table) {
    const headers = [];
    // Pega os cabeçalhos (assume primeira linha)
    table.querySelectorAll('tr')[0].querySelectorAll('th, td').forEach(cell => {
        headers.push(cell.innerText.trim());
    });

    const data = [];
    const rows = table.querySelectorAll('tr');

    // Itera sobre as linhas de dados (começa de i=1 para pular cabeçalho)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) continue;

        const rowData = {};
        let isTotalRow = false; // Flag para ignorar a linha "Total"

        headers.forEach((header, index) => {
            const cell = cells[index];
            if (!cell) return;
            
            const cellText = cell.innerText.trim();

            if (index === 0) {
                // Primeira coluna (Setor) é texto
                rowData[header] = cellText;
                if (cellText.toLowerCase() === 'total') {
                    isTotalRow = true;
                }
            } else {
                // Outras colunas são números
                // Remove ',' (milhar) e usa '.' como decimal
                const numericValue = cellText.replace(/,/g, ''); 
                
                rowData[header] = parseFloat(numericValue) || 0;
            }
        });

        // Só adiciona a linha se NÃO for a linha de "Total"
        if (!isTotalRow) {
            data.push(rowData);
        }
    }
    return { headers, data };
}

// Função para calcular os totais
function analyzeProductionData(data) {
    let grandTotalManha = 0;
    let grandTotalTarde = 0;
    let grandTotalForaHorario = 0;
    let grandTotalNoite = 0;
    let grandTotalProduction = 0; // Para calcular a %
    const sectorBreakdown = [];

    // Cabeçalhos que não são de produção por período
    const nonProductionPeriodHeaders = ['setor', 'total'];

    data.forEach(row => {
        let manha = 0;
        let tarde = 0;
        let foraHorario = 0;
        let noite = 0;
        const setor = row[Object.keys(row)[0]]; // Pega o nome do setor

        Object.keys(row).forEach(header => {
            const headerClean = header.toLowerCase();
            // Pula se for "Setor" ou "Total"
            if (nonProductionPeriodHeaders.includes(headerClean)) return; 
            
            // Extrai a hora
            const hour = parseInt(header.replace('h', ''));
            if (isNaN(hour)) return; // Pula se não for uma hora (ex: "Total")

            const value = row[header];

            // Classifica a hora
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
        
        // Pega o total do setor (da coluna 'Total')
        const totalSetor = row['Total'] || 0;
        grandTotalProduction += totalSetor;

        // Adiciona totais do setor
        sectorBreakdown.push({ setor, manha, tarde, foraHorario, noite, totalSetor });

        // Adiciona aos totais gerais
        grandTotalManha += manha;
        grandTotalTarde += tarde;
        grandTotalForaHorario += foraHorario;
        grandTotalNoite += noite;
    });

    // Retorna o total geral para cálculo da %
    return { grandTotalManha, grandTotalTarde, grandTotalForaHorario, grandTotalNoite, grandTotalProduction, sectorBreakdown }; 
}

// --- FUNÇÕES DE EXIBIÇÃO ---

// Nova função para popular a tabela de detalhes
function displaySectorTable(sectorBreakdown) {
    const tbody = document.getElementById('sectorTableBody');
    tbody.innerHTML = ''; // Limpa tabela

    sectorBreakdown.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        const totalSetor = item.totalSetor || 0;

        // Cálculos de Média e Porcentagem por período
        const avgManha = (periodDurations.manha > 0) ? (item.manha / periodDurations.manha) : 0;
        const pctManha = (totalSetor > 0) ? (item.manha / totalSetor) : 0; // valor de 0 a 1

        const avgTarde = (periodDurations.tarde > 0) ? (item.tarde / periodDurations.tarde) : 0;
        const pctTarde = (totalSetor > 0) ? (item.tarde / totalSetor) : 0;

        const avgForaHorario = (periodDurations.foraHorario > 0) ? (item.foraHorario / periodDurations.foraHorario) : 0;
        const pctForaHorario = (totalSetor > 0) ? (item.foraHorario / totalSetor) : 0;

        const avgNoite = (periodDurations.noite > 0) ? (item.noite / periodDurations.noite) : 0;
        const pctNoite = (totalSetor > 0) ? (item.noite / totalSetor) : 0;
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.setor}</td>
            
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800 bg-gray-100">${formatter.format(totalSetor)}</td>

            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.manha)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgManha)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-blue-700 font-medium">${formatterPct.format(pctManha)}</td>
            
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.tarde)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgTarde)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-green-700 font-medium">${formatterPct.format(pctTarde)}</td>
            
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.foraHorario)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgForaHorario)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-yellow-700 font-medium">${formatterPct.format(pctForaHorario)}</td>
            
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">${formatter.format(item.noite)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${formatter.format(avgNoite)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-indigo-700 font-medium">${formatterPct.format(pctNoite)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Função para desenhar o gráfico (agrupado)
function displayProductionChart(sectorBreakdown) {
    const ctx = document.getElementById('productionChart').getContext('2d');
    
    const labels = sectorBreakdown.map(item => item.setor); // Nomes dos setores
    const manhaData = sectorBreakdown.map(item => item.manha);
    const tardeData = sectorBreakdown.map(item => item.tarde);
    const foraHorarioData = sectorBreakdown.map(item => item.foraHorario);
    const noiteData = sectorBreakdown.map(item => item.noite);

    // Destrói gráfico antigo, se existir
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Manhã (7h-12h)',
                    data: manhaData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)', // Azul
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Tarde (13h-16h)',
                    data: tardeData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)', // Verde
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Fora Horário (17h-21h)',
                    data: foraHorarioData,
                    backgroundColor: 'rgba(255, 206, 86, 0.6)', // Amarelo
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Noite (22h-6h)',
                    data: noiteData,
                    backgroundColor: 'rgba(75, 0, 130, 0.6)', // Indigo/Roxo
                    borderColor: 'rgba(75, 0, 130, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
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
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatter.format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Popula o <div> com checkboxes
function populateSectorCheckboxes(data) {
    const container = document.getElementById('sectorCheckboxContainer');
    container.innerHTML = ''; // Limpa opções antigas

    data.forEach((row, index) => {
        const sectorName = row[Object.keys(row)[0]]; // Pega o nome do setor (primeira coluna)
        
        // Cria o HTML para o checkbox e a label
        const checkboxHTML = `
            <div class="flex items-center p-1 hover:bg-gray-100 rounded">
                <input type="checkbox" 
                       id="sector-cb-${index}" 
                       value="${sectorName}" 
                       class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                       ${index === 0 ? 'checked' : ''}> <label for="sector-cb-${index}" class="ml-2 block text-sm text-gray-900">${sectorName}</label>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', checkboxHTML);
    });

    // Adiciona o event listener ao container PAI
    container.addEventListener('change', () => {
        const selectedSectors = [];
        // Encontra todos os checkboxes marcados DENTRO do container
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedSectors.push(checkbox.value);
        });
        displayHourlyChart(selectedSectors);
    });

}

// Desenha o gráfico de linha por hora para MÚLTIPLOS setores
function displayHourlyChart(selectedSectorNamesArray) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    const { headers, data } = parsedDataCache;

    // Define um pool de cores para os gráficos
    const chartColors = [
        'rgba(239, 68, 68, 1)',   // Red
        'rgba(54, 162, 235, 1)',  // Blue
        'rgba(75, 192, 192, 1)',  // Green
        'rgba(255, 206, 86, 1)',  // Yellow
        'rgba(139, 92, 246, 1)',  // Indigo
        'rgba(255, 159, 64, 1)',  // Orange
        'rgba(153, 102, 255, 1)', // Purple
        'rgba(255, 99, 132, 1)'   // Pink
    ];
    const chartBgColors = [
        'rgba(239, 68, 68, 0.1)',
        'rgba(54, 162, 235, 0.1)',
        'rgba(75, 192, 192, 0.1)',
        'rgba(255, 206, 86, 0.1)',
        'rgba(139, 92, 246, 0.1)',
        'rgba(255, 159, 64, 0.1)',
        'rgba(153, 102, 255, 0.1)',
        'rgba(255, 99, 132, 0.1)'
    ];

    const chartLabels = [];
    const datasets = [];

    // 1. Pega os cabeçalhos das horas (ex: "0h", "1h"...)
    headers.forEach(header => {
        const hour = parseInt(header.replace('h', ''));
        if (!isNaN(hour) && hour >= 0 && hour <= 23) {
            chartLabels.push(header);
        }
    });

    // 2. Cria um dataset para CADA setor selecionado
    selectedSectorNamesArray.forEach((sectorName, index) => {
        // Encontra os dados do setor selecionado
        const sectorData = data.find(row => row[Object.keys(row)[0]] === sectorName);
        if (!sectorData) return; // Pula se não encontrar

        const chartDataPoints = [];

        // Pega os dados de produção para cada hora
        chartLabels.forEach(label => {
            chartDataPoints.push(sectorData[label] || 0);
        });

        // Usa o index para pegar uma cor do pool (dando a volta se acabar)
        const colorIndex = index % chartColors.length;

        // Adiciona o dataset para este setor
        datasets.push({
            label: `Produção de ${sectorName}`,
            data: chartDataPoints,
            borderColor: chartColors[colorIndex],
            backgroundColor: chartBgColors[colorIndex],
            fill: true,
            tension: 0.1 // Suaviza a linha
        });
    });

    // Destrói gráfico antigo, se existir
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }

    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
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
                legend: {
                    display: true 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatter.format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Função para exibir mensagens de status
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