import sequelize from '../config/database';
import testimonialsMigration from './001-create-testimonials';

const runMigrations = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();

    await testimonialsMigration.up(queryInterface);

    console.log('Migration testimonials berhasil dijalankan');
    await sequelize.close();
  } catch (error) {
    console.error('Migration gagal:', error);
    process.exit(1);
  }
};

runMigrations();