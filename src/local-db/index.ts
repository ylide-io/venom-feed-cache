import { feeds } from './feeds';
import { updatePosts } from './posts';

export * from './admins';
export * from './bannedAddresses';
export * from './feeds';
export * from './posts';
export * from './predefinedTexts';

export const updatePostsInAllFeeds = async () => {
	await Promise.all(feeds.map(async feed => await updatePosts(feed)));
};
