import { postRepository } from '../database';
import {
	IVenomFeedPostDTO,
	IVenomFeedPostWithReactionsDTO,
	PostWithReactions,
	postToDTO,
	postWithReactionToDTO,
} from '../types';
import { getPostsWithReactionsQuery } from '../utils/queries';
import { admins } from './admins';

export const posts: Record<string, IVenomFeedPostDTO[]> = {};

export const updatePosts = async (feedId: string) => {
	const _posts = await postRepository.find({
		where: { banned: false, feedId: feedId },
		order: { createTimestamp: 'DESC' },
		take: 50,
	});
	posts[feedId] = _posts.map(post => postToDTO(post, admins[feedId]));
};

export const postsWithReactions: Record<string, IVenomFeedPostWithReactionsDTO[]> = {};

export const updatePostsWithReactions = async (feedId: string) => {
	const parameters = [feedId];
	const sqlQuery = getPostsWithReactionsQuery({
		whereClause: 'where p."banned" is false and p."feedId" = $1',
		orderByClause: 'order by p."createTimestamp" desc',
		limitClause: 'limit 50',
	});
	const _posts = (await postRepository.query(sqlQuery, parameters)) as PostWithReactions[];
	postsWithReactions[feedId] = _posts.map(post => postWithReactionToDTO(post, admins[feedId]));
};
