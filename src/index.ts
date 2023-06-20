import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import { startReader } from './reader';
import { AppDataSource } from './database';
import { getNotGoodWords, isGoodPost, startParser } from './parser';
import { DataSource, MoreThan } from 'typeorm';
import { VenomFeedPostEntity } from './entities/VenomFeedPost.entity';
import { asyncDelay } from '@ylide/sdk';

async function doGoodPosts(db: DataSource) {
	const rep = db.getRepository(VenomFeedPostEntity);
	let lastTimestmap = 0;
	while (true) {
		const post = await rep.findOne({
			where: {
				banned: false,
				isApproved: false,
				isPredefined: false,
				isAutobanned: false,
				createTimestamp: MoreThan(lastTimestmap),
			},
			order: {
				createTimestamp: 'ASC',
			},
		});
		if (!post) {
			return;
		}
		if (isGoodPost(post.contentText)) {
			post.isApproved = true;
			await rep.save(post);
			console.log('Good post found: ', post.contentText);
		} else {
			lastTimestmap = post.createTimestamp;
			console.log(
				'Bad post: ' + post.contentText,
				' bad words: ' +
					getNotGoodWords(post.contentText)
						.map(t => JSON.stringify(t))
						.join(', '),
			);
			await asyncDelay(1000);
		}
	}
}

async function run() {
	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');
	console.log('Venom feed started');
	const sharedData: { predefinedTexts: string[]; bannedAddresses: string[] } = {
		predefinedTexts: [],
		bannedAddresses: [],
	};
	// await doGoodPosts(pool);
	const updateCache = await startReader(sharedData, Number(env.PORT), pool);
	await startParser(sharedData, updateCache, env.READ_FEED === 'true');
}

run();
