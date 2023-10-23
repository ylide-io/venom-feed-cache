import { feeds } from './feeds';
import { updatePostsWithReactions } from './posts';

export * from './admins';
export * from './bannedAddresses';
export * from './feeds';
export * from './posts';
export * from './predefinedTexts';

export const updatePostsWithReactionsInAllFeeds = async () => {
	await Promise.all(feeds.map(async feed => await updatePostsWithReactions(feed.feedId)));
};
