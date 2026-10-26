import { QueryInterface } from 'sequelize';

const DATA = [
  {
    user_id: null,
    name: 'Rina Wulandari',
    message: 'Kelas tari topeng di sini seru dan pengajarnya sabar.',
  },
  {
    user_id: null,
    name: 'Budi Santoso',
    message: 'Topeng pesanan saya selesai tepat waktu dan hasilnya bagus.',
  },
  {
    user_id: null,
    name: 'Dewi Lestari',
    message: 'Pertunjukan di sanggar ini layak ditonton bersama keluarga.',
  },
];

export default {
  async up(queryInterface: QueryInterface) {
    // Aman dijalankan ulang: hanya memasukkan data yang belum ada.
    const [rows] = (await queryInterface.sequelize.query(
      'SELECT message FROM testimonials'
    )) as [{ message: string }[], unknown];
    const sudahAda = new Set(rows.map((r) => r.message));

    const baru = DATA.filter((d) => !sudahAda.has(d.message)).map((d) => ({
      ...d,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    if (baru.length === 0) {
      console.log('Data testimonials sudah ada, dilewati.');
      return;
    }
    await queryInterface.bulkInsert('testimonials', baru);
  },

  async down(queryInterface: QueryInterface) {
    // Hanya menghapus data seeder ini, bukan seluruh tabel.
    await queryInterface.bulkDelete('testimonials', {
      message: DATA.map((d) => d.message),
    });
  },
};