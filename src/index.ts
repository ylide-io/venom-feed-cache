import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import 'newrelic';

import webpush from 'web-push';

import { AppDataSource, createMessageBus } from './database';
import { updateBannedAddresses, updateFeeds, updatePredefinedTexts } from './local-db';
import { startBlockchainFeedParser } from './parser/blockchainFeedParser';
import { startPusher } from './pusher';
import { startReader } from './reader';

async function run() {
	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');

	if (process.env.PUSHER === 'true') {
		console.log('Starting pusher...');
		const { redis } = await createMessageBus(env);
		webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
		await startPusher(redis, webpush.sendNotification);
	} else {
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
			await startBlockchainFeedParser(redis);
		}
	}
}

run();
