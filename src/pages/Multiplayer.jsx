import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AlertCircle, Users, Plus, RefreshCw, Trophy, Clock, Coins } from 'lucide-react'
import { ethers } from 'ethers'

export default function Multiplayer({ contract, readOnlyContract, account, onJoinGame }) {
    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [betAmount, setBetAmount] = useState('0')
    const [myActiveGames, setMyActiveGames] = useState([])
    const [error, setError] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createWithToken, setCreateWithToken] = useState(false)
    const [selectedToken, setSelectedToken] = useState(null)
    const [supportedTokens, setSupportedTokens] = useState([])
    const pollingIntervalRef = useRef(null)
    const isMountedRef = useRef(true)

    const loadBetAmount = useCallback(async () => {
        if (!readOnlyContract) return
        try {
            const b = await readOnlyContract.betAmount()
            if (isMountedRef.current) {
                setBetAmount(b.toString())
            }
        } catch (err) {
            console.error('Failed to load bet amount:', err)
        }
    }, [readOnlyContract])

    const loadSupportedTokens = useCallback(async () => {
        if (!readOnlyContract) return
        try {
            const tokenAddresses = await readOnlyContract.getSupportedTokens()

            const tokens = await Promise.all(
                tokenAddresses.map(async (address) => {
                    try {
                        const tokenBetAmount = await readOnlyContract.getTokenBetAmount(address)
                        return {
                            address,
                            betAmount: tokenBetAmount.toString(),
                            symbol: `${address.slice(0, 6)}...${address.slice(-4)}`
                        }
                    } catch (err) {
                        console.error(`Failed to load token ${address}:`, err)
                        return null
                    }
                })
            )

            if (isMountedRef.current) {
                setSupportedTokens(tokens.filter(t => t !== null))
            }
        } catch (err) {
            console.error('Failed to load supported tokens:', err)
        }
    }, [readOnlyContract])

    const loadLobby = useCallback(async () => {
        if (!readOnlyContract) return

        try {
            setLoading(true)
            setError(null)

            const total = await readOnlyContract.totalMultiplayerGames()
            const count = Number(total.toString())

            if (count === 0) {
                if (isMountedRef.current) {
                    setGames([])
                    setMyActiveGames([])
                    setLoading(false)
                }
                return
            }

            const arr = []
            const batchSize = 10

            for (let i = 0; i < count; i += batchSize) {
                const batch = []
                const end = Math.min(i + batchSize, count)

                for (let j = i; j < end; j++) {
                    batch.push(readOnlyContract.multiplayerGames(j))
                }

                const results = await Promise.all(batch)

                results.forEach((g, idx) => {
                    const gameId = i + idx
                    arr.push({
                        id: gameId,
                        player1: g.player1,
                        player2: g.player2,
                        player1Choice: g.player1Choice,
                        player2Choice: g.player2Choice,
                        player1Committed: g.player1Committed,
                        player2Committed: g.player2Committed,
                        betAmount: g.betAmount.toString(),
                        finished: g.finished,
                        isTokenGame: g.isTokenGame,
                        token: g.token
                    })
                })
            }

            if (!isMountedRef.current) return

            const myGames = account ? arr.filter(g =>
                g.player1.toLowerCase() === account.toLowerCase() ||
                g.player2.toLowerCase() === account.toLowerCase()
            ) : []

            setGames(arr.reverse().slice(0, 50))
            setMyActiveGames(myGames.filter(g => !g.finished))

        } catch (err) {
            console.error('Failed to load lobby:', err)
            if (isMountedRef.current) {
                setError('Failed to load games. Please try again.')
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false)
            }
        }
    }, [readOnlyContract, account])

    async function createGame() {
        if (!contract) {
            setError('Please connect your wallet first')
            return
        }
        if (!account) {
            setError('No account connected')
            return
        }

        try {
            setCreating(true)
            setError(null)

            if (createWithToken && selectedToken) {
                const tokenContract = new ethers.Contract(
                    selectedToken.address,
                    ['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
                    account
                )

                const tokenBalance = await tokenContract.balanceOf(account)
                if (BigInt(tokenBalance) < BigInt(selectedToken.betAmount)) {
                    throw new Error('Insufficient token balance to create game')
                }

                const approveTx = await tokenContract.approve(contract.target, selectedToken.betAmount)
                await approveTx.wait()

                const tx = await contract.createMultiplayerGameWithToken(selectedToken.address)
                await tx.wait()
            } else {
                const provider = contract.runner.provider
                const balance = await provider.getBalance(account)

                if (BigInt(balance) < BigInt(betAmount)) {
                    throw new Error('Insufficient balance to create game')
                }

                const tx = await contract.createMultiplayerGame({ value: betAmount })
                await tx.wait()
            }

            setShowCreateModal(false)
            await loadLobby()

        } catch (err) {
            console.error('Failed to create game:', err)
            const errorMsg = err.reason || err.message || 'Unknown error'
            setError(`Failed to create game: ${errorMsg}`)
        } finally {
            setCreating(false)
        }
    }

    async function joinGame(gameId) {
        if (!contract) {
            setError('Please connect your wallet first')
            return
        }
        if (!account) {
            setError('No account connected')
            return
        }

        try {
            setError(null)

            const game = await readOnlyContract.multiplayerGames(gameId)
            if (game.finished) {
                throw new Error('Game has already finished')
            }
            if (game.player2 !== '0x0000000000000000000000000000000000000000') {
                throw new Error('Game already has 2 players')
            }

            if (game.isTokenGame) {
                const tokenContract = new ethers.Contract(
                    game.token,
                    ['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
                    account
                )

                const tokenBalance = await tokenContract.balanceOf(account)
                if (BigInt(tokenBalance) < BigInt(game.betAmount)) {
                    throw new Error('Insufficient token balance to join game')
                }

                const approveTx = await tokenContract.approve(contract.target, game.betAmount)
                await approveTx.wait()

                const tx = await contract.joinMultiplayerGameWithToken(gameId)
                await tx.wait()
            } else {
                const provider = contract.runner.provider
                const balance = await provider.getBalance(account)

                if (BigInt(balance) < BigInt(game.betAmount)) {
                    throw new Error('Insufficient BNB balance to join game')
                }

                const tx = await contract.joinMultiplayerGame(gameId, { value: game.betAmount })
                await tx.wait()
            }

            await loadLobby()
            if (onJoinGame) onJoinGame(gameId)

        } catch (err) {
            console.error('Failed to join game:', err)
            const errorMsg = err.reason || err.message || 'Unknown error'
            setError(`Failed to join game: ${errorMsg}`)
        }
    }

    useEffect(() => {
        isMountedRef.current = true
        loadBetAmount()
        loadSupportedTokens()
        loadLobby()

        return () => {
            isMountedRef.current = false
        }
    }, [loadBetAmount, loadSupportedTokens, loadLobby])

    useEffect(() => {
        if (!account || !readOnlyContract) return

        pollingIntervalRef.current = setInterval(() => {
            loadLobby()
        }, 10000)

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [account, readOnlyContract, loadLobby])

    const formatAddress = (addr) => {
        if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'Waiting...'
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const formatToken = (game) => {
        if (!game.isTokenGame) return 'BNB'
        if (game.token === '0x0000000000000000000000000000000000000000') return 'BNB'
        return `${game.token.slice(0, 6)}...${game.token.slice(-4)}`
    }

    const getGameStatus = (game) => {
        if (game.finished) return '✅ Finished'
        if (!game.player2 || game.player2 === '0x0000000000000000000000000000000000000000') {
            return '⏳ Waiting for Player 2'
        }
        if (!game.player1Committed) return '🤔 Player 1 choosing...'
        if (!game.player2Committed) return '🤔 Player 2 choosing...'
        return '✅ Both committed'
    }

    const canJoin = (game) => {
        if (!account) return false
        if (game.finished) return false
        if (game.player2 && game.player2 !== '0x0000000000000000000000000000000000000000') return false
        if (game.player1.toLowerCase() === account.toLowerCase()) return false
        return true
    }

    const canPlay = (game) => {
        if (!account) return false
        if (game.finished) return false
        const isPlayer1 = game.player1.toLowerCase() === account.toLowerCase()
        const isPlayer2 = game.player2 && game.player2.toLowerCase() === account.toLowerCase()
        if (!isPlayer1 && !isPlayer2) return false
        if (isPlayer1 && game.player1Committed) return false
        if (isPlayer2 && game.player2Committed) return false
        return true
    }

    const isMyGame = (game) => {
        if (!account) return false
        return game.player1.toLowerCase() === account.toLowerCase() ||
            (game.player2 && game.player2.toLowerCase() === account.toLowerCase())
    }

    if (!account) {
        return (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-800">Connect your wallet to access multiplayer</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Multiplayer Lobby
                    </h2>
                </div>
                <button
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    onClick={loadLobby}
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-medium text-red-800">Error</div>
                        <div className="text-sm text-red-700">{error}</div>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-600 hover:text-red-800"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-medium text-gray-900">Create New Game</div>
                        <div className="text-sm text-gray-600 mt-1">
                            Choose BNB or Token payment
                        </div>
                    </div>
                    <button
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors shadow-lg"
                        onClick={() => setShowCreateModal(true)}
                        disabled={creating || loading}
                    >
                        <Plus className="w-5 h-5" />

                        Create Game
                    </button>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">Create New Game</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Payment Method
                                </label>
                                <div className="space-y-2">
                                    <button
                                        className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                            !createWithToken
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                        onClick={() => setCreateWithToken(false)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">BNB (Native)</div>
                                                <div className="text-sm text-gray-600">
                                                    {(Number(betAmount) / 1e18).toFixed(4)} BNB
                                                </div>
                                            </div>
                                            {!createWithToken && (
                                                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                                    <span className="text-white text-xs">✓</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>

                                    {supportedTokens.length > 0 && (
                                        <button
                                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                                createWithToken
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                            onClick={() => setCreateWithToken(true)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium">ERC-20 Token</div>
                                                    <div className="text-sm text-gray-600">
                                                        {supportedTokens.length} token{supportedTokens.length !== 1 ? 's' : ''} available
                                                    </div>
                                                </div>
                                                {createWithToken && (
                                                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs">✓</span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {createWithToken && supportedTokens.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Token
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {supportedTokens.map((token) => (
                                            <button
                                                key={token.address}
                                                className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                                    selectedToken?.address === token.address
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                                onClick={() => setSelectedToken(token)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-sm">{token.symbol}</div>
                                                        <div className="text-xs text-gray-500 font-mono">
                                                            {token.address}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-medium">
                                                            {(Number(token.betAmount) / 1e18).toFixed(4)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Bet Amount</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {createWithToken && selectedToken
                                        ? `${(Number(selectedToken.betAmount) / 1e18).toFixed(4)} ${selectedToken.symbol}`
                                        : `${(Number(betAmount) / 1e18).toFixed(4)} BNB`
                                    }
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    Winner takes: {createWithToken && selectedToken
                                    ? `${(Number(selectedToken.betAmount) * 2 / 1e18).toFixed(4)} ${selectedToken.symbol}`
                                    : `${(Number(betAmount) * 2 / 1e18).toFixed(4)} BNB`
                                }
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={creating}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                    onClick={createGame}
                                    disabled={creating || (createWithToken && !selectedToken)}
                                >
                                    {creating ? 'Creating...' : 'Create Game'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {myActiveGames.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-green-600" />
                        Your Active Games ({myActiveGames.length})
                    </h3>
                    <div className="space-y-2">
                        {myActiveGames.map(game => (
                            <div
                                key={game.id}
                                className="p-4 border-2 border-green-500 bg-green-50 rounded-lg hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">Game #{game.id}</div>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {formatAddress(game.player1)} vs {formatAddress(game.player2)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Coins className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm font-medium text-gray-700">
                                                {game.isTokenGame ? `Token: ${formatToken(game)}` : 'BNB'}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                • {(Number(game.betAmount) / 1e18).toFixed(4)}
                                            </span>
                                        </div>
                                        <div className="text-sm font-medium text-green-700 mt-1">
                                            {getGameStatus(game)}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {canPlay(game) && (
                                            <button
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                                                onClick={() => onJoinGame && onJoinGame(game.id)}
                                            >
                                                Make Your Move
                                            </button>
                                        )}
                                        {!canPlay(game) && (
                                            <button
                                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                                onClick={() => onJoinGame && onJoinGame(game.id)}
                                            >
                                                View Game
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    All Games ({games.length})
                </h3>

                {loading && games.length === 0 ? (
                    <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                        <div className="text-gray-500">Loading games...</div>
                    </div>
                ) : games.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <div className="font-medium">No games yet</div>
                        <div className="text-sm mt-1">Create the first one!</div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {games.map(game => {
                            const myGame = isMyGame(game)

                            return (
                                <div
                                    key={game.id}
                                    className={`p-4 border rounded-lg transition-all ${
                                        myGame
                                            ? 'bg-green-50 border-green-200 shadow-sm'
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                    } ${game.finished ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">Game #{game.id}</span>
                                                {myGame && <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">Your Game</span>}
                                                {game.finished && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Finished</span>}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1">
                                                {formatAddress(game.player1)} vs {formatAddress(game.player2)}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Coins className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-700">
                                                    {game.isTokenGame ? `Token: ${formatToken(game)}` : 'BNB'}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    • {(Number(game.betAmount) / 1e18).toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {getGameStatus(game)}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {canJoin(game) && (
                                                <button
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                                                    onClick={() => joinGame(game.id)}
                                                >
                                                    Join Game
                                                </button>
                                            )}
                                            {myGame && !game.finished && (
                                                <button
                                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                                    onClick={() => onJoinGame && onJoinGame(game.id)}
                                                >
                                                    Open
                                                </button>
                                            )}
                                            {game.finished && (
                                                <button
                                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                                    onClick={() => onJoinGame && onJoinGame(game.id)}
                                                >
                                                    View Result
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}