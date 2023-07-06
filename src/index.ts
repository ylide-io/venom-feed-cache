import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import { startReader } from './reader';
import { AppDataSource } from './database';
import { getNotGoodWords, init, isGoodPost, startParser } from './parser';
import { DataSource, MoreThan } from 'typeorm';
import { VenomFeedPostEntity } from './entities/VenomFeedPost.entity';
import { Uint256 } from '@ylide/sdk';
import { GLOBAL_VENOM_FEED_ID } from './constants';

async function doGoodPosts(db: DataSource) {
	const rep = db.getRepository(VenomFeedPostEntity);
	let lastTimestmap = 0;
	let i = 0;
	let bad = 0;
	while (true) {
		const posts = await rep.find({
			where: {
				banned: false,
				isApproved: false,
				isPredefined: false,
				isAutobanned: false,
				createTimestamp: MoreThan(lastTimestmap),
				// sender: '0:444a4820e0638a6e647d83b03c1124271a3e3f1167ad0711c5caa2b40a99e785',
			},
			order: {
				createTimestamp: 'ASC',
			},
			take: 1000,
		});
		if (!posts.length) {
			console.log('Good posts in total: ' + i);
			console.log('Bad posts in total: ' + bad);
			return;
		}
		lastTimestmap = posts.at(-1)!.createTimestamp;
		for (const post of posts) {
			if (isGoodPost(post.contentText)) {
				i++;
				post.isApproved = true;
				await rep.save(post);
				console.log('Good post found: ', post.contentText);
			} else {
				bad++;
				console.log(
					'Bad post: ' + post.contentText,
					' bad words: ' +
						getNotGoodWords(post.contentText)
							.map(t => JSON.stringify(t))
							.join(', '),
				);
				// await asyncDelay(1000);
			}
		}
		// return;
	}
}

async function run() {
	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');
	console.log('Venom feed started');

	const sharedData: { predefinedTexts: string[]; bannedAddresses: string[]; prebuiltFeedIds: Uint256[] } = {
		predefinedTexts: [],
		bannedAddresses: [],
		prebuiltFeedIds: [
			GLOBAL_VENOM_FEED_ID,
			'1000000000000000000000000000000000000000000000000000000000000005' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000006' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000007' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000008' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000009' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000010' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000011' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000012' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000013' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000014' as Uint256,
			'1000000000000000000000000000000000000000000000000000000000000015' as Uint256,
		] as Uint256[],
	};
	// await doGoodPosts(pool);
	const { controller } = await init();
	const updateCache = await startReader(sharedData, Number(env.PORT), pool);
	await startParser(controller, sharedData, updateCache, env.READ_FEED === 'true');
}

run();
