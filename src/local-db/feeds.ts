import { asyncTimer } from '@ylide/sdk';
import { feedRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';

export let feeds: FeedEntity[] = [];

export const updateFeeds = async () => {
	feeds = await feedRepository.find();
};

asyncTimer(async () => {
	await updateFeeds();
}, 30 * 1000);
