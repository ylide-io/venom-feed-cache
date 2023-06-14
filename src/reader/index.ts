import express from 'express';
import bodyParser from 'body-parser';
import { DataSource } from 'typeorm';
import cors from 'cors';
import { validateBanPost } from '../middlewares/validate';
import { postRepository } from '../database';

export async function startReader(port: number, db: DataSource) {
	const app = express();

	const whitelist = [];
	app.use(
		cors({
			credentials: true,
			origin: function (origin, callback) {
				if (true || whitelist.indexOf(origin) !== -1) {
					callback(null, true);
				} else {
					callback(new Error('Not allowed by CORS'));
				}
			},
		}),
	);

	app.use(bodyParser.text());
	app.use(bodyParser.json());

	app.get('/ping', async (req, res) => {
		try {
			return res.end('PONG');
		} catch {
			return res.end('NO-PONG');
		}
	});

	app.post('/ban-posts', validateBanPost, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		await postRepository.update(ids, { banned: true });
		res.sendStatus(201);
	});

	app.delete('/unban-posts', validateBanPost, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		await postRepository.update(ids, { banned: false });
		res.sendStatus(204);
	});

	app.listen(port, () => {
		console.log(`Reader is listening on ${port}`);
	});
}
