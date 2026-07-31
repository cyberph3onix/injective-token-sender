/**
 * Smoke test for the read path in lib/injective.ts, runnable without a wallet.
 *
 * It hits the real testnet LCD and asserts that the three queries a transfer
 * depends on — balance, account number/sequence, latest block — all return
 * usable values. Run it with `npm run check` when a transfer misbehaves and you
 * need to know whether the problem is the chain or the browser.
 */

import {
  BaseAccount,
  ChainRestAuthApi,
  ChainRestBankApi,
  ChainRestTendermintApi,
} from '@injectivelabs/sdk-ts'
import { BigNumberInWei } from '@injectivelabs/utils'
import assert from 'node:assert/strict'

const REST = process.env.NEXT_PUBLIC_REST_ENDPOINT || 'https://testnet.sentry.lcd.injective.network'

// A funded testnet account, used here only as a read target. Pass your own
// address as an argument to check that one instead.
const ADDRESS = process.argv[2] || 'inj1qpqn0pdqxucax35ynz80ggsf98yw2xzkyujajd'

const balance = await new ChainRestBankApi(REST).fetchBalance(ADDRESS, 'inj')
const human = new BigNumberInWei(balance.amount || 0).toBase().toFixed()
assert.equal(balance.denom, 'inj')
console.log(`balance: ${human} INJ`)

const account = BaseAccount.fromRestApi(
  await new ChainRestAuthApi(REST).fetchAccount(ADDRESS),
).toAccountDetails()
assert.ok(Number.isFinite(account.accountNumber), 'accountNumber must be a number')
assert.ok(Number.isFinite(account.sequence), 'sequence must be a number')
console.log(`account: number=${account.accountNumber} sequence=${account.sequence}`)

const block = await new ChainRestTendermintApi(REST).fetchLatestBlock()
assert.ok(Number(block.header.height) > 0, 'block height must be positive')
console.log(`block:   ${block.header.height}`)

console.log('\nAll read-path checks passed.')
