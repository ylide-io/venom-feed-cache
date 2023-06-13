global.fetch = require('node-fetch');

const { EverscaleStandaloneClient } = require('everscale-standalone-client/nodejs');

import core from 'everscale-standalone-client/core';

const coreDeepCopy: typeof core = {
	ensureNekotonLoaded: core.ensureNekotonLoaded,
	debugLog: core.debugLog,
	fetch: core.fetch,
	fetchAgent: core.fetchAgent,
	nekoton: core.nekoton,
};

import { EverscaleBlockchainController } from '@ylide/everscale';
import { BlockchainSourceType, Uint256 } from '@ylide/sdk';
import { postRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';

export async function startParser() {
	Object.assign(core, coreDeepCopy);

	const provider = await EverscaleStandaloneClient.create({
		connection: {
			id: 1,
			group: 'mainnet',
			type: 'graphql',
			data: {
				local: false,
				endpoints: ['https://gql-testnet.venom.foundation/graphql'],
			},
		},
	});

	const controller = new EverscaleBlockchainController({
		type: 'venom-testnet',
		endpoints: ['https://gql-testnet.venom.foundation/graphql'],
		provider,
		nekotonCore: core,
	});

	const VENOM_FEED_ID = '1000000000000000000000000000000000000000000000000000000000000004' as Uint256;

	const composedFeedId = await controller.currentMailer.wrapper.composeFeedId(
		controller.currentMailer.link,
		VENOM_FEED_ID,
		1,
	);

	async function updateFeed(fullScan = false) {
		let firstPost = null;
		if (!fullScan) {
			firstPost = await postRepository.findOne({ where: {}, order: { createTimestamp: 'DESC' } });
		}
		let lastPost: any = null;
		let i = 0;
		while (true) {
			const history = await controller.currentMailer.wrapper.retrieveHistoryDesc(
				controller.currentMailer.link,
				{
					feedId: composedFeedId,
					type: BlockchainSourceType.BROADCAST,
					sender: null,
				},
				lastPost,
				null,
				50,
			);

			for (const msg of history) {
				if (firstPost && msg.msgId === firstPost.id) {
					return;
				}
				const exists = await postRepository.findOne({ where: { id: msg.msgId } });
				if (exists) {
					return;
				}
				const content = await controller.currentMailer.wrapper.retrieveMessageContent(
					controller.currentMailer.link,
					msg,
				);
				const post = new VenomFeedPostEntity();
				post.id = msg.msgId;
				post.createTimestamp = msg.createdAt;
				post.sender = msg.senderAddress;
				post.meta = msg;

				post.content = content;
				await postRepository.save(post);
				console.log(`Saved post #${i++}`);
			}
		}
	}

	await updateFeed(true);

	debugger;
}
