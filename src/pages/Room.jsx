import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ArrowLeft, Loader2, AlertCircle, Trophy, Users, Clock } from 'lucide-react'

const CHOICES = ['Rock', 'Paper', 'Scissors']
const CHOICE_EMOJI = ['✊', '✋', '✌️']

export default function Room({ contract, readOnlyContract, gameId, account, onBack }) {
    const [game, setGame] = useState(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [selectedChoice, setSelectedChoice] = useState(null)
    const [error, setError] = useState(null)
    const [successMessage, setSuccessMessage] = useState(null)

    const pollingIntervalRef = useRef(null)
    const isMountedRef = useRef(true)
    const lastGameStateRef = useRef(null)

    const loadGame = useCallback(async () => {
        if (!readOnlyContract) return

        try {
            setLoading(true)
            setError(null)

            const g = await readOnlyContract.multiplayerGames(gameId)

            const gameData = {
                player1: g.player1,
                player2: g.player2,
                player1Choice: Number(g.player1Choice),
                player2Choice: Number(g.player2Choice),
                player1Committed: g.player1Committed,
                player2Committed: g.player2Committed,
                betAmount: g.betAmount.toString(),
                finished: g.finished,
                isTokenGame: g.isTokenGame,
                token: g.token
            }

            if (!isMountedRef.current) return

            const gameStateString = JSON.stringify(gameData)
            if (gameStateString !== lastGameStateRef.current) {
                lastGameStateRef.current = gameStateString
                setGame(gameData)

                if (account) {
                    const isPlayer1 = gameData.player1.toLowerCase() === account.toLowerCase()
                    const isPlayer2 = gameData.player2 && gameData.player2.toLowerCase() === account.toLowerCase()

                    if (isPlayer1 && gameData.player1Committed && gameData.player2Committed && !gameData.finished) {
                        setSuccessMessage('Both players committed! Waiting for result...')
                    } else if (isPlayer2 && gameData.player2Committed && gameData.player1Committed && !gameData.finished) {
                        setSuccessMessage('Both players committed! Waiting for result...')
                    }

                    if (gameData.finished && successMessage) {
                        setSuccessMessage(null)
                    }
                }
            }

        } catch (err) {
            console.error('Failed to load game:', err)
            if (isMountedRef.current) {
                setError('Failed to load game. Please refresh.')
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false)
            }
        }
    }, [readOnlyContract, gameId, account, successMessage])

    const makeMove = useCallback(async (choice) => {
        if (!contract || !account) {
            setError('Please connect your wallet')
            return
        }

        if (!game) {
            setError('Game not loaded')
            return
        }

        try {
            setSubmitting(true)
            setError(null)
            setSuccessMessage(null)

            const isPlayer1 = game.player1.toLowerCase() === account.toLowerCase()
            const isPlayer2 = game.player2 && game.player2.toLowerCase() === account.toLowerCase()

            if (!isPlayer1 && !isPlayer2) {
                throw new Error('You are not a player in this game')
            }

            if (game.finished) {
                throw new Error('Game has already finished')
            }

            if (isPlayer1 && game.player1Committed) {
                throw new Error('You have already made your move')
            }

            if (isPlayer2 && game.player2Committed) {
                throw new Error('You have already made your move')
            }

            console.log('Making move:', { gameId, choice })

            const tx = await contract.makeMove(gameId, choice)
            console.log('Transaction sent:', tx.hash)

            const receipt = await tx.wait()
            console.log('Transaction confirmed:', receipt.transactionHash)

            setSuccessMessage('Move submitted successfully! Waiting for opponent...')
            setSelectedChoice(null)

            await loadGame()

        } catch (err) {
            console.error('Failed to make move:', err)
            const errorMsg = err.reason || err.message || 'Unknown error'
            setError(`Failed to make move: ${errorMsg}`)
        } finally {
            setSubmitting(false)
        }
    }, [contract, account, game, gameId, loadGame])

    useEffect(() => {
        isMountedRef.current = true
        loadGame()

        return () => {
            isMountedRef.current = false
        }
    }, [loadGame])

    useEffect(() => {
        if (!readOnlyContract || !gameId) return

        pollingIntervalRef.current = setInterval(() => {
            loadGame()
        }, 5000)

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [readOnlyContract, gameId, loadGame])

    const formatAddress = (addr) => {
        if (!addr || addr === '0x0000000000000000000000000000000000000000') {
            return 'Waiting...'
        }
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const isPlayer1 = account && game && game.player1.toLowerCase() === account.toLowerCase()
    const isPlayer2 = account && game && game.player2 && game.player2.toLowerCase() === account.toLowerCase()

    const canMove = game && !game.finished && (
        (isPlayer1 && !game.player1Committed) ||
        (isPlayer2 && !game.player2Committed)
    )

    const waitingForOpponent = game && !game.finished && (
        (isPlayer1 && game.player1Committed && !game.player2Committed) ||
        (isPlayer2 && game.player2Committed && !game.player1Committed)
    )

    const getWinner = () => {
        if (!game || !game.finished) return null
        const p1 = game.player1Choice
        const p2 = game.player2Choice

        if (p1 === p2) return 'draw'
        if ((p1 === 1 && p2 === 3) || (p1 === 2 && p2 === 1) || (p1 === 3 && p2 === 2)) {
            return 'player1'
        }
        return 'player2'
    }

    const getResultMessage = () => {
        const winner = getWinner()
        if (winner === 'draw') return "It's a Draw! 🤝"
        if (winner === 'player1') {
            return isPlayer1 ? 'You Won! 🎉' : 'You Lost 😢'
        }
        if (winner === 'player2') {
            return isPlayer2 ? 'You Won! 🎉' : 'You Lost 😢'
        }
        return ''
    }

    const getResultColor = () => {
        const winner = getWinner()
        if (winner === 'draw') return 'bg-gray-50 border-gray-300'
        if (winner === 'player1') {
            return isPlayer1 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
        }
        if (winner === 'player2') {
            return isPlayer2 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
        }
        return 'bg-gray-50 border-gray-300'
    }

    if (loading && !game) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <div className="text-gray-500">Loading game...</div>
                </div>
            </div>
        )
    }

    if (!game) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <div className="text-gray-500 mb-4">Game not found</div>
                <button
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={onBack}
                >
                    Back to Lobby
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={onBack}
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold">Game #{gameId}</h2>
                    <p className="text-sm text-gray-600">
                        {game.finished ? 'Game Finished' : 'In Progress'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="font-medium text-red-800">Error</div>
                        <div className="text-sm text-red-700">{error}</div>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-600 hover:text-red-800"
                    >
                        ×
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                    <Trophy className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="font-medium text-green-800">{successMessage}</div>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="text-green-600 hover:text-green-800"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className={`p-6 border-2 rounded-lg transition-all ${
                    isPlayer1 ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white'
                }`}>
                    <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Player 1
                    </div>
                    <div className="font-medium mb-3 break-all">{formatAddress(game.player1)}</div>

                    {game.player1Committed ? (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-700 font-medium">Committed</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-yellow-700">Choosing...</span>
                        </div>
                    )}

                    {game.finished && game.player1Choice > 0 && (
                        <div className="mt-4 text-center">
                            <div className="text-5xl mb-2">{CHOICE_EMOJI[game.player1Choice - 1]}</div>
                            <div className="font-medium">{CHOICES[game.player1Choice - 1]}</div>
                        </div>
                    )}
                </div>

                <div className={`p-6 border-2 rounded-lg transition-all ${
                    isPlayer2 ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white'
                }`}>
                    <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Player 2
                    </div>
                    <div className="font-medium mb-3 break-all">{formatAddress(game.player2)}</div>

                    {game.player2 && game.player2 !== '0x0000000000000000000000000000000000000000' ? (
                        game.player2Committed ? (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm text-green-700 font-medium">Committed</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-yellow-700">Choosing...</span>
                            </div>
                        )
                    ) : (
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Waiting to join...
                        </div>
                    )}

                    {game.finished && game.player2Choice > 0 && (
                        <div className="mt-4 text-center">
                            <div className="text-5xl mb-2">{CHOICE_EMOJI[game.player2Choice - 1]}</div>
                            <div className="font-medium">{CHOICES[game.player2Choice - 1]}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Bet Amount</div>
                        <div className="text-2xl font-bold text-purple-700">
                            {(Number(game.betAmount) / 1e18).toFixed(4)} BNB
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Prize Pool</div>
                        <div className="text-2xl font-bold text-blue-700">
                            {(Number(game.betAmount) * 2 / 1e18).toFixed(4)} BNB
                        </div>
                    </div>
                </div>
            </div>

            {game.finished && (
                <div className={`p-6 border-2 rounded-lg ${getResultColor()}`}>
                    <div className="text-center">
                        <div className="text-4xl font-bold mb-4">
                            {getResultMessage()}
                        </div>
                        <div className="text-xl mb-6 flex items-center justify-center gap-4">
                            <div className="text-center">
                                <div className="text-5xl mb-2">{CHOICE_EMOJI[game.player1Choice - 1]}</div>
                                <div className="text-sm text-gray-600">Player 1</div>
                            </div>
                            <div className="text-3xl text-gray-400">VS</div>
                            <div className="text-center">
                                <div className="text-5xl mb-2">{CHOICE_EMOJI[game.player2Choice - 1]}</div>
                                <div className="text-sm text-gray-600">Player 2</div>
                            </div>
                        </div>
                        <button
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors shadow-lg"
                            onClick={onBack}
                        >
                            Back to Lobby
                        </button>
                    </div>
                </div>
            )}

            {!game.finished && game.player2 === '0x0000000000000000000000000000000000000000' && (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <Clock className="w-12 h-12 text-yellow-600 mx-auto mb-3 animate-pulse" />
                    <div className="text-yellow-800 font-medium mb-2">
                        Waiting for Player 2 to join...
                    </div>
                    <div className="text-sm text-yellow-700">
                        Share this game with others or wait for someone to join
                    </div>
                </div>
            )}

            {canMove && !game.finished && game.player2 !== '0x0000000000000000000000000000000000000000' && (
                <div className="space-y-4">
                    <div className="text-center">
                        <div className="text-xl font-bold mb-2">Make Your Move</div>
                        <div className="text-sm text-gray-600">Choose your weapon carefully!</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {CHOICES.map((choice, idx) => (
                            <button
                                key={idx}
                                className={`p-6 border-2 rounded-lg transition-all hover:scale-105 ${
                                    selectedChoice === idx + 1
                                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                                        : 'border-gray-300 hover:border-blue-300'
                                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => setSelectedChoice(idx + 1)}
                                disabled={submitting}
                            >
                                <div className="text-5xl mb-2">{CHOICE_EMOJI[idx]}</div>
                                <div className="font-medium text-lg">{choice}</div>
                            </button>
                        ))}
                    </div>

                    {selectedChoice !== null && (
                        <button
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-all shadow-lg"
                            onClick={() => makeMove(selectedChoice)}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Submitting...
                                </span>
                            ) : (
                                `Commit ${CHOICES[selectedChoice - 1]}`
                            )}
                        </button>
                    )}
                </div>
            )}

            {waitingForOpponent && (
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-3" />
                    <div className="text-blue-800 font-medium mb-2">
                        Waiting for opponent's move...
                    </div>
                    <div className="text-sm text-blue-600">
                        Your move has been committed. The game will automatically update.
                    </div>
                </div>
            )}
        </div>
    )
}