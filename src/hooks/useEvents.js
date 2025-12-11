import { useEffect, useState, useCallback, useRef } from 'react'

export function useEvents(readOnlyContract) {
    const [events, setEvents] = useState([])
    const lastBlockChecked = useRef(0)
    const pollingInterval = useRef(null)
    const isPolling = useRef(false)

    const pushEvent = useCallback((e) => {
        console.log('New event received:', e)
        setEvents((s) => {
            const isDuplicate = s.some(existing =>
                existing.type === e.type &&
                existing.timestamp === e.timestamp &&
                existing.player === e.player
            )
            if (isDuplicate) {
                return s
            }
            return [e, ...s].slice(0, 100)
        })
    }, [])

    const pollForEvents = useCallback(async () => {
        if (!readOnlyContract) {
            return
        }

        if (isPolling.current) {
            return
        }

        isPolling.current = true

        try {
            const provider = readOnlyContract.runner.provider

            if (provider.constructor.name === 'BrowserProvider' || provider.constructor.name === '_BrowserProvider') {
                isPolling.current = false
                return
            }

            const currentBlock = await provider.getBlockNumber()

            if (lastBlockChecked.current === 0) {
                lastBlockChecked.current = currentBlock
                isPolling.current = false
                return
            }

            if (currentBlock <= lastBlockChecked.current) {
                isPolling.current = false
                return
            }

            const fromBlock = lastBlockChecked.current + 1
            const blockRange = Math.min(currentBlock - fromBlock + 1, 5)
            const toBlock = fromBlock + blockRange - 1

            console.log(`Polling events [${fromBlock} → ${toBlock}]`)

            try {
                const singleResultFilter = readOnlyContract.filters.SingleGameResult()
                const singleResults = await readOnlyContract.queryFilter(singleResultFilter, fromBlock, toBlock)

                singleResults.forEach(event => {
                    pushEvent({
                        type: 'SingleGameResult',
                        player: event.args.player,
                        playerChoice: event.args.playerChoice.toString(),
                        houseChoice: event.args.houseChoice.toString(),
                        result: event.args.result.toString(),
                        payout: event.args.payout.toString(),
                        isTokenGame: event.args.isTokenGame,
                        token: event.args.token,
                        timestamp: Date.now(),
                        blockNumber: event.blockNumber
                    })
                })

                await new Promise(resolve => setTimeout(resolve, 100))

                const multiResultFilter = readOnlyContract.filters.MultiplayerGameResult()
                const multiResults = await readOnlyContract.queryFilter(multiResultFilter, fromBlock, toBlock)

                multiResults.forEach(event => {
                    pushEvent({
                        type: 'MultiplayerGameResult',
                        gameId: event.args.gameId.toString(),
                        winner: event.args.winner,
                        payout: event.args.payout.toString(),
                        isTokenGame: event.args.isTokenGame,
                        token: event.args.token,
                        timestamp: Date.now(),
                        blockNumber: event.blockNumber
                    })
                })

                lastBlockChecked.current = toBlock

            } catch (err) {
                console.error('Error polling events:', err)
            }

        } catch (err) {
            console.error('Error in pollForEvents:', err)
        } finally {
            isPolling.current = false
        }
    }, [readOnlyContract, pushEvent])

    useEffect(() => {
        if (!readOnlyContract) {
            return
        }

        console.log('Setting up event polling with provider:', readOnlyContract.runner.provider.constructor.name)

        pollingInterval.current = setInterval(pollForEvents, 200)

        setTimeout(pollForEvents, 20)

        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current)
            }
        }
    }, [readOnlyContract, pollForEvents])

    return { events }
}