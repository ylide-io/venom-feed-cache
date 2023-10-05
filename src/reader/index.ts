import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { DataSource } from 'typeorm';
import v8 from 'v8';
import { admins } from '../local-db';
import { predefinedTexts } from '../local-db/predefinedTexts';
import { createAdminRouter } from './admin';
import { createAuthRouter } from './auth';
import { createFeedsRouter } from './feeds';
import { createManagerRouter } from './manager';
import { createPostsRouter } from './posts';
import { createServiceStatusRouter } from './service-status';
import { createSubscriptionRoute } from './subscription';

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

	const { router: postsRouter } = await createPostsRouter();
	const { router: adminRouter } = await createAdminRouter();
	const { router: serviceStatusRouter } = await createServiceStatusRouter();
	const { router: feedsRouter } = await createFeedsRouter();
	const { router: authRouter } = await createAuthRouter();

	app.use('/', postsRouter);
	app.use('/', authRouter);
	app.use('/', adminRouter);
	app.use('/', serviceStatusRouter);
	app.use('/feeds', feedsRouter);
	app.use('/subscription', createSubscriptionRoute());
	app.use('/manager', createManagerRouter());

	app.get('/get-idea', async (req, res) => {
		try {
			const idx = Math.floor(Math.random() * predefinedTexts.length);
			return res.json(predefinedTexts[idx]);
		} catch {
			return res.end('No idea :(');
		}
	});

	app.get('/is-admin', async (req, res) => {
		try {
			const feedId = req.query.feedId as string;
			const address = req.query.address as string;
			if (admins[feedId]?.some(a => a.address === address)) {
				return res.json(true);
			}
			return res.json(false);
		} catch {
			return res.end('No idea :(');
		}
	});

	app.get('/admins', async (req, res) => {
		try {
			const feedId = req.query.feedId as string;
			return res.json(admins[feedId]?.map(a => a.address) || []);
		} catch {
			return res.end('No idea :(');
		}
	});

	app.get('/dump-heap', (req, res) => {
		try {
			v8.writeHeapSnapshot(`${Date.now()}.heapsnapshot`);
			return res.end('OK');
		} catch {
			return res.end('NO');
		}
	});

	app.listen(port, () => {
		console.log(`Reader is listening on ${port}`);
	});
}
