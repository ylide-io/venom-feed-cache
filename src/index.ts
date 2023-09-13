import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import 'newrelic';

import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

import { startReader } from './reader';
import { AppDataSource, createMessageBus } from './database';
import { updateBannedAddresses, updateFeeds, updatePredefinedTexts } from './local-db';
import { sendTGAlert } from './utils/telegram';
import { startBlockchainFeedParser } from './parser/blockchainFeedParser';
import { prepopulateFeeds } from './utils/prepopulate';

const numCPUs = availableParallelism();

async function run() {
	if (process.env.ENV !== 'local') {
		console.log('Starting cluster in a production mode');
		if (cluster.isPrimary) {
			console.log(`Primary ${process.pid} is running`);

			// Fork workers.
			for (let i = 0; i < numCPUs; i++) {
				cluster.fork();
			}

			cluster.on('exit', (worker, code, signal) => {
				console.log(`worker ${worker.process.pid} died`);
				sendTGAlert(`BlockchainFeedIndexer: worker ${worker.process.pid} died, restarting...`);
				cluster.fork();
			});
		}
	} else {
		console.log('Starting without cluster in a local mode');
	}

	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');

	await updatePredefinedTexts();
	await updateBannedAddresses();
	await updateFeeds();

	console.log('Caches prepopulated');

	if (process.env.ENV === 'local' || !cluster.isPrimary) {
		await startReader(Number(env.PORT), pool);
	}
	if (env.READ_FEED === 'true' && (process.env.ENV === 'local' || cluster.isPrimary)) {
		const { redis } = await createMessageBus(env);
		await startBlockchainFeedParser(redis);
	}
}

run();
