import React from 'react'
import { Dice1, Users, BarChart3, Zap } from 'lucide-react'

export default function Home({ goTo }) {
    return (
        <div className="space-y-8">
            <div className="text-center py-8">
                <h2 className="text-4xl font-bold mb-3">Rock Paper Scissors</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <button
                    className="group p-6 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-all text-left"
                    onClick={() => goTo('single')}
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <Dice1 className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2 text-gray-900">Play vs House</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                Challenge the house with Chainlink VRF ensuring fair random result
                            </p>
                        </div>
                    </div>
                </button>

                <button
                    className="group p-6 border-2 border-purple-500 rounded-lg hover:bg-purple-50 transition-all text-left"
                    onClick={() => goTo('multiplayer')}
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                            <Users className="w-8 h-8 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2 text-gray-900">Multiplayer</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                Challenge other players in multiplayer games
                            </p>
                        </div>
                    </div>
                </button>
            </div>

            <button
                className="w-full group p-6 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-left"
                onClick={() => goTo('stats')}
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                        <BarChart3 className="w-8 h-8 text-gray-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2 text-gray-900">Your Statistics</h3>
                        <p className="text-sm text-gray-600">
                            Track your wins, losses, and total profits on-chain
                        </p>
                    </div>
                </div>
            </button>
        </div>
    )
}