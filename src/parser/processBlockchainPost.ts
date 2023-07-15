import { IMessageContent, AbstractBlockchainController, IMessage, IMessageCorruptedContent } from '@ylide/sdk';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { predefinedTexts, bannedAddresses, getFeedComissions } from '../local-db';
import { shouldBeBanned } from '../utils/badWords';
import { decryptBroadcastContent } from '../utils/decryptBroadcastContent';
import { isGoodPost } from '../utils/goodWords';
import { retry } from '../utils/retry';
import { calcComissionDecimals, calcComissions, isComissionGreaterOrEqualsThan } from '../utils/calcComissions';
import { DECIMALS } from '../constants';

export const processPostContent = (post: VenomFeedPostEntity, content: IMessageContent) => {
	post.content = {
		...content,
		content: [...content.content],
	};
	const result = decryptBroadcastContent(content);
	post.contentText = (
		typeof result.content.content === 'string' ? result.content.content : result.content.content.toString()
	).trim();
	if (post.banned) {
		return;
	}
	let isPredefined = post.contentText.trim() === '' || predefinedTexts.some(t => post.contentText === t);
	if (!isPredefined) {
		isPredefined = isGoodPost(post.contentText);
		if (isPredefined) {
			console.log('Good post: ' + post.contentText);
		}
	}
	if (isPredefined) {
		post.isPredefined = true;
	} else {
		const isBannedAddress = bannedAddresses.includes(post.sender);
		const isAutobanned = isBannedAddress || shouldBeBanned(post.contentText);
		if (isAutobanned) {
			post.isAutobanned = true;
			post.banned = true;
		}
	}
};

export const processBlockchainPost = async (
	feed: FeedEntity,
	msg: IMessage,
	content: IMessageContent | IMessageCorruptedContent | null,
) => {
	const post = new VenomFeedPostEntity();
	post.id = msg.msgId;
	post.createTimestamp = msg.createdAt;
	post.sender = msg.senderAddress;
	post.blockchain = msg.blockchain;
	post.banned = false;
	post.feedId = feed.feedId;
	post.isComissionValid = true;
	post.banned = false;
	post.isAutobanned = false;
	try {
		const comissions = getFeedComissions(feed.feedId);
		const comission = calcComissions(msg.blockchain, comissions);
		if (comission !== '0') {
			if (msg.$$meta.extraPayment && typeof msg.$$meta.extraPayment === 'string') {
				const decimals = DECIMALS[msg.blockchain] || 0;
				const decimalizedComission = calcComissionDecimals(comission, decimals);
				if (isComissionGreaterOrEqualsThan(msg.$$meta.extraPayment, decimalizedComission)) {
					post.isComissionValid = true;
				} else {
					post.isComissionValid = false;
					post.banned = true;
					post.isAutobanned = true;
				}
			} else {
				post.isComissionValid = false;
				post.banned = true;
				post.isAutobanned = true;
			}
		} else {
			post.isComissionValid = true;
		}
	} catch (err) {
		console.log('Error getting feed comissions: ', err);
		post.isComissionValid = false;
		post.banned = true;
		post.isAutobanned = true;
	}
	post.meta = {
		...msg,
		key: [...msg.key],
	};

	if (!content) {
		post.content = null;
		post.banned = true;
		post.isAutobanned = true;
		post.contentText = 'no-content-available';
	} else if (content.corrupted) {
		post.content = content;
		post.banned = true;
		post.isAutobanned = true;
		post.contentText = 'corrupted';
	} else {
		processPostContent(post, content);
	}
	await postRepository.save(post);
};
