import React, { useEffect, useState } from 'react'
import { Trophy, XCircle, TrendingUp, Target, AlertCircle, RefreshCw, Layers } from 'lucide-react'
import { ethers } from 'ethers'

export default function Stats({ readOnlyContract, account }) {
    const [stats, setStats] = useState(null)
    const [tokenProfits, setTokenProfits] = useState([])
    const [loading, setLoading] = useState(false)

    const formatBalance = (balance, decimals = 18) => {
        if (!balance || typeof balance === 'undefined') return '0.000000'
        return ethers.formatUnits(balance, decimals)
    }

    async function load() {
        if (!readOnlyContract || !account) return
        try {
            setLoading(true)

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

            const [tokenAddresses, profitAmounts] = await readOnlyContract.getAllPlayerTokenProfits(account)

            const formattedTokenProfits = tokenAddresses
                .map((address, index) => ({
                    address,
                    symbol: `TOKEN-${address.slice(2, 8).toUpperCase()}`,
                    profit: profitAmounts[index].toString(),
                    decimals: 18
                }))
                .filter(p => p.profit !== '0');

            setTokenProfits(formattedTokenProfits);

        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [readOnlyContract, account])

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
        <div className="space-y-6">
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
                    <div className="space-y-2">
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

            {Number(stats.total) === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <div className="text-lg mb-2">No games played yet</div>
                    <div className="text-sm">Start playing to build your statistics!</div>
                </div>
            )}
        </div>
    )
}