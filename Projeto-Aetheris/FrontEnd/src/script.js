// ========================================================
// CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS
// ========================================================
const BR_BOUNDS = [[-34.0, -74.0], [5.3, -34.0]];
const map = L.map('map', {
    maxBounds: BR_BOUNDS,
    maxBoundsViscosity: 2.0,
    minZoom: 5,
    maxZoom: 15
}).setView([-14.2, -51.9], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Variável global para armazenar o resultado da busca WTSS e as coordenadas
window.currentWtssResult = null; 

// ========================================================
// ELEMENTOS DE INTERFACE
// ========================================================
const sidebar = document.getElementById('sidebar');
const input = document.getElementById("tag-input");
const suggestionsBox = document.getElementById("suggestions");
const selectedTagsContainer = document.getElementById("selected-tags");
const infoPanel = document.getElementById("info-panel-right");

let selectedTags = [];
let selectedMarker;
let selectedArea;

// ========================================================
// DADOS BASE
// ========================================================
const allSuggestions = [
    "CBERS4A", "Landsat-2", "CBERS-2B", "GOES-19", "Sentinel-2",
    "Sentinel-1", "MODIS Terra/Aqua", "Landsat series", "MODIS Aqua",
    "Sentinel-3 OLCI", "CBERS-4", "Estações meteorológicas / satélite", "CBERS WFI"
];

const sateliteIdMap = {
    "CBERS4A": "cbers4a",
    "CBERS-4": "cbers4",
    "Landsat-2": "landsat-2",
    "Landsat series": "landsat-2",
    "Sentinel-2": "sentinel2",
    "Sentinel-1": "sentinel1",
    "MODIS Terra/Aqua": "modis",
    "GOES-19": "goes16",
    "MODIS Aqua": "modis",
    "Sentinel-3 OLCI": "sentinel3",
    "CBERS-2B": "cbers2b",
    "Estações meteorológicas / satélite": "EtaCCDay_CMIP5-1",
    "CBERS WFI": "amazonia1"
};

const productNameToPopularName = {
    'mosaic-cbers4a-paraiba-3m-1': 'CBERS-4A (Paraíba)',
    'mosaic-cbers4-paraiba-3m-1': 'CBERS-4 (Paraíba)',
    'AMZ1-WFI-L4-SR-1': 'Amazônia-1 (WFI)',
    'LCC_L8_30_16D_STK_Cerrado-1': 'Landsat-8 (Cerrado 16D)',
    'myd13q1-6.1': 'MODIS (NDVI/EVI 16D)',
    'mosaic-s2-yanomami_territory-6m-1': 'Sentinel-2 (Yanomami 6M)',
    'LANDSAT-16D-1': 'Landsat (Data Cube 16D)',
    'S2-16D-2': 'Sentinel-2 (Data Cube 16D)',
    'prec_merge_daily-1': 'Precipitação Diária',
    'EtaCCDay_CMIP5-1': 'Modelo Climático (CMIP5)'
};

// WTSS Config & Fallback
const WTSS_REFERENCE_COVERAGE = 'LANDSAT-16D-1'; 
const LANDSAT_ATTRIBUTES_FALLBACK = [
    'NDVI', 'EVI', 'blue', 'green', 'red', 'nir08', 'swir16', 'swir22', 
    'coastal', 'qa_pixel', 'CLEAROB', 'TOTALOB', 'PROVENANCE', 'DATASOURCE'
];


// ========================================================
// CONTROLE DO SIDEBAR
// ========================================================
window.toggleMenu = function () {
    sidebar.classList.toggle('ativo');
};

// ========================================================
// FUNÇÕES DE SELEÇÃO NO MAPA
// ========================================================
function createSelectionVisuals(latlng) {
    if (selectedMarker) map.removeLayer(selectedMarker);
    if (selectedArea) map.removeLayer(selectedArea);

    selectedMarker = L.circleMarker(latlng, {
        radius: 10, color: "#ff0000", weight: 3, fillColor: "#ff4d4d", fillOpacity: 0.7
    }).addTo(map);

    selectedArea = L.circle(latlng, {
        radius: 20000, color: "#ff0000", weight: 2, fillColor: "#ff4d4d", fillOpacity: 0.15
    }).addTo(map);
}

// ========================================================
// TAG SELECTOR (filtros de satélite)
// ========================================================
function showSuggestions(filter) {
    suggestionsBox.innerHTML = "";
    const filtered = allSuggestions.filter(item =>
        item.toLowerCase().includes(filter) && !selectedTags.includes(item)
    );
    filtered.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        li.addEventListener("click", () => selectTag(item));
        suggestionsBox.appendChild(li);
    });
    suggestionsBox.style.display = filtered.length ? "block" : "none";
}

function selectTag(tag) {
    selectedTags.push(tag);
    input.value = "";
    suggestionsBox.innerHTML = "";
    renderSelectedTags();
    input.focus();
}

window.removeTag = function (tag) {
    selectedTags = selectedTags.filter(t => t !== tag);
    renderSelectedTags();
    showSuggestions(input.value);
};

function renderSelectedTags() {
    selectedTagsContainer.innerHTML = "";
    selectedTags.forEach(tag => {
        const tagEl = document.createElement("div");
        tagEl.classList.add("tag");
        tagEl.innerHTML = `${tag} <span class="remove" onclick="removeTag('${tag}')">&times;</span>`;
        selectedTagsContainer.appendChild(tagEl);
    });
}

// ========================================================
// ABAS DO PAINEL DIREITO (STAC / WTSS)
// ========================================================
function showTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        showTab(tabId);
    });
});

function showInfoPanelSTAC(htmlContent) {
    const panel = document.getElementById('info-panel-right');
    const tab = document.getElementById('stac-tab');
    tab.innerHTML = htmlContent;
    panel.classList.add('visible');
    showTab('stac-tab');
}

function showInfoPanelWTSS(htmlContent) {
    const panel = document.getElementById('info-panel-right');
    const tab = document.getElementById('wtss-tab');
    tab.innerHTML = htmlContent;
    panel.classList.add('visible');
    showTab('wtss-tab');
}

function hideInfoPanel() {
    document.getElementById('info-panel-right').classList.remove('visible');
}

// ========================================================
// FUNÇÕES DE CHART E API (STAC)
// ========================================================
function applyScale(rawValue) {
    return rawValue * 0.0001;
}

window.fetchTimeSeriesAndPlot = async function (lat, lng, coverage, band, friendlyName) {
    const tempContent = `<div class="satelite-popup-header"><strong>Carregando Série Temporal STAC...</strong></div><p>Produto: ${friendlyName}</p><p>Aguarde...</p>`;
    showInfoPanelSTAC(tempContent);

    try {
        // 'band' agora deve ser uma lista de bandas separadas por vírgula
        const bandQuery = band ? `&bands=${band}` : ''; 
        const response = await fetch(`http://localhost:3000/api/timeseries?lat=${lat}&lng=${lng}&coverage=${coverage}${bandQuery}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details?.description || `Erro ${response.status} na API Local.`);
        }
        
        const data = await response.json();
        
        if (!data || !data.timeline || data.timeline.length === 0) {
             console.warn(`STAC: API retornou dados vazios para ${coverage}.`, data);
             showInfoPanelSTAC(`<div class="satelite-popup-header"><strong>Série Temporal STAC: ${friendlyName}</strong></div><p>A API retornou dados, mas a série temporal está vazia (linha do tempo vazia).</p>`);
             return;
        }

        createChart(lat, lng, friendlyName, data);
    } catch (error) {
        console.error('Erro ao plotar série temporal STAC:', error);
        // Usando a classe CSS para erros
        showInfoPanelSTAC(`<div class="satelite-popup-header text-error"><strong>Erro ao buscar dados:</strong></div><p>${error.message}</p>`);
    }
};

function createChart(lat, lng, title, timeSeriesData) {
    if (!timeSeriesData || !timeSeriesData.timeline || timeSeriesData.timeline.length === 0) {
        showInfoPanelSTAC(`<div class="satelite-popup-header"><strong>Série Temporal STAC: ${title}</strong></div><p>Nenhum dado encontrado.</p>`);
        return;
    }

    const chartId = `chart-${Date.now()}`;
    const bands = timeSeriesData.attributes;
    const chartDatasets = bands.map((band, index) => {
        const rawValues = timeSeriesData.values.map(v => v[band]);
        const scaledData = rawValues.map(val => (val !== undefined && val !== null) ? applyScale(val) : null);
        let color = `hsl(${index * 60}, 70%, 50%)`;
        if (band.toUpperCase().includes('NDVI')) color = 'rgba(0, 128, 0, 1)';
        else if (band.toUpperCase().includes('EVI')) color = 'rgba(0, 0, 255, 1)';
        return {
            label: band,
            data: timeSeriesData.timeline.map((date, i) => ({ x: date, y: scaledData[i] })),
            borderColor: color,
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 3
        };
    });


    const panelHtml = `
        <div class="chart-popup-content">
            <div class="satelite-popup-header"><strong>Série Temporal STAC: ${title}</strong></div>
            <p>Atributos: ${bands.join(', ')}</p>
            <hr class="satelite-popup-divider">
            <div style="position: relative; height: 300px; width: 100%;"> 
                <canvas id="${chartId}"></canvas>
            </div>
            <p class="chart-footer" style="font-size: 0.7em;">Valores reais (escala padrão aplicada).</p>
        </div>`;

    showInfoPanelSTAC(panelHtml);

    setTimeout(() => {
        const ctx = document.getElementById(chartId);
        if (!ctx) return;
        new Chart(ctx, {
            type: 'line',
            data: { datasets: chartDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                parsing: false,
                scales: {
                    x: { type: 'time', time: { unit: 'month', tooltipFormat: 'dd MMM yyyy' }, title: { display: true, text: 'Data' } },
                    y: { title: { display: true, text: 'Valor (Escala aplicada)' }, min: -0.2, max: 1.05 }
                }
            }
        });
    }, 500); 
}

// ========================================================
// WTSS - FUNÇÕES DE DADOS E PLOTAGEM (EMPILHAMENTO)
// ========================================================

// Variável para armazenar o resultado da busca WTSS e as coordenadas
window.currentWtssResult = null; 

// Busca os metadados (incluindo todos os atributos)
async function getWTSSData(lat, lon) {
    const baseUrl = "https://data.inpe.br/bdc/wtss/v4/";
    const name = WTSS_REFERENCE_COVERAGE; 

    try {
        const detailUrl = `${baseUrl}${name}`; 
        const datasetResponse = await fetch(detailUrl);

        if (!datasetResponse.ok) {
            throw new Error(`Erro ${datasetResponse.status} ao buscar detalhes de cobertura WTSS: ${name}`);
        }

        const datasetDetails = await datasetResponse.json();

        const timeline = datasetDetails.timeline;
        const start_date = timeline[0];
        const end_date = timeline[timeline.length - 1];
        
        let availableAttributes = datasetDetails.attributes?.map(attr => attr.attribute) ?? [];

        if (availableAttributes.length === 0) {
            availableAttributes = LANDSAT_ATTRIBUTES_FALLBACK;
            console.warn(`WTSS: Usando FALLBACK. Cobertura '${name}' não retornou atributos na API, mas usaremos a lista conhecida.`);
        }

        if (availableAttributes.length === 0) {
             return null;
        }

        return {
            title: name,
            start_date,
            end_date,
            availableAttributes,
            timeline,
            lat,
            lon // Armazenamos as coordenadas
        };
    } catch (err) {
        console.error("Erro ao acessar metadados WTSS:", err);
        return { error: err.message, title: name, lat, lon }; 
    }
}

// Função de limpeza de gráficos empilhados
window.clearWTSSEmpilhados = function(result) {
    const wtssTab = document.getElementById('wtss-tab');
    wtssTab.innerHTML = ''; // Limpa todo o conteúdo da aba
    
    // Recria o painel de seleção na aba
    createWTSSPanel(result, result.lat, result.lon);
}

// Função que busca a série temporal WTSS e plota o gráfico
window.fetchWTSSTimeSeriesAndPlot = async function (lat, lon, coverage, attribute, friendlyName) {
    const tempContent = `<div class="satelite-popup-header"><strong>Carregando Série Temporal WTSS...</strong></div><p>Atributo: ${attribute}</p><p>Aguarde...</p>`;
    // Adiciona a mensagem de carregamento, mantendo o painel de controle
    document.getElementById('wtss-tab').insertAdjacentHTML('beforeend', `<div id="wtss-loading-message">${tempContent}</div>`); 

    try {
        const baseUrl = "https://data.inpe.br/bdc/wtss/v4/";
        
        // --- LÓGICA DE CÁLCULO DE PERÍODO (1 ANO) ---
        const now = new Date();
        const date01YearsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const calculated_end_date = now.toISOString().split('T')[0]; 
        const calculated_start_date = date01YearsAgo.toISOString().split('T')[0];
        // ---------------------------------------------
        
        const timeSeriesUrl = `${baseUrl}time_series?coverage=${coverage}&attributes=${attribute}&start_date=${calculated_start_date}&end_date=${calculated_end_date}&latitude=${lat}&longitude=${lon}`;
        
        const timeSeriesResponse = await fetch(timeSeriesUrl);
        if (!timeSeriesResponse.ok) throw new Error(`Erro ${timeSeriesResponse.status} ao buscar série WTSS.`);
        
        const timeSeriesData = await timeSeriesResponse.json();
        
        const attributesResult = timeSeriesData.result?.attributes ?? [];
        const attrData = attributesResult.find(a => a.attribute === attribute);
        
        if (!attrData || !attrData.values || attrData.values.length === 0) {
             throw new Error(`Nenhum dado encontrado para o atributo ${attribute} no período ${calculated_start_date} a ${calculated_end_date}.`);
        }

        // Passa a timeline e o dado para a plotagem que empilha
        createWTSSTimeSeriesChart(friendlyName, attrData.values, timeSeriesData.result.timeline, attribute, coverage);
        
    } catch (error) {
        console.error('Erro ao plotar série temporal WTSS:', error);
        
        // Remove a mensagem de loading e mostra o erro
        const loadingMessage = document.getElementById('wtss-loading-message');
        if (loadingMessage) loadingMessage.remove();

        // Usando a classe CSS para erros
        document.getElementById('wtss-tab').insertAdjacentHTML('beforeend', `<div class="wtss-error-message" style="margin-top: 10px;"><strong>Erro WTSS:</strong> ${error.message}</div>`);
    }
};

// Cria o gráfico para o WTSS (PLOTA E EMPILHA)
function createWTSSTimeSeriesChart(title, values, timeline, attribute, coverage) {
    // 1. Gera um ID ÚNICO para o novo bloco e o canvas
    const uniqueId = `chart-${coverage}-${attribute}-${Date.now()}`;
    
    const panel = document.getElementById('wtss-tab');
    
    // 2. Remove a mensagem de loading
    const loadingMessage = panel.querySelector('#wtss-loading-message');
    if (loadingMessage) loadingMessage.remove();

    // 3. Cria o novo bloco HTML para o gráfico
    const chartBlock = document.createElement('div');
    chartBlock.id = uniqueId;
    chartBlock.classList.add('wtss-chart-block'); 
    
    chartBlock.innerHTML = `
        <div class="wtss-panel" style="border-top: 1px solid #666; margin-top: 15px; padding-top: 15px;">
            <h3 style="display: flex; justify-content: space-between; align-items: center;">
                Série Temporal: ${title}
                <span class="remove" onclick="document.getElementById('${uniqueId}').remove()" style="cursor:pointer; color: red; font-size: 1.2em;">&times;</span>
            </h3>
            <p><b>Atributo:</b> ${attribute}</p>
            <hr class="satelite-popup-divider">
            <div style="position: relative; height: 300px; width: 100%;">
                <canvas id="canvas-${uniqueId}"></canvas>
            </div>
            <p class="chart-footer" style="font-size: 0.7em;">Valores reais (escala padrão aplicada).</p>
        </div>
    `;

    // 4. ANEXA o novo bloco ao final da aba
    panel.appendChild(chartBlock);
    
    // 5. Rola a aba para cima para mostrar o painel de controle
    panel.scrollTop = 0; 

    // 6. Inicializa o gráfico no novo canvas
    setTimeout(() => {
        const ctx = document.getElementById(`canvas-${uniqueId}`);
        if (!ctx) return;
        
        const chartDatasets = [{
            label: attribute,
            data: timeline.map((date, i) => ({ x: date, y: (values[i] !== undefined && values[i] !== null) ? applyScale(values[i]) : null })),
            borderColor: attribute.toUpperCase().includes('NDVI') ? 'green' : 'blue',
            borderWidth: 2,
            fill: false,
            pointRadius: 3
        }];

        new Chart(ctx, {
            type: 'line',
            data: { labels: timeline, datasets: chartDatasets },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'month', tooltipFormat: 'dd MMM yyyy' }, title: { display: true, text: 'Data' } },
                    y: { title: { display: true, text: 'Valor (Escala aplicada)' }, min: -0.2, max: 1.05 } 
                }
            }
        });
        
    }, 500);
}
   
// Cria o painel WTSS com o seletor (VERSÃO FINAL SEM ESTILOS EM LINHA)
function createWTSSPanel(result, lat, lon) {
    // Armazena o resultado globalmente para o botão de limpeza e regeneração do painel
    window.currentWtssResult = { ...result, lat, lon }; 
    
    // --- CÁLCULO DE PERÍODO (01 ANOS) PARA EXIBIÇÃO NO PAINEL ---
    const now = new Date();
    const date01YearsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const calculated_start_date = date01YearsAgo.toISOString().split('T')[0];
    const calculated_end_date = now.toISOString().split('T')[0];
    // -----------------------------------------------------------

    if (result.error || !result.availableAttributes || result.availableAttributes.length === 0) {
        // Bloco de erro (já usa a classe externa .wtss-error-message)
        // ... (código mantido) ...
        return;
    }
    
    const defaultAttribute = result.availableAttributes.find(attr => attr.toUpperCase().includes('NDVI')) || result.availableAttributes[0];

    const attributeSelector = `
        <select id="wtss-attribute-select" class="wtss-full-width-select">
            ${result.availableAttributes.map(attr => 
                `<option value="${attr}" ${attr === defaultAttribute ? 'selected' : ''}>${attr}</option>`
            ).join('')}
        </select>
    `;

    const friendlyName = `WTSS - ${result.title}`;
    
    const plotButton = `
        <button 
            onclick="
                const selectEl = document.getElementById('wtss-attribute-select');
                fetchWTSSTimeSeriesAndPlot(${lat}, ${lon}, '${result.title}', selectEl.value, '${friendlyName}');
            " 
            class="action-button wtss-full-width-button plot-button-spacing">
            Plotar Série Temporal (Últimos 12 Meses)
        </button>
    `;
    
    // Controles no topo (LIVRES DE ESTILO INLINE)
    const controlsPanelHTML = `
        <div id="wtss-controls-panel" class="wtss-panel wtss-controls-sticky">
            <h3>Controles WTSS</h3>
            <p><b>Cobertura:</b> ${result.title}</p>
            <p><b>Período Solicitado:</b> ${calculated_start_date} → ${calculated_end_date}</p>
            <p><b>Atributo:</b> ${attributeSelector}</p>
            ${plotButton}
            <button onclick="clearWTSSEmpilhados(window.currentWtssResult)" class="action-button secondary-button wtss-full-width-button">
                Limpar Todos os Gráficos
            </button>
            <hr class="wtss-divider">
        </div>
    `;

    const wtssTab = document.getElementById('wtss-tab');
    const existingControls = document.getElementById('wtss-controls-panel');
    
    if (existingControls) {
        existingControls.outerHTML = controlsPanelHTML;
    } else {
        wtssTab.insertAdjacentHTML('afterbegin', controlsPanelHTML);
    }
    
    // Este é o ÚNICO estilo que pode permanecer em linha, pois é estrutural para o layout da aba. 
    // Mantenha se for necessário, mas se for a causa, mova para CSS.
    // wtssTab.style.overflowY = 'auto'; 
}


// ========================================================
// CLIQUE NO MAPA (STAC + WTSS) - LÓGICA DE INTERAÇÃO
// ========================================================
map.on('click', async function (e) {
    const { lat, lng } = e.latlng;

    hideInfoPanel();
    createSelectionVisuals(e.latlng);

    let pulse = L.circle(e.latlng, { radius: 5000, color: "#ff0000", fillColor: "#ff4d4d", fillOpacity: 0.25 }).addTo(map);
    setTimeout(() => { map.removeLayer(pulse); }, 600);

    showInfoPanelSTAC("<strong>📍 Ponto selecionado</strong><br>Buscando produtos STAC...");

    try {
        // --- LÓGICA STAC: APENAS METADADOS ---
        const satelitesQuery = selectedTags.map(tag => sateliteIdMap[tag]).filter(id => id).join(',');
        const response = await fetch(`http://localhost:3000/api/geodata?lat=${lat}&lng=${lng}&satelites=${satelitesQuery}`);
        if (!response.ok) throw new Error(`Erro ao buscar metadados STAC: ${response.status}`);

        const data = await response.json();
        let panelContent = `<div class="satelite-popup-header"><strong>Resultados STAC:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</div><hr class="satelite-popup-divider">`;

        if (data.length > 0) {
            data.forEach(item => {
                const popularName = productNameToPopularName[item.productName] || item.productName;
                const availableBands = (item.variables || []).map(v => v.name || v.id).filter(Boolean);
                
                // === STAC: APENAS METADADOS, SEM BOTÃO ===
                panelContent += `
                    <div class="product-info-block">
                        <strong class="product-title">🛰️ ${popularName}</strong>
                        <div class="product-details">
                            <p class="product-name">(${item.productName})</p>
                            <p class="product-description">${item.title || 'Sem descrição disponível.'}</p>
                            <p class="product-bands"><strong>Bandas:</strong> ${availableBands.join(', ') || 'N/A'}</p>
                        </div>
                    </div>`; 
            });
        } else {
            panelContent += `<p>Nenhum produto STAC encontrado para os filtros ativos.</p>`;
        }

        showInfoPanelSTAC(panelContent);

        // --- LÓGICA WTSS: Limpa e configura o painel de controles ---
        const wtssResult = await getWTSSData(lat, lng);
        if (wtssResult) createWTSSPanel(wtssResult, lat, lng); 

    } catch (error) {
        console.error('Erro geral no clique do mapa:', error);
        showInfoPanelSTAC(`<div class="text-error"><strong>Erro Geral:</strong> ${error.message}</div>`);
        
        // Tenta inicializar o painel WTSS mesmo após um erro STAC
        const wtssResult = await getWTSSData(lat, lng);
        if (wtssResult) createWTSSPanel(wtssResult, lat, lng);
    }
});

// ========================================================
// EVENTOS DE INPUT
// ========================================================
input.addEventListener("focus", () => showSuggestions(""));
input.addEventListener("input", () => showSuggestions(input.value.toLowerCase()));
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        const value = input.value.trim();
        const match = allSuggestions.find(item => item.toLowerCase() === value.toLowerCase());
        if (match && !selectedTags.includes(match)) selectTag(match);
    }
});

document.addEventListener("click", function (e) {
    const wrapper = document.querySelector(".tag-selector");
    if (wrapper && !wrapper.contains(e.target)) {
        suggestionsBox.innerHTML = "";
    }
});
