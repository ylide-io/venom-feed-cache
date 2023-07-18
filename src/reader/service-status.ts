import * as fs from 'fs';
import express from 'express';
import { validateAdmin } from '../middlewares/validate';

export const createServiceStatusRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	let status = fs.readFileSync('./status.txt', 'utf-8').trim();

	router.get('/ping', async (req, res) => {
		try {
			return res.end('PONG');
		} catch {
			return res.end('NO-PONG');
		}
	});

	router.get('/service-status', async (req, res) => {
		res.json({ status });
	});

	router.get('/stop-service', validateAdmin, async (req, res) => {
		status = 'STOPPED';
		fs.writeFileSync('./status.txt', status);
		res.sendStatus(201);
	});

	router.get('/start-service', validateAdmin, async (req, res) => {
		status = 'ACTIVE';
		fs.writeFileSync('./status.txt', status);
		res.sendStatus(201);
	});

	return { router };
};
