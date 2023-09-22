import { feeds } from './feeds';
import { updatePosts, updatePostsWithReactions } from './posts';

export * from './admins';
export * from './bannedAddresses';
export * from './feeds';
export * from './posts';
export * from './predefinedTexts';

export const updatePostsInAllFeeds = async () => {
	await Promise.all(feeds.map(async feed => await updatePosts(feed.feedId)));
};

export const updatePostsWithReactionsInAllFeeds = async () => {
	await Promise.all(feeds.map(async feed => await updatePostsWithReactions(feed.feedId)));
};
