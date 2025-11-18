import React, {useEffect, useState} from 'react'
import {useEvents} from '../hooks/useEvents'
import {AlertCircle, Dice1} from 'lucide-react'

const CHOICES = ['Rock', 'Paper', 'Scissors']
const CHOICE_EMOJI = ['✊', '✋', '✌️']
const RESULTS = ['Draw', 'Won', 'Lost']

export default function SinglePlayer({contract, readOnlyContract, account}) {
    const [betAmount, setBetAmount] = useState('0')
    const [loading, setLoading] = useState(false)
    const [lastResult, setLastResult] = useState(null)
    const [selectedChoice, setSelectedChoice] = useState(null)
    const [recentGames, setRecentGames] = useState([])
    const [pendingTx, setPendingTx] = useState(null)
    const [waitingForBlock, setWaitingForBlock] = useState(null)

    const {events} = useEvents(readOnlyContract)

    async function fetchBet() {
        if (!readOnlyContract) return
        try {
            const b = await readOnlyContract.betAmount()
            setBetAmount(b.toString())
        } catch (err) {
            console.error(err)
        }
    }

    async function playChoice(choice) {
        if (!contract) return alert('Connect wallet first')
        if (!account) return alert('No account connected')

        try {
            setLoading(true)
            setLastResult(null)
            setPendingTx(null)
            setWaitingForBlock(null)

            console.log('🎮 Starting game with choice:', choice)

            const tx = await contract.playAgainstHouse(choice, {value: betAmount})
            const txHash = tx.hash
            setPendingTx(txHash)

            console.log('Transaction sent:', txHash)

            const receipt = await tx.wait()
            console.log('Transaction mined in block:', receipt.blockNumber)

            setWaitingForBlock(receipt.blockNumber)
        } catch (err) {
            console.error('❌ Transaction failed:', err)
            alert('Transaction failed: ' + (err.shortMessage || err.message || 'Unknown error'))
            setLoading(false)
            setPendingTx(null)
            setWaitingForBlock(null)
        }
    }

    useEffect(() => {
        fetchBet()
    }, [readOnlyContract])

    useEffect(() => {
        if (!events.length || !account || !loading) return

        console.log('📨 Checking events:', events.length)

        const myResults = events.filter(e =>
            e.type === 'SingleGameResult' &&
            e.player.toLowerCase() === account.toLowerCase()
        )

        if (myResults.length > 0) {
            const latest = myResults[0]

            if (waitingForBlock && latest.blockNumber >= waitingForBlock) {
                console.log('✅ Result found!', latest)

                setLastResult(latest)
                setLoading(false)
                setPendingTx(null)
                setWaitingForBlock(null)

                setRecentGames(prev => {
                    const newList = [latest, ...prev.filter(g => g.timestamp !== latest.timestamp)].slice(0, 5)
                    return newList
                })
            }
        }
    }, [events, account, loading, waitingForBlock])

    useEffect(() => {
        if (!loading) return

        const timeout = setTimeout(() => {
            console.log('⏰ Timeout reached (3 minutes)')
            setLoading(false)
            setPendingTx(null)
            setWaitingForBlock(null)
            alert('VRF callback is taking longer than expected. Please check BSCScan for the result.')
        }, 180000)

        return () => clearTimeout(timeout)
    }, [loading])

    const getResultColor = (result) => {
        const r = Number(result)
        if (r === 1) return 'text-green-600'
        if (r === 2) return 'text-red-600'
        return 'text-gray-600'
    }

    const getResultBg = (result) => {
        const r = Number(result)
        if (r === 1) return 'bg-green-50 border-green-200'
        if (r === 2) return 'bg-red-50 border-red-200'
        return 'bg-gray-50 border-gray-200'
    }

    if (!account) {
        return (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <AlertCircle className="w-5 h-5 text-yellow-600"/>
                <span>Connect your wallet to play against the house</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                    <Dice1 className="w-6 h-6"/>
                    Play vs House
                </h2>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <div className="text-sm text-gray-600 mb-1">Bet Amount</div>
                <div className="text-2xl font-bold text-blue-700">
                    {(Number(betAmount) / 1e18).toFixed(4)} BNB
                </div>
                <div className="text-sm text-gray-600 mt-1">
                    Win: {(Number(betAmount) * 2 / 1e18).toFixed(4)} BNB (2x)
                </div>
            </div>

            {loading && (
                <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                    <div className="flex items-center justify-center mb-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
                            <div
                                className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <div className="font-bold text-xl text-purple-800">
                            Waiting for VRF Result...
                        </div>
                        {pendingTx && (
                            <div className="pt-4 border-t border-purple-200 mt-4">
                                <div className="text-xs text-purple-600 mb-2">Transaction Hash:</div>
                                <div
                                    className="font-mono text-xs text-purple-800 break-all mb-2 bg-white bg-opacity-50 p-2 rounded">
                                    {pendingTx.slice(0, 20)}...{pendingTx.slice(-20)}
                                </div>

                                <a href={`https://testnet.bscscan.com/tx/${pendingTx}`}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="inline-block px-4 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                >
                                    View on BSCScan →
                                </a>
                            </div>
                        )}

                        {waitingForBlock && (
                            <div className="mt-3 p-2 bg-purple-100 rounded">
                                <div className="text-xs text-purple-700">
                                    Waiting for VRF callback from block {waitingForBlock}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <button
                            className="w-full py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm transition-colors"
                            onClick={() => {
                                setLoading(false)
                                setPendingTx(null)
                                setWaitingForBlock(null)
                            }}
                        >
                            Cancel (result will still be processed)
                        </button>
                    </div>
                </div>
            )}


            {!loading && lastResult && (
                <div className={`p-6 border-2 rounded-lg ${getResultBg(lastResult.result)}`}>
                    <div className="text-center mb-4">
                        <div className={`text-4xl font-bold mb-3 ${getResultColor(lastResult.result)}`}>
                            {RESULTS[Number(lastResult.result)]}!
                        </div>
                        <div className="text-xl mb-4">
                            <div className="flex items-center justify-center gap-4">
                                <div className="text-center">
                                    <div className="text-5xl mb-2">{CHOICE_EMOJI[lastResult.playerChoice - 1]}</div>
                                    <div className="text-sm text-gray-600">You</div>
                                    <div className="font-medium">{CHOICES[lastResult.playerChoice - 1]}</div>
                                </div>
                                <div className="text-3xl text-gray-400">VS</div>
                                <div className="text-center">
                                    <div className="text-5xl mb-2">{CHOICE_EMOJI[lastResult.houseChoice - 1]}</div>
                                    <div className="text-sm text-gray-600">House</div>
                                    <div className="font-medium">{CHOICES[lastResult.houseChoice - 1]}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-center pt-4 border-t">
                        <div className="text-sm text-gray-600 mb-1">Payout</div>
                        <div className="text-2xl font-bold">
                            {(Number(lastResult.payout) / 1e18).toFixed(4)} BNB
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <div className="text-center font-medium text-lg">Choose Your Move</div>
                <div className="grid grid-cols-3 gap-4">
                    {CHOICES.map((choice, idx) => (
                        <button
                            key={idx}
                            className={`p-6 border-2 rounded-lg transition-all ${
                                selectedChoice === idx + 1
                                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                                    : 'border-gray-300 hover:border-blue-300 hover:scale-105'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => setSelectedChoice(idx + 1)}
                            disabled={loading}
                        >
                            <div className="text-5xl mb-2">{CHOICE_EMOJI[idx]}</div>
                            <div className="font-medium text-lg">{choice}</div>
                        </button>
                    ))}
                </div>

                {selectedChoice !== null && (
                    <button
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 font-medium text-lg transition-all shadow-lg"
                        onClick={() => playChoice(selectedChoice)}
                        disabled={loading}
                    >
                        {loading ? 'Playing...' : `Play ${CHOICES[selectedChoice - 1]}`}
                    </button>
                )}
            </div>

            {recentGames.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Recent Games</h3>
                    <div className="space-y-2">
                        {recentGames.map((game, idx) => (
                            <div
                                key={idx}
                                className={`p-4 border rounded-lg flex justify-between items-center ${getResultBg(game.result)}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-3xl">
                                        {CHOICE_EMOJI[game.playerChoice - 1]}
                                    </div>
                                    <div>
                                        <div className="font-medium">{CHOICES[game.playerChoice - 1]}</div>
                                        <div className="text-sm text-gray-600">
                                            vs {CHOICES[game.houseChoice - 1]}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold text-lg ${getResultColor(game.result)}`}>
                                        {RESULTS[Number(game.result)]}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {(Number(game.payout) / 1e18).toFixed(4)} BNB
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}