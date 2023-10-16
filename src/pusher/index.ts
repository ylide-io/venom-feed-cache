import { IMessage } from '@ylide/sdk';
import { Redis } from 'ioredis';
import isEqual from 'lodash.isequal';
import type { sendNotification as SendNotification } from 'web-push';
import { userRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';

export const startPusher = async (redis: Redis, sendNotification: typeof SendNotification) => {
	await redis.subscribe('ylide-direct-messages', (err, count) => {
		if (err) {
			console.error('Subscription error: ', err);
		} else {
			console.log(`Successfully subscribed to ${count as number} channels`);
		}
	});

	await redis.subscribe('ylide-broadcast-replies', (err, count) => {
		if (err) {
			console.error('Subscription error: ', err);
		} else {
			console.log(`Successfully subscribed to ${count as number} channels`);
		}
	});

	const sendPush = async (address: string, data: { type: 'INCOMING_MAIL' | 'POST_REPLY'; body: any }) => {
		const user = await userRepository.findOneBy({ address: address.toLowerCase() });
		if (user?.pushSubscription) {
			console.log(`Sending push to ${user.address}. Type: ${data.type}`);
			user.pushSubscription.forEach(s => {
				void sendNotification(s, JSON.stringify(data)).catch((e: any) => {
					console.log(
						`Failed to send push - ${user.address}. Error: ${e.name} | ${e.message} | ${e.body} | ${e.statusCode}`,
					);
					if (e.statusCode === 410) {
						console.log(`Push subscription has unsubscribed or expired. Removing for ${user.address}...`);
						const pushSubscription = user.pushSubscription.filter(_s => !isEqual(s, _s));
						return userRepository.update(user.address, { pushSubscription }).catch(e => {
							console.log(`Failed to remove user ${user.address} from database: `, e);
						});
					}
				});
			});
		}
	};

	redis.on('message', async (channel, message) => {
		try {
			if (channel === 'ylide-direct-messages') {
				try {
					const msg = JSON.parse(message);
					const body: IMessage = msg.data;
					if (body.isBroadcast) {
						return;
					}
					let address: string;
					if (body.recipientAddress.startsWith('000000000000000000000000')) {
						address = '0x' + body.recipientAddress.substring(24);
					} else {
						address = '0:' + body.recipientAddress;
					}
					sendPush(address, {
						type: 'INCOMING_MAIL',
						body: {
							senderAddress: body.senderAddress,
							recipientAddress: address,
							msgId: body.msgId,
						},
					});
				} catch (err) {
					console.log('Failed to parse message: ', err);
				}
			} else if (channel === 'ylide-broadcast-replies') {
				try {
					const msg = JSON.parse(message);
					const { originalPost, replyPost } = msg.data as {
						originalPost: VenomFeedPostEntity;
						replyPost: VenomFeedPostEntity;
					};
					sendPush(originalPost.sender, {
						type: 'POST_REPLY',
						body: {
							feedId: originalPost.feedId,
							author: {
								address: originalPost.sender,
								postId: originalPost.id,
							},
							reply: {
								address: replyPost.sender,
								postId: replyPost.id,
							},
						},
					});
				} catch (err) {
					console.log('Failed to parse message: ', err);
				}
			}
		} catch (err) {
			console.error('Redis on message error: ', err);
		}
	});
	console.log('Pusher started');
};
