import { IMessage } from '@ylide/sdk';
import { Redis } from 'ioredis';
import isEqual from 'lodash.isequal';
import { In } from 'typeorm';
import type { sendNotification as SendNotification } from 'web-push';
import { GLOBAL_YLIDE_FEED_PRODUCTION, GLOBAL_YLIDE_FEED_TESTING } from '../constants';
import { userRepository } from '../database';
import { UserEntity } from '../entities/User.entity';
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

	await redis.subscribe('ylide-global-broadcast', (err, count) => {
		if (err) {
			console.error('Subscription error: ', err);
		} else {
			console.log(`Successfully subscribed to ${count as number} channels`);
		}
	});

	const sendPush = async (user: UserEntity, data: { type: 'INCOMING_MAIL' | 'POST_REPLY'; body: any }) => {
		if (user?.pushSubscription) {
			console.log(`Sending push to ${user.address}. Type: ${data.type}`);
			return Promise.all(
				user.pushSubscription.map(async s => {
					return sendNotification(s, JSON.stringify(data)).catch((e: any): any => {
						console.log(
							`Failed to send push - ${user.address}. Error: ${e.name} | ${e.message} | ${e.body} | ${e.statusCode}`,
						);
						if (e.statusCode === 410) {
							console.log(
								`Push subscription has unsubscribed or expired. Removing for ${user.address}...`,
							);
							const pushSubscription = user.pushSubscription.filter(_s => !isEqual(s, _s));
							if (pushSubscription.length === 0) {
								console.log(
									`No more push subscriptions for ${user.address}. Removing from database...`,
								);
								return userRepository.remove(user).catch(e => {
									console.log(`Failed to remove user ${user.address} from database: `, e);
								});
							}
							return userRepository.update(user.address, { pushSubscription }).catch(e => {
								console.log(`Failed to remove user ${user.address} from database: `, e);
							});
						}
					});
				}),
			);
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
					const user = await userRepository.findOneBy({ address: address.toLowerCase() });
					if (user) {
						void sendPush(user, {
							type: 'INCOMING_MAIL',
							body: {
								senderAddress: body.senderAddress,
								recipientAddress: address,
								msgId: body.msgId,
							},
						});
					}
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
					const user = await userRepository.findOneBy({ address: originalPost.sender.toLowerCase() });
					if (user) {
						void sendPush(user, {
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
					}
				} catch (err) {
					console.log('Failed to parse message: ', err);
				}
			} else if (channel === 'ylide-global-broadcast') {
				try {
					const msg = JSON.parse(message);
					const body: IMessage = msg.data;
					if (body.feedId === GLOBAL_YLIDE_FEED_TESTING) {
						const ylideManagers = [
							'0x9Eb187e2b5280c41b1e6723b0F215331a099dc65',
							'0x9B44ed2A5de91f4E9109453434825a32FF2fD6e7',
							'0x15a33D60283e3D20751D6740162D1212c1ad2a2d',
							'0x0962C57d9e451df7905d40cb1b33F179d75f6Af0',
							'0x52E316E323C35e5B222BA63311433F91d80545EE',
							'0x0c386867628470786a90fd88809dafb7ca1d3173',
						].map(a => a.toLowerCase());
						const users = await userRepository.find({
							where: { address: In(ylideManagers) },
						});
						users.forEach(
							u =>
								void sendPush(u, {
									type: 'INCOMING_MAIL',
									body: {
										senderAddress: body.senderAddress,
										recipientAddress: u.address,
										msgId: body.msgId,
									},
								}),
						);
					} else if (body.feedId === GLOBAL_YLIDE_FEED_PRODUCTION) {
						let offset = 0;
						const limit = 100;
						while (true) {
							const [users, totalCount] = await userRepository.findAndCount({
								skip: offset,
								take: limit,
							});
							console.log(`Sending global push: ${offset} - ${offset + limit} / ${totalCount}`);
							for (const user of users) {
								await sendPush(user, {
									type: 'INCOMING_MAIL',
									body: {
										senderAddress: body.senderAddress,
										recipientAddress: user.address,
										msgId: body.msgId,
									},
								});
							}
							if (offset + limit >= totalCount) {
								break;
							}
							offset += limit;
						}
					}
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
