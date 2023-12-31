import { inspect } from 'util';

export async function retry<T>(callback: () => Promise<T>, maxRetries: number = 10): Promise<T> {
	let retries = 0;
	while (retries < maxRetries) {
		try {
			return await callback();
		} catch (err) {
			console.error(err);
			console.error(inspect(err, true, 10, true));
			retries++;
		}
	}
	throw new Error('Max retries exceeded');
}
