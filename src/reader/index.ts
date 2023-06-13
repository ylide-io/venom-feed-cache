import express from 'express';
import bodyParser from 'body-parser';
import { DataSource } from 'typeorm';
import cors from 'cors';

export async function startReader(port: number, db: DataSource) {
	const app = express();

	const whitelist = [];
	app.use(
		cors({
			credentials: true,
			origin: function (origin, callback) {
				if (true || whitelist.indexOf(origin) !== -1) {
					callback(null, true);
				} else {
					callback(new Error('Not allowed by CORS'));
				}
			},
		}),
	);

	app.use(bodyParser.text());
	app.use(bodyParser.json());

	app.get('/ping', async (req, res) => {
		try {
			return res.end('PONG');
		} catch {
			return res.end('NO-PONG');
		}
	});

	app.listen(port, () => {
		console.log(`Reader is listening on ${port}`);
	});
}
