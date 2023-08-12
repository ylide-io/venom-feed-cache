import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import 'newrelic';

import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

import { initTvmControllers } from './parser/initTvmControllers';

import { startReader } from './reader';
import { AppDataSource, createMessageBus } from './database';
import { startTvmParser } from './parser/tvmParser';
import { updateBannedAddresses, updateFeeds, updatePredefinedTexts } from './local-db';
import { sendTGAlert } from './utils/telegram';
import { startEvmParser } from './parser/evmParser';
import { prepopulateFeeds } from './utils/prepopulate';
import { EverscaleBlockchainController, TVMMailerContractType } from '@ylide/everscale';

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
				sendTGAlert(`BlockchainFeedIndexer: worker ${worker.process.pid} died`);
			});
		}
	} else {
		console.log('Starting without cluster in a local mode');
	}

	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');

	const { venomController, everscaleController } = await initTvmControllers();
	console.log('Everscale connected');

	await updatePredefinedTexts();
	await updateBannedAddresses();
	await updateFeeds();

	await prepopulateFeeds();

	console.log('Caches prepopulated');

	if (process.env.ENV === 'local' || !cluster.isPrimary) {
		await startReader(Number(env.PORT), pool);
	}
	if (env.READ_FEED === 'true' && (process.env.ENV === 'local' || cluster.isPrimary)) {
		const { redis } = await createMessageBus(env);
		const toCrawl: any[] = [];
		for (const broadcaster of venomController.broadcasters) {
			if (
				broadcaster.link.type === TVMMailerContractType.TVMMailerV7 ||
				broadcaster.link.type === TVMMailerContractType.TVMMailerV8
			) {
				if (broadcaster.link.type === TVMMailerContractType.TVMMailerV7 && broadcaster.link.id === 14) {
					// because I'm an idiot
					const replacement = venomController.mailers.find(x => x.link.id === 13)!;
					toCrawl.push({
						name: '[VNM] ' + replacement.link.address,
						controller: venomController,
						broadcaster: replacement,
					});
				} else {
					toCrawl.push({
						name: '[VNM] ' + broadcaster.link.address,
						controller: venomController,
						broadcaster: broadcaster,
					});
				}
			}
		}
		for (const broadcaster of everscaleController.broadcasters) {
			if (
				broadcaster.link.type === TVMMailerContractType.TVMMailerV7 ||
				broadcaster.link.type === TVMMailerContractType.TVMMailerV8
			) {
				toCrawl.push({
					name: '[EVR] ' + broadcaster.link.address,
					controller: venomController,
					broadcaster: broadcaster,
				});
			}
		}
		console.log(
			'To crawl: ',
			toCrawl.map(x => x.name),
		);
		for (const { name, controller, broadcaster } of toCrawl) {
			await startTvmParser(name, redis, controller, broadcaster);
		}
		await startEvmParser(redis);
	}
}

run();
