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
	await startParser();
	await startReader(Number(env.PORT), pool);
}

run();
