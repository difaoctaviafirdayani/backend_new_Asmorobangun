import sequelize from '../config/database';
import testimonialsSeeder from './001-seed-testimonials';

const runSeeders = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();

    await testimonialsSeeder.up(queryInterface);

    console.log('Seeder testimonials berhasil dijalankan');
    await sequelize.close();
  } catch (error) {
    console.error('Seeder gagal:', error);
    process.exit(1);
  }
};

runSeeders();