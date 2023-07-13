import { IMessageContent, MessageContainer, MessageBlob } from '@ylide/sdk';

export const decryptBroadcastContent = (content: IMessageContent) => {
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
};
