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

export async function init() {
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

	//

	return { controller };
}
