import express from 'express';
import bodyParser from 'body-parser';
import { DataSource } from 'typeorm';
import cors from 'cors';
import { predefinedTexts } from '../local-db/predefinedTexts';
import { createPostsRouter } from './posts';
import { createAdminRouter } from './admin';
import { createServiceStatusRouter } from './service-status';
import { createFeedsRouter } from './feeds';

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

	app.use('/', postsRouter);
	app.use('/', adminRouter);
	app.use('/', serviceStatusRouter);
	app.use('/feeds', feedsRouter);

	app.get('/get-idea', async (req, res) => {
		try {
			const idx = Math.floor(Math.random() * predefinedTexts.length);
			return res.json(predefinedTexts[idx]);
		} catch {
			return res.end('No idea :(');
		}
	});

	app.listen(port, () => {
		console.log(`Reader is listening on ${port}`);
	});
}
