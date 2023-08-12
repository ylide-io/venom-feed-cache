import { IMessage, IndexerHub, Uint256, asyncTimer } from '@ylide/sdk';
import { feeds, updatePosts } from '../local-db';
import { sendTGAlert } from '../utils/telegram';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { retry } from '../utils/retry';
import { processBlockchainPost } from './processBlockchainPost';
import { constructGenericFeedId } from '../utils/copy-to-delete';
import Redis from 'ioredis';

const processEvmPost = async (indexerHub: IndexerHub, redis: Redis, feed: FeedEntity, msg: IMessage) => {
	const start = Date.now();
	const content = await retry(() => indexerHub.requestContent(msg));
	const end = Date.now();
	if (end - start > 300) {
		console.log(`WARN: retrieving message content took ${end - start}ms: `, msg.msgId);
	}
	return await processBlockchainPost(redis, feed, msg, content);
};

const composedFeedCache: Record<string, Uint256> = {};

const idxRequest = async (url: string, body: any, timeout = 5000) => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), timeout);

	const response = await fetch(`https://idx3.ylide.io${url}`, {
		method: 'POST',
		body: JSON.stringify(body),
		headers: {
			'Content-Type': 'text/plain',
		},
		signal: controller.signal,
	});

	const responseBody = await response.json();

	if (responseBody.result) {
		return responseBody.data;
	} else {
		throw Error(responseBody.error || 'Response error');
	}
};

async function updateEvmFeed(indexerHub: IndexerHub, redis: Redis, feed: FeedEntity) {
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
						idxRequest(
							'/broadcasts',
							{
								feedId: composedFeedId,
								offset: 0,
								limit: 100,
							},
							5000,
						),
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
			await processEvmPost(indexerHub, redis, feed, msg);
			wasChanged = true;
			console.log(`Saved post #${i++}`);
			lastPost = msg;
		}
	}
}

export const startEvmParser = async (redis: Redis) => {
	const indexerHub = new IndexerHub();
	let consequentErrors = 0;

	const updateAllFeeds = async () => {
		try {
			const updatedFeeds = await Promise.all(feeds.map(feed => updateEvmFeed(indexerHub, redis, feed)));
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
