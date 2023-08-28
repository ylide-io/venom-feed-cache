import { IMessageContent, AbstractBlockchainController, IMessage, IMessageCorruptedContent } from '@ylide/sdk';
import { postRepository } from '../database';
import { FeedEntity } from '../entities/Feed.entity';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { predefinedTexts, bannedAddresses, getFeedComissions } from '../local-db';
import { shouldBeBanned } from '../utils/badWords';
import { decryptBroadcastContent } from '../utils/decryptBroadcastContent';
import { isGoodPost } from '../utils/goodWords';
import { retry } from '../utils/retry';
import {
	calcComissionDecimals,
	calcComissions,
	excludeDecimals,
	isComissionGreaterOrEqualsThan,
} from '../utils/calcComissions';
import { DECIMALS } from '../constants';
import Redis from 'ioredis';

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
	if (post.contentText.trim().toLowerCase() === 'gm') {
		post.isAutobanned = true;
		post.banned = true;
	} else {
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
	}
};

export const processBlockchainPost = async (
	redis: Redis,
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
	post.originalFeedId = msg.feedId;
	if (post.blockchain === 'everscale' || post.blockchain === 'venom-testnet') {
		post.contractAddress = msg.$$meta.src;
	} else {
		post.contractAddress = msg.$$meta.tx.to;
	}
	try {
		const decimals = DECIMALS[msg.blockchain] || 0;
		if (msg.$$meta.extraPayment && typeof msg.$$meta.extraPayment === 'string') {
			post.extraPayment = excludeDecimals(msg.$$meta.extraPayment, decimals);
		}
		const comissions = getFeedComissions(feed.feedId);
		const comission = calcComissions(msg.blockchain, comissions);
		if (comission !== '0') {
			if (msg.$$meta.extraPayment && typeof msg.$$meta.extraPayment === 'string') {
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
	if (!post.banned) {
		try {
			// <reply-to id="yA05OswBQayIBMkQfGKDxa51udwKxdQoymRUpuBpKp5mmg==" />yes, cool
			if (post.contentText && post.contentText.includes('<reply-to id="')) {
				const msgId = post.contentText.split('<reply-to id="')[1].split('"')[0];
				if (msgId) {
					postRepository
						.findOne({ where: { id: msgId } })
						.then(replyToPost => {
							if (replyToPost) {
								void redis.publish(
									'ylide-broadcast-replies',
									JSON.stringify({
										data: {
											originalPost: replyToPost,
											replyPost: post,
										},
									}),
								);
							}
						})
						.catch(err => {
							// do nothing
						});
				}
			}
		} catch (err) {
			// do nothing
		}
	}
	await postRepository.save(post);
};
