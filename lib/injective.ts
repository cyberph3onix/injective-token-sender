/**
 * Everything this app knows about Injective lives here.
 *
 * Only REST (LCD) endpoints are used, so there is no backend: the browser talks
 * to a public Injective node directly, and the wallet extension does the
 * signing. Nothing here ever sees a private key.
 */

import {
  BaseAccount,
  ChainRestAuthApi,
  ChainRestBankApi,
  ChainRestTendermintApi,
  MsgSend,
  TxRestApi,
  createTransaction,
  getTxRawFromTxRawOrDirectSignResponse,
  uint8ArrayToBase64,
} from '@injectivelabs/sdk-ts'
import { BigNumberInBase, BigNumberInWei, getStdFee } from '@injectivelabs/utils'

export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || 'injective-888'
export const REST_ENDPOINT =
  process.env.NEXT_PUBLIC_REST_ENDPOINT ||
  'https://testnet.sentry.lcd.injective.network'
export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  'https://testnet.explorer.injective.network'

/** Native INJ. 18 decimals, so 1 INJ = 10^18 "inj" on-chain. */
const INJ_DENOM = 'inj'

/** How many blocks into the future the transaction stays valid. */
const TIMEOUT_BLOCKS = 90

const authApi = new ChainRestAuthApi(REST_ENDPOINT)
const bankApi = new ChainRestBankApi(REST_ENDPOINT)
const tendermintApi = new ChainRestTendermintApi(REST_ENDPOINT)
const txApi = new TxRestApi(REST_ENDPOINT)

export interface Account {
  address: string
  /** secp256k1 public key, base64. The chain needs it to verify signatures. */
  pubKey: string
}

/**
 * Asks the Keplr extension for permission and returns the account.
 *
 * Nothing is sent anywhere — the extension simply hands the page a public
 * address after the user approves the popup.
 */
export async function connectKeplr(): Promise<Account> {
  const keplr = typeof window !== 'undefined' ? window.keplr : undefined

  if (!keplr) {
    throw new Error('Keplr is not installed. Get it at https://keplr.app/download')
  }

  await keplr.enable(CHAIN_ID)
  const key = await keplr.getKey(CHAIN_ID)

  return {
    address: key.bech32Address,
    pubKey: uint8ArrayToBase64(key.pubKey),
  }
}

/** Reads the INJ balance and returns it in human units, e.g. `"0.42"`. */
export async function fetchInjBalance(address: string): Promise<string> {
  const balance = await bankApi.fetchBalance(address, INJ_DENOM)

  return new BigNumberInWei(balance.amount || 0).toBase().toFixed()
}

export interface SendResult {
  txHash: string
  explorerUrl: string
}

/**
 * Builds, signs and broadcasts a `MsgSend` transferring INJ.
 *
 * The five steps below are the whole write path on any Cosmos chain:
 * prepare -> build -> sign (in the wallet) -> broadcast -> check the result.
 */
export async function sendInj(
  sender: Account,
  recipient: string,
  amount: string,
): Promise<SendResult> {
  const keplr = window.keplr
  if (!keplr) throw new Error('Keplr is not available.')

  // 1. Prepare. The account number and sequence are read fresh every time —
  //    a cached sequence is the usual cause of "account sequence mismatch".
  const accountDetails = await fetchAccountDetails(sender.address)
  const latestBlock = await tendermintApi.fetchLatestBlock()

  // 2. Build. Amounts go to the chain as integers in the smallest unit, so
  //    "0.01" INJ has to become "10000000000000000".
  const message = MsgSend.fromJSON({
    amount: {
      denom: INJ_DENOM,
      amount: new BigNumberInBase(amount).toWei().toFixed(0),
    },
    srcInjectiveAddress: sender.address,
    dstInjectiveAddress: recipient.trim(),
  })

  const { signDoc } = createTransaction({
    message,
    memo: 'sent via Injective Token Sender',
    fee: getStdFee({}),
    pubKey: sender.pubKey,
    sequence: accountDetails.sequence,
    accountNumber: accountDetails.accountNumber,
    chainId: CHAIN_ID,
    timeoutHeight: Number(latestBlock.header.height) + TIMEOUT_BLOCKS,
  })

  // 3. Sign. The popup appears here. We broadcast the document the *wallet*
  //    returns, not the one we sent, because wallets may adjust the fee.
  const signer = keplr.getOfflineSigner(CHAIN_ID)
  const signResponse = await signer.signDirect(sender.address, signDoc)
  const signedTx = getTxRawFromTxRawOrDirectSignResponse(
    signResponse as unknown as Parameters<
      typeof getTxRawFromTxRawOrDirectSignResponse
    >[0],
  )

  // 4. Broadcast.
  const response = await txApi.broadcast(signedTx)

  // 5. Confirm. Being included in a block is not the same as succeeding —
  //    a non-zero code means the chain executed the message and rejected it.
  if (response.code !== 0) {
    throw new Error(response.rawLog || `Transaction failed with code ${response.code}`)
  }

  return {
    txHash: response.txHash,
    explorerUrl: `${EXPLORER_URL}/transaction/${response.txHash}`,
  }
}

/**
 * Reads the sender's account number and sequence.
 *
 * An address that has never received funds does not exist on-chain yet and the
 * node answers 404, which is worth translating into something actionable.
 */
async function fetchAccountDetails(address: string) {
  try {
    const response = await authApi.fetchAccount(address)

    return BaseAccount.fromRestApi(response).toAccountDetails()
  } catch {
    throw new Error(
      'This account does not exist on-chain yet. Fund it from the testnet faucet first.',
    )
  }
}
