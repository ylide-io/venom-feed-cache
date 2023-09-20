import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import 'newrelic';

import { AppDataSource, createMessageBus } from './database';
import { updateBannedAddresses, updateFeeds, updatePredefinedTexts } from './local-db';
import { startBlockchainFeedParser } from './parser/blockchainFeedParser';
import { startReader } from './reader';
import { sendTGAlert } from './utils/telegram';

async function run() {
	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');

	await updatePredefinedTexts();
	await updateBannedAddresses();
	await updateFeeds();

	console.log('Caches pre-populated');

	process.on('SIGINT', async () => {
		sendTGAlert(
			`BlockchainFeed ${
				env.READER === 'true' ? 'reader' : process.env.PARSER === 'true' ? 'parser' : ''
			} process ${process.pid} is restarting...`,
		);
		if (pool.isInitialized) {
			await pool.destroy();
			process.exit(0);
		}
	});

	if (process.env.ENV === 'local' || process.env.READER === 'true') {
		console.log('Starting reader...');
		await startReader(Number(env.PORT), pool);
	}
	if (env.READ_FEED === 'true' && (process.env.ENV === 'local' || process.env.PARSER === 'true')) {
		console.log('Starting parser...');
		const { redis } = await createMessageBus(env);
		await startBlockchainFeedParser(redis);
	}
}

run();
