import { BlockchainSourceType, IMessage, Uint256 } from '@ylide/sdk';
import { postRepository } from '../database';
import { sendTGAlert } from '../utils/telegram';
import { retry } from '../utils/retry';
import asyncTimer from '../utils/asyncTimer';
import { feeds } from '../local-db/feeds';
import { FeedEntity } from '../entities/Feed.entity';
import { updatePosts } from '../local-db';
import type {
	EverscaleBlockchainController,
	EverscaleMailerV5Wrapper,
	EverscaleMailerV6Wrapper,
	EverscaleMailerV7Wrapper,
	ITVMMailerContractLink,
} from '@ylide/everscale';
import { processBlockchainPost } from './processBlockchainPost';
import { EverscaleMailerV8Wrapper } from '@ylide/everscale/lib/contract-wrappers/EverscaleMailerV8Wrapper';

const processTvmPost = async (
	name: string,
	controller: EverscaleBlockchainController,
	broadcaster: {
		link: ITVMMailerContractLink;
		wrapper:
			| EverscaleMailerV5Wrapper
			| EverscaleMailerV6Wrapper
			| EverscaleMailerV7Wrapper
			| EverscaleMailerV8Wrapper;
	},
	feed: FeedEntity,
	msg: IMessage,
) => {
	const start = Date.now();
	const content = await retry(() => broadcaster.wrapper.retrieveMessageContent(broadcaster.link, msg));
	const end = Date.now();
	if (end - start > 300) {
		console.log(`WARN: ${name} retrieving message content took ${end - start}ms: `, msg.msgId);
	}
	return await processBlockchainPost(feed, msg, content);
};

const composedFeedCache: Record<string, Uint256> = {};

async function updateTvmFeed(
	name: string,
	controller: EverscaleBlockchainController,
	broadcaster: {
		link: ITVMMailerContractLink;
		wrapper:
			| EverscaleMailerV5Wrapper
			| EverscaleMailerV6Wrapper
			| EverscaleMailerV7Wrapper
			| EverscaleMailerV8Wrapper;
	},
	feed: FeedEntity,
) {
	let lastPost: any = null;
	let i = 0;
	let wasChanged = false;

	const composedFeedId =
		composedFeedCache[feed.feedId] || (await controller.getComposedFeedId(feed.feedId as Uint256, 1));
	composedFeedCache[feed.feedId] = composedFeedId;

	while (true) {
		const startHistory = Date.now();
		const history = await retry(() =>
			broadcaster.wrapper.retrieveHistoryDesc(
				broadcaster.link,
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
			console.log(`WARN: ${name} retrieving history took ${endHistory - startHistory}ms: `, lastPost === null);
		}

		if (history.length === 0) {
			return wasChanged ? feed : null;
		}

		for (const msg of history) {
			const exists = await postRepository.findOne({ where: { id: msg.msgId } });
			if (exists) {
				return wasChanged ? feed : null;
			}
			await processTvmPost(name, controller, broadcaster, feed, msg);
			wasChanged = true;
			console.log(`${name} Saved post #${i++}`);
			lastPost = msg;
		}
	}
}

export const startTvmParser = async (
	name: string,
	controller: EverscaleBlockchainController,
	broadcaster: {
		link: ITVMMailerContractLink;
		wrapper:
			| EverscaleMailerV5Wrapper
			| EverscaleMailerV6Wrapper
			| EverscaleMailerV7Wrapper
			| EverscaleMailerV8Wrapper;
	},
) => {
	let consequentErrors = 0;

	const updateAllFeeds = async () => {
		try {
			const updatedFeeds = await Promise.all(
				feeds.map(feed => updateTvmFeed(name, controller, broadcaster, feed)),
			);
			await Promise.all(updatedFeeds.map(async feed => feed && (await updatePosts(feed))));
			consequentErrors = 0;
			console.log(`[${new Date().toISOString()}] Feed updated`);
		} catch (e: any) {
			consequentErrors++;
			console.error(e);
			if (consequentErrors > 5) {
				sendTGAlert(`!!!!!! Tvm feed error: ${name}, ${e.message}`).catch(err => {
					console.error('TG error', err);
				});
			}
		}
	};

	await updateAllFeeds();
	asyncTimer(async () => {
		await updateAllFeeds();
	}, 5 * 1000);

	console.log(`[${new Date().toISOString()}] TVM ${name} parser started`);
};
