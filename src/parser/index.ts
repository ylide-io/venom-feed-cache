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
import { bannedAddressRepository, postRepository, predefinedTextRepository } from '../database';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { sendTGAlert } from '../utils/telegram';
import { retry } from '../utils/retry';
import asyncTimer from '../utils/asyncTimer';
import { badWordsLowerCase } from '../utils/badWords';

const goodWords = [
	'hi',
	'hello',
	'gm',
	'lfg',
	'venom',
	'ylide',
	'lets',
	'go',
	'to',
	'the',
	'moon',
	'everybody',
	'is',
	'a',
	'here',
	'nice',
	'day',
	'great',
	'project',
	'venoms',
	'yup',
	'all',
	'when',
	'mainnet',
	'airdrop',
	'this',
	'first',
	'message',
	'chain',
	'awesome',
	'wow',
	'cool',
	'my',
	'blockchain',
	'very',
	'good',
	'done',
	'nft',
	'venomians',
	'community',
	'sir',
	'and',
	'strong',
	'i',
	'm',
	'eagerly',
	'waiting',
	'for',
	'launch',
	'will',
	'be',
	'next',
	'big',
	'thing',
	'vamos',
	'wagmi',
	'hodl',
	'wewillsee',
	'network',
	'best',
	'fore',
	'ever',
	'love',
	'how',
	'are',
	'you',
	'family',
	'friends',
	'brothers',
	'fam',
	'looking',
	'hot',
	'enthusiastic',
	'amazing',
	'it',
	'gang',
	'welcome',
	'activity',
	'on',
	'has',
	'been',
	'interesting',
	'which',
	'shows',
	'sound',
	'dedicated',
	'team',
	'am',
	'bringing',
	'something',
	'web',
	'ecosystem',
	'proud',
	'part',
	'of',
	'partnership',
	'with',
	'must',
	'say',
	'about',
	'politics',
	'applesauce',
	'n',
	'smooth',
	'experience',
	'speed',
	'in',
	'future',
	'its',
	'hoping',
	'success',
	'us',
	'let',
	's',
	'real',
	'deal',
	'what',
	'top',
	'an',
	'glad',
	'morning',
	'everyone',
	'dont',
	'miss',
	'hii',
	'exciting',
	're',
	'beautiful',
	'true',
	'topnotch',
	'hey',
	'enthusiasts',
	'just',
	'arrived',
	'realm',
	'excited',
	'connect',
	'like',
	'minded',
	'people',
	'happy',
	'tester',
	'testnet',
	'luck',
	'really',
	'world',
	'mates',
	'guys',
	'so',
	'far',
	'greatest',
	'forward',
	'as',
	'excel',
	'promising',
	'always',
	'support',
	'gonna',
	'than',
	'doing',
	'by',
	'introducing',
	'doing',
	'superb',
	'smoothly',
	'transaction',
	'testing',
	'have',
	'stay',
	'tuned',
	'them',
	'earn',
	'reliable',
	'hyper',
	'idea',
	'y',
	'most',
	'popular',
	'crypto',
	'platform',
	'wonderful',
	'enjoying',
	'every',
	'bit',
	'test',
	'okay',
	'bright',
	'rock',
	'your',
	'perfect',
	'me',
	'me',
	'im',
	'bullish',
	'joining',
	'seeking',
	'inspiration',
	'from',
	'minds',
	'within',
	'because',
	'thrive',
	'that',
	'coming',
	'market',
	'roll',
	'simplicity',
	'hopeful',
	'expect',
	'continue',
	'kiss',
	'kudos',
	'power',
	'users',
	'appreciate',
	'everything',
	'do',
	'new',
	'early',
	'beginnings',
	'feeling',
	'wavy',
	'leading',
	'together',
	'count',
	'among',
	'hopefully',
	'going',
	'seen',
	'game',
	'changer',
	'knowledge',
	'diverse',
	'super',
	'whatsup',
	'join',
	'foundation',
	'yo',
	'huge',
	'😍',
	'come',
	'hope',
	'can',
	'feel',
	'trust',
	'there',
	'things',
	'see',
	'dear',
	'job',
	'safe',
	'security',
	'hub',
	'changing',
	'believe',
	'should',
	'revolution',
	'drive',
	'innovation',
	'fantastic',
	'god',
	'bull',
	'incoming',
	'lovely',
	'indeed',
	'nicee',
	'x',
	'belive',
	'fly',
	'bigger',
	'then',
	'other',
	'blockchains',
	'smart',
	'complete',
	'ups',
	'biggest',
	'year',
	'keep',
	'task',
	'user',
	'make',
	'more',
	'active',
	'token',
	'wave',
	'remember',
	'words',
	'was',
	'definitely',
	'beyond',
	'dive',
	'too',
	'massive',
	'feed',
	'loved',
	'projects',
	'get',
	'along',
	'excellent',
	'frens',
	'wishing',
	'favourite',
	'yes',
	'enjoy',
	'life',
	'looks',
	'epic',
	'vibes',
	'fine',
	'meet',
	'wallet',
	'post',
	'soon',
	'wish',
	'proof',
	'respect',
	'we',
	'interested',
	'time',
	'check',
	'fast',
	'cannot',
	'wait',
	'friend',
	'fabulous',
	'bitcoin',
	'frog',
	'devs',
	'devoted',
	'transparent',
	'easy',
	'hear',
	'news',
	'think',
	'king',
	'field',
	'🚀🚀🚀',
	'try',
	'add',
	'another',
	'one',
	'thank',
	'campaign',
	'side',
	'collaboration',
	'performance',
	'app',
	'ready',
	'member',
	'cause',
	'growing',
	'up',
	'🙂',
	'could',
	'elegant',
	'executed',
	'professional',
	'head',
	'having',
	'mainview',
	'layer',
	'thanks',
	'ok',
	'work',
	'yet',
	'swift',
	'interact',
	'opportunity',
	'fellow',
	'yourself',
	'🔥🔥🔥',
	'🔥🔥🔥🔥',
	'anticipating',
	'now',
	'much',
	'funding',
	'lot',
	'trying',
	'fully',
	'loaded',
	'innovations',
	'creative',
	'exist',
	'name',
	'sounds',
	'mars',
	'champion',
	'yeah',
	'potential',
	'starknet',
	'share',
	'favorite',
	'moments',
	'passions',
	'dreams',
	'💫',
	'smoothest',
	'use',
	'friendly',
	'both',
	'mobile',
	'pc',
	'loving',
	'officially',
	'launched',
	'venomtestnet',
	'create',
	'communication',
	'apps',
	'building',
	'lego',
	'set',
	'multichain',
	'begin',
	'journey',
	'website',
	'ui',
	'ux',
	'design',
	'sure',
	'watch',
	'out',
	'coin',
	'pro',
	'lambo',
	'space',
	'cheers',
	'revive',
	'space',
	'management',
	'highly',
	'organised',
	'focus',
	'expansion',
	'growth',
	'being',
	'😊',
	'pioneers',
	'possibilities',
	'endless',
	'social',
	'famous',
	'thus',
	'look',
	'simple',
	'choice',
	'inevitable',
	'upcoming',
	'accumulate',
	'shot',
	'accurate',
	'contribute',
	'their',
	'mostly',
	'totally',
	'likely',
	'improvement',
	'only',
	'way',
	'venomous',
	'well',
	'making',
	'progress',
	'quickly',
	'potentials',
	'blessed',
	'honour',
	'media',
	'many',
	'solid',
	'🌙',
	'successful',
	'career',
	'prosperity',
	'call',
	'baby',
	'used',
	'take',
	'off',
	'🚀',
	'years',
	'bros',
	'sis',
	'viva',
	'starting',
	'quest',
	'today',
	'venomites',
	'fire',
	'evening',
	'full',
	'privacy',
	'e',
	'encryption',
	'sign',
];

const goodWordsSet = new Set(goodWords);

export function isGoodPost(text: string) {
	const words = text
		.toLowerCase()
		.split(/[^a-zA-Z\u00C0-\u1FFF\u2800-\uFFFD]+/g)
		.map(t => t.trim())
		.filter(t => !!t);
	return words.length === 0 || words.every(w => goodWordsSet.has(w));
}

export function getNotGoodWords(text: string) {
	const words = text
		.toLowerCase()
		.split(/[^a-zA-Z\u00C0-\u1FFF\u2800-\uFFFD]+/g)
		.map(t => t.trim())
		.filter(t => !!t);
	return words.filter(w => !goodWordsSet.has(w));
}

export async function startParser(
	data: { predefinedTexts: string[]; bannedAddresses: string[] },
	updateCache: () => Promise<void>,
	readFeed: boolean,
) {
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

	async function updateBannedAddresses() {
		const texts = await bannedAddressRepository.find();
		data.bannedAddresses = texts.map(t => t.address);
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
					let isPredefined =
						post.contentText.trim() === '' || data.predefinedTexts.some(t => post.contentText === t);
					if (!isPredefined) {
						isPredefined = isGoodPost(post.contentText);
						if (isPredefined) {
							console.log('Good post: ' + post.contentText);
						}
					}
					if (isPredefined) {
						post.isPredefined = true;
					} else {
						const isBannedAddress = data.bannedAddresses.includes(post.sender);
						const isAutobanned = isBannedAddress || shouldBeBanned(post.contentText);
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
	await updateBannedAddresses();
	await updateFeed();

	asyncTimer(async () => {
		await updatePredefinedTexts();
		await updateBannedAddresses();
	}, 10 * 1000);

	asyncTimer(async () => {
		try {
			if (readFeed) {
				const smthAdded = await updateFeed();
				if (smthAdded) {
					await updateCache();
				}
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
