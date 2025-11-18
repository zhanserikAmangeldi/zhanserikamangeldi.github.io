import React, { useEffect, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { AlertCircle, Download, RefreshCw, BarChart, DollarSign } from 'lucide-react'

export default function Admin({ contract, readOnlyContract, account, readOnlyProvider }) {
    const [isOwner, setIsOwner] = useState(false)
    const [contractOwner, setContractOwner] = useState(null)
    const [nativeBalance, setNativeBalance] = useState('0')
    const [tokenBalances, setTokenBalances] = useState([])
    const [loading, setLoading] = useState(true)
    const [withdrawAmounts, setWithdrawAmounts] = useState({})
    const [txStatus, setTxStatus] = useState({ message: '', type: '' })

    const formatBalance = (balance, decimals = 18) => {
        if (!balance || isNaN(balance)) return '0.0000'
        return ethers.formatUnits(balance, decimals)
    }

    const checkOwner = useCallback(async () => {
        if (!readOnlyContract || !account) return
        try {
            const ownerAddress = await readOnlyContract.owner()
            setContractOwner(ownerAddress)
            if (account && ownerAddress) {
                setIsOwner(ethers.getAddress(account) === ethers.getAddress(ownerAddress))
            }
        } catch (err) {
            console.error('Failed to check owner:', err)
        }
    }, [readOnlyContract, account])

    const loadBalances = useCallback(async () => {
        if (!readOnlyContract || !readOnlyProvider) return
        setLoading(true)
        setTxStatus({ message: '', type: '' })
        try {
            const balance = await readOnlyProvider.getBalance(await readOnlyContract.getAddress())
            setNativeBalance(balance.toString())

            const supportedTokens = await readOnlyContract.getSupportedTokens()

            const tokenData = await Promise.all(
                supportedTokens.map(async (tokenAddress) => {
                    try {
                        const balance = await readOnlyContract.getContractTokenBalance(tokenAddress)
                        return {
                            address: tokenAddress,
                            symbol: `TOKEN-${tokenAddress.slice(2, 8).toUpperCase()}`,
                            balance: balance.toString(),
                            decimals: 18,
                        }
                    } catch (err) {
                        console.error(`Failed to get balance for ${tokenAddress}`, err)
                        return null
                    }
                })
            )
            setTokenBalances(tokenData.filter((t) => t !== null))
        } catch (err) {
            console.error('Failed to load balances:', err)
            setTxStatus({ message: 'Failed to load contract balances.', type: 'error' })
        } finally {
            setLoading(false)
        }
    }, [readOnlyContract, readOnlyProvider])

    useEffect(() => {
        checkOwner()
        loadBalances()
    }, [checkOwner, loadBalances])

    const handleAmountChange = (key, value) => {
        setWithdrawAmounts((prev) => ({ ...prev, [key]: value }))
    }

    const handleWithdraw = async (tokenAddress = null) => {
        if (!contract) return

        const isNative = tokenAddress === null
        const amountKey = isNative ? 'native' : tokenAddress
        const amountString = withdrawAmounts[amountKey]

        if (!amountString || isNaN(amountString) || parseFloat(amountString) <= 0) {
            setTxStatus({ message: 'Please enter a valid amount.', type: 'error' })
            return
        }

        try {
            const amount = ethers.parseEther(amountString)
            setTxStatus({ message: 'Processing withdrawal transaction...', type: 'info' })

            const tx = isNative
                ? await contract.withdrawFunds(amount)
                : await contract.withdrawTokens(tokenAddress, amount)

            await tx.wait()

            setTxStatus({ message: 'Withdrawal successful!', type: 'success' })
            loadBalances()
            handleAmountChange(amountKey, '')
        } catch (err) {
            console.error('Withdrawal failed:', err)
            setTxStatus({ message: err.reason || 'Withdrawal transaction failed.', type: 'error' })
        }
    }

    if (!account) {
        return (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span>Connect your wallet to access the Admin Panel.</span>
            </div>
        )
    }

    if (!isOwner) {
        return (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                    <span>You are not authorized to view this page.</span>
                    <p className="text-xs text-gray-600 mt-1">
                        Connected: {account} <br/>
                        Owner: {contractOwner || 'Loading...'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">House Administration</h2>
                </div>
                <button
                    onClick={loadBalances}
                    className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50 text-sm disabled:opacity-50"
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Balances
                </button>
            </div>

            {txStatus.message && (
                <div
                    className={`p-3 rounded text-sm ${
                        txStatus.type === 'success' ? 'bg-green-100 text-green-800'
                            : txStatus.type === 'error' ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                    }`}
                >
                    {txStatus.message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                    <div className="font-semibold text-lg flex items-center gap-2">
                        Native Currency (BNB)
                    </div>
                    <div className="bg-white p-3 rounded-md shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Contract Balance</div>
                        <div className="text-2xl font-mono font-bold">
                            {parseFloat(formatBalance(nativeBalance)).toFixed(6)}
                        </div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <label className="text-xs text-gray-600">Amount to Withdraw</label>
                            <input
                                type="text"
                                placeholder="e.g., 0.1"
                                value={withdrawAmounts['native'] || ''}
                                onChange={(e) => handleAmountChange('native', e.target.value)}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>
                        <button
                            onClick={() => handleWithdraw(null)}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                            <Download className="w-4 h-4"/> Withdraw
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                    <div className="font-semibold text-lg flex items-center gap-2">
                        Supported Tokens
                    </div>
                    {tokenBalances.length > 0 ? (
                        tokenBalances.map(token => (
                            <div key={token.address} className="bg-white p-3 rounded-md shadow-sm space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold">{token.symbol}</div>
                                        <div className="text-xs text-gray-500 font-mono">{token.address}</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-mono font-bold text-right">
                                            {parseFloat(formatBalance(token.balance, token.decimals)).toFixed(4)}
                                        </div>
                                        <div className="text-xs text-gray-500 text-right">Balance</div>
                                    </div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex-grow">
                                        <input
                                            type="text"
                                            placeholder={`Amount of ${token.symbol}`}
                                            value={withdrawAmounts[token.address] || ''}
                                            onChange={(e) => handleAmountChange(token.address, e.target.value)}
                                            className="w-full p-2 border rounded text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleWithdraw(token.address)}
                                        className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2 text-sm"
                                    >
                                        <Download className="w-4 h-4"/> Withdraw
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">No supported tokens found.</div>
                    )}
                </div>
            </div>
        </div>
    )
}