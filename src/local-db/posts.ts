import { postRepository } from '../database';
import { IVenomFeedPostWithReactionsDTO, PostWithReactions, postWithReactionToDTO } from '../types';
import { getPostsWithReactionsQuery } from '../utils/queries';
import { admins } from './admins';

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
