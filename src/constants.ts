import { Uint256 } from '@ylide/sdk';

export const IS_DEV = false;

export const GLOBAL_VENOM_FEED_ID = '0000000000026e4d30eccc3215dd8f3157d27e23acbdcfe68000000000000004' as Uint256;

export const DECIMALS: Record<string, number> = {
	'CRONOS': 18,
	'ETHEREUM': 18,
	'BNBCHAIN': 18,
	'ARBITRUM': 18,
	'AVALANCHE': 18,
	'OPTIMISM': 18,
	'POLYGON': 18,
	'FANTOM': 18,
	'KLAYTN': 18,
	'GNOSIS': 18,
	'AURORA': 18,
	'CELO': 18,
	'MOONBEAM': 18,
	'MOONRIVER': 18,
	'METIS': 18,
	'ASTAR': 18,
	'everscale': 0,
	'venom-testnet': 0,
};
