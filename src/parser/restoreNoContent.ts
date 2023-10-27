import { IndexerHub } from '@ylide/sdk';
import { Redis } from 'ioredis';
import uniq from 'lodash.uniq';
import { noContentRepository, postRepository } from '../database';
import { HashtagEntity } from '../entities/Hashtag.entity';
import { NoContentPostEntity } from '../entities/NoContentPost';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { extractHashtags } from '../utils';
import { broadCastReply, processPostContent } from './processBlockchainPost';

export const restoreNoContent = (redis: Redis, indexerHub: IndexerHub) => async () => {
	try {
		const noContentPosts = await noContentRepository.find({
			relations: { post: true },
		});
		if (noContentPosts.length === 0) {
			return;
		}
		console.log(`restoreNoContent - Found ${noContentPosts.length} posts...`);
		const toSave: VenomFeedPostEntity[] = [];
		const toDelete: NoContentPostEntity[] = [];

		for (const noContentPost of noContentPosts) {
			const content = await indexerHub.retryingOperation(
				() => indexerHub.requestContent(noContentPost.post.meta),
				async () => null,
			);
			if (content && !content.corrupted) {
				noContentPost.post.banned = false;
				noContentPost.post.isAutobanned = false;
				processPostContent(noContentPost.post, content);
				const hashtagsEntities = uniq(extractHashtags(noContentPost.post.contentText)).map(h => {
					const e = new HashtagEntity();
					e.name = h.toLowerCase();
					return e;
				});
				noContentPost.post.hashtags = hashtagsEntities;
				toSave.push(noContentPost.post);
				toDelete.push(noContentPost);
			}
		}

		if (toSave.length > 0) {
			await postRepository.manager.transaction(async manager => {
				await manager.save(toSave);
				await manager.remove(toDelete);
			});
			for (const post of toSave) {
				await broadCastReply(redis, post);
			}
		}
	} catch (error) {
		console.log(`restoreNoContent - Error: ${error}`);
	}
};
