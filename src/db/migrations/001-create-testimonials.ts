import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'testimonials';

export default {
  async up(queryInterface: QueryInterface) {
    // Aman dijalankan ulang: lewati kalau tabel sudah ada.
    const tables = await queryInterface.showAllTables();
    if (tables.includes(TABLE)) {
      console.log(`Tabel ${TABLE} sudah ada, dilewati.`);
      return;
    }

    await queryInterface.createTable(TABLE, {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.STRING(30), allowNull: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};