import 'reflect-metadata';
import { DataSource } from 'typeorm';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

export default new DataSource({
  type: 'postgres',
  url,
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
