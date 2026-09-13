import type { PropsWithChildren } from 'react';
import { createSolanaDevnet, createSolanaMainnet, MobileWalletProvider } from '@wallet-ui/react-native-kit';

const useMainnet = process.env.EXPO_PUBLIC_SOLANA_NETWORK === 'mainnet';
const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL;
const cluster = useMainnet
  ? createSolanaMainnet(rpcUrl ?? 'https://api.mainnet-beta.solana.com')
  : createSolanaDevnet(rpcUrl);
const identity = { name: 'BoundKey', uri: 'https://boundkey.app' };

export function AppProviders({ children }: PropsWithChildren) {
  return <MobileWalletProvider cluster={cluster} identity={identity}>{children}</MobileWalletProvider>;
}
