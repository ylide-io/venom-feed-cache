import { asyncTimer } from '@ylide/sdk';
import express from 'express';
import { MoreThan, LessThan } from 'typeorm';
import { GLOBAL_VENOM_FEED_ID } from '../constants';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { admins, updateAdmins } from '../local-db/admins';
import { feeds } from '../local-db/feeds';
import { postToDTO } from '../types';
import { validatePostsStatus } from '../middlewares/validate';
import { posts, updatePosts } from '../local-db/posts';

export const createPostsRouter = async () => {
	const router = express.Router();

	async function updateCache(feed: FeedEntity) {
		const start = Date.now();
		await updateAdmins(feed);
		await updatePosts(feed);
		if (Date.now() - start > 2000) {
			console.log(`Cache for ${feed.feedId} updated in ${Date.now() - start}ms`);
		}
	}

	async function updateAllCaches() {
		const start = Date.now();
		await Promise.all(feeds.map(async feed => updateCache(feed)));
		if (Date.now() - start > 1000) {
			console.log(`All caches updated in ${Date.now() - start}ms`);
		}
	}

	for (const feedId of feeds) {
		console.log(`Building cache for ${feedId}`);
		await updateCache(feedId);
	}

	asyncTimer(updateAllCaches, 5 * 1000);

	router.get('/posts', async (req, res) => {
		try {
			const { beforeTimestamp: beforeTimestampRaw, adminMode: adminModeRaw, feedId: feedIdRaw } = req.query;
			const feedId = feedIdRaw ? String(feedIdRaw) : GLOBAL_VENOM_FEED_ID;
			const beforeTimestamp = isNaN(Number(beforeTimestampRaw)) ? 0 : Number(beforeTimestampRaw);
			const adminMode = adminModeRaw === 'true';
			const idx = !adminMode
				? beforeTimestamp === 0
					? 0
					: posts[feedId]
					? posts[feedId].findIndex(p => p.createTimestamp < beforeTimestamp)
					: -1
				: -1;
			if (idx !== -1 && !adminMode && idx <= posts[feedId].length - 10) {
				return res.json(posts[feedId].slice(idx, idx + 10));
			}
			const _posts = await postRepository.find({
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
			return res.json(_posts.map(post => postToDTO(post, admins[feedId])));
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	router.get('/post', async (req, res) => {
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
			return res.json(post ? postToDTO(post, admins[post.feedId]) : null);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	router.get('/posts-status', validatePostsStatus, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		const result = await postRepository
			.createQueryBuilder()
			.select('id')
			.where(`id in (:...ids)`, { ids })
			.andWhere('banned = true')
			.getRawMany();
		res.status(200).json({ bannedPosts: result.map(e => e.id) });
	});

	return { router };
};
