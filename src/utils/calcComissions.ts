export const calcComissions = (blockchain: string, comissions: Record<string, string>[]): string => {
	const filteredComissions = comissions.map(c => c[blockchain] || '0');
	const comission = filteredComissions.reduce((acc, curr) => {
		return acc + Number(curr);
	});
	return String(comission);
};

const stripLeadingZeros = (str: string): string => {
	if (str.includes('.')) {
		const [integer, fraction] = str.split('.');
		return `${stripLeadingZeros(integer)}.${fraction}`;
	} else {
		while (str.startsWith('0')) {
			str = str.slice(1);
		}
		return str ? str : '0';
	}
};

const stripTrailingZeros = (str: string): string => {
	if (str.includes('.')) {
		const [integer, fraction] = str.split('.');
		return `${integer}.${stripTrailingZeros(fraction)}`;
	} else {
		while (str.endsWith('0')) {
			str = str.slice(0, -1);
		}
		return str ? str : '0';
	}
};

export const calcComissionDecimals = (comission: string, decimals: number): string => {
	if (comission.includes('.')) {
		const [integer, fraction] = comission.split('.');
		if (fraction.length > decimals) {
			return stripLeadingZeros(`${integer}${fraction.slice(0, decimals)}.${fraction.slice(decimals)}`);
		} else {
			return stripLeadingZeros(`${integer}${fraction}${'0'.repeat(decimals - fraction.length)}`);
		}
	} else {
		if (comission === '0') {
			return '0';
		} else {
			return stripLeadingZeros(`${comission}${'0'.repeat(decimals)}`);
		}
	}
};

export const compareInts = (a: string, b: string): number => {
	if (a === b) {
		return 0;
	} else {
		if (a.length === b.length) {
			return a > b ? 1 : -1;
		} else {
			return a.length > b.length ? 1 : -1;
		}
	}
};

export const compareFracts = (a: string, b: string): number => {
	if (a.length > b.length) {
		b = b + '0'.repeat(a.length - b.length);
	} else if (a.length < b.length) {
		a = a + '0'.repeat(b.length - a.length);
	}
	if (a === b) {
		return 0;
	} else {
		return a > b ? 1 : -1;
	}
};

export const isComissionGreaterOrEqualsThan = (a: string, b: string): boolean => {
	let [aInt, aFrac] = a.split('.');
	let [bInt, bFrac] = b.split('.');
	const ints = compareInts(aInt, bInt);
	if (ints === 0) {
		aFrac = aFrac || '0';
		bFrac = bFrac || '0';
		const fracts = compareFracts(aFrac, bFrac);
		return fracts >= 0;
	} else {
		return ints >= 0;
	}
};
