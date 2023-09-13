import { postRepository } from '../database';
import { IVenomFeedPostDTO, postToDTO } from '../types';
import { admins } from './admins';

export let posts: Record<string, IVenomFeedPostDTO[]> = {};

export const updatePosts = async (feedId: string) => {
	const _posts = await postRepository.find({
		where: { banned: false, feedId: feedId },
		order: { createTimestamp: 'DESC' },
		take: 50,
	});
	posts[feedId] = _posts.map(post => postToDTO(post, admins[feedId]));
};
