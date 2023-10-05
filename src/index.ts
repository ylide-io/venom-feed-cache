import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import 'newrelic';

import { AppDataSource, createMessageBus } from './database';
import { updateBannedAddresses, updateFeeds, updatePredefinedTexts } from './local-db';
import { startBlockchainFeedParser } from './parser/blockchainFeedParser';
import { startReader } from './reader';

async function run() {
	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');

	await updatePredefinedTexts();
	await updateBannedAddresses();
	await updateFeeds();

	console.log('Caches pre-populated');

	if (process.env.READER === 'true') {
		console.log('Starting reader...');
		await startReader(Number(env.PORT), pool);
	} else if (process.env.PARSER === 'true') {
		console.log('Starting parser...');
		const { redis } = await createMessageBus(env);
		await startBlockchainFeedParser(redis, env);
	}
}

run();
