import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { IVenomFeedPostDTO, postToDTO } from '../types';
import { admins } from './admins';

export let posts: Record<string, IVenomFeedPostDTO[]> = {};

export const updatePosts = async (feed: FeedEntity) => {
	const _posts = await postRepository.find({
		where: { banned: false, feedId: feed.feedId },
		order: { createTimestamp: 'DESC' },
		take: 200,
	});
	posts[feed.feedId] = _posts.map(post => postToDTO(post, admins[feed.feedId]));
};
