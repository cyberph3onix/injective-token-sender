/**
 * The slice of the Keplr extension API this app actually uses.
 *
 * Keplr publishes full types in `@keplr-wallet/types`, but pulling in a package
 * for four method signatures is not worth it here.
 */
import type { SignDoc } from '@injectivelabs/sdk-ts'

interface KeplrSigner {
  signDirect(
    signerAddress: string,
    signDoc: SignDoc,
  ): Promise<{ signed: SignDoc; signature: { signature: string } }>
}

interface Keplr {
  enable(chainId: string): Promise<void>
  getKey(chainId: string): Promise<{ bech32Address: string; pubKey: Uint8Array }>
  getOfflineSigner(chainId: string): KeplrSigner
}

declare global {
  interface Window {
    keplr?: Keplr
  }
}

export {}
