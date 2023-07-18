import { IMessage, IndexerHub, Uint256, asyncTimer } from '@ylide/sdk';
import { feeds, updatePosts } from '../local-db';
import { sendTGAlert } from '../utils/telegram';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { retry } from '../utils/retry';
import { processBlockchainPost } from './processBlockchainPost';
import { constructGenericFeedId } from '../utils/copy-to-delete';

const processEvmPost = async (indexerHub: IndexerHub, feed: FeedEntity, msg: IMessage) => {
	const start = Date.now();
	const content = await retry(() => indexerHub.requestContent(msg));
	const end = Date.now();
	if (end - start > 300) {
		console.log(`WARN: retrieving message content took ${end - start}ms: `, msg.msgId);
	}
	return await processBlockchainPost(feed, msg, content);
};

const composedFeedCache: Record<string, Uint256> = {};

async function updateEvmFeed(indexerHub: IndexerHub, feed: FeedEntity) {
	let lastPost: any = null;
	let i = 0;
	let wasChanged = false;

	const composedFeedId = composedFeedCache[feed.feedId] || constructGenericFeedId(feed.feedId as Uint256);
	composedFeedCache[feed.feedId] = composedFeedId;

	while (true) {
		const startHistory = Date.now();
		const history = await retry(
			() =>
				indexerHub.retryingOperation(
					() =>
						indexerHub.request('/broadcasts', {
							feedId: composedFeedId,
							offset: 0,
							limit: 100,
						}),
					() => {
						throw new Error('No fallback for indexer request');
					},
				),
			3,
		);
		const endHistory = Date.now();
		if (endHistory - startHistory > 300) {
			console.log(
				`WARN: retrieving EVM history from indexer took ${endHistory - startHistory}ms: `,
				lastPost === null,
			);
		}

		if (history.length === 0) {
			return wasChanged ? feed : null;
		}

		for (const rawMsg of history) {
			const msg: IMessage = {
				...rawMsg,
				key: new Uint8Array(rawMsg.key),
			};
			const exists = await postRepository.findOne({ where: { id: msg.msgId } });
			if (exists) {
				return wasChanged ? feed : null;
			}
			await processEvmPost(indexerHub, feed, msg);
			wasChanged = true;
			console.log(`Saved post #${i++}`);
			lastPost = msg;
		}
	}
}

export const startEvmParser = async () => {
	const indexerHub = new IndexerHub();
	let consequentErrors = 0;

	const updateAllFeeds = async () => {
		try {
			const updatedFeeds = await Promise.all(feeds.map(feed => updateEvmFeed(indexerHub, feed)));
			await Promise.all(updatedFeeds.map(async feed => feed && (await updatePosts(feed))));
			consequentErrors = 0;
			console.log(`[${new Date().toISOString()}] EVM Feed updated`);
		} catch (e: any) {
			consequentErrors++;
			console.error(e);
			if (consequentErrors > 0) {
				sendTGAlert(`!!!!!! EVM feed error: ${e.message}`).catch(err => {
					console.error('TG error', err);
				});
			}
		}
	};

	await updateAllFeeds();
	asyncTimer(async () => {
		await updateAllFeeds();
	}, 5 * 1000);

	console.log('EVM parser started');
};