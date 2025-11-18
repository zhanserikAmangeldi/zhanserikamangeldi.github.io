import React, { useState } from 'react'
import { useWallet } from './hooks/useContract'
import WalletConnect from './components/WalletConnect'
import Home from './pages/Home'
import SinglePlayer from './pages/SinglePlayer'
import Multiplayer from './pages/Multiplayer'
import Room from './pages/Room'
import Stats from './pages/Stats'
import Admin from './pages/Admin'

export default function App() {
    const { account, contract, readOnlyContract, connect, readOnlyProvider } = useWallet()
    const [route, setRoute] = useState('home')
    const [currentGameId, setCurrentGameId] = useState(null)

    const goToGame = (gameId) => {
        setCurrentGameId(gameId)
        setRoute('room')
    }

    const goToRoute = (newRoute) => {
        setCurrentGameId(null)
        setRoute(newRoute)
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto p-6">
                <header className="bg-white shadow-sm rounded-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">RPS dApp</h1>
                            <p className="text-sm text-gray-500 mt-1">Rock Paper Scissors on BNB Blockchain</p>
                        </div>
                        <WalletConnect account={account} connect={connect} />
                    </div>

                    {route !== 'home' && (
                        <nav className="flex gap-2 mt-4 pt-4 border-t overflow-x-auto">
                            <button
                                onClick={() => goToRoute('home')}
                                className="px-3 py-1 text-sm rounded hover:bg-gray-100"
                            >
                                Home
                            </button>
                            <button
                                onClick={() => goToRoute('single')}
                                className={`px-3 py-1 text-sm rounded hover:bg-gray-100 ${route === 'single' ? 'bg-blue-100 text-blue-700' : ''}`}
                            >
                                Single Player
                            </button>
                            <button
                                onClick={() => goToRoute('multiplayer')}
                                className={`px-3 py-1 text-sm rounded hover:bg-gray-100 ${route === 'multiplayer' || route === 'room' ? 'bg-blue-100 text-blue-700' : ''}`}
                            >
                                Multiplayer
                            </button>
                            <button
                                onClick={() => goToRoute('stats')}
                                className={`px-3 py-1 text-sm rounded hover:bg-gray-100 ${route === 'stats' ? 'bg-blue-100 text-blue-700' : ''}`}
                            >
                                Stats
                            </button>
                            <button
                                onClick={() => goToRoute('admin')}
                                className={`px-3 py-1 text-sm rounded hover:bg-gray-100 ${route === 'admin' ? 'bg-blue-100 text-blue-700' : ''}`}
                            >
                                Admin
                            </button>
                        </nav>
                    )}
                </header>

                <main className="bg-white shadow-sm rounded-lg p-6">
                    {route === 'home' && <Home goTo={goToRoute} />}
                    {route === 'single' && (
                        <SinglePlayer
                            contract={contract}
                            readOnlyContract={readOnlyContract}
                            account={account}
                        />
                    )}
                    {route === 'multiplayer' && (
                        <Multiplayer
                            contract={contract}
                            readOnlyContract={readOnlyContract}
                            account={account}
                            onJoinGame={goToGame}
                        />
                    )}
                    {route === 'room' && currentGameId !== null && (
                        <Room
                            contract={contract}
                            readOnlyContract={readOnlyContract}
                            gameId={currentGameId}
                            account={account}
                            onBack={() => goToRoute('multiplayer')}
                        />
                    )}
                    {route === 'stats' && (
                        <Stats
                            contract={contract}
                            readOnlyContract={readOnlyContract}
                            account={account}
                        />
                    )}
                    {route === 'admin' && (
                        <Admin
                            contract={contract}
                            readOnlyContract={readOnlyContract}
                            account={account}
                            readOnlyProvider={readOnlyProvider}
                        />
                    )}
                </main>

                <footer className="mt-6 text-center text-xs text-gray-400">
                    <div>Contract: {contract?.target || 'Not connected'}</div>
                    <div className="mt-1">Built with React + ethers.js + Chainlink VRF</div>
                </footer>
            </div>
        </div>
    )
}