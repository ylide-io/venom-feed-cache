import { asymmetricDecrypt, IndexerHub } from '@ylide/sdk';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthorizationPayload } from '../types';

const fromHexToUint8 = (s: string) => new Uint8Array(Buffer.from(s, 'hex'));

export const authenticationFactory = () => {
	const YLIDE_PRIVATE_KEY = process.env.YLIDE_PRIVATE_KEY;
	if (!YLIDE_PRIVATE_KEY) {
		throw Error('YLIDE_PRIVATE_KEY is undefined');
	}
	const JWT_KEY = process.env.JWT_KEY;
	if (!JWT_KEY) {
		throw Error('JWT_KEY is undefined');
	}

	const ylidePrivateKey = new Uint8Array(Buffer.from(YLIDE_PRIVATE_KEY, 'hex'));

	const indexerHub = new IndexerHub();

	const isBytesEqual = (a: Uint8Array, b: Uint8Array) => {
		return a.length === b.length && a.every((v, i) => v === b[i]);
	};

	return async ({ messageEncrypted, publicKey, address: addressRaw }: AuthorizationPayload) => {
		const address = addressRaw.toLowerCase();
		try {
			const publicKeysForAddress = Object.values(
				await indexerHub.retryingOperation(
					() => indexerHub.requestKeys(address),
					async () =>
						({}) as Record<
							string,
							{
								block: number;
								keyVersion: number;
								publicKey: Uint8Array;
								timestamp: number;
								registrar: number;
							}
						>,
				),
			);
			const pK = fromHexToUint8(publicKey);
			if (!publicKeysForAddress.find(pk => isBytesEqual(pk.publicKey, pK))) {
				return null;
			}

			const data = asymmetricDecrypt(fromHexToUint8(messageEncrypted), ylidePrivateKey, pK);
			const content = JSON.parse(new TextDecoder('utf-8').decode(data));
			if (content.address !== address || content.timestamp < Date.now() - 300_000) {
				return null;
			} else {
				return jwt.sign(address, JWT_KEY);
			}
		} catch (err) {
			console.log(err);
			return null;
		}
	};
};

export function isValidAddress(address: string): boolean {
	return Boolean(address.match(/^0x[a-f0-9]{40}$/)) || Boolean(address.match(/^0:[a-f0-9]{64}$/));
}

export const authorizationFactory = () => {
	const JWT_KEY = process.env.JWT_KEY;
	if (!JWT_KEY) {
		throw Error('JWT_KEY is undefined');
	}
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const bearerHeader = req.headers['authorization'];
			if (bearerHeader) {
				const bearer = bearerHeader.split(' ');
				const bearerToken = bearer[1];
				const address = jwt.verify(bearerToken, JWT_KEY) as string;
				if (isValidAddress(address)) {
					// @ts-ignore
					req.userAddress = address;
					return next();
				}
			}
		} catch (e) {
			console.log(e);
		}
		return res.status(403).json({ error: 'Unauthorized' });
	};
};
