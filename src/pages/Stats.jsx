import React, { useEffect, useState } from 'react'
import { 
    Trophy, XCircle, TrendingUp, Target, AlertCircle, 
    RefreshCw, Layers, Clock, ArrowRight, ArrowLeft, History 
} from 'lucide-react'
import { ethers } from 'ethers'

export default function Stats({ readOnlyContract, account }) {
    // Stats State
    const [stats, setStats] = useState(null)
    const [tokenProfits, setTokenProfits] = useState([])
    
    // History State
    const [history, setHistory] = useState([])
    const [historyCount, setHistoryCount] = useState(0)
    const [page, setPage] = useState(0)
    const ROWS_PER_PAGE = 10
    
    const [loading, setLoading] = useState(false)
    const [historyLoading, setHistoryLoading] = useState(false)

    // Helpers
    const formatBalance = (balance, decimals = 18) => {
        if (!balance || typeof balance === 'undefined') return '0.000000'
        return ethers.formatUnits(balance, decimals)
    }

    const shortenAddress = (addr) => {
        if (!addr || addr === ethers.ZeroAddress) return 'House'
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const formatDate = (timestamp) => {
        if (!timestamp) return '-'
        return new Date(Number(timestamp) * 1000).toLocaleString()
    }

    const getChoiceName = (choiceIdx) => {
        const choices = ['?', 'Rock', 'Paper', 'Scissors']
        return choices[Number(choiceIdx)] || '?'
    }

    // Main Data Loader
    async function load() {
        if (!readOnlyContract || !account) return
        try {
            setLoading(true)

            // 1. Fetch Basic Stats
            const s = await readOnlyContract.getPlayerStats(account)
            const wins = Number(s._wins.toString())
            const losses = Number(s._losses.toString())
            const total = wins + losses
            const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0'

            setStats({
                wins: wins.toString(),
                losses: losses.toString(),
                profits: s._totalProfits.toString(),
                total: total.toString(),
                winRate,
            })

            // 2. Fetch Token Profits
            const [tokenAddresses, profitAmounts] = await readOnlyContract.getAllPlayerTokenProfits(account)
            const formattedTokenProfits = tokenAddresses
                .map((address, index) => ({
                    address,
                    symbol: `TKN-${address.slice(2, 6).toUpperCase()}`, // Simplified symbol logic
                    profit: profitAmounts[index].toString(),
                    decimals: 18
                }))
                .filter(p => p.profit !== '0');

            setTokenProfits(formattedTokenProfits);

            // 3. Trigger History Load
            await loadHistory(0)

        } catch (err) {
            console.error("Error loading stats:", err)
        } finally {
            setLoading(false)
        }
    }

    // Separate History Loader for Pagination
    async function loadHistory(pageIndex) {
        if (!readOnlyContract || !account) return
        try {
            setHistoryLoading(true)
            
            // Get total count first
            const count = await readOnlyContract.getPlayerHistoryCount(account)
            setHistoryCount(Number(count))

            // Calculate cursor
            // Note: Since blockchain arrays usually append to the end, 
            // the newest games are at the highest indices. 
            // To show newest first, we need to do some math or fetch and reverse.
            // For simplicity here, we fetch based on index. 
            // (Ideally, the contract would support fetching in reverse, but we'll fetch standard here).
            
            const cursor = pageIndex * ROWS_PER_PAGE
            const data = await readOnlyContract.getPlayerHistory(account, cursor, ROWS_PER_PAGE)
            
            // Format Data
            const formattedHistory = data.map(record => ({
                id: record.gameId.toString(),
                type: Number(record.gameType) === 0 ? 'Single' : 'Multi',
                opponent: record.opponent,
                playerChoice: record.playerChoice,
                opponentChoice: record.opponentChoice,
                bet: record.betAmount,
                token: record.token,
                result: Number(record.result), // 0=Draw, 1=Win, 2=Loss
                payout: record.payout,
                timestamp: record.timestamp
            }))

            // Reverse to show newest of this batch at top if desired, 
            // though with this pagination method (0-10), you are seeing the Oldest games first.
            // A common pattern without reverse-pagination support in contract is just displaying what we get.
            setHistory(formattedHistory)
            setPage(pageIndex)

        } catch (err) {
            console.error("Error loading history:", err)
        } finally {
            setHistoryLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [readOnlyContract, account])

    // --- Render ---

    if (!account) {
        return (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span>Connect your wallet to see your stats</span>
            </div>
        )
    }

    if (loading && !stats) {
        return <div className="text-center py-12 text-gray-500">Loading your stats...</div>
    }

    if (!stats) {
        return <div className="text-center py-12 text-gray-500">Failed to load stats. Please try again.</div>
    }

    const nativeProfitValue = parseFloat(formatBalance(stats.profits))
    const isNativeProfitable = nativeProfitValue > 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Your Statistics</h2>
                </div>
                <button
                    className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50 text-sm disabled:opacity-50"
                    onClick={load}
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2"><Target className="w-5 h-5 text-blue-600" /><div className="text-sm text-blue-600 font-medium">Total Games</div></div>
                    <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-green-600" /><div className="text-sm text-green-600 font-medium">Wins</div></div>
                    <div className="text-3xl font-bold text-green-700">{stats.wins}</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2"><XCircle className="w-5 h-5 text-red-600" /><div className="text-sm text-red-600 font-medium">Losses</div></div>
                    <div className="text-3xl font-bold text-red-700">{stats.losses}</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-purple-600" /><div className="text-sm text-purple-600 font-medium">Win Rate</div></div>
                    <div className="text-3xl font-bold text-purple-700">{stats.winRate}%</div>
                </div>
            </div>

            {/* Profits Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-lg border-2 ${
                    isNativeProfitable ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
                        : nativeProfitValue < 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                            : 'bg-gray-50 border-gray-300'
                }`}>
                    <div className="text-center">
                        <div className={`text-sm font-medium mb-2 ${
                            isNativeProfitable ? 'text-green-700' : nativeProfitValue < 0 ? 'text-red-700' : 'text-gray-700'
                        }`}>BNB (Native) Profit/Loss</div>
                        <div className={`text-4xl font-bold mb-2 ${
                            isNativeProfitable ? 'text-green-700' : nativeProfitValue < 0 ? 'text-red-700' : 'text-gray-700'
                        }`}>{nativeProfitValue > 0 ? '+' : ''}{nativeProfitValue.toFixed(6)}</div>
                        <div className="text-sm text-gray-600">
                            {isNativeProfitable ? '🎉 You\'re in profit!' : nativeProfitValue < 0 ? 'Keep playing to recover' : 'Break even'}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-gray-700"/> Token Profit/Loss
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {tokenProfits.length > 0 ? (
                            tokenProfits.map(token => {
                                const profit = parseFloat(formatBalance(token.profit, token.decimals))
                                const isProfitable = profit > 0
                                return (
                                    <div key={token.address} className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                                        <div>
                                            <div className="font-medium text-sm">{token.symbol}</div>
                                            <div className="text-xs text-gray-500 font-mono">{token.address.slice(0,10)}...</div>
                                        </div>
                                        <div className={`font-bold font-mono text-lg ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                                            {isProfitable ? '+' : ''}{profit.toFixed(4)}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center text-sm text-gray-500 py-4">No token game history found.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-600" /> Game History
                    </h3>
                    <div className="text-sm text-gray-500">
                        Total Games: {historyCount}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Opponent</th>
                                <th className="px-6 py-3">Moves</th>
                                <th className="px-6 py-3">Result</th>
                                <th className="px-6 py-3 text-right">Bet</th>
                                <th className="px-6 py-3 text-right">Payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {historyLoading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                        Loading history...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                        No games played yet.
                                    </td>
                                </tr>
                            ) : (
                                history.map((game, idx) => {
                                    const isWin = game.result === 1
                                    const isLoss = game.result === 2
                                    const isDraw = game.result === 0
                                    const currency = game.token === ethers.ZeroAddress ? "BNB" : "TKN"

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {formatDate(game.timestamp)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2 py-1 rounded-full border ${
                                                    game.type === 'Single' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-orange-50 text-orange-700 border-orange-100'
                                                }`}>
                                                    {game.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-gray-600">
                                                {shortenAddress(game.opponent)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{getChoiceName(game.playerChoice)}</span>
                                                    <span className="text-gray-400 text-xs">vs</span>
                                                    <span className="text-gray-600">{getChoiceName(game.opponentChoice)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-bold ${
                                                    isWin ? 'text-green-600' : isLoss ? 'text-red-600' : 'text-gray-500'
                                                }`}>
                                                    {isWin ? 'WIN' : isLoss ? 'LOSS' : 'DRAW'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                {formatBalance(game.bet)} {currency}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${
                                                isWin ? 'text-green-600' : 'text-gray-400'
                                            }`}>
                                                {parseFloat(formatBalance(game.payout)) > 0 ? '+' : ''}
                                                {formatBalance(game.payout)}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <button
                        onClick={() => loadHistory(page - 1)}
                        disabled={page === 0 || historyLoading}
                        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-xs text-gray-500">
                        Page {page + 1}
                    </span>
                    <button
                        onClick={() => loadHistory(page + 1)}
                        disabled={(page + 1) * ROWS_PER_PAGE >= historyCount || historyLoading}
                        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}