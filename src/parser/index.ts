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
import { BlockchainSourceType, IMessage, IMessageContent, MessageBlob, MessageContainer, Uint256 } from '@ylide/sdk';
import { postRepository, predefinedTextRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { sendTGAlert } from '../utils/telegram';
import { retry } from '../utils/retry';
import asyncTimer from '../utils/asyncTimer';
import { badWordsLowerCase } from '../utils/badWords';

export async function startParser(data: { predefinedTexts: string[] }, updateCache: () => Promise<void>) {
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

	async function updatePredefinedTexts() {
		const texts = await predefinedTextRepository.find();
		data.predefinedTexts = texts.map(t => t.text);
	}

	function decryptBroadcastContent(msg: IMessage, content: IMessageContent) {
		const unpackedContainer = MessageContainer.unpackContainter(content.content);
		if (unpackedContainer.isEncoded) {
			throw new Error(`Can't decode encrypted content`);
		}
		const decodedContent = MessageBlob.unpackAndDecode(unpackedContainer.messageBlob);

		return {
			content: decodedContent,
			serviceCode: unpackedContainer.serviceCode,
			container: unpackedContainer,
		};
	}

	function shouldBeBanned(text: string) {
		const textLowerCase = text.toLowerCase();
		const words = textLowerCase.matchAll(/[a-z]+/g);
		for (const word of words) {
			if (badWordsLowerCase.includes(word[0])) {
				return true;
			}
		}
		return false;
	}

	async function updateFeed() {
		let lastPost: any = null;
		let i = 0;
		let smthChanged = false;
		while (true) {
			const startHistory = Date.now();
			const history = await retry(() =>
				controller.currentMailer.wrapper.retrieveHistoryDesc(
					controller.currentMailer.link,
					{
						feedId: composedFeedId,
						type: BlockchainSourceType.BROADCAST,
						sender: null,
					},
					lastPost,
					null,
					20,
				),
			);
			const endHistory = Date.now();
			if (endHistory - startHistory > 300) {
				console.log(`WARN: retrieving history took ${endHistory - startHistory}ms: `, lastPost === null);
			}

			if (history.length === 0) {
				return smthChanged;
			}

			for (const msg of history) {
				const exists = await postRepository.findOne({ where: { id: msg.msgId } });
				if (exists) {
					return smthChanged;
				}
				const start = Date.now();
				const content = await retry(() =>
					controller.currentMailer.wrapper.retrieveMessageContent(controller.currentMailer.link, msg),
				);
				const end = Date.now();
				if (end - start > 300) {
					console.log(`WARN: retrieving message content took ${end - start}ms: `, msg.msgId);
				}
				const post = new VenomFeedPostEntity();
				post.id = msg.msgId;
				post.createTimestamp = msg.createdAt;
				post.sender = msg.senderAddress;
				post.banned = false;
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
					post.content = {
						...content,
						content: [...content.content],
					};
					const result = decryptBroadcastContent(msg, content);
					post.contentText = (
						typeof result.content.content === 'string'
							? result.content.content
							: result.content.content.toString()
					).trim();
					const isPredefined =
						post.contentText.trim() === '' || data.predefinedTexts.some(t => post.contentText === t);
					if (isPredefined) {
						post.isPredefined = true;
					} else {
						const isAutobanned = shouldBeBanned(post.contentText);
						if (isAutobanned) {
							post.isAutobanned = true;
							post.banned = true;
						}
					}
				}
				await postRepository.save(post);
				smthChanged = true;
				console.log(`Saved post #${i++}`);
				lastPost = msg;
			}
		}
	}

	await updatePredefinedTexts();
	await updateFeed();

	asyncTimer(async () => {
		await updatePredefinedTexts();
	}, 10 * 1000);

	asyncTimer(async () => {
		try {
			const smthAdded = await updateFeed();
			if (smthAdded) {
				await updateCache();
			}
		} catch (e: any) {
			console.error(e);
			sendTGAlert(`!!!!!! Venom feed error: ${e.message}`).catch(err => {
				console.error('TG error', err);
			});
		}
		console.log(`[${new Date().toISOString()}] Feed updated`);
	}, 5 * 1000);

	console.log('Parser done');
}
