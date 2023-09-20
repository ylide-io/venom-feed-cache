module.exports = {
	apps: [
		{
			name: 'reader',
			script: './build/index.js',
			instances: 'max',
			exec_mode: 'cluster',
			max_memory_restart: '1200M',
			node_args: ['--max-old-space-size=1024'],
			env: {
				READER: 'true',
			},
		},
		{
			name: 'parser',
			script: './build/index.js',
			max_memory_restart: '1200M',
			node_args: ['--max-old-space-size=1024'],
			env: {
				PARSER: 'true',
			},
		},
	],
};
