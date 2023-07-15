import { asyncTimer } from '@ylide/sdk';
import { feedRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';

export let feeds: FeedEntity[] = [];

export const updateFeeds = async () => {
	feeds = await feedRepository.find();
};

export const getFeedComissions = (feedId: string) => {
	const comissions = [];
	let currentFeed: FeedEntity | undefined = feeds.find(f => f.feedId === feedId);
	while (currentFeed) {
		if (currentFeed.comissions) {
			comissions.push(currentFeed.comissions);
		}
		if (currentFeed!.parentFeedId) {
			currentFeed = feeds.find(f => f.feedId === currentFeed!.parentFeedId);
			if (!currentFeed) {
				throw new Error(`Feed ${feedId} has no parent feed ${currentFeed!.parentFeedId}`);
			}
		} else {
			break;
		}
	}
	return comissions;
};

asyncTimer(async () => {
	await updateFeeds();
}, 30 * 1000);
