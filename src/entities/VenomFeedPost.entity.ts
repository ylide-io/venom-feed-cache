import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { GLOBAL_VENOM_FEED_ID } from '../constants';

@Entity()
@Index(['banned', 'feedId', 'createTimestamp'])
@Index(['banned', 'originalFeedId', 'createTimestamp'])
export class VenomFeedPostEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string;

	@Column({ type: 'int' })
	@Index()
	createTimestamp!: number;

	@Column({ type: 'varchar', length: 255, default: null, nullable: true })
	@Index()
	feedId!: string | null;

	@Column({ type: 'varchar', length: 255 })
	@Index()
	originalFeedId!: string;

	@Column({ type: 'varchar', length: 255, default: 'venom-testnet' })
	@Index()
	blockchain!: string;

	@Column({ type: 'text' })
	sender!: string;

	@Column({ type: 'jsonb' })
	meta!: any;

	@Column({ type: 'jsonb', nullable: true, default: null })
	content!: any | null;

	@Column({ type: 'text', default: '', nullable: false })
	contentText!: string;

	@Column({ type: 'boolean', default: false, nullable: false })
	banned!: boolean;

	@Column({ type: 'boolean', default: false, nullable: false })
	isAutobanned!: boolean;

	@Column({ type: 'boolean', default: false, nullable: false })
	isPredefined!: boolean;

	@Column({ type: 'boolean', default: false, nullable: false })
	isApproved!: boolean;

	@Column({ type: 'boolean', default: true, nullable: false })
	isComissionValid!: boolean;

	@Column({ type: 'double precision', default: 0, nullable: false })
	extraPayment!: string;

	@Column({ type: 'varchar', length: 255, default: '', nullable: false })
	contractAddress!: string;
}
