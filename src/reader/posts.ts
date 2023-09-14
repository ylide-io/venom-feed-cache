import { Uint256, asyncTimer } from '@ylide/sdk';
import express from 'express';
import { MoreThan, LessThan } from 'typeorm';
import { GLOBAL_VENOM_FEED_ID } from '../constants';
import { feedRepository, postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { admins, updateAdmins } from '../local-db/admins';
import { feeds } from '../local-db/feeds';
import { postToDTO } from '../types';
import { validatePostsStatus } from '../middlewares/validate';
import { posts, updatePosts } from '../local-db/posts';
import { constructGenericEvmFeedId, constructGenericTvmFeedId } from '../utils/copy-to-delete';

export const createPostsRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	async function updateCache(feed: FeedEntity) {
		const start = Date.now();
		await updateAdmins(feed);
		await updatePosts(feed.feedId);
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

	for (const feed of feeds) {
		console.log(`Building cache for ${feed.feedId} (${feed.title})`);
		await updateCache(feed);
	}

	asyncTimer(updateAllCaches, 5 * 1000);

	router.get('/posts', async (req, res) => {
		try {
			const { beforeTimestamp: beforeTimestampRaw, adminMode: adminModeRaw, feedId: feedIdRaw } = req.query;
			const feedId = feedIdRaw ? String(feedIdRaw) : GLOBAL_VENOM_FEED_ID;
			if (feeds.find(f => f.feedId === feedId) === undefined) {
				const newFeed = new FeedEntity();
				newFeed.feedId = feedId;
				let title = 'New unnamed feed';
				if (feedId.startsWith('3000000000000000000000000000000000000000000000000000001')) {
					title = 'New Dexify feed';
				}
				newFeed.title = title;
				newFeed.description = title;
				newFeed.isHidden = true;
				newFeed.parentFeedId = null;
				newFeed.logoUrl = null;
				newFeed.evmFeedId = constructGenericEvmFeedId(newFeed.feedId as Uint256);
				newFeed.tvmFeedId = constructGenericTvmFeedId(newFeed.feedId as Uint256, 1);
				await feedRepository.save(newFeed);
				feeds.push(newFeed);
			}
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
			return res.json(post ? postToDTO(post, post.feedId ? admins[post.feedId] : undefined) : null);
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
