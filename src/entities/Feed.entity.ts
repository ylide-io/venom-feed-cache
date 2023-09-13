import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class FeedEntity {
	@PrimaryColumn({ type: 'varchar', length: 255 })
	feedId!: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	parentFeedId!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	evmFeedId!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	tvmFeedId!: string | null;

	@Column({ type: 'varchar', length: 255 })
	title!: string;

	@Column({ type: 'text' })
	description!: string;

	@Column({ type: 'varchar', length: 512, nullable: true })
	logoUrl!: string | null;

	@Column({ type: 'boolean', default: false })
	isHighlighted!: boolean;

	@Column({ type: 'boolean', default: false })
	isHidden!: boolean;

	@Column({ type: 'jsonb', default: '{}' })
	comissions!: Record<string, string>;
}
