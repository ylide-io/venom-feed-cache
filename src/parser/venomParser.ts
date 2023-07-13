import { AbstractBlockchainController, BlockchainSourceType, IMessage, Uint256 } from '@ylide/sdk';
import { postRepository } from '../database';
import { sendTGAlert } from '../utils/telegram';
import { retry } from '../utils/retry';
import asyncTimer from '../utils/asyncTimer';
import { feeds } from '../local-db/feeds';
import { FeedEntity } from '../entities/Feed.entity';
import { updatePosts } from '../local-db';
import { EverscaleBlockchainController } from '@ylide/everscale';
import { processBlockchainPost } from './processBlockchainPost';

const processVenomPost = async (controller: AbstractBlockchainController, feed: FeedEntity, msg: IMessage) => {
	const start = Date.now();
	const content = await retry(() => controller.retrieveMessageContent(msg));
	const end = Date.now();
	if (end - start > 300) {
		console.log(`WARN: retrieving message content took ${end - start}ms: `, msg.msgId);
	}
	return await processBlockchainPost(feed, msg, content);
};

const composedFeedCache: Record<string, Uint256> = {};

async function updateVenomFeed(controller: EverscaleBlockchainController, feed: FeedEntity) {
	let lastPost: any = null;
	let i = 0;
	let wasChanged = false;

	const composedFeedId =
		composedFeedCache[feed.feedId] || (await controller.getComposedFeedId(feed.feedId as Uint256, 1));
	composedFeedCache[feed.feedId] = composedFeedId;

	while (true) {
		const startHistory = Date.now();
		const history = await retry(() =>
			controller.currentMailer.wrapper.retrieveHistoryDesc(
				controller.currentMailer.link,
				{
					feedId: composedFeedId,
					type: BlockchainSourceType.BROADCAST,
					sender: null,
				},
				lastPost,
				null,
				20,
			),
		);
		const endHistory = Date.now();
		if (endHistory - startHistory > 300) {
			console.log(`WARN: retrieving history took ${endHistory - startHistory}ms: `, lastPost === null);
		}

		if (history.length === 0) {
			return wasChanged ? feed : null;
		}

		for (const msg of history) {
			const exists = await postRepository.findOne({ where: { id: msg.msgId } });
			if (exists) {
				return wasChanged ? feed : null;
			}
			await processVenomPost(controller, feed, msg);
			wasChanged = true;
			console.log(`Saved post #${i++}`);
			lastPost = msg;
		}
	}
}

export const startVenomParser = async (controller: EverscaleBlockchainController) => {
	let consequentErrors = 0;

	const updateAllFeeds = async () => {
		try {
			const updatedFeeds = await Promise.all(feeds.map(feed => updateVenomFeed(controller, feed)));
			await Promise.all(updatedFeeds.map(async feed => feed && (await updatePosts(feed))));
			consequentErrors = 0;
			console.log(`[${new Date().toISOString()}] Feed updated`);
		} catch (e: any) {
			consequentErrors++;
			console.error(e);
			if (consequentErrors > 5) {
				sendTGAlert(`!!!!!! Venom feed error: ${e.message}`).catch(err => {
					console.error('TG error', err);
				});
			}
		}
	};

	await updateAllFeeds();
	asyncTimer(async () => {
		await updateAllFeeds();
	}, 5 * 1000);

	console.log('Venom parser started');
};
