import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { GLOBAL_VENOM_FEED_ID } from '../constants';

@Entity()
@Index(['banned', 'feedId', 'createTimestamp'])
export class VenomFeedPostEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string;

	@Column({ type: 'int' })
	@Index()
	createTimestamp!: number;

	@Column({ type: 'varchar', length: 255, default: GLOBAL_VENOM_FEED_ID })
	@Index()
	feedId!: string;

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
}
