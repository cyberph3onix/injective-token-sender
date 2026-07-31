'use client'

import { useState } from 'react'
import {
  CHAIN_ID,
  connectKeplr,
  fetchInjBalance,
  sendInj,
  type Account,
  type SendResult,
} from '@/lib/injective'

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null)
  const [balance, setBalance] = useState('0')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('0.01')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState('')

  /** Wraps an async action so every failure ends up in one place. */
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setBusy(false)
    }
  }

  const connect = () =>
    run(async () => {
      const connected = await connectKeplr()
      setAccount(connected)
      setBalance(await fetchInjBalance(connected.address))
    })

  const send = () =>
    run(async () => {
      if (!account) return
      setResult(null)
      setResult(await sendInj(account, recipient, amount))
      // The balance only changes once the transfer is confirmed.
      setBalance(await fetchInjBalance(account.address))
    })

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold">Injective Token Sender</h1>
        <p className="text-sm text-slate-400">
          Send INJ on <span className="font-mono">{CHAIN_ID}</span>
        </p>
      </header>

      {!account ? (
        <button
          onClick={connect}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect Keplr'}
        </button>
      ) : (
        <>
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Address</p>
            <p className="break-all font-mono text-sm">{account.address}</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Balance</p>
            <p className="text-xl font-semibold">{balance} INJ</p>
          </section>

          <section className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Recipient address
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="inj1…"
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Amount (INJ)
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500"
              />
            </label>

            <button
              onClick={send}
              disabled={busy || !recipient || !amount}
              className="rounded-lg bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send INJ'}
            </button>
          </section>
        </>
      )}

      {result && (
        <section className="rounded-lg border border-emerald-800 bg-emerald-950 p-4 text-sm">
          <p className="font-medium text-emerald-300">Transaction confirmed</p>
          <p className="mt-1 break-all font-mono text-xs text-emerald-200">
            {result.txHash}
          </p>
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block underline"
          >
            View on explorer →
          </a>
        </section>
      )}

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-300">
          {error}
        </p>
      )}
    </main>
  )
}
