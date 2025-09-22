// script.js - Versión corregida para el Dashboard

const CONFIG = {
    HOLDERS_API: 'https://b5d8fe120b27.ngrok-free.app',
    SITE_URL: window.location.origin,
    UPDATE_INTERVAL: 30000
};

// Estado global
let publicRaceData = {
    races: [],        // Para ganadores de carreras
    holders: [],      // Para holders del token
    walletStats: {},
    lastUpdate: null
};

// Headers para bypass de ngrok
const NGROK_HEADERS = {
    'ngrok-skip-browser-warning': 'true'
};

// Inicializar
async function init() {
    console.log('🎏 DerbyFunScan Public - Initializing...');
    
    // Cargar datos desde localStorage
    loadLocalData();
    
    // Cargar datos frescos
    await fetchAllData();
    
    // Actualizar UI
    updateUI();
    
    // Timer de próxima carrera
    updateNextRaceTimer();
    setInterval(updateNextRaceTimer, 1000);
    
    // Actualizar datos periódicamente
    setInterval(fetchAllData, CONFIG.UPDATE_INTERVAL);
}

// Cargar datos locales
function loadLocalData() {
    const stored = localStorage.getItem('derbyPublicData');
    if (stored) {
        try {
            publicRaceData = JSON.parse(stored);
            console.log(`Loaded data from cache`);
        } catch (e) {
            console.error('Error loading local data:', e);
        }
    }
}

// Guardar datos locales
function saveLocalData() {
    localStorage.setItem('derbyPublicData', JSON.stringify(publicRaceData));
}

// Obtener TODOS los datos
async function fetchAllData() {
    await Promise.all([
        fetchWinnersData(),
        fetchHoldersData(),
        fetchStatsData()
    ]);
    
    saveLocalData();
    updateUI();
}

// Obtener datos de GANADORES (no holders)
async function fetchWinnersData() {
    try {
        const response = await fetch(`${CONFIG.HOLDERS_API}/winners`, {
            headers: NGROK_HEADERS
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                publicRaceData.races = data.data;
                console.log(`✅ ${data.data.length} winners loaded`);
            }
        }
    } catch (error) {
        console.error('Error fetching winners:', error);
    }
}

// Obtener datos de HOLDERS (solo para Hall of Fame y búsqueda)
async function fetchHoldersData() {
    try {
        const response = await fetch(`${CONFIG.HOLDERS_API}/api/holders`, {
            headers: NGROK_HEADERS
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                publicRaceData.holders = data.data;
                console.log(`✅ ${data.data.length} holders loaded`);
            }
        }
    } catch (error) {
        console.error('Error fetching holders:', error);
    }
}

// Obtener estadísticas
async function fetchStatsData() {
    try {
        const response = await fetch(`${CONFIG.HOLDERS_API}/api/stats`, {
            headers: NGROK_HEADERS
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                publicRaceData.stats = data.data;
            }
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Buscar wallet (en holders Y winners)
async function searchWallet() {
    const address = document.getElementById('searchInput').value.trim();
    
    if (!address) {
        document.getElementById('searchResults').classList.remove('active');
        return;
    }
    
    const results = document.getElementById('searchResults');
    results.classList.add('active');
    
    try {
        // Buscar en ganadores
        const winnersResponse = await fetch(`${CONFIG.HOLDERS_API}/api/winners/wallet/${address}`, {
            headers: NGROK_HEADERS
        });
        
        let winnerData = null;
        if (winnersResponse.ok) {
            const result = await winnersResponse.json();
            if (result.success && result.totalWins > 0) {
                winnerData = result;
            }
        }
        
        // Buscar en holders
        const holder = publicRaceData.holders.find(h => 
            h.address.toLowerCase() === address.toLowerCase()
        );
        
        if (!winnerData && !holder) {
            results.innerHTML = `
                <h4 style="color: #FF6B6B;">❌ Wallet Not Found</h4>
                <p style="color: #999;">This wallet is not a holder or winner.</p>
            `;
            return;
        }
        
        let html = `<h4 style="color: #4CAF50; margin-bottom: 15px;">✅ Wallet Found</h4>`;
        
        // Info de holder
        if (holder) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h5 style="color: #FFD700;">🪙 Token Holder:</h5>
                    <div class="wallet-stats">
                        <div class="stat-item">
                            <div class="stat-label">Balance</div>
                            <div class="stat-value">${(holder.balance / 1e6).toFixed(2)}M</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Percentage</div>
                            <div class="stat-value">${holder.percentage?.toFixed(2) || '0'}%</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Info de ganador
        if (winnerData) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h5 style="color: #FFD700;">🏆 Race Winner:</h5>
                    <div class="wallet-stats">
                        <div class="stat-item">
                            <div class="stat-label">Total Wins</div>
                            <div class="stat-value">${winnerData.totalWins}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Earnings</div>
                            <div class="stat-value">${winnerData.totalEarnings.toFixed(4)} SOL</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        results.innerHTML = html;
        
    } catch (error) {
        console.error('Error searching wallet:', error);
        results.innerHTML = `<h4 style="color: #FF6B6B;">Error</h4>`;
    }
}

// Actualizar UI
function updateUI() {
    updateRecentWinners();
    updateGlobalStats();
    updateHallOfFame();
}

// Actualizar tabla de GANADORES (NO holders)
function updateRecentWinners() {
    const container = document.getElementById('recentWinners');
    const winners = publicRaceData.races || [];
    
    if (winners.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <p style="color: #666;">No race winners yet</p>
                <p style="color: #999; font-size: 12px;">Waiting for races to complete...</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <table class="winners-table">
            <thead>
                <tr>
                    <th>Race</th>
                    <th>Winner</th>
                    <th>Horse</th>
                    <th>Prize</th>
                    <th>Time</th>
                    <th>Tx</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    winners.slice(0, 20).forEach((winner, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const walletUrl = `https://solscan.io/account/${winner.walletAddress}`;
        const txUrl = winner.paymentTxHash ? 
            `https://solscan.io/tx/${winner.paymentTxHash}` : '#';
        
        const shortWallet = winner.walletAddress ? 
            winner.walletAddress.substring(0, 6) + '...' + winner.walletAddress.substring(winner.walletAddress.length - 4) : 
            'Unknown';
        
        const timeAgo = winner.timestamp ? getTimeAgo(winner.timestamp) : 'Just now';
        
        html += `
            <tr>
                <td>${medal} #${winner.raceId || '-'}</td>
                <td>
                    <a href="${walletUrl}" target="_blank" class="wallet-link">
                        ${shortWallet}
                    </a>
                </td>
                <td>${winner.horseNumber || '-'}</td>
                <td style="color: #FFD700; font-weight: bold;">
                    ${winner.prizeAmount || '0.005'} SOL
                </td>
                <td style="color: #999; font-size: 12px;">${timeAgo}</td>
                <td>
                    ${winner.paymentTxHash ? 
                        `<a href="${txUrl}" target="_blank" class="tx-link" title="View payment">🔗</a>` :
                        '<span style="color: #666;">Pending</span>'
                    }
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Actualizar estadísticas globales
function updateGlobalStats() {
    const stats = publicRaceData.stats || {};
    const winners = publicRaceData.races || [];
    const holders = publicRaceData.holders || [];
    
    // Calcular estadísticas de ganadores
    const totalPrizes = winners.reduce((sum, w) => sum + (w.prizeAmount || 0.005), 0);
    const uniqueWinners = new Set(winners.map(w => w.walletAddress)).size;
    
    document.getElementById('totalRaces').textContent = winners.length;
    document.getElementById('totalPrizes').textContent = totalPrizes.toFixed(2);
    document.getElementById('uniqueWinners').textContent = uniqueWinners;
    document.getElementById('todayRaces').textContent = 
        winners.filter(w => {
            const today = new Date().toDateString();
            return new Date(w.timestamp).toDateString() === today;
        }).length;
    
    // Ticker
    const tickerPrizes = document.getElementById('ticker-total-prizes');
    const tickerRaces = document.getElementById('ticker-total-races');
    if (tickerPrizes) tickerPrizes.textContent = totalPrizes.toFixed(4);
    if (tickerRaces) tickerRaces.textContent = winners.length;
}

// Hall of Fame - TOP GANADORES (los que más premios han ganado)
function updateHallOfFame() {
    const container = document.getElementById('hallOfFame');
    const winners = publicRaceData.races || [];
    
    if (winners.length === 0) {
        container.innerHTML = '<div class="loading">No winners yet</div>';
        return;
    }
    
    // Agrupar ganadores por wallet y sumar premios
    const winnerStats = {};
    
    winners.forEach(winner => {
        if (winner.walletAddress && winner.paymentStatus === 'completed') {
            if (!winnerStats[winner.walletAddress]) {
                winnerStats[winner.walletAddress] = {
                    address: winner.walletAddress,
                    totalWins: 0,
                    totalEarnings: 0,
                    lastWin: winner.timestamp
                };
            }
            
            winnerStats[winner.walletAddress].totalWins += 1;
            winnerStats[winner.walletAddress].totalEarnings += (winner.prizeAmount || 0.005);
            
            // Actualizar última victoria si es más reciente
            if (new Date(winner.timestamp) > new Date(winnerStats[winner.walletAddress].lastWin)) {
                winnerStats[winner.walletAddress].lastWin = winner.timestamp;
            }
        }
    });
    
    // Convertir a array y ordenar por ganancias totales
    const topWinners = Object.values(winnerStats)
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, 10);
    
    if (topWinners.length === 0) {
        container.innerHTML = '<div class="loading">No completed races yet</div>';
        return;
    }
    
    let html = '<div class="hall-of-fame">';
    
    topWinners.forEach((winner, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '#' + (index + 1);
        const shortAddress = winner.address.substring(0, 8) + '...' + winner.address.substring(winner.address.length - 4);
        
        // Color basado en las ganancias
        let earningsColor = '#4CAF50';
        if (winner.totalEarnings >= 0.1) earningsColor = '#FFD700';
        if (winner.totalEarnings >= 0.5) earningsColor = '#FF6B6B';
        
        html += '<div class="fame-item" style="cursor: pointer;" onclick="searchSpecificWallet(\'' + winner.address + '\')">';
        html += '<span class="fame-rank">' + medal + '</span>';
        html += '<span class="fame-wallet" style="flex: 1;">' + shortAddress + '</span>';
        html += '<span style="display: flex; flex-direction: column; align-items: flex-end; font-size: 11px;">';
        html += '<span style="color: ' + earningsColor + '; font-weight: bold; font-size: 13px;">';
        html += winner.totalEarnings.toFixed(4) + ' SOL</span>';
        html += '<span style="color: #999;">' + winner.totalWins + ' win' + (winner.totalWins > 1 ? 's' : '') + '</span>';
        html += '</span></div>';
    });
    
    html += '</div>';
    
    // Agregar estadísticas totales al final
    const totalPrizesPaid = winners.reduce((sum, w) => 
        w.paymentStatus === 'completed' ? sum + (w.prizeAmount || 0.005) : sum, 0
    );
    const uniqueWinnersCount = Object.keys(winnerStats).length;
    
    html += '<div style="margin-top: 15px; padding: 10px; background: rgba(255,215,0,0.1); border-radius: 5px; text-align: center;">';
    html += '<div style="display: flex; justify-content: space-around; font-size: 11px;">';
    html += '<div><div style="color: #999;">Total Paid</div>';
    html += '<div style="color: #FFD700; font-weight: bold;">' + totalPrizesPaid.toFixed(3) + ' SOL</div></div>';
    html += '<div><div style="color: #999;">Unique Winners</div>';
    html += '<div style="color: #4CAF50; font-weight: bold;">' + uniqueWinnersCount + '</div></div>';
    html += '</div></div>';
    
    container.innerHTML = html;
}

// Función auxiliar para buscar una wallet específica cuando se hace click en el Hall of Fame
function searchSpecificWallet(address) {
    document.getElementById('searchInput').value = address;
    searchWallet();
}
    
    // Ordenar por balance
    const topHolders = holders
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10);
    
    let html = '<div class="hall-of-fame">';
    
    topHolders.forEach((holder, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        const balance = (holder.balance / 1e6).toFixed(1);
        
        html += `
            <div class="fame-item">
                <span class="fame-rank">${medal}</span>
                <span class="fame-wallet">
                    ${holder.address.substring(0, 8)}...${holder.address.substring(holder.address.length - 4)}
                </span>
                <span class="fame-wins">${balance}M tokens</span>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;


// Timer de próxima carrera
function updateNextRaceTimer() {
    const timer = document.getElementById('nextRaceTimer');
    if (!timer) return;
    
    // Calcular próxima carrera (cada 2 minutos)
    const now = Date.now();
    const nextRace = Math.ceil(now / 120000) * 120000;
    const timeToNext = Math.max(0, nextRace - now);
    
    const minutes = Math.floor(timeToNext / 60000);
    const seconds = Math.floor((timeToNext % 60000) / 1000);
    
    timer.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Utilidad para tiempo
function getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// Inicializar cuando cargue
window.addEventListener('load', init);