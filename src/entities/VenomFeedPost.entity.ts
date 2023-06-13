import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';

@Entity()
export class VenomFeedPostEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string;

	@Column({ type: 'int' })
	@Index()
	createTimestamp!: number;

	@Column({ type: 'text' })
	sender!: string;

	@Column({ type: 'jsonb' })
	meta!: any;

	@Column({ type: 'jsonb' })
	content!: any;
}
