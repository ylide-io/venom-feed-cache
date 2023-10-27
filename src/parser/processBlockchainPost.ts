import { IMessage, IMessageContent, IMessageCorruptedContent } from '@ylide/sdk';
import Redis from 'ioredis';
import uniq from 'lodash.uniq';
import { DECIMALS } from '../constants';
import { noContentRepository, postRepository } from '../database';
import { HashtagEntity } from '../entities/Hashtag.entity';
import { NoContentPostEntity } from '../entities/NoContentPost';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { bannedAddresses, feeds, getFeedComissions, predefinedTexts } from '../local-db';
import { extractHashtags } from '../utils';
import { shouldBeBanned } from '../utils/badWords';
import {
	calcComissionDecimals,
	calcComissions,
	excludeDecimals,
	isComissionGreaterOrEqualsThan,
} from '../utils/calcComissions';
import { decryptBroadcastContent } from '../utils/decryptBroadcastContent';
import { isGoodPost } from '../utils/goodWords';
import { sendTGAlert } from '../utils/telegram';

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

export const broadCastReply = async (redis: Redis, post: VenomFeedPostEntity) => {
	if (!post.banned) {
		try {
			// <reply-to id="yA05OswBQayIBMkQfGKDxa51udwKxdQoymRUpuBpKp5mmg==" />yes, cool
			if (post.contentText && post.contentText.includes('<reply-to id="')) {
				const msgId = post.contentText.split('<reply-to id="')[1].split('"')[0];
				if (msgId) {
					const replyToPost = await postRepository.findOne({ where: { id: msgId } });
					if (replyToPost && !replyToPost.banned) {
						void redis
							.publish(
								'ylide-broadcast-replies',
								JSON.stringify({
									data: {
										originalPost: replyToPost,
										replyPost: post,
									},
								}),
							)
							.catch(err => {
								console.log('Failed to publish reply to redis: ', err);
							});
					}
				}
			}
		} catch (err) {
			console.log(err);
		}
	}
};

export const processBlockchainPost = async (
	redis: Redis,
	msg: IMessage,
	content: IMessageContent | IMessageCorruptedContent | null,
) => {
	const post = new VenomFeedPostEntity();
	post.id = msg.msgId;
	post.createTimestamp = msg.createdAt;
	post.sender = msg.senderAddress;
	post.blockchain = msg.blockchain;
	post.banned = false;
	post.originalFeedId = msg.feedId;
	const feed = feeds.find(f =>
		msg.blockchain === 'venom-testnet' || msg.blockchain === 'everscale'
			? f.tvmFeedId === msg.feedId
			: f.evmFeedId === msg.feedId,
	);
	post.feedId = feed ? feed.feedId : null;
	post.isComissionValid = true;
	post.banned = false;
	post.isAutobanned = false;
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
		if (feed) {
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
	await broadCastReply(redis, post);
	try {
		const hashtagsEntities = uniq(extractHashtags(post.contentText)).map(h => {
			const e = new HashtagEntity();
			e.name = h.toLowerCase();
			return e;
		});
		post.hashtags = hashtagsEntities;
		await postRepository.save(post);
	} catch (error) {
		sendTGAlert(
			`BlockhainFeedParser: Failed to save hashtags for post #${
				post.id
			}. Will save without it. Error: ${JSON.stringify(error)}`,
		);
		post.hashtags = [];
		await postRepository.save(post);
	}
	if (post.contentText === 'no-content-available') {
		try {
			const noContent = new NoContentPostEntity();
			noContent.post = post;
			await noContentRepository.save(noContent);
		} catch (error) {
			console.log(`Failed to save no-content post #${post.id}: `, error);
		}
	}

	return { post, feed };
};
