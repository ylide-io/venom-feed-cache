import { Uint256 } from '@ylide/sdk';
import express from 'express';
import { LessThan, MoreThan } from 'typeorm';
import { GLOBAL_VENOM_FEED_ID } from '../constants';
import { feedRepository, postRepository, reactionRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { FeedPostReactionEntity } from '../entities/FeedPostReaction.entity';
import { admins, updateAdmins } from '../local-db/admins';
import { feeds } from '../local-db/feeds';
import { posts, postsWithReactions, updatePosts, updatePostsWithReactions } from '../local-db/posts';
import { validatePostsStatus } from '../middlewares/validate';
import { PostWithReactions, Reactions, postToDTO, postWithReactionToDTO } from '../types';
import { isEmoji } from '../utils';
import asyncTimer from '../utils/asyncTimer';
import { constructGenericEvmFeedId, constructGenericTvmFeedId } from '../utils/copy-to-delete';
import { getPostsWithReactionsQuery, getReactionsForPosts } from '../utils/queries';
import { authorizationFactory } from '../utils/ylide-auth';

export const createPostsRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	const authorize = authorizationFactory();

	async function updateCache(feed: FeedEntity) {
		const start = Date.now();
		await updateAdmins(feed);
		await updatePosts(feed.feedId);
		await updatePostsWithReactions(feed.feedId);
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

	router.get('/v2/posts', async (req, res) => {
		try {
			const {
				beforeTimestamp: beforeTimestampRaw,
				adminMode: adminModeRaw,
				feedId: feedIdRaw,
				address: addressRaw,
			} = req.query;
			const feedId = feedIdRaw ? String(feedIdRaw) : GLOBAL_VENOM_FEED_ID;
			const addresses = addressRaw
				? typeof addressRaw === 'string'
					? [addressRaw.toLowerCase()]
					: (addressRaw as string[]).map(a => a.toLowerCase())
				: [];
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
					: postsWithReactions[feedId]
					? postsWithReactions[feedId].findIndex(p => p.createTimestamp < beforeTimestamp)
					: -1
				: -1;
			if (idx !== -1 && !adminMode && idx <= postsWithReactions[feedId].length - 10) {
				const _posts = postsWithReactions[feedId].slice(idx, idx + 10);
				if (addresses.length) {
					const { query, parameters } = getReactionsForPosts(
						_posts.map(p => p.id),
						addresses,
					);
					const _reactions = (await postRepository.query(query, parameters)) as Reactions[];
					_reactions.forEach(r => {
						for (const _post of _posts) {
							if (_post.id === r.postId) {
								_post.addressReactions = r.addressReactions;
								break;
							}
						}
					});
				}
				return res.json(_posts);
			}
			const parameters: (string | number)[] = [feedId];
			let whereClause = '';
			if (adminMode) {
				whereClause =
					'where p."isAutobanned" is false and p."banned" is false and p."isPredefined" is false and p."isApproved" is false and p."feedId" = $1';
				if (beforeTimestamp > 0) {
					whereClause += ' and p."createTimestamp" > $2';
					parameters.push(beforeTimestamp);
				}
			} else {
				whereClause = 'where p."banned" is false and p."feedId" = $1';
				if (beforeTimestamp > 0) {
					whereClause += ' and p."createTimestamp" < $2';
					parameters.push(beforeTimestamp);
				}
			}
			let addressWhereClause = '';
			if (addresses.length) {
				addressWhereClause = ` and address in (${addresses
					.map((_, i) => `$${i + 1 + parameters.length}`)
					.join(', ')})`;
				parameters.push(...addresses.map(a => a.toLowerCase()));
			}
			const orderByClause = `order by p."createTimestamp" ${adminMode ? 'ASC' : 'DESC'}`;
			const limitClause = `limit 10`;

			const sqlQuery = getPostsWithReactionsQuery({
				whereClause,
				orderByClause,
				addressWhereClause,
				limitClause,
			});

			const _posts = (await postRepository.query(sqlQuery, parameters)) as PostWithReactions[];

			return res.json(_posts.map(post => postWithReactionToDTO(post, admins[feedId])));
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

	router.get('/v2/post', async (req, res) => {
		try {
			const { id: idRaw, adminMode: adminModeRaw, address: addressRaw } = req.query;
			const id = String(idRaw);
			const adminMode = adminModeRaw === 'true';
			const addresses = addressRaw
				? typeof addressRaw === 'string'
					? [addressRaw.toLowerCase()]
					: (addressRaw as string[]).map(a => a.toLowerCase())
				: [];
			const parameters: (string | number)[] = [id];
			let whereClause = '';
			if (adminMode) {
				whereClause =
					'where p."isAutobanned" is false and p."banned" is false and p."isPredefined" is false and p."isApproved" is false and p."id" = $1';
			} else {
				whereClause = 'where p."banned" is false and p."id" = $1';
			}
			let addressWhereClause = '';
			if (addresses.length) {
				addressWhereClause = ` and address in (${addresses
					.map((_, i) => `$${i + 1 + parameters.length}`)
					.join(', ')})`;
				parameters.push(...addresses.map(a => a.toLowerCase()));
			}
			const sqlQuery = getPostsWithReactionsQuery({ whereClause, addressWhereClause });
			const _posts = (await postRepository.query(sqlQuery, parameters)) as PostWithReactions[];
			const post = _posts.length === 1 ? _posts[0] : null;

			return res.json(post ? postWithReactionToDTO(post, post.feedId ? admins[post.feedId] : undefined) : null);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	router.post('/reaction', authorize, async (req, res) => {
		try {
			const { postId: postIdRaw, reaction: reactionRaw } = req.body;
			if (typeof reactionRaw !== 'string' || !isEmoji(reactionRaw)) {
				return res.status(400).json({ error: 'Emoji validation error' });
			}
			const postId = String(postIdRaw);
			const reaction = String(reactionRaw);
			// @ts-ignore
			const address = req.userAddress;

			const post = await postRepository.findOne({ where: { id: postId } });
			if (!post) {
				return res.status(404).json({ error: 'No post' });
			}

			const reactionEntity = new FeedPostReactionEntity();
			reactionEntity.address = address;
			reactionEntity.post = post;
			reactionEntity.reaction = reaction;

			await reactionRepository.save(reactionEntity);

			res.sendStatus(201);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	router.delete('/reaction', authorize, async (req, res) => {
		try {
			const { postId: postIdRaw } = req.body;
			const postId = String(postIdRaw);
			// @ts-ignore
			const address = req.userAddress;

			const reaction = await reactionRepository.findOne({ where: { postId, address } });
			if (!reaction) {
				return res.status(404).json({ error: 'No reaction' });
			}

			await reactionRepository.remove(reaction);

			res.sendStatus(204);
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
