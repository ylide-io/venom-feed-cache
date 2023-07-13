import { AdminEntity } from '../entities/Admin.entity';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';

export interface IVenomFeedPostDTO {
	id: string;
	createTimestamp: number;
	feedId: string;
	sender: string;
	meta: any;
	content: any | null;
	banned: boolean;
	isAdmin: boolean;
	adminTitle?: string;
	adminRank?: string;
	adminEmoji?: string;
}

export const postToDTO = (post: VenomFeedPostEntity, admins: undefined | AdminEntity[]) => {
	const foundAdmin = admins ? admins.find(admin => admin.address === post.sender) : undefined;
	return {
		id: post.id,
		createTimestamp: post.createTimestamp,
		feedId: post.feedId,
		sender: post.sender,
		meta: post.meta,
		content: post.content,
		banned: post.banned,
		isAdmin: !!foundAdmin,
		adminTitle: foundAdmin?.title,
		adminRank: foundAdmin?.rank,
		adminEmoji: foundAdmin?.emoji,
	};
};
