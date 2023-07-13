import { asyncTimer } from '@ylide/sdk';
import { bannedAddressRepository } from '../database';

export let bannedAddresses: string[] = [];

export const updateBannedAddresses = async () => {
	const texts = await bannedAddressRepository.find();
	bannedAddresses = texts.map(t => t.address);
};

asyncTimer(async () => {
	await updateBannedAddresses();
}, 10 * 1000);
