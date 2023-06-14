import express from 'express';
import bodyParser from 'body-parser';
import { DataSource } from 'typeorm';
import cors from 'cors';
import { validateBanPost, validatePostsStatus } from '../middlewares/validate';
import { postRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';

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

	let last200Posts: VenomFeedPostEntity[] = [];

	async function updateCache() {
		const posts = await postRepository.find({
			where: { banned: false },
			order: { createTimestamp: 'DESC' },
			take: 200,
		});
		last200Posts = posts;
	}

	await updateCache();

	setInterval(updateCache, 5 * 1000);

	app.get('/posts', async (req, res) => {
		try {
			const { limit: limitRaw, offset: offsetRaw, withBanned: withBannedRaw } = req.query;
			const limit = isNaN(Number(limitRaw)) ? 10 : Math.max(50, Math.min(50, Number(limitRaw)));
			const offset = isNaN(Number(offsetRaw)) ? 0 : Math.max(0, Number(offsetRaw));
			const withBanned = withBannedRaw === 'true';
			if (!withBanned && limit <= 200 && offset + limit <= 200) {
				return res.json(last200Posts.slice(offset, offset + limit));
			}
			const posts = await postRepository.find({
				where: withBanned ? {} : { banned: false },
				order: { createTimestamp: 'DESC' },
				take: limit,
				skip: offset,
			});
			res.json(posts);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	app.get('/posts-status', validatePostsStatus, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		const result = await postRepository
			.createQueryBuilder()
			.select('id')
			.where(`id in (:...ids)`, { ids })
			.andWhere('banned = true')
			.getRawMany();
		res.status(200).json({ bannedPosts: result.map(e => e.id) });
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
