import type { Uint256 } from '@ylide/sdk';
import { sha256 } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';

export const constructFeedId = (
	senderAddress: string,
	isPersonal: boolean,
	isGenericFeed: boolean,
	uniqueId: Uint256,
) => {
	const bytes = SmartBuffer.ofHexString(
		senderAddress.substring(2).toLowerCase() + '0'.repeat(63) + (isPersonal ? '1' : '0') + uniqueId,
	).bytes;

	const composedFeedId = new SmartBuffer(sha256(bytes)).toHexString();

	return composedFeedId as Uint256;
};

export const constructPersonalFeedId = (senderAddress: string, feedId: Uint256) => {
	return constructFeedId(senderAddress, true, false, feedId);
};

export const constructPublicFeedId = (senderAddress: string, uniqueId: Uint256) => {
	return constructFeedId(senderAddress, false, false, uniqueId);
};

export const constructGenericFeedId = (feedId: Uint256) => {
	return constructFeedId('0x0000000000000000000000000000000000000000', false, true, feedId);
};
