import { asyncTimer } from '@ylide/sdk';
import { predefinedTextRepository } from '../database';

export let predefinedTexts: string[] = [];

export const updatePredefinedTexts = async () => {
	const texts = await predefinedTextRepository.find();
	predefinedTexts = texts.map(t => t.text);
};

asyncTimer(async () => {
	await updatePredefinedTexts();
}, 10 * 1000);
