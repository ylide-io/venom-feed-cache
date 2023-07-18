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

export async function initTvmControllers() {
	Object.assign(core, coreDeepCopy);

	const venomProvider = await EverscaleStandaloneClient.create({
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

	const venomController = new EverscaleBlockchainController({
		type: 'venom-testnet',
		endpoints: ['https://gql-testnet.venom.foundation/graphql'],
		provider: venomProvider,
		nekotonCore: core,
	});

	const everscaleProvider = await EverscaleStandaloneClient.create({
		connection: {
			id: 1,
			group: 'mainnet',
			type: 'graphql',
			data: {
				local: false,
				endpoints: ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'],
			},
		},
	});

	const everscaleController = new EverscaleBlockchainController({
		type: 'everscale-mainnet',
		endpoints: ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'],
		provider: everscaleProvider,
		nekotonCore: core,
	});

	//

	return { venomController, everscaleController };
}
