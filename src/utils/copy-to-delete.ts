import type { Uint256 } from '@ylide/sdk';
import { sha256, uint256ToUint8Array } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';

export const constructFeedId = (
	senderAddress: string,
	isPersonal: boolean,
	isGenericFeed: boolean,
	uniqueId: Uint256,
) => {
	const bytes = SmartBuffer.ofHexString(
		senderAddress.substring(2).toLowerCase() +
			'0'.repeat(63) +
			(isGenericFeed ? '2' : isPersonal ? '1' : '0') +
			uniqueId,
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

export const constructGenericEvmFeedId = (feedId: Uint256) => {
	return constructFeedId('0x0000000000000000000000000000000000000000', false, true, feedId);
};

export const constructGenericTvmFeedId = (feedId: Uint256, count: number) => {
	const sb = SmartBuffer.ofSize(32 + 4);
	sb.writeBytes(uint256ToUint8Array(feedId));
	sb.writeUint32(count);
	return new SmartBuffer(sha256(sb.bytes)).toHexString() as Uint256;
};
