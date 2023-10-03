import { Column, Entity, Index, JoinTable, ManyToMany, OneToMany, PrimaryColumn } from 'typeorm';
import { FeedPostReactionEntity } from './FeedPostReaction.entity';
import { HashtagEntity } from './Hashtag.entity';

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

	@OneToMany(() => FeedPostReactionEntity, reaction => reaction.post)
	reactions!: FeedPostReactionEntity[];

	@ManyToMany(() => HashtagEntity, hashtag => hashtag.posts, { cascade: true })
	@JoinTable()
	hashtags!: HashtagEntity[] | string[];
}
