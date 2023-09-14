import { IMessage, IndexerHub, Uint256, asyncTimer } from '@ylide/sdk';
import Redis from 'ioredis';

import { feeds, updatePosts } from '../local-db';
import { sendTGAlert } from '../utils/telegram';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { retry } from '../utils/retry';
import { processBlockchainPost } from './processBlockchainPost';
import { constructGenericEvmFeedId, constructGenericTvmFeedId } from '../utils/copy-to-delete';

const processPost = async (indexerHub: IndexerHub, redis: Redis, msg: IMessage) => {
	const start = Date.now();
	const content = await retry(() => indexerHub.requestContent(msg));
	const end = Date.now();
	if (end - start > 300) {
		console.log(`WARN: retrieving message content took ${end - start}ms: `, msg.msgId);
	}
	return await processBlockchainPost(redis, msg, content);
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

async function updateFeed(indexerHub: IndexerHub, redis: Redis) {
	let lastPost: any = null;
	let i = 0;
	const changedFeeds = new Set<string>();
	let totalNewPosts = 0;

	while (true) {
		const startHistory = Date.now();
		const history = await retry(
			() =>
				indexerHub.retryingOperation(
					() =>
						idxRequest(
							'/broadcasts',
							{
								feedId: [],
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
				`WARN: retrieving blockchain feed history from indexer took ${endHistory - startHistory}ms: `,
				lastPost === null,
			);
		}

		if (history.length === 0) {
			return { changedFeeds, totalNewPosts };
		}

		for (const rawMsg of history) {
			const msg: IMessage = {
				...rawMsg,
				key: new Uint8Array(rawMsg.key),
			};
			const exists = await postRepository.findOne({ where: { id: msg.msgId } });
			if (exists) {
				return { changedFeeds, totalNewPosts };
			}
			const { post, feed } = await processPost(indexerHub, redis, msg);
			if (feed) {
				changedFeeds.add(feed.feedId);
			}
			console.log(`Saved post #${i++}`);
			totalNewPosts++;
			lastPost = msg;
		}
	}
}

export const startBlockchainFeedParser = async (redis: Redis) => {
	const indexerHub = new IndexerHub();
	let consequentErrors = 0;

	const updateAllFeeds = async () => {
		try {
			const { changedFeeds, totalNewPosts } = await updateFeed(indexerHub, redis);
			await Promise.all([...changedFeeds.values()].map(async feedId => await updatePosts(feedId)));
			consequentErrors = 0;
			console.log(`[${new Date().toISOString()}] Feed updated: ${totalNewPosts} new posts`);
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

	const recoverPostFeedIds = async () => {
		await postRepository.query(`
			UPDATE
				venom_feed_post_entity
			SET
				"feedId" = (
					SELECT
						f."feedId"
					FROM
						feed_entity as f
					WHERE
							(f."evmFeedId" = "originalFeedId")
						OR
							(f."tvmFeedId" = "originalFeedId")
				)
			WHERE
					"feedId" is null
				and
					exists(
						SELECT
							f."feedId"
						FROM
							feed_entity as f
						WHERE
								(f."evmFeedId" = "originalFeedId")
							OR
								(f."tvmFeedId" = "originalFeedId")
					)
		`);
	};

	await updateAllFeeds();

	asyncTimer(updateAllFeeds, 2 * 1000);
	asyncTimer(recoverPostFeedIds, 60 * 1000);

	console.log('Blockchain feed parser started');
};
