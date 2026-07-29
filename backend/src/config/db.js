const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartplant',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Verifica la conexión al iniciar el servidor
async function verificarConexion() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conectado a MySQL correctamente');
    conn.release();
  } catch (error) {
    console.error('❌ Error al conectar a MySQL:', error.message);
    process.exit(1);
  }
}

/**
 * Crea automáticamente las tablas que se agregaron después de la instalación
 * inicial (ej. diagnosticos_ia del Asistente IA), para que el usuario no
 * tenga que ejecutar database.sql manualmente cada vez que se agrega una
 * funcionalidad nueva. Usa CREATE TABLE IF NOT EXISTS, así que es seguro
 * ejecutarlo en cada arranque del backend (no borra ni modifica datos
 * existentes).
 */
async function asegurarTablasRecientes() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnosticos_ia (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          dispositivo_id INT NOT NULL,
          tipo ENUM('manual', 'automatica') NOT NULL DEFAULT 'manual',
          diagnostico TEXT NOT NULL,
          recomendaciones TEXT NULL,
          tendencia VARCHAR(30) NULL,
          humedad_actual DECIMAL(5,2) NULL,
          creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE,
          INDEX idx_usuario_fecha (usuario_id, creado_en)
      )
    `);
    console.log('✅ Tabla diagnosticos_ia verificada/creada correctamente');
  } catch (error) {
    console.error('❌ No se pudo verificar/crear la tabla diagnosticos_ia:', error.message);
  }
}

module.exports = { pool, verificarConexion, asegurarTablasRecientes };
