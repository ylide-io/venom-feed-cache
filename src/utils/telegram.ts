import fetch from 'node-fetch';

export async function sendTGAlert(message: string): Promise<void> {
	const token = process.env.TELEGRAM_ALERT_TOKEN as string;

	let escaped = '';
	for (let i = 0; i < message.length; i++) {
		const char = message[i];
		if (char.charCodeAt(0) > 127) {
			escaped += message[i];
		} else {
			escaped += '\\' + message[i];
		}
	}

	fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=-815119072&text=${escaped}&parse_mode=MarkdownV2`);
}
