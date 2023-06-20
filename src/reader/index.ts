import express from 'express';
import bodyParser from 'body-parser';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import cors from 'cors';
import fs from 'fs';
import { validateAdmin, validateBanAddresses, validateBanPost, validatePostsStatus } from '../middlewares/validate';
import { bannedAddressRepository, postRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';

export async function startReader(
	sharedData: { predefinedTexts: string[]; bannedAddresses: string[] },
	port: number,
	db: DataSource,
) {
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

	app.get('/get-idea', async (req, res) => {
		try {
			const idx = Math.floor(Math.random() * sharedData.predefinedTexts.length);
			return res.json(sharedData.predefinedTexts[idx]);
		} catch {
			return res.end('No idea :(');
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
			const { beforeTimestamp: beforeTimestampRaw, adminMode: adminModeRaw } = req.query;
			const beforeTimestamp = isNaN(Number(beforeTimestampRaw)) ? 0 : Number(beforeTimestampRaw);
			const adminMode = adminModeRaw === 'true';
			const idx = !adminMode
				? beforeTimestamp === 0
					? 0
					: last200Posts.findIndex(p => p.createTimestamp < beforeTimestamp)
				: -1;
			if (idx !== -1 && !adminMode && idx <= last200Posts.length - 10) {
				return res.json(last200Posts.slice(idx, idx + 10));
			}
			const posts = await postRepository.find({
				where: adminMode
					? beforeTimestamp === 0
						? { isAutobanned: false, banned: false, isPredefined: false, isApproved: false }
						: {
								isAutobanned: false,
								banned: false,
								isPredefined: false,
								isApproved: false,
								createTimestamp: MoreThan(beforeTimestamp),
						  }
					: beforeTimestamp === 0
					? { banned: false }
					: { createTimestamp: LessThan(beforeTimestamp), banned: false },
				order: { createTimestamp: adminMode ? 'ASC' : 'DESC' },
				take: adminMode ? 10 : 10,
			});
			return res.json(posts);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	app.get('/post', async (req, res) => {
		try {
			const { id: idRaw, adminMode: adminModeRaw } = req.query;
			const id = String(idRaw);
			const adminMode = adminModeRaw === 'true';
			const idx = !adminMode ? last200Posts.findIndex(p => p.id === id) : -1;
			if (idx !== -1 && !adminMode && idx <= last200Posts.length - 10) {
				return res.json(last200Posts.find(p => p.id === id));
			}
			const post = await postRepository.findOne({
				where: adminMode
					? {
							isAutobanned: false,
							banned: false,
							isPredefined: false,
							isApproved: false,
							id,
					  }
					: { banned: false, id },
			});
			return res.json(post);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	let status = fs.readFileSync('./status.txt', 'utf-8').trim();

	app.get('/service-status', async (req, res) => {
		res.json({ status });
	});

	app.get('/stop-service', validateAdmin, async (req, res) => {
		status = 'STOPPED';
		fs.writeFileSync('./status.txt', status);
		res.sendStatus(201);
	});

	app.get('/start-service', validateAdmin, async (req, res) => {
		status = 'ACTIVE';
		fs.writeFileSync('./status.txt', status);
		res.sendStatus(201);
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
		for (const id of ids) {
			const idx = last200Posts.findIndex(p => p.id === id);
			if (idx !== -1) {
				last200Posts.splice(idx, 1);
			}
		}
		res.sendStatus(201);
	});

	app.post('/approve-posts', validateBanPost, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		await postRepository.update(ids, { isApproved: true });
		res.sendStatus(201);
	});

	app.post('/ban-addresses', validateBanAddresses, async (req, res) => {
		const addresses = typeof req.query.address === 'string' ? [req.query.address] : (req.query.address as string[]);
		const newAddresses = addresses.filter(a => !sharedData.bannedAddresses.includes(a));
		if (newAddresses.length) {
			await bannedAddressRepository.insert(newAddresses.map(address => ({ address })));
			await bannedAddressRepository.query(
				`UPDATE venom_feed_post_entity SET banned = true, "isAutobanned" = true WHERE sender IN (${newAddresses
					.map(a => `'${a}'`)
					.join(', ')})`,
			);
			await updateCache();
		}
		res.sendStatus(201);
	});

	app.delete('/unban-addresses', validateBanAddresses, async (req, res) => {
		const addresses = typeof req.query.address === 'string' ? [req.query.address] : (req.query.address as string[]);
		await bannedAddressRepository.delete(addresses);
		await updateCache();
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

	return updateCache;
}
