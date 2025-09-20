// script.js - DerbyFunScan versión pública para Vercel

const CONFIG = {
    HOLDERS_API: 'https://b5d8fe120b27.ngrok-free.app/api',
    SITE_URL: window.location.origin,
    UPDATE_INTERVAL: 30000
};

// Estado global
let publicRaceData = {
    races: [],
    walletStats: {},
    lastUpdate: null
};

// Headers para bypass de ngrok
const NGROK_HEADERS = {
    'ngrok-skip-browser-warning': 'true'
};

// Inicializar
async function init() {
    console.log('🐎 DerbyFunScan Public - Initializing...');
    
    // Cargar datos desde localStorage
    loadLocalData();
    
    // Intentar cargar datos frescos desde la API
    await fetchHoldersData();
    
    // Actualizar UI
    updateUI();
    
    // Timer de próxima carrera
    updateNextRaceTimer();
    setInterval(updateNextRaceTimer, 1000);
    
    // Actualizar datos periódicamente
    setInterval(fetchHoldersData, CONFIG.UPDATE_INTERVAL);
}

// Cargar datos locales
function loadLocalData() {
    const stored = localStorage.getItem('derbyPublicData');
    if (stored) {
        try {
            publicRaceData = JSON.parse(stored);
            console.log(`Loaded ${publicRaceData.races?.length || 0} races from cache`);
        } catch (e) {
            console.error('Error loading local data:', e);
        }
    }
}

// Guardar datos locales
function saveLocalData() {
    localStorage.setItem('derbyPublicData', JSON.stringify(publicRaceData));
}

// Obtener datos de holders desde tu API
async function fetchHoldersData() {
    try {
        // Obtener stats generales
        const statsResponse = await fetch(`${CONFIG.HOLDERS_API}/stats`, {
            headers: NGROK_HEADERS
        });
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            console.log('Stats received:', statsData);
            
            if (statsData.success && statsData.data) {
                // Actualizar datos con lo que viene de tu API
                publicRaceData.totalRaces = statsData.data.totalRaces || 0;
                publicRaceData.totalWallets = statsData.data.currentWalletsCount || 0;
                publicRaceData.lastUpdate = statsData.data.lastUpdate;
                publicRaceData.topHolder = statsData.data.topHolder;
                
                // Obtener lista de holders
                await fetchHoldersList();
                
                saveLocalData();
                updateUI();
                console.log('✅ Data updated from API');
            }
        }
    } catch (error) {
        console.error('Error fetching holders data:', error);
    }
}

// Obtener lista de holders
async function fetchHoldersList() {
    try {
        const response = await fetch(`${CONFIG.HOLDERS_API}/holders`, {
            headers: NGROK_HEADERS
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                // Convertir holders a formato de "races" para mostrar
                publicRaceData.races = data.data.slice(0, 20).map((holder, index) => ({
                    id: index + 1,
                    winner: holder.address,
                    balance: holder.balance,
                    percentage: holder.percentage,
                    timestamp: holder.lastSeen || holder.addedAt
                }));
            }
        }
    } catch (error) {
        console.error('Error fetching holders list:', error);
    }
}

// Buscar wallet
async function searchWallet() {
    const address = document.getElementById('searchInput').value.trim();
    
    if (!address) {
        document.getElementById('searchResults').classList.remove('active');
        return;
    }
    
    const results = document.getElementById('searchResults');
    results.classList.add('active');
    
    try {
        // Buscar en la API de holders
        const response = await fetch(`${CONFIG.HOLDERS_API}/holders`, {
            headers: NGROK_HEADERS
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                const holder = data.data.find(h => 
                    h.address.toLowerCase() === address.toLowerCase()
                );
                
                if (holder) {
                    results.innerHTML = `
                        <h4 style="color: #4CAF50; margin-bottom: 15px;">✅ Wallet Found - Active Holder</h4>
                        <div class="wallet-stats">
                            <div class="stat-item">
                                <div class="stat-label">Balance</div>
                                <div class="stat-value">${(holder.balance / 1e6).toFixed(2)}M</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Percentage</div>
                                <div class="stat-value">${holder.percentage.toFixed(2)}%</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Rank</div>
                                <div class="stat-value">#${holder.rank || data.data.indexOf(holder) + 1}</div>
                            </div>
                        </div>
                    `;
                    return;
                }
            }
        }
        
        results.innerHTML = `
            <h4 style="color: #FF6B6B;">❌ Wallet Not Found</h4>
            <p style="color: #999;">This wallet is not in the current holders list.</p>
        `;
        
    } catch (error) {
        console.error('Error searching wallet:', error);
        results.innerHTML = `
            <h4 style="color: #FF6B6B;">Error</h4>
            <p style="color: #999;">Could not search wallet. Please try again.</p>
        `;
    }
}
// Actualizar UI con datos
function updateUI() {
    updateRecentWinners();
    updateGlobalStats();
    updateHallOfFame();
}

// Actualizar "ganadores recientes" (ahora mostrando top holders)
function updateRecentWinners() {
    const container = document.getElementById('recentWinners');
    const races = publicRaceData.races || [];
    
    if (races.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <p style="color: #666;">Loading holders data...</p>
                <p style="color: #999; font-size: 12px; margin-top: 10px;">
                    Connecting to API...
                </p>
            </div>
        `;
        return;
    }
    
    let html = `
        <table class="winners-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Wallet</th>
                    <th>Balance</th>
                    <th>%</th>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    races.forEach((holder, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const solscanUrl = `https://solscan.io/account/${holder.winner}`;
        const balance = holder.balance ? (holder.balance / 1e6).toFixed(2) : '0';
        
        html += `
            <tr>
                <td>${medal} ${index + 1}</td>
                <td>
                    <a href="${solscanUrl}" target="_blank" class="wallet-link">
                        ${holder.winner ? 
                            holder.winner.substring(0, 6) + '...' + holder.winner.substring(holder.winner.length - 4) : 
                            'Unknown'}
                    </a>
                </td>
                <td style="color: #4CAF50; font-weight: bold;">${balance}M</td>
                <td style="color: #FFD700;">${holder.percentage?.toFixed(2) || '0'}%</td>
                <td>
                    <a href="${solscanUrl}" target="_blank" class="tx-link">🔗</a>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Actualizar estadísticas globales
function updateGlobalStats() {
    const totalRaces = publicRaceData.totalRaces || 0;
    const totalWallets = publicRaceData.totalWallets || 0;
    const races = publicRaceData.races || [];
    
    // Top holder info
    const topHolder = publicRaceData.topHolder;
    const topBalance = topHolder ? (topHolder.balance / 1e9).toFixed(2) : '0';
    
    // Actualizar elementos
    document.getElementById('totalRaces').textContent = totalRaces;
    document.getElementById('totalPrizes').textContent = topBalance + 'B';
    document.getElementById('uniqueWinners').textContent = totalWallets;
    document.getElementById('todayRaces').textContent = races.length;
    
    // Ticker
    const tickerPrizes = document.getElementById('ticker-total-prizes');
    const tickerRaces = document.getElementById('ticker-total-races');
    if (tickerPrizes) tickerPrizes.textContent = topBalance;
    if (tickerRaces) tickerRaces.textContent = totalRaces;
}

// Actualizar Hall of Fame (top holders)
function updateHallOfFame() {
    const container = document.getElementById('hallOfFame');
    const races = publicRaceData.races || [];
    
    if (races.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <p style="color: #666;">Loading top holders...</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="hall-of-fame">';
    races.slice(0, 10).forEach((holder, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        const balance = holder.balance ? (holder.balance / 1e6).toFixed(1) : '0';
        
        html += `
            <div class="fame-item">
                <span class="fame-rank">${medal}</span>
                <span class="fame-wallet">
                    ${holder.winner.substring(0, 8)}...${holder.winner.substring(holder.winner.length - 4)}
                </span>
                <span class="fame-wins">${balance}M tokens</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Timer de próxima actualización (en lugar de carrera)
function updateNextRaceTimer() {
    const timer = document.getElementById('nextRaceTimer');
    if (!timer) return;
    
    const now = Date.now();
    const updateInterval = 5 * 60000; // 5 minutos
    const lastUpdate = publicRaceData.lastUpdate ? new Date(publicRaceData.lastUpdate).getTime() : now;
    const nextUpdate = lastUpdate + updateInterval;
    const timeToNext = Math.max(0, nextUpdate - now);
    
    const minutes = Math.floor(timeToNext / 60000);
    const seconds = Math.floor((timeToNext % 60000) / 1000);
    
    timer.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Utilidades
function getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
}

// Inicializar cuando cargue
window.addEventListener('load', init);