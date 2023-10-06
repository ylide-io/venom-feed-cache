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
import { brackets, isEmoji } from '../utils';
import asyncTimer from '../utils/asyncTimer';
import { constructGenericEvmFeedId, constructGenericTvmFeedId } from '../utils/copy-to-delete';
import { getPostsWithReactionsQuery, getReactionsForPosts } from '../utils/queries';
import { authorizationFactory } from '../utils/ylide-auth';

export const createPostsRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	const authorize = authorizationFactory();

	const getPostBuilder = ({
		feedId,
		addresses,
		adminMode,
		beforeTimestamp,
		postId,
	}: {
		feedId?: string;
		addresses: string[];
		adminMode?: boolean;
		beforeTimestamp?: number;
		postId?: string;
	}) => {
		const reactionsCountSubQuery = reactionRepository
			.createQueryBuilder('r')
			.select(['r."postId"', 'r."reaction"', 'count(*) as count'])
			.where('r."postId" = p."id"')
			.groupBy('r."postId"')
			.addGroupBy('r."reaction"');

		const addressReactionsSubQuery = reactionRepository
			.createQueryBuilder('r')
			.select(['r."postId"', 'r."reaction"', 'r."address"'])
			.where('r."postId" = p."id"')
			.andWhere('r.address in (:...addresses)', { addresses });

		const builder = postRepository
			.createQueryBuilder('p')
			.select([
				'p."id"',
				'p."createTimestamp"',
				'p."feedId"',
				'p."sender"',
				'p."meta"',
				'p."content"',
				'p."banned"',
				'p."blockchain"',
			])
			.addSelect(
				qb =>
					qb
						.subQuery()
						.select(`coalesce(jsonb_object_agg(rr.reaction, rr.count), '{}'::jsonb)`)
						.from(brackets(reactionsCountSubQuery.getSql()), 'rr'),
				'reactionsCounts',
			)
			.addSelect(
				qb =>
					qb
						.subQuery()
						.select(`coalesce(jsonb_object_agg(rr.address, rr.reaction), '{}'::jsonb)`)
						.from(brackets(addressReactionsSubQuery.getQuery()), 'rr'),
				'addressReactions',
			)
			.setParameters(addressReactionsSubQuery.getParameters())
			.where('banned is false')
			.limit(10);
		if (feedId) {
			builder.andWhere('p."feedId" = :feedId', { feedId });
		}
		if (postId) {
			builder.andWhere('p."id" = :postId', { postId });
		}
		if (adminMode) {
			builder
				.andWhere('p."isAutobanned" is false')
				.andWhere('p."isPredefined" is false')
				.andWhere('p."isApproved" is false')
				.orderBy('p."createTimestamp"', 'ASC');
			if (beforeTimestamp) {
				builder.andWhere('p."createTimestamp" > :beforeTimestamp', { beforeTimestamp });
			}
		} else {
			if (beforeTimestamp) {
				builder.andWhere('p."createTimestamp" < :beforeTimestamp', { beforeTimestamp });
			}
			builder.orderBy('p."createTimestamp"', 'DESC');
		}
		return builder;
	};

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

	if (process.env.NODE_ENV !== 'development') {
		(async () => {
			for (const feed of feeds) {
				console.log(`Building cache for ${feed.feedId} (${feed.title})`);
				await updateCache(feed);
			}
			asyncTimer(updateAllCaches, 5 * 1000);
		})();
	}

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

	router.get('/v3/posts', async (req, res) => {
		try {
			const {
				beforeTimestamp: beforeTimestampRaw,
				adminMode: adminModeRaw,
				feedId: feedIdRaw,
				address: addressRaw,
				hashtag: hashtagRaw,
			} = req.query;
			const feedId = feedIdRaw ? String(feedIdRaw) : GLOBAL_VENOM_FEED_ID;
			const hashtag =
				typeof hashtagRaw === 'string'
					? [hashtagRaw.toLowerCase()]
					: Array.isArray(hashtagRaw)
					? hashtagRaw.map(h => String(h).toLowerCase())
					: null;
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
			const posts = postsWithReactions[feedId] || [];
			const idx = !adminMode
				? beforeTimestamp === 0
					? 0
					: posts
					? posts.findIndex(p => p.createTimestamp < beforeTimestamp)
					: -1
				: -1;
			if (!hashtag && idx !== -1 && !adminMode && idx <= posts.length - 10) {
				const _posts = posts.slice(idx, idx + 10);
				if (addresses.length) {
					const builder = reactionRepository
						.createQueryBuilder('reaction')
						.select('"postId"')
						.addSelect('jsonb_object_agg(address, reaction) as "addressReactions"')
						.where('"postId" in (:...postId)', { postId: _posts.map(p => p.id) })
						.groupBy('reaction."postId"');
					if (addresses.length) {
						builder.andWhere(`address in (:...address)`, { address: addresses });
					}
					const _reactions = (await builder.getRawMany()) as Reactions[];

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

			const builder = getPostBuilder({ feedId, addresses, adminMode, beforeTimestamp });

			if (hashtag) {
				builder.leftJoin('p.hashtags', 'hashtag').andWhere('hashtag.name in (:...hashtag)', { hashtag });
			}

			const _posts = await builder.getRawMany();

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

	router.get('/v3/post', async (req, res) => {
		try {
			const { id: idRaw, adminMode: adminModeRaw, address: addressRaw } = req.query;
			const id = String(idRaw);
			const adminMode = adminModeRaw === 'true';
			const addresses = addressRaw
				? typeof addressRaw === 'string'
					? [addressRaw.toLowerCase()]
					: (addressRaw as string[]).map(a => a.toLowerCase())
				: [];
			const builder = getPostBuilder({ postId: id, addresses, adminMode });
			const post = await builder.getRawOne();
			return res.json(post ? postWithReactionToDTO(post, post.feedId ? admins[post.feedId] : undefined) : null);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	router.post('/reaction', authorize, async (req, res) => {
		try {
			const { postId: postIdRaw, reaction: reactionRaw } = req.body;
			if (reactionRaw && (typeof reactionRaw !== 'string' || !isEmoji(reactionRaw))) {
				return res.status(400).json({ error: 'Emoji validation error' });
			}
			const postId = String(postIdRaw);
			const reaction = reactionRaw ? String(reactionRaw) : null;
			// @ts-ignore
			const address = req.userAddress;

			const post = await postRepository.findOne({ where: { id: postId } });
			if (!post) {
				return res.status(404).json({ error: 'No post' });
			}

			const exist = await reactionRepository.findOne({ where: { address, postId } });
			if (exist) {
				if (reaction) {
					exist.reaction = reaction;
					await reactionRepository.save(exist);
				} else {
					await reactionRepository.remove(exist);
				}
			} else {
				if (reaction) {
					const reactionEntity = new FeedPostReactionEntity();
					reactionEntity.address = address;
					reactionEntity.post = post;
					reactionEntity.reaction = reaction;
					await reactionRepository.save(reactionEntity);
				} else {
					res.status(400).json('No reaction to save');
					return;
				}
			}
			res.sendStatus(200);
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

	router.post('/posts/statistic', async (req, res) => {
		try {
			const feedIds = req.body.feedIds as string[];
			if (feedIds.length > 20) {
				res.status(400).json('Too many feeds');
				return;
			}
			const result = await postRepository
				.createQueryBuilder('post')
				.select(['post."feedId"', 'count(*) "totalMessages"', 'count(distinct(post.sender)) "uniqSenders"'])
				.where(`"feedId" in (:...feedIds)`, { feedIds })
				.groupBy('post."feedId"')
				.getRawMany();
			res.status(200).json(result);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	return { router };
};
