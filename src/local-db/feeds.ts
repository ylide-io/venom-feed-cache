import { asyncTimer } from '@ylide/sdk';
import { feedRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';

export let feeds: FeedEntity[] = [];

export const updateFeeds = async () => {
	feeds = await feedRepository.find();
};

asyncTimer(async () => {
	await updateFeeds();
	console.log(`Feeds updated: `, JSON.stringify(feeds, null, 2));
}, 30 * 1000);
