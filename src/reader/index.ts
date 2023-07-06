import express from 'express';
import bodyParser from 'body-parser';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import cors from 'cors';
import fs from 'fs';
import { validateAdmin, validateBanAddresses, validateBanPost, validatePostsStatus } from '../middlewares/validate';
import { adminRepository, bannedAddressRepository, postRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { GLOBAL_VENOM_FEED_ID } from '../constants';
import { Uint256 } from '@ylide/sdk';
import asyncTimer from '../utils/asyncTimer';
import { AdminEntity } from '../entities/Admin.entity';

export interface IVenomFeedPostDTO {
	id: string;
	createTimestamp: number;
	feedId: string;
	sender: string;
	meta: any;
	content: any | null;
	banned: boolean;
	isAdmin: boolean;
	adminTitle?: string;
	adminRank?: string;
	adminEmoji?: string;
}

function toDTO(post: VenomFeedPostEntity, admins: AdminEntity[]) {
	const foundAdmin = admins.find(admin => admin.address === post.sender);
	return {
		id: post.id,
		createTimestamp: post.createTimestamp,
		feedId: post.feedId,
		sender: post.sender,
		meta: post.meta,
		content: post.content,
		banned: post.banned,
		isAdmin: !!foundAdmin,
		adminTitle: foundAdmin?.title,
		adminRank: foundAdmin?.rank,
		adminEmoji: foundAdmin?.emoji,
	};
}

export async function startReader(
	sharedData: { predefinedTexts: string[]; bannedAddresses: string[]; prebuiltFeedIds: Uint256[] },
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

	let last200Posts: Record<string, IVenomFeedPostDTO[]> = {};
	let admins: Record<string, AdminEntity[]> = {};

	async function updateCache(feedId: string) {
		const start = Date.now();
		const _admins = await adminRepository.find({
			where: { feedId },
		});
		const posts = await postRepository.find({
			where: { banned: false, feedId },
			order: { createTimestamp: 'DESC' },
			take: 200,
		});
		if (Date.now() - start > 2000) {
			console.log(`Cache for ${feedId} updated in ${Date.now() - start}ms`);
		}
		admins[feedId] = _admins;
		last200Posts[feedId] = posts.map(post => toDTO(post, _admins));
	}

	async function updateAllCaches() {
		const start = Date.now();
		await Promise.all(sharedData.prebuiltFeedIds.map(async feedId => updateCache(feedId)));
		if (Date.now() - start > 1000) {
			console.log(`All caches updated in ${Date.now() - start}ms`);
		}
	}

	for (const feedId of sharedData.prebuiltFeedIds) {
		console.log(`Building cache for ${feedId}`);
		await updateCache(feedId);
	}

	asyncTimer(updateAllCaches, 5 * 1000);

	app.get('/posts', async (req, res) => {
		try {
			const { beforeTimestamp: beforeTimestampRaw, adminMode: adminModeRaw, feedId: feedIdRaw } = req.query;
			const feedId = feedIdRaw ? String(feedIdRaw) : GLOBAL_VENOM_FEED_ID;
			const beforeTimestamp = isNaN(Number(beforeTimestampRaw)) ? 0 : Number(beforeTimestampRaw);
			const adminMode = adminModeRaw === 'true';
			const idx = !adminMode
				? beforeTimestamp === 0
					? 0
					: last200Posts[feedId]
					? last200Posts[feedId].findIndex(p => p.createTimestamp < beforeTimestamp)
					: -1
				: -1;
			if (idx !== -1 && !adminMode && idx <= last200Posts[feedId].length - 10) {
				return res.json(last200Posts[feedId].slice(idx, idx + 10));
			}
			const posts = await postRepository.find({
				where: adminMode
					? beforeTimestamp === 0
						? { isAutobanned: false, banned: false, isPredefined: false, isApproved: false, feedId }
						: {
								isAutobanned: false,
								banned: false,
								feedId,
								isPredefined: false,
								isApproved: false,
								createTimestamp: MoreThan(beforeTimestamp),
						  }
					: beforeTimestamp === 0
					? { banned: false, feedId }
					: { createTimestamp: LessThan(beforeTimestamp), banned: false, feedId },
				order: { createTimestamp: adminMode ? 'ASC' : 'DESC' },
				take: adminMode ? 10 : 10,
			});
			return res.json(posts.map(post => toDTO(post, admins[feedId])));
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
			// const idx = !adminMode
			// 	? last200Posts[feedId]
			// 		? last200Posts[feedId].findIndex(p => p.id === id)
			// 		: -1
			// 	: -1;
			// if (idx !== -1 && !adminMode && idx <= last200Posts[feedId].length - 10) {
			// 	return res.json(last200Posts[feedId].find(p => p.id === id));
			// }
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
			return res.json(post ? toDTO(post, admins[post.feedId]) : null);
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
			for (const feedId of sharedData.prebuiltFeedIds) {
				const idx = last200Posts[feedId] ? last200Posts[feedId].findIndex(p => p.id === id) : -1;
				if (idx !== -1) {
					last200Posts[feedId].splice(idx, 1);
				}
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
			await updateAllCaches();
		}
		res.sendStatus(201);
	});

	app.delete('/unban-addresses', validateBanAddresses, async (req, res) => {
		const addresses = typeof req.query.address === 'string' ? [req.query.address] : (req.query.address as string[]);
		await bannedAddressRepository.delete(addresses);
		await updateAllCaches();
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
