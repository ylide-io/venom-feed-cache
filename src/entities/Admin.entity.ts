import { Column, Entity, Index, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { GLOBAL_VENOM_FEED_ID } from '../constants';

@Entity()
export class AdminEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'int' })
	createTimestamp!: number;

	@Column({ type: 'varchar', length: 255, nullable: false, default: '' })
	password!: string;

	@Column({ type: 'varchar', length: 255, default: GLOBAL_VENOM_FEED_ID })
	@Index()
	feedId!: string;

	@Column({ type: 'varchar', length: 255, nullable: false })
	address!: string;

	@Column({ type: 'varchar', length: 255, nullable: false, default: '' })
	title!: string;

	@Column({ type: 'varchar', length: 255, nullable: false, default: 'Mod' })
	rank!: string;

	@Column({ type: 'varchar', length: 10, nullable: false, default: '' })
	emoji!: string;

	@Column({ type: 'varchar', length: 60, nullable: false, default: 'admin' })
	role!: 'admin';
}
