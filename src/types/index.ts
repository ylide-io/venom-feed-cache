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
	blockchain: string;
	isAdmin: boolean;
	adminTitle?: string;
	adminRank?: string;
	adminEmoji?: string;
}

export interface IVenomFeedPostWithReactionsDTO {
	id: string;
	createTimestamp: number;
	feedId: string;
	sender: string;
	meta: any;
	content: any | null;
	banned: boolean;
	blockchain: string;
	reactionsCounts: Record<string, number>;
	addressReactions: Record<string, string>;
	isAdmin: boolean;
	adminTitle?: string;
	adminRank?: string;
	adminEmoji?: string;
}

export const postToDTO = (post: VenomFeedPostEntity, admins: undefined | AdminEntity[]): IVenomFeedPostDTO => {
	const foundAdmin = admins
		? admins.find(admin => admin.address.toLowerCase() === post.sender.toLowerCase())
		: undefined;
	return {
		id: post.id,
		createTimestamp: post.createTimestamp,
		feedId: post.feedId!,
		sender: post.sender,
		meta: post.meta,
		content: post.content,
		banned: post.banned,
		blockchain: post.blockchain,
		isAdmin: !!foundAdmin,
		adminTitle: foundAdmin?.title,
		adminRank: foundAdmin?.rank,
		adminEmoji: foundAdmin?.emoji,
	};
};

export const postWithReactionToDTO = (
	post: PostWithReactions,
	admins: undefined | AdminEntity[],
): IVenomFeedPostWithReactionsDTO => {
	const foundAdmin = admins
		? admins.find(admin => admin.address.toLowerCase() === post.sender.toLowerCase())
		: undefined;
	return {
		id: post.id,
		createTimestamp: post.createTimestamp,
		feedId: post.feedId!,
		sender: post.sender,
		meta: post.meta,
		content: post.content,
		banned: post.banned,
		blockchain: post.blockchain,
		reactionsCounts: post.reactionsCounts,
		addressReactions: post.addressReactions,
		isAdmin: !!foundAdmin,
		adminTitle: foundAdmin?.title,
		adminRank: foundAdmin?.rank,
		adminEmoji: foundAdmin?.emoji,
	};
};

export type AuthorizationPayload = {
	messageEncrypted: string;
	publicKey: string;
	address: string;
};

export type PostWithReactions = {
	id: string;
	createTimestamp: number;
	feedId: string;
	sender: string;
	meta: any;
	content: any;
	banned: boolean;
	blockchain: string;
	reactionsCounts: Record<string, number>;
	addressReactions: Record<string, string>;
};

export type Reactions = {
	postId: string;
	addressReactions: Record<string, string>;
};
