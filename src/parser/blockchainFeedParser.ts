import { IMessage, IndexerHub, Uint256, asyncTimer } from '@ylide/sdk';
import Redis from 'ioredis';

import { feeds, updatePosts } from '../local-db';
import { sendTGAlert } from '../utils/telegram';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { retry } from '../utils/retry';
import { processBlockchainPost } from './processBlockchainPost';
import { constructGenericEvmFeedId, constructGenericTvmFeedId } from '../utils/copy-to-delete';

const processPost = async (indexerHub: IndexerHub, redis: Redis, feed: FeedEntity, msg: IMessage) => {
	const start = Date.now();
	const content = await retry(() => indexerHub.requestContent(msg));
	const end = Date.now();
	if (end - start > 300) {
		console.log(`WARN: retrieving message content took ${end - start}ms: `, msg.msgId);
	}
	return await processBlockchainPost(redis, feed, msg, content);
};

const idxRequest = async (url: string, body: any, timeout = 5000) => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), timeout);

	const response = await fetch(`http://67.207.78.205${url}`, {
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

async function updateFeed(indexerHub: IndexerHub, redis: Redis, feed: FeedEntity) {
	let lastPost: any = null;
	let i = 0;
	let wasChanged = false;

	const evmComposedFeedId = constructGenericEvmFeedId(feed.feedId as Uint256);
	const tvmComposedFeedId = constructGenericTvmFeedId(feed.feedId as Uint256, 1);

	while (true) {
		const startHistory = Date.now();
		const history = await retry(
			() =>
				indexerHub.retryingOperation(
					() =>
						idxRequest(
							'/broadcasts',
							{
								feedId: [evmComposedFeedId, tvmComposedFeedId],
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
			await processPost(indexerHub, redis, feed, msg);
			wasChanged = true;
			console.log(`Saved post #${i++}`);
			lastPost = msg;
		}
	}
}

export const startBlockchainFeedParser = async (redis: Redis) => {
	const indexerHub = new IndexerHub();
	let consequentErrors = 0;

	const updateAllFeeds = async () => {
		try {
			const updatedFeeds = await Promise.all(feeds.map(feed => updateFeed(indexerHub, redis, feed)));
			await Promise.all(updatedFeeds.map(async feed => feed && (await updatePosts(feed))));
			consequentErrors = 0;
			console.log(`[${new Date().toISOString()}] Feed updated`);
		} catch (e: any) {
			consequentErrors++;
			console.error(e);
			if (consequentErrors > 0) {
				sendTGAlert(`!!!!!! Blockchain feed error: ${e.message}`).catch(err => {
					console.error('TG error', err);
				});
			}
		}
	};

	await updateAllFeeds();
	asyncTimer(async () => {
		await updateAllFeeds();
	}, 5 * 1000);

	console.log('Blockchain feed parser started');
};
