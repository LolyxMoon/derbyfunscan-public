// script.js - DerbyFunScan versión pública para Vercel

const CONFIG = {
    HOLDERS_API: 'http://191.96.39.186:3001/api',
    SITE_URL: window.location.origin,
    UPDATE_INTERVAL: 30000
};

// Estado global
let publicRaceData = {
    races: [],
    walletStats: {},
    lastUpdate: null
};

// Inicializar
async function init() {
    console.log('🏇 DerbyFunScan Public - Initializing...');
    
    // Cargar datos desde localStorage
    loadLocalData();
    
    // Intentar cargar datos frescos
    await fetchPublicData();
    
    // Actualizar UI
    updateUI();
    
    // Timer de próxima carrera
    updateNextRaceTimer();
    setInterval(updateNextRaceTimer, 1000);
    
    // Actualizar datos periódicamente
    setInterval(fetchPublicData, CONFIG.UPDATE_INTERVAL);
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

// Obtener datos públicos
async function fetchPublicData() {
    try {
        // Intentar obtener desde el endpoint de Vercel
        const response = await fetch('/api/races');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                // Actualizar solo si hay datos nuevos
                if (data.data.lastUpdated !== publicRaceData.lastUpdate) {
                    publicRaceData = {
                        races: data.data.recentWinners || [],
                        totalRaces: data.data.totalRaces || 0,
                        totalPrizes: data.data.totalPrizes || 0,
                        lastUpdate: data.data.lastUpdated
                    };
                    saveLocalData();
                    updateUI();
                    console.log('✅ Data updated from server');
                }
            }
        }
    } catch (error) {
        console.error('Error fetching public data:', error);
        // Usar datos locales si falla
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
    
    // Buscar en datos públicos
    const races = publicRaceData.races || [];
    const walletRaces = races.filter(r => 
        r.winner && r.winner.toLowerCase() === address.toLowerCase()
    );
    
    if (walletRaces.length > 0) {
        const totalPrizes = walletRaces.length * 0.005;
        const lastWin = walletRaces[0]?.timestamp;
        
        results.innerHTML = `
            <h4 style="color: #4CAF50; margin-bottom: 15px;">✅ Wallet Found in Public Records</h4>
            <div class="wallet-stats">
                <div class="stat-item">
                    <div class="stat-label">Races Won</div>
                    <div class="stat-value">${walletRaces.length}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Total Prizes</div>
                    <div class="stat-value">${totalPrizes.toFixed(4)} SOL</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Last Win</div>
                    <div class="stat-value" style="font-size: 14px;">
                        ${lastWin ? getTimeAgo(lastWin) : 'N/A'}
                    </div>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 10px; background: rgba(255,215,0,0.1); border-radius: 8px;">
                <p style="color: #999; font-size: 12px;">
                    Note: Only showing publicly available race data
                </p>
            </div>
        `;
    } else {
        // Verificar si es holder actual (si la API está disponible)
        try {
            const holderResponse = await fetch(`${CONFIG.HOLDERS_API}/check-wallet/${address}`);
            if (holderResponse.ok) {
                const holderData = await holderResponse.json();
                if (holderData.isHolder) {
                    results.innerHTML = `
                        <h4 style="color: #FFD700;">🎯 Active Holder</h4>
                        <p>This wallet is an active holder but hasn't won any races yet.</p>
                    `;
                    return;
                }
            }
        } catch (e) {
            // API no disponible
        }
        
        results.innerHTML = `
            <h4 style="color: #FF6B6B;">❌ No Race Records Found</h4>
            <p style="color: #999;">This wallet has no recorded wins in the public race history.</p>
        `;
    }
}

// Actualizar UI con datos públicos
function updateUI() {
    updateRecentWinners();
    updateGlobalStats();
    updateHallOfFame();
}

// Actualizar ganadores recientes
function updateRecentWinners() {
    const container = document.getElementById('recentWinners');
    const races = publicRaceData.races || [];
    
    if (races.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <p style="color: #666;">Waiting for race data...</p>
                <p style="color: #999; font-size: 12px; margin-top: 10px;">
                    Data will appear here once races are recorded
                </p>
            </div>
        `;
        return;
    }
    
    let html = `
        <table class="winners-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Winner</th>
                    <th>Prize</th>
                    <th>When</th>
                    <th>TX</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    races.slice(0, 20).forEach((race, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const timeAgo = race.timestamp ? getTimeAgo(race.timestamp) : 'Unknown';
        const solscanUrl = `https://solscan.io/tx/${race.txHash || ''}`;
        
        html += `
            <tr>
                <td>${medal} ${race.id || index + 1}</td>
                <td>
                    <a href="${solscanUrl}" target="_blank" class="wallet-link">
                        ${race.winner ? 
                            race.winner.substring(0, 6) + '...' + race.winner.substring(race.winner.length - 4) : 
                            'Unknown'}
                    </a>
                </td>
                <td style="color: #4CAF50; font-weight: bold;">0.005 SOL</td>
                <td style="color: #999;">${timeAgo}</td>
                <td>
                    ${race.txHash ? 
                        `<a href="${solscanUrl}" target="_blank" class="tx-link">🔗</a>` : 
                        '-'}
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
    const totalPrizes = publicRaceData.totalPrizes || 0;
    const races = publicRaceData.races || [];
    
    // Contar ganadores únicos
    const uniqueWinners = [...new Set(races.map(r => r.winner).filter(w => w))].length;
    
    // Carreras de hoy
    const today = new Date().toDateString();
    const todayRaces = races.filter(r => 
        r.timestamp && new Date(r.timestamp).toDateString() === today
    ).length;
    
    // Actualizar elementos
    document.getElementById('totalRaces').textContent = totalRaces;
    document.getElementById('totalPrizes').textContent = totalPrizes.toFixed(4);
    document.getElementById('uniqueWinners').textContent = uniqueWinners;
    document.getElementById('todayRaces').textContent = todayRaces;
    
    // Ticker
    const tickerPrizes = document.getElementById('ticker-total-prizes');
    const tickerRaces = document.getElementById('ticker-total-races');
    if (tickerPrizes) tickerPrizes.textContent = totalPrizes.toFixed(4);
    if (tickerRaces) tickerRaces.textContent = totalRaces;
}

// Actualizar Hall of Fame
function updateHallOfFame() {
    const container = document.getElementById('hallOfFame');
    const races = publicRaceData.races || [];
    
    // Contar victorias por wallet
    const winCounts = {};
    races.forEach(race => {
        if (race.winner) {
            winCounts[race.winner] = (winCounts[race.winner] || 0) + 1;
        }
    });
    
    // Ordenar por victorias
    const topWinners = Object.entries(winCounts)
        .map(([wallet, wins]) => ({ wallet, wins }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 10);
    
    if (topWinners.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <p style="color: #666;">No winners yet...</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="hall-of-fame">';
    topWinners.forEach((winner, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        html += `
            <div class="fame-item">
                <span class="fame-rank">${medal}</span>
                <span class="fame-wallet">
                    ${winner.wallet.substring(0, 8)}...${winner.wallet.substring(winner.wallet.length - 4)}
                </span>
                <span class="fame-wins">${winner.wins} wins</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Timer de próxima carrera
function updateNextRaceTimer() {
    const timer = document.getElementById('nextRaceTimer');
    if (!timer) return;
    
    const now = Date.now();
    const raceInterval = 120000; // 2 minutos
    const timeToNext = raceInterval - (now % raceInterval);
    
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