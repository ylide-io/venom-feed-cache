import dotenv from 'dotenv';
const env = dotenv.config().parsed || {};

import { startReader } from './reader';
import { AppDataSource } from './database';
import { startParser } from './parser';

async function run() {
	console.log('Start');
	const pool = await AppDataSource.initialize();
	console.log('Database connected');
	console.log('Venom feed started');
	const sharedData: { predefinedTexts: string[] } = { predefinedTexts: [] };
	const updateCache = await startReader(sharedData, Number(env.PORT), pool);
	await startParser(sharedData, updateCache);
}

run();
