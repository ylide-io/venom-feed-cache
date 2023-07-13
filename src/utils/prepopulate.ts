import { Uint256 } from '@ylide/sdk';
import { feedRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { GLOBAL_VENOM_FEED_ID } from '../constants';

// GLOBAL_VENOM_FEED_ID,
// '1000000000000000000000000000000000000000000000000000000000000005' as Uint256,
// '1000000000000000000000000000000000000000000000000000000000000006' as Uint256,
// '1000000000000000000000000000000000000000000000000000000000000007' as Uint256,
// '1000000000000000000000000000000000000000000000000000000000000008' as Uint256,
// '1000000000000000000000000000000000000000000000000000000000000009' as Uint256,
// '100000000000000000000000000000000000000000000000000000000000000a' as Uint256,
// '100000000000000000000000000000000000000000000000000000000000000b' as Uint256,
// '100000000000000000000000000000000000000000000000000000000000000c' as Uint256,
// '100000000000000000000000000000000000000000000000000000000000000d' as Uint256,
// '100000000000000000000000000000000000000000000000000000000000000e' as Uint256,
// '100000000000000000000000000000000000000000000000000000000000000f' as Uint256,
// '1000000000000000000000000000000000000000000000000000000000000010' as Uint256,

export const prepopulateFeeds = async () => {
	const feeds = await feedRepository.find();
	if (feeds.length > 0) {
		return;
	}
	const data: { feedId: Uint256; title: string; description: string; logoUrl: string; parentFeedId?: string }[] = [
		{
			feedId: '1000000000000000000000000000000000000000000000000000000000000005' as Uint256,
			title: 'Nümi',
			description:
				'Nümi is the first anime metaverse on Venom blockchain that provides players with limitless possibilities to create their own gaming experience.',
			logoUrl: '<NumiSvg />',
		},
		{
			feedId: '1000000000000000000000000000000000000000000000000000000000000006' as Uint256,
			title: 'oasis.gallery',
			description: "Trade unique digital assets on Venom blockchain's NFT marketplace.",
			logoUrl: '<OasisGallerySvg />',
		},
		{
			feedId: '1000000000000000000000000000000000000000000000000000000000000007' as Uint256,
			title: 'Snipa',
			description: 'DeFi portfolio tracker designed for users to manage their assets.',
			logoUrl: '<SnipaSvg />',
		},
		{
			feedId: GLOBAL_VENOM_FEED_ID,
			title: 'Venom Blockchain',
			description:
				'Versatile and innovative blockchain that offers a range of use cases across various industries.',
			logoUrl: '<VenomBlockchainSvg />',
		},
		{
			feedId: '1000000000000000000000000000000000000000000000000000000000000009' as Uint256,
			title: 'Venom Bridge',
			description:
				'Explore the world of interchain transactions by effortlessly transferring tokens from one chain to the other.',
			logoUrl: '<VenomBridgeSvg />',
		},
		{
			feedId: '100000000000000000000000000000000000000000000000000000000000000a' as Uint256,
			title: 'VenomPad',
			description: 'First crowdfunding platform on Venom.',
			logoUrl: '<VenomPadSvg />',
		},
		{
			feedId: '100000000000000000000000000000000000000000000000000000000000000b' as Uint256,
			title: 'Venom Scan',
			description: 'Search and explore the immutable records of the Venom blockchain.',
			logoUrl: '<VenomScanSvg />',
		},
		{
			feedId: '100000000000000000000000000000000000000000000000000000000000000c' as Uint256,
			title: 'VenomStake',
			description: 'Secure solution for staking VENOM tokens, enabling users to maximize rewards.',
			logoUrl: '<VenomStakeSvg />',
		},
		{
			feedId: '100000000000000000000000000000000000000000000000000000000000000d' as Uint256,
			title: 'Venom Wallet',
			description: 'Non-custodial wallet with a Multisig accounts option and Ledger support.',
			logoUrl: '<VenomWalletSvg />',
		},
		{
			feedId: '100000000000000000000000000000000000000000000000000000000000000e' as Uint256,
			title: 'Web3.World',
			description: 'First DEX on Venom that enables seamless trading by pooling liquidity from investors.',
			logoUrl: '<Web3WorldSvg />',
		},
		{
			feedId: '100000000000000000000000000000000000000000000000000000000000000f' as Uint256,
			title: 'Ylide',
			description: 'Protocol for wallet-to-wallet communication with built-in payments.',
			logoUrl: '<YlideSvg />',
		},
		{
			feedId: '1000000000000000000000000000000000000000000000000000000000000010' as Uint256,
			title: 'Ventory',
			description:
				'Multichain NFT Marketplace exclusively for entertaining games & seamless experience, initially built on Venom network.',
			logoUrl: '<VentorySvg />',
		},

		{
			feedId: '2000000000000000000000000000000000000000000000000000000000000001' as Uint256,
			title: 'TVM 주요 업데이트',
			description: '베놈과 에버스케일을 포함한 TVM 블록체인의 주요 업데이트 내용을 공유하는 채널',
			logoUrl: '<YlideSvg />',
		},
	];
	for (const row of data) {
		const feed = new FeedEntity();
		feed.title = row.title;
		feed.description = row.description;
		feed.logoUrl = row.logoUrl;
		feed.feedId = row.feedId;
		feed.parentFeedId = row.parentFeedId || null;
		await feedRepository.save(feed);
	}
};
