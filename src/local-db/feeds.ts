import { Uint256, asyncTimer } from '@ylide/sdk';
import { feedRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { constructGenericEvmFeedId, constructGenericTvmFeedId } from '../utils/copy-to-delete';

export let feeds: FeedEntity[] = [];

export const updateFeeds = async () => {
	feeds = await feedRepository.find();
	const updatedFeeds: FeedEntity[] = [];
	for (const feed of feeds) {
		let updated = false;
		if (!feed.evmFeedId) {
			feed.evmFeedId = constructGenericEvmFeedId(feed.feedId as Uint256);
			updated = true;
		}
		if (!feed.tvmFeedId) {
			feed.tvmFeedId = constructGenericTvmFeedId(feed.feedId as Uint256, 1);
			updated = true;
		}
		if (updated) {
			updatedFeeds.push(feed);
		}
	}
	if (updatedFeeds.length) {
		await feedRepository.save(updatedFeeds);
	}
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
}, 20 * 1000);
